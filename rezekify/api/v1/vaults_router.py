"""Vaults (Sinking Funds & Fixed Commitments) Router."""

from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from rezekify.api.deps import get_current_user, get_db
from rezekify.api.v1.transactions_router import TransactionItemResponse
from rezekify.db.models import Account, Category, CategoryType, LedgerEntry, User, Vault, VaultType
from rezekify.services.ledger import LedgerService
from rezekify.services.runway import RunwayService
from rezekify.services.vault_reconciliation import advance_one_month

vaults_router = APIRouter()


class VaultCreateRequest(BaseModel):
    name: str
    vault_type: VaultType = VaultType.SAVINGS
    target_amount: Decimal
    allocated_amount: Decimal = Decimal("0.00")
    target_date: Optional[date] = None
    is_locked: bool = False


class VaultUpdateRequest(BaseModel):
    name: str
    target_amount: Decimal
    allocated_amount: Decimal
    target_date: Optional[date] = None


class VaultDepositRequest(BaseModel):
    amount: Decimal = Field(gt=0)
    source_account_id: Optional[UUID] = None


class VaultPayBillRequest(BaseModel):
    account_id: UUID
    category_id: Optional[UUID] = None
    amount: Optional[Decimal] = None
    notes: Optional[str] = None


class VaultResponse(BaseModel):
    id: UUID
    name: str
    vault_type: VaultType
    target_amount: Decimal
    allocated_amount: Decimal
    target_date: Optional[date]
    is_locked: bool

    model_config = ConfigDict(from_attributes=True)


class VaultPayBillResponse(BaseModel):
    vault: VaultResponse
    transaction: TransactionItemResponse

    model_config = ConfigDict(from_attributes=True)


@vaults_router.get("", response_model=List[VaultResponse])
@vaults_router.get("/", response_model=List[VaultResponse])
def list_vaults(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists all commitment vaults and sinking funds for the user."""
    return (
        db.query(Vault)
        .filter(Vault.user_id == current_user.id)
        .all()
    )


@vaults_router.get("/{vault_id}", response_model=VaultResponse)
def get_vault(
    vault_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves a single vault by ID."""
    vault = db.query(Vault).filter_by(id=vault_id, user_id=current_user.id).one_or_none()
    if not vault:
        raise HTTPException(status_code=404, detail="Vault tidak ditemukan.")
    return vault



@vaults_router.post("", response_model=VaultResponse)
@vaults_router.post("/", response_model=VaultResponse)
def create_vault(
    req: VaultCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Creates a new savings goal or fixed bill commitment vault."""
    vault = Vault(
        user_id=current_user.id,
        name=req.name.strip(),
        vault_type=req.vault_type,
        target_amount=req.target_amount,
        allocated_amount=req.allocated_amount,
        target_date=req.target_date,
        is_locked=req.is_locked,
    )
    db.add(vault)
    db.commit()
    db.refresh(vault)
    RunwayService.clear_cache(user_id=current_user.id)
    return vault


@vaults_router.patch("/{vault_id}/toggle-lock", response_model=VaultResponse)
def toggle_vault_lock(
    vault_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vault = db.query(Vault).filter_by(id=vault_id, user_id=current_user.id).one_or_none()
    if not vault:
        raise HTTPException(status_code=404, detail="Vault tidak ditemukan.")
    vault.is_locked = not vault.is_locked
    db.commit()
    db.refresh(vault)
    RunwayService.clear_cache(user_id=current_user.id)
    return vault


@vaults_router.post("/{vault_id}/deposit", response_model=VaultResponse)
def deposit_to_vault(
    vault_id: UUID,
    req: VaultDepositRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deposits funds into a vault, automatically securing it with a lock."""
    vault = db.query(Vault).filter_by(id=vault_id, user_id=current_user.id).one_or_none()
    if not vault:
        raise HTTPException(status_code=404, detail="Vault tidak ditemukan.")

    if req.source_account_id:
        source_acc = (
            db.query(Account)
            .filter_by(id=req.source_account_id, user_id=current_user.id)
            .one_or_none()
        )
        if not source_acc:
            raise HTTPException(status_code=404, detail="Akun sumber tidak ditemukan.")
        if source_acc.current_balance < req.amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Saldo akun tidak mencukupi untuk dialokasikan ke vault.",
            )

    vault.allocated_amount += req.amount
    vault.is_locked = True
    db.commit()
    db.refresh(vault)
    RunwayService.clear_cache(user_id=current_user.id)
    return vault


@vaults_router.post("/{vault_id}/pay-bill", response_model=VaultPayBillResponse)
def pay_bill_vault(
    vault_id: UUID,
    req: VaultPayBillRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Pays a fixed bill, records a double-entry ledger expense, and rolls over cycle."""
    vault = db.query(Vault).filter_by(id=vault_id, user_id=current_user.id).one_or_none()
    if not vault:
        raise HTTPException(status_code=404, detail="Vault tidak ditemukan.")

    pay_amount = req.amount if req.amount is not None else (vault.target_amount or vault.allocated_amount)
    if not pay_amount or pay_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nominal pembayaran harus lebih besar dari 0.",
        )

    account = (
        db.query(Account)
        .filter_by(id=req.account_id, user_id=current_user.id)
        .one_or_none()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Akun sumber pembayaran tidak ditemukan.")
    if account.current_balance < pay_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Saldo akun tidak mencukupi untuk membayar tagihan.",
        )

    category = None
    if req.category_id:
        category = (
            db.query(Category)
            .filter_by(id=req.category_id, user_id=current_user.id)
            .one_or_none()
        )
        if not category:
            raise HTTPException(status_code=404, detail="Kategori tidak ditemukan.")
    else:
        category = (
            db.query(Category)
            .filter(
                Category.user_id == current_user.id,
                Category.category_type == CategoryType.EXPENSE,
                Category.name.ilike("%Tagihan%"),
            )
            .first()
        )
        if not category:
            category = (
                db.query(Category)
                .filter(
                    Category.user_id == current_user.id,
                    Category.category_type == CategoryType.EXPENSE,
                )
                .first()
            )
        if not category:
            category = Category(
                user_id=current_user.id,
                name="Tagihan",
                category_type=CategoryType.EXPENSE,
            )
            db.add(category)
            db.flush()

    ledger_service = LedgerService(db, auto_commit=False)
    tx = ledger_service.record_expense(
        user_id=current_user.id,
        account_id=account.id,
        category_id=category.id,
        amount=pay_amount,
        description=req.notes or f"Pembayaran tagihan: {vault.name}",
        source_channel="WEB_UI",
        vault_id=vault.id,
    )

    vault.allocated_amount = Decimal("0.00")
    if vault.target_date:
        vault.target_date = advance_one_month(vault.target_date)

    db.commit()
    db.refresh(vault)
    db.refresh(tx)
    RunwayService.clear_cache(user_id=current_user.id)

    return VaultPayBillResponse(vault=vault, transaction=tx)


@vaults_router.put("/{vault_id}", response_model=VaultResponse)
def update_vault(
    vault_id: UUID,
    req: VaultUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vault = db.query(Vault).filter_by(id=vault_id, user_id=current_user.id).one_or_none()
    if not vault:
        raise HTTPException(status_code=404, detail="Vault tidak ditemukan.")

    if vault.is_locked and req.allocated_amount < vault.allocated_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dana komitmen terkunci. Buka kunci terlebih dahulu untuk menarik atau mengurangi alokasi dana.",
        )

    vault.name = req.name.strip()
    vault.target_amount = req.target_amount
    vault.allocated_amount = req.allocated_amount
    vault.target_date = req.target_date
    db.commit()
    db.refresh(vault)
    RunwayService.clear_cache(user_id=current_user.id)
    return vault


@vaults_router.delete("/{vault_id}")
def delete_vault(
    vault_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vault = db.query(Vault).filter_by(id=vault_id, user_id=current_user.id).one_or_none()
    if not vault:
        raise HTTPException(status_code=404, detail="Vault tidak ditemukan.")

    if vault.is_locked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Komitmen dana terkunci. Buka kunci terlebih dahulu untuk menghapus vault.",
        )

    db.query(LedgerEntry).filter(LedgerEntry.vault_id == vault.id).update({LedgerEntry.vault_id: None})
    db.delete(vault)
    db.commit()
    RunwayService.clear_cache(user_id=current_user.id)
    return {"detail": "Vault berhasil dihapus."}
