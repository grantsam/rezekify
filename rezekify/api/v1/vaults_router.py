"""Vaults (Sinking Funds & Fixed Commitments) Router."""

from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from rezekify.api.deps import get_current_user, get_db
from rezekify.db.models import User, Vault, VaultType

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


class VaultResponse(BaseModel):
    id: UUID
    name: str
    vault_type: VaultType
    target_amount: Decimal
    allocated_amount: Decimal
    target_date: Optional[date]
    is_locked: bool

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
    return vault


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

    db.delete(vault)
    db.commit()
    return {"detail": "Vault berhasil dihapus."}
