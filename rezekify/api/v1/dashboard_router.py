"""Dashboard and Analytics Router."""

from datetime import date
from decimal import Decimal
from typing import List, Literal, Optional, Union
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from rezekify.agent.key_pool import RotaryKeyPool
from rezekify.agent.orchestrator import AgentOrchestrator
from rezekify.api.deps import get_current_user, get_db, get_gemini_key_pool
from rezekify.core.rate_limit import RateLimiter
from rezekify.db.models import User
from rezekify.services.runway import RunwayService

dashboard_router = APIRouter()
analytics_router = APIRouter()

# ponytail: in-memory sliding window rate limiter; upgrade to Redis-backed limiter when scaling horizontally.
ai_chat_limiter = RateLimiter(max_requests=15, window_seconds=60)
ai_receipt_limiter = RateLimiter(max_requests=5, window_seconds=60)

ALLOWED_RECEIPT_MIMES = {"image/jpeg", "image/png", "image/webp"}
MAX_RECEIPT_BYTES = 10 * 1024 * 1024  # 10MB

ALLOWED_VOICE_MIMES = {
    "audio/webm",
    "audio/ogg",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/mpeg",
    "audio/mp3",
    "video/webm",
}
MAX_VOICE_BYTES = 10 * 1024 * 1024  # 10MB


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


class VoiceChatResponse(BaseModel):
    reply: str
    transcription: str = ""


class SimulatePurchaseRequest(BaseModel):
    planned_amount: Decimal


class SimulatePurchaseResponse(BaseModel):
    current_daily_runway: Decimal
    projected_daily_runway: Decimal
    daily_drop_amount: Decimal
    is_safe: bool
    advice: str




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
    category_id: Optional[UUID] = None
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


@dashboard_router.post("/ai-chat", response_model=ChatResponse, dependencies=[Depends(ai_chat_limiter)])
def ai_chat_omni_input(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    key_pool: RotaryKeyPool = Depends(get_gemini_key_pool),
):
    """Processes natural language omni-input into ledger mutations."""
    orchestrator = AgentOrchestrator(db=db, key_pool=key_pool)
    reply = orchestrator.handle_message(user_id=current_user.id, text=req.message)
    return ChatResponse(reply=reply)


@dashboard_router.post("/ai-receipt", response_model=ChatResponse, dependencies=[Depends(ai_receipt_limiter)])
async def ai_receipt_upload(
    file: UploadFile = File(...),
    message: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    key_pool: RotaryKeyPool = Depends(get_gemini_key_pool),
) -> ChatResponse:
    """Processes multimodal receipt image uploads via Gemini Vision OCR."""
    if file.content_type not in ALLOWED_RECEIPT_MIMES:
        raise HTTPException(
            status_code=400,
            detail="Format file tidak didukung. Harap unggah file gambar (JPEG, PNG, WebP).",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File gambar kosong.")
    if len(content) > MAX_RECEIPT_BYTES:
        raise HTTPException(status_code=400, detail="Ukuran file melebihi batas maksimal 10MB.")

    is_jpeg = content.startswith(b"\xff\xd8\xff")
    is_png = content.startswith(b"\x89PNG\r\n\x1a\n")
    is_webp = content.startswith(b"RIFF") and b"WEBP" in content[:16]
    if not (is_jpeg or is_png or is_webp):
        raise HTTPException(status_code=400, detail="Format file tidak didukung atau header file tidak valid.")

    orchestrator = AgentOrchestrator(db=db, key_pool=key_pool)
    prompt_text = (message or "").strip() or "Foto struk kasir"
    reply = await run_in_threadpool(
        orchestrator.handle_message,
        user_id=current_user.id,
        text=prompt_text,
        image_bytes=content,
        mime_type=file.content_type,
    )
    return ChatResponse(reply=reply)


@dashboard_router.post("/ai-voice", response_model=VoiceChatResponse)
async def ai_voice_endpoint(
    file: UploadFile = File(...),
    message: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    key_pool: RotaryKeyPool = Depends(get_gemini_key_pool),
) -> VoiceChatResponse:
    if file.content_type and file.content_type.lower() not in ALLOWED_VOICE_MIMES:
        raise HTTPException(
            status_code=400,
            detail="Format file audio tidak didukung. Harap gunakan WebM, OGG, WAV, MP4, atau MP3.",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File audio kosong.")
    if len(content) > MAX_VOICE_BYTES:
        raise HTTPException(status_code=400, detail="Ukuran file audio melebihi batas maksimal 10MB.")

    orchestrator = AgentOrchestrator(db=db, key_pool=key_pool)
    result = await run_in_threadpool(
        orchestrator.handle_voice,
        user_id=current_user.id,
        audio_bytes=content,
        caption=(message or "").strip() or None,
        mime_type=file.content_type or "audio/webm",
    )
    return VoiceChatResponse(
        reply=result.get("reply", ""),
        transcription=result.get("transcription", ""),
    )


@dashboard_router.post("/simulate-purchase", response_model=SimulatePurchaseResponse)
def simulate_purchase_endpoint(
    req: SimulatePurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SimulatePurchaseResponse:
    if req.planned_amount <= Decimal("0.00"):
        raise HTTPException(
            status_code=400,
            detail="Nominal belanja harus lebih besar dari 0.",
        )

    sim = RunwayService(db).simulate_purchase(
        user_id=current_user.id,
        planned_amount=req.planned_amount,
    )

    return SimulatePurchaseResponse(
        current_daily_runway=sim.current_daily_runway,
        projected_daily_runway=sim.projected_daily_runway,
        daily_drop_amount=sim.daily_drop_amount,
        is_safe=sim.is_safe,
        advice=sim.advice,
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
