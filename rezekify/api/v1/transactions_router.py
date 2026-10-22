"""Transactions Manual CRUD & History Router."""

import csv
from datetime import datetime
from decimal import Decimal
import io
import math
from typing import List, Optional, Union
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.orm.exc import NoResultFound

from rezekify.api.deps import get_current_user, get_db
from rezekify.db.models import (
    Account,
    Category,
    EntryType,
    LedgerEntry,
    Transaction,
    User,
    Vault,
    VaultType,
)
from rezekify.schemas.transaction import (
    LedgerEntryResponse,
    PaginatedTransactionsResponse,
    TransactionCreateRequest,
    TransactionItemResponse,
    TransactionUpdateRequest,
)
from rezekify.services.ledger import LedgerService
from rezekify.services.vault_reconciliation import VaultReconciliationService

__all__ = [
    "transactions_router",
    "LedgerEntryResponse",
    "PaginatedTransactionsResponse",
    "TransactionCreateRequest",
    "TransactionItemResponse",
    "TransactionUpdateRequest",
]

transactions_router = APIRouter()


@transactions_router.get("", response_model=Union[PaginatedTransactionsResponse, List[TransactionItemResponse]])
@transactions_router.get("/", response_model=Union[PaginatedTransactionsResponse, List[TransactionItemResponse]])
def list_transactions(
    account_id: Optional[UUID] = Query(default=None),
    category_id: Optional[UUID] = Query(default=None),
    search: Optional[str] = Query(default=None),
    start_date: Optional[datetime] = Query(default=None),
    end_date: Optional[datetime] = Query(default=None),
    page: Optional[int] = Query(default=None, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    limit: int = Query(default=50, ge=1, le=100, description="Max number of transactions to return (1-100)."),
    offset: int = Query(default=0, ge=0, description="Number of transactions to skip for pagination."),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists historical transactions with ledger entries, optional filtering, and pagination."""
    query = (
        db.query(Transaction)
        .options(selectinload(Transaction.ledger_entries))
        .filter(Transaction.user_id == current_user.id)
    )

    if account_id is not None:
        query = query.filter(Transaction.ledger_entries.any(LedgerEntry.account_id == account_id))

    if category_id is not None:
        query = query.filter(Transaction.ledger_entries.any(LedgerEntry.category_id == category_id))

    if search and search.strip():
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Transaction.description.ilike(search_term),
                Transaction.raw_input_text.ilike(search_term),
            )
        )

    if start_date is not None:
        query = query.filter(Transaction.transaction_date >= start_date)

    if end_date is not None:
        query = query.filter(Transaction.transaction_date <= end_date)

    query = query.distinct()
    total = query.count()
    query = query.order_by(Transaction.transaction_date.desc(), Transaction.id.desc())

    if page is not None:
        items = query.offset((page - 1) * page_size).limit(page_size).all()
        total_pages = math.ceil(total / page_size) if total > 0 else 1
        return PaginatedTransactionsResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    # Backward compatibility for legacy tests and callers
    return query.offset(offset).limit(limit).all()


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
            # ponytail: sequential vault lookup and settlement in route handler; move to an event-driven post-transaction background task if latency increases.
            if req.vault_id:
                vault = (
                    db.query(Vault)
                    .filter_by(id=req.vault_id, user_id=current_user.id)
                    .one_or_none()
                )
                if not vault:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Pos tagihan (vault) tidak ditemukan.",
                    )
                if vault.vault_type != VaultType.FIXED_BILL:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Hanya pos tagihan (FIXED_BILL) yang dapat dihubungkan ke transaksi.",
                    )
                tx = ledger.record_expense(
                    user_id=current_user.id,
                    account_id=req.account_id,
                    category_id=req.category_id,
                    amount=req.amount,
                    description=req.description,
                    source_channel=req.source_channel,
                    transaction_date=req.transaction_date,
                    vault_id=vault.id,
                )
                ledger.reconcile_fixed_bill_vault(
                    user_id=current_user.id,
                    vault=vault,
                    transaction=tx,
                    amount=req.amount,
                )
                db.refresh(tx)
                return tx
            else:
                tx = ledger.record_expense(
                    user_id=current_user.id,
                    account_id=req.account_id,
                    category_id=req.category_id,
                    amount=req.amount,
                    description=req.description,
                    source_channel=req.source_channel,
                    transaction_date=req.transaction_date,
                )
                recon_service = VaultReconciliationService(db)
                vault = recon_service.find_matching_fixed_bill_vault(
                    user_id=current_user.id,
                    description=req.description,
                    amount=req.amount,
                )
                if vault:
                    ledger.reconcile_fixed_bill_vault(
                        user_id=current_user.id,
                        vault=vault,
                        transaction=tx,
                        amount=req.amount,
                    )
                    db.refresh(tx)
                return tx
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
                transaction_date=req.transaction_date,
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
                transaction_date=req.transaction_date,
            )
        else:
            raise ValueError(f"Unsupported transaction type: {req.transaction_type}")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


def sanitize_csv_cell(value: Optional[str]) -> str:
    """Escapes strings to prevent spreadsheet formula injection (CWE-1236)."""
    if not value:
        return "-"
    cleaned = str(value).strip()
    if not cleaned or cleaned == "-":
        return "-"
    if cleaned.startswith(("=", "+", "-", "@", "\t", "\r")):
        return f"'{cleaned}"
    return cleaned


def parse_query_datetime(val: Optional[Union[datetime, str]]) -> Optional[datetime]:
    """Parses optional ISO query datetime string, tolerating URL-decoded timezone '+' spaces."""
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    cleaned = str(val).strip()
    try:
        return datetime.fromisoformat(cleaned)
    except ValueError:
        if " " in cleaned:
            parts = cleaned.rsplit(" ", 1)
            if len(parts) == 2 and (":" in parts[1] or len(parts[1]) in (2, 4)):
                try:
                    return datetime.fromisoformat(f"{parts[0]}+{parts[1]}")
                except ValueError:
                    pass
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid datetime format: {val}",
        )


def map_transaction_to_csv_row(
    tx: Transaction,
    user_accounts: dict[UUID, str],
    user_categories: dict[UUID, str],
    account_balances: dict[UUID, Decimal],
) -> list[str]:
    """Deterministically maps a Transaction and its LedgerEntries into a CSV row."""
    debit_entries = [e for e in tx.ledger_entries if e.entry_type == EntryType.DEBIT]
    credit_entries = [e for e in tx.ledger_entries if e.entry_type == EntryType.CREDIT]

    debit_entry = debit_entries[0] if debit_entries else None
    credit_entry = credit_entries[0] if credit_entries else None

    tx_type = "PENGELUARAN"
    cat_name = "-"
    source_acc = "-"
    target_acc = "-"
    amount = Decimal("0.00")
    balance = Decimal("0.00")

    if credit_entry and credit_entry.account_id and debit_entry and debit_entry.category_id:
        # EXPENSE: Credit Account, Debit Category
        tx_type = "PENGELUARAN"
        source_acc = user_accounts.get(credit_entry.account_id, "-")
        target_acc = "-"
        cat_name = user_categories.get(debit_entry.category_id, "-")
        amount = debit_entry.amount
        balance = account_balances.get(credit_entry.account_id, Decimal("0.00"))
    elif debit_entry and debit_entry.account_id and credit_entry and credit_entry.category_id:
        # INCOME: Debit Account, Credit Category
        tx_type = "PEMASUKAN"
        source_acc = "-"
        target_acc = user_accounts.get(debit_entry.account_id, "-")
        cat_name = user_categories.get(credit_entry.category_id, "-")
        amount = debit_entry.amount
        balance = account_balances.get(debit_entry.account_id, Decimal("0.00"))
    elif credit_entry and credit_entry.account_id and debit_entry and debit_entry.account_id:
        # TRANSFER: Credit FromAccount, Debit ToAccount
        tx_type = "TRANSFER"
        source_acc = user_accounts.get(credit_entry.account_id, "-")
        target_acc = user_accounts.get(debit_entry.account_id, "-")
        cat_name = "-"
        amount = debit_entry.amount
        balance = account_balances.get(credit_entry.account_id, Decimal("0.00"))
    elif debit_entry:
        amount = debit_entry.amount
    elif credit_entry:
        amount = credit_entry.amount

    date_str = tx.transaction_date.strftime("%Y-%m-%d %H:%M:%S") if tx.transaction_date else "-"
    nominal_str = f"{amount:.2f}"
    saldo_str = f"{balance:.2f}"

    return [
        date_str,
        tx_type,
        sanitize_csv_cell(cat_name),
        sanitize_csv_cell(source_acc),
        sanitize_csv_cell(target_acc),
        sanitize_csv_cell(tx.description),
        nominal_str,
        saldo_str,
    ]


@transactions_router.get("/export")
def export_transactions_csv(
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    account_id: Optional[UUID] = Query(default=None),
    category_id: Optional[UUID] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Streams transaction history in CSV format with formula injection defenses and tenant isolation."""
    parsed_start = parse_query_datetime(start_date)
    parsed_end = parse_query_datetime(end_date)

    query = (
        db.query(Transaction)
        .options(selectinload(Transaction.ledger_entries))
        .filter(Transaction.user_id == current_user.id)
    )

    if account_id is not None:
        query = query.filter(Transaction.ledger_entries.any(LedgerEntry.account_id == account_id))

    if category_id is not None:
        query = query.filter(Transaction.ledger_entries.any(LedgerEntry.category_id == category_id))

    if parsed_start is not None:
        query = query.filter(Transaction.transaction_date >= parsed_start)

    if parsed_end is not None:
        query = query.filter(Transaction.transaction_date <= parsed_end)

    query = query.distinct().order_by(Transaction.transaction_date.desc(), Transaction.id.desc())

    # ponytail: in-memory lookup dicts ceiling ~10k user accounts/categories; upgrade to SQL join if volume expands
    user_accounts = {a.id: a.name for a in db.query(Account).filter_by(user_id=current_user.id).all()}
    account_balances = {a.id: a.current_balance for a in db.query(Account).filter_by(user_id=current_user.id).all()}
    user_categories = {c.id: c.name for c in db.query(Category).filter_by(user_id=current_user.id).all()}

    def generate_csv_stream():
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
        # Write Excel UTF-8 BOM
        output.write("﻿")
        writer.writerow([
            "Tanggal", "Tipe", "Kategori", "Akun Sumber",
            "Akun Tujuan", "Deskripsi", "Nominal (IDR)", "Saldo Akun"
        ])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)

        for tx in query.yield_per(500):
            row = map_transaction_to_csv_row(tx, user_accounts, user_categories, account_balances)
            writer.writerow(row)
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    now_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"rezekify_transaksi_{now_str}.csv"
    return StreamingResponse(
        generate_csv_stream(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )


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
