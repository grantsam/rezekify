"""Accounts Management Router."""

from decimal import Decimal
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from rezekify.api.deps import get_current_user, get_db
from rezekify.db.models import Account, AccountType, User

accounts_router = APIRouter()


class AccountCreateRequest(BaseModel):
    name: str
    account_type: AccountType
    initial_balance: Decimal = Decimal("0.00")


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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists all active holding accounts for the authenticated user."""
    return (
        db.query(Account)
        .filter(Account.user_id == current_user.id, Account.is_active == True)
        .all()
    )


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
