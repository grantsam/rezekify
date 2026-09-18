"""Vaults (Sinking Funds & Fixed Commitments) Router."""

from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
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
    )
    db.add(vault)
    db.commit()
    db.refresh(vault)
    return vault
