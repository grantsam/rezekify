"""Telegram Gateway Webhook Router for edge proxy update forwarding."""

from typing import Any, Dict
from fastapi import APIRouter, Body, Depends
from sqlalchemy.orm import Session

from rezekify.api.deps import get_db
from rezekify.gateway.telegram_bot import TelegramGateway

gateway_router = APIRouter()


@gateway_router.post("/telegram/webhook")
def telegram_webhook(
    payload: Dict[str, Any] = Body(default_factory=dict),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Processes incoming Telegram update payload forwarded by edge proxy."""
    gateway = TelegramGateway(db=db)
    result = gateway.handle_update(payload)
    return {"status": "ok", "result": result}
