"""Transactions Manual CRUD & History Router."""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import NoResultFound

from rezekify.api.deps import get_current_user, get_db
from rezekify.db.models import EntryType, Transaction, User
from rezekify.services.ledger import LedgerService

transactions_router = APIRouter()


class LedgerEntryResponse(BaseModel):
    id: UUID
    account_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    vault_id: Optional[UUID] = None
    entry_type: EntryType
    amount: Decimal

    model_config = ConfigDict(from_attributes=True)


class TransactionItemResponse(BaseModel):
    id: UUID
    description: str
    source_channel: str
    transaction_date: datetime
    raw_input_text: Optional[str] = None
    receipt_image_url: Optional[str] = None
    ledger_entries: List[LedgerEntryResponse] = []

    model_config = ConfigDict(from_attributes=True)


class TransactionCreateRequest(BaseModel):
    transaction_type: str = "EXPENSE"  # EXPENSE, INCOME, TRANSFER
    amount: Decimal
    description: str
    account_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    from_account_id: Optional[UUID] = None
    to_account_id: Optional[UUID] = None
    source_channel: str = "WEB_MANUAL"


class TransactionUpdateRequest(BaseModel):
    amount: Decimal
    description: str
    account_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    to_account_id: Optional[UUID] = None
    transaction_date: Optional[datetime] = None
    from_account_id: Optional[UUID] = None
    transaction_type: Optional[str] = None


@transactions_router.get("", response_model=List[TransactionItemResponse])
@transactions_router.get("/", response_model=List[TransactionItemResponse])
def list_transactions(
    limit: int = Query(default=50, ge=1, le=100, description="Max number of transactions to return (1-100)."),
    offset: int = Query(default=0, ge=0, description="Number of transactions to skip for pagination."),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists historical transactions with ledger entries for the user."""
    return (
        db.query(Transaction)
        .filter(Transaction.user_id == current_user.id)
        .order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@transactions_router.post("", response_model=TransactionItemResponse)
@transactions_router.post("/", response_model=TransactionItemResponse)
def create_transaction(
    req: TransactionCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Creates a manual transaction (expense, income, or transfer) using LedgerService."""
    ledger = LedgerService(db)
    tt = req.transaction_type.upper()
    try:
        if tt == "EXPENSE":
            if not req.account_id:
                raise ValueError("account_id is required for expense.")
            return ledger.record_expense(
                user_id=current_user.id,
                account_id=req.account_id,
                category_id=req.category_id,
                amount=req.amount,
                description=req.description,
                source_channel=req.source_channel,
            )
        elif tt == "INCOME":
            if not req.account_id:
                raise ValueError("account_id is required for income.")
            return ledger.record_income(
                user_id=current_user.id,
                account_id=req.account_id,
                category_id=req.category_id,
                amount=req.amount,
                description=req.description,
                source_channel=req.source_channel,
            )
        elif tt == "TRANSFER":
            from_acc = req.from_account_id or req.account_id
            if not from_acc or not req.to_account_id:
                raise ValueError("from_account_id and to_account_id are required for transfer.")
            return ledger.record_transfer(
                user_id=current_user.id,
                from_account_id=from_acc,
                to_account_id=req.to_account_id,
                amount=req.amount,
                description=req.description,
            )
        else:
            raise ValueError(f"Unsupported transaction type: {req.transaction_type}")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@transactions_router.put("/{transaction_id}", response_model=TransactionItemResponse)
def update_transaction(
    transaction_id: UUID,
    req: TransactionUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates an existing transaction, deterministically reconciling account balances."""
    ledger = LedgerService(db)
    try:
        tx = ledger.update_transaction(
            user_id=current_user.id,
            transaction_id=transaction_id,
            amount=req.amount,
            description=req.description,
            account_id=req.account_id,
            category_id=req.category_id,
            to_account_id=req.to_account_id,
            transaction_date=req.transaction_date,
            from_account_id=req.from_account_id,
            transaction_type=req.transaction_type,
        )
        return tx
    except NoResultFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@transactions_router.delete("/{transaction_id}")
def delete_transaction_endpoint(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes transaction and deterministically reverses balance modifications."""
    ledger = LedgerService(db)
    try:
        ledger.delete_transaction(user_id=current_user.id, transaction_id=transaction_id)
        return {"detail": "Transaction deleted and balance reversed."}
    except NoResultFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
