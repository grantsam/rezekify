"""Dashboard and Analytics Router."""

from datetime import date
from decimal import Decimal
from typing import List, Literal, Optional, Union
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from rezekify.agent.key_pool import RotaryKeyPool
from rezekify.agent.orchestrator import AgentOrchestrator
from rezekify.api.deps import get_current_user, get_db
from rezekify.db.models import User
from rezekify.services.runway import RunwayService

dashboard_router = APIRouter()
analytics_router = APIRouter()

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


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


class ReceiptExtractedData(BaseModel):
    action: str
    amount: Decimal
    account_name: Optional[str] = None
    category_name: Optional[str] = None
    note: Optional[str] = None


class ReceiptUploadResponse(BaseModel):
    reply: str
    transaction_id: Optional[UUID] = None
    extracted_data: ReceiptExtractedData



class DailySpendingItemModel(BaseModel):
    date: date
    day_label: str = Field(..., description="Localized Indonesian day abbreviation (e.g. Sen, Sel, Rab)")
    amount: Decimal = Field(..., description="Total expenses recorded on this day")
    safe_runway_threshold: Decimal = Field(..., description="Benchmark daily safe runway threshold")
    is_over_budget: bool = Field(..., description="True if amount exceeds safe_runway_threshold")


class DailySpendingResponse(BaseModel):
    period: Literal["daily"]
    daily_safe_runway: Decimal
    total_spent_in_period: Decimal
    items: List[DailySpendingItemModel]


class CategorySpendingItemModel(BaseModel):
    category_id: UUID
    category_name: str
    amount: Decimal
    percentage: Decimal = Field(..., description="Percentage of total cycle spending, e.g. 42.5")
    color: str


class MonthlySpendingResponse(BaseModel):
    period: Literal["monthly"]
    cycle_start_date: date
    cycle_end_date: date
    total_spent: Decimal
    items: List[CategorySpendingItemModel]


SpendingBreakdownResponse = Union[DailySpendingResponse, MonthlySpendingResponse]


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


@dashboard_router.post("/ai-receipt", response_model=ReceiptUploadResponse)
async def ai_receipt_upload(
    file: UploadFile = File(...),
    message: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Processes uploaded receipt image (JPEG, PNG, WebP up to 10MB) through Gemini 2.5 Flash Vision."""
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Format file tidak didukung. Harap unggah struk berformat JPEG, PNG, atau WebP.",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=400,
            detail="File yang diunggah kosong.",
        )
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Ukuran file melebihi batas maksimal 10MB.",
        )

    orchestrator = AgentOrchestrator(db=db, key_pool=RotaryKeyPool.from_env("GEMINI_API_KEYS"))
    result = orchestrator.handle_receipt(
        user_id=current_user.id,
        image_bytes=content,
        mime_type=file.content_type,
        user_note=message,
    )

    return ReceiptUploadResponse(
        reply=result["reply"],
        transaction_id=result["transaction_id"],
        extracted_data=ReceiptExtractedData(
            action=result["extracted_data"]["action"],
            amount=Decimal(str(result["extracted_data"]["amount"])),
            account_name=result["extracted_data"]["account_name"],
            category_name=result["extracted_data"]["category_name"],
            note=result["extracted_data"]["note"],
        ),
    )



@analytics_router.get("/spending-breakdown", response_model=SpendingBreakdownResponse)
def get_spending_breakdown(
    period: str = Query("daily", pattern="^(daily|monthly)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns spending analytics for either 'daily' (7-day trend vs runway)
    or 'monthly' (category breakdown for active cycle). Rejects yearly queries (422) for zero-bloat efficiency."""
    service = RunwayService(db)
    if period == "daily":
        daily_report = service.get_daily_spending_breakdown(user_id=current_user.id, days=7)
        return DailySpendingResponse(
            period="daily",
            daily_safe_runway=daily_report.daily_safe_runway,
            total_spent_in_period=daily_report.total_spent_in_period,
            items=[
                DailySpendingItemModel(
                    date=item.date,
                    day_label=item.day_label,
                    amount=item.amount,
                    safe_runway_threshold=item.safe_runway_threshold,
                    is_over_budget=item.is_over_budget,
                )
                for item in daily_report.items
            ],
        )

    monthly_report = service.get_category_spending_breakdown(user_id=current_user.id)
    return MonthlySpendingResponse(
        period="monthly",
        cycle_start_date=monthly_report.cycle_start_date,
        cycle_end_date=monthly_report.cycle_end_date,
        total_spent=monthly_report.total_spent,
        items=[
            CategorySpendingItemModel(
                category_id=item.category_id,
                category_name=item.category_name,
                amount=item.amount,
                percentage=item.percentage,
                color=item.color,
            )
            for item in monthly_report.items
        ],
    )
