"""Accounts Management Router."""

from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from rezekify.api.deps import get_current_user, get_db
from rezekify.db.models import Account, AccountType, User

accounts_router = APIRouter()


class AccountCreateRequest(BaseModel):
    name: str
    account_type: AccountType
    initial_balance: Decimal = Decimal("0.00")


class AccountUpdateRequest(BaseModel):
    name: Optional[str] = None
    account_type: Optional[AccountType] = None


class AccountResponse(BaseModel):
    id: UUID
    name: str
    account_type: AccountType
    current_balance: Decimal
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


@accounts_router.get("", response_model=List[AccountResponse])
@accounts_router.get("/", response_model=List[AccountResponse])
def list_accounts(
    include_inactive: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists holding accounts for the authenticated user."""
    query = db.query(Account).filter(Account.user_id == current_user.id)
    if not include_inactive:
        query = query.filter(Account.is_active == True)
    return query.all()


@accounts_router.post("", response_model=AccountResponse)
@accounts_router.post("/", response_model=AccountResponse)
def create_account(
    req: AccountCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Creates a new cash/bank/ewallet account bucket."""
    acc = Account(
        user_id=current_user.id,
        name=req.name.strip(),
        account_type=req.account_type,
        current_balance=req.initial_balance,
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return acc


@accounts_router.put("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: UUID,
    req: AccountUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = db.query(Account).filter_by(id=account_id, user_id=current_user.id).one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Rekening tidak ditemukan.")

    if req.name is not None and req.name.strip():
        account.name = req.name.strip()
    if req.account_type is not None:
        account.account_type = req.account_type

    db.commit()
    db.refresh(account)
    return account


@accounts_router.delete("/{account_id}")
def deactivate_account(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = db.query(Account).filter_by(id=account_id, user_id=current_user.id).one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Rekening tidak ditemukan.")

    account.is_active = False
    db.commit()
    return {"detail": "Rekening berhasil dinonaktifkan."}
