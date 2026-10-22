"""Pydantic schemas for Transaction creation, updates, and serialized responses."""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from rezekify.db.models import EntryType


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


class PaginatedTransactionsResponse(BaseModel):
    items: List[TransactionItemResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

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
    transaction_date: Optional[datetime] = None
    vault_id: Optional[UUID] = None


class TransactionUpdateRequest(BaseModel):
    amount: Decimal
    description: str
    account_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    to_account_id: Optional[UUID] = None
    transaction_date: Optional[datetime] = None
    from_account_id: Optional[UUID] = None
    transaction_type: Optional[str] = None
    vault_id: Optional[UUID] = None
