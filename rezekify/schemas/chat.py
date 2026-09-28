"""Pydantic schemas for AI Copilot Hub chat, messages history, and telemetry."""

from datetime import datetime
from decimal import Decimal
import json
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_serializer, model_validator


class TransactionSummary(BaseModel):
    id: UUID
    amount: Decimal
    account_name: Optional[str] = None
    category_name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    account_balance_after: Optional[Decimal] = None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("amount", mode="plain")
    def serialize_amount(self, v: Decimal) -> float:
        return float(v)

    @field_serializer("account_balance_after", mode="plain")
    def serialize_balance(self, v: Optional[Decimal]) -> Optional[float]:
        return float(v) if v is not None else None


class TelemetrySnapshot(BaseModel):
    operational_free_cash: Decimal
    daily_safe_runway: Decimal
    days_remaining: int
    health_status: str

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("operational_free_cash", "daily_safe_runway", mode="plain")
    def serialize_decimal(self, v: Decimal) -> float:
        return float(v)


class EnrichedChatResponse(BaseModel):
    reply: str
    message_id: Optional[UUID] = None
    transaction: Optional[TransactionSummary] = None
    telemetry: Optional[TelemetrySnapshot] = None
    transcription: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ChatMessageResponse(BaseModel):
    id: UUID
    role: str
    content: str
    transaction_id: Optional[UUID] = None
    transaction: Optional[TransactionSummary] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def resolve_metadata(cls, data: Any) -> Any:
        if hasattr(data, "metadata_json") and not hasattr(data, "metadata"):
            raw_meta = getattr(data, "metadata_json", None)
            parsed_meta = None
            if raw_meta:
                try:
                    parsed_meta = json.loads(raw_meta)
                except Exception:
                    parsed_meta = {"raw": raw_meta}
            return {
                "id": getattr(data, "id"),
                "role": getattr(data, "role"),
                "content": getattr(data, "content"),
                "transaction_id": getattr(data, "transaction_id", None),
                "transaction": getattr(data, "transaction", None),
                "metadata": parsed_meta,
                "created_at": getattr(data, "created_at"),
            }
        return data
