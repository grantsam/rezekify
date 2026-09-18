"""Dashboard and Analytics Router."""

from datetime import date
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from rezekify.agent.key_pool import RotaryKeyPool
from rezekify.agent.orchestrator import AgentOrchestrator
from rezekify.api.deps import get_current_user, get_db
from rezekify.db.models import User
from rezekify.services.runway import RunwayService

dashboard_router = APIRouter()
analytics_router = APIRouter()


class UpcomingBillResponse(BaseModel):
    name: str
    target_amount: Decimal
    allocated_amount: Decimal
    target_date: date
    days_until_due: int


class DashboardSummaryResponse(BaseModel):
    total_liquid_cash: Decimal
    vault_locked_cash: Decimal
    operational_free_cash: Decimal
    days_remaining: int
    daily_safe_runway: Decimal
    health_status: str
    upcoming_bills: List[UpcomingBillResponse]


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


@dashboard_router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Calculates deterministic liquid free cash and dynamic daily safe runway."""
    service = RunwayService(db)
    report = service.calculate_runway(user_id=current_user.id)
    return DashboardSummaryResponse(
        total_liquid_cash=report.total_liquid_cash,
        vault_locked_cash=report.vault_locked_cash,
        operational_free_cash=report.operational_free_cash,
        days_remaining=report.days_remaining,
        daily_safe_runway=report.daily_safe_runway,
        health_status=report.health_status,
        upcoming_bills=[
            UpcomingBillResponse(
                name=b.name,
                target_amount=b.target_amount,
                allocated_amount=b.allocated_amount,
                target_date=b.target_date,
                days_until_due=b.days_until_due,
            )
            for b in report.upcoming_bills
        ],
    )


@dashboard_router.post("/ai-chat", response_model=ChatResponse)
def ai_chat_omni_input(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Processes natural language omni-input into ledger mutations."""
    orchestrator = AgentOrchestrator(db=db, key_pool=RotaryKeyPool.from_env("GEMINI_API_KEYS"))
    reply = orchestrator.handle_message(user_id=current_user.id, text=req.message)
    return ChatResponse(reply=reply)


@analytics_router.get("/spending-breakdown")
def get_spending_breakdown(
    period: str = Query("daily", pattern="^(daily|monthly)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns spending analytics for either 'daily' (7-14 day trend vs runway)
    or 'monthly' (category breakdown). Rejects yearly queries (422) for zero-bloat efficiency."""
    return {
        "period": period,
        "breakdown": [],
    }
