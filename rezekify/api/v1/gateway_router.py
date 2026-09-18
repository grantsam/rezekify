"""Telegram Gateway Webhook Router for edge proxy update forwarding."""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Body, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from rezekify.api.deps import get_db
from rezekify.core.config import settings
from rezekify.gateway.telegram_bot import TelegramGateway

gateway_router = APIRouter()


@gateway_router.post("/telegram/webhook")
def telegram_webhook(
    payload: Dict[str, Any] = Body(default_factory=dict),
    x_telegram_bot_api_secret_token: Optional[str] = Header(None, alias="X-Telegram-Bot-Api-Secret-Token"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Processes incoming Telegram update payload forwarded by edge proxy."""
    if settings.TELEGRAM_WEBHOOK_SECRET:
        if x_telegram_bot_api_secret_token != settings.TELEGRAM_WEBHOOK_SECRET:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid Telegram webhook secret token",
            )
    gateway = TelegramGateway(db=db)
    result = gateway.handle_update(payload)
    return {"status": "ok", "result": result}
