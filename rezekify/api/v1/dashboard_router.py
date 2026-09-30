"""Dashboard and Analytics Router."""

from datetime import date
from decimal import Decimal
import json
from typing import List, Literal, Optional, Union
from uuid import UUID
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, selectinload

from rezekify.agent.key_pool import RotaryKeyPool
from rezekify.agent.orchestrator import AgentOrchestrator
from rezekify.api.deps import get_current_user, get_db, get_gemini_key_pool
from rezekify.core.rate_limit import RateLimiter
from rezekify.db.models import Account, Category, ChatMessage, EntryType, Transaction, User
from rezekify.schemas.chat import (
    ChatMessageResponse,
    EnrichedChatResponse,
    TelemetrySnapshot,
    TransactionSummary,
)
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
    today_spent: Decimal = Decimal("0.00")


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
        today_spent=report.today_spent,
    )


def _build_transaction_summary(tx: Transaction, db: Session) -> Optional[TransactionSummary]:
    if not tx:
        return None
    amount = Decimal("0")
    account_name = None
    category_name = None
    account_balance_after = None
    tx_type = "EXPENSE"

    for entry in tx.ledger_entries:
        if entry.account_id:
            acc = db.query(Account).filter(Account.id == entry.account_id).first()
            if acc:
                account_name = acc.name
                account_balance_after = acc.current_balance
            amount = entry.amount
            if entry.entry_type == EntryType.CREDIT:
                tx_type = "EXPENSE"
            elif entry.entry_type == EntryType.DEBIT:
                tx_type = "INCOME"
        if entry.category_id:
            cat = db.query(Category).filter(Category.id == entry.category_id).first()
            if cat:
                category_name = cat.name

    return TransactionSummary(
        id=tx.id,
        amount=amount,
        account_name=account_name,
        category_name=category_name,
        description=tx.description,
        type=tx_type,
        account_balance_after=account_balance_after,
    )


def _resolve_tx_summary(msg: ChatMessage, db: Session) -> Optional[TransactionSummary]:
    if msg.metadata_json:
        try:
            data = json.loads(msg.metadata_json)
            if isinstance(data, dict) and data.get("transaction"):
                return TransactionSummary(**data["transaction"])
        except Exception:
            pass
    tx = msg.transaction
    if not tx and msg.transaction_id:
        tx = db.query(Transaction).filter(Transaction.id == msg.transaction_id).first()
    if tx:
        return _build_transaction_summary(tx, db)
    return None


@dashboard_router.get("/ai-chat/messages", response_model=List[ChatMessageResponse])
def get_chat_messages(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ChatMessageResponse]:
    """Retrieves chronological chat message history for the authenticated user."""
    query = (
        db.query(ChatMessage)
        .options(selectinload(ChatMessage.transaction).selectinload(Transaction.ledger_entries))
        .filter(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.asc())
        .offset(offset)
        .limit(limit)
    )
    messages = query.all()
    results = []
    for msg in messages:
        tx_summary = _resolve_tx_summary(msg, db)
        meta = None
        if msg.metadata_json:
            try:
                meta = json.loads(msg.metadata_json)
            except Exception:
                meta = {"raw": msg.metadata_json}
        results.append(
            ChatMessageResponse(
                id=msg.id,
                role=msg.role,
                content=msg.content,
                transaction_id=msg.transaction_id,
                transaction=tx_summary,
                metadata=meta,
                created_at=msg.created_at,
            )
        )
    return results


@dashboard_router.delete("/ai-chat/messages")
def clear_chat_messages(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes all chat messages for current user without affecting underlying ledger transactions."""
    db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id).delete(synchronize_session=False)
    db.commit()
    return {"status": "cleared"}


@dashboard_router.post("/ai-chat", response_model=EnrichedChatResponse, dependencies=[Depends(ai_chat_limiter)])
async def ai_chat_omni_input(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    key_pool: RotaryKeyPool = Depends(get_gemini_key_pool),
) -> EnrichedChatResponse:
    """Processes natural language omni-input into ledger mutations and persists conversation history."""
    user_msg = ChatMessage(
        user_id=current_user.id,
        role="user",
        content=req.message,
    )
    db.add(user_msg)
    db.commit()

    orchestrator = AgentOrchestrator(db=db, key_pool=key_pool)
    res = await orchestrator.handle_message_async(user_id=current_user.id, text=req.message)

    reply = res["reply"] if isinstance(res, dict) else str(res)
    tx_id = res.get("transaction_id") if isinstance(res, dict) else None
    tx_dict = res.get("transaction") if isinstance(res, dict) else None
    telemetry_dict = res.get("telemetry") if isinstance(res, dict) else None

    if telemetry_dict is None:
        try:
            runway = RunwayService(db).calculate_runway(current_user.id)
            telemetry_dict = {
                "operational_free_cash": runway.operational_free_cash,
                "daily_safe_runway": runway.daily_safe_runway,
                "days_remaining": runway.days_remaining,
                "health_status": runway.health_status,
            }
        except Exception:
            telemetry_dict = None

    meta_to_store = {}
    if tx_dict:
        meta_to_store["transaction"] = json.loads(json.dumps(tx_dict, default=str))
    if telemetry_dict:
        meta_to_store["telemetry"] = json.loads(json.dumps(telemetry_dict, default=str))

    assistant_msg = ChatMessage(
        user_id=current_user.id,
        role="assistant",
        content=reply,
        transaction_id=tx_id,
        metadata_json=json.dumps(meta_to_store) if meta_to_store else None,
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    tx_summary = TransactionSummary(**tx_dict) if tx_dict else None
    telemetry_snap = TelemetrySnapshot(**telemetry_dict) if telemetry_dict else None

    return EnrichedChatResponse(
        reply=reply,
        message_id=assistant_msg.id,
        transaction=tx_summary,
        telemetry=telemetry_snap,
    )


@dashboard_router.post("/ai-receipt", response_model=EnrichedChatResponse, dependencies=[Depends(ai_receipt_limiter)])
async def ai_receipt_upload(
    file: UploadFile = File(...),
    message: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    key_pool: RotaryKeyPool = Depends(get_gemini_key_pool),
) -> EnrichedChatResponse:
    """Processes multimodal receipt image uploads via Gemini Vision OCR and persists conversation history."""
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

    prompt_text = (message or "").strip() or "Foto struk kasir"
    user_msg = ChatMessage(
        user_id=current_user.id,
        role="user",
        content=prompt_text,
        metadata_json=json.dumps({"type": "receipt", "filename": file.filename}),
    )
    db.add(user_msg)
    db.commit()

    orchestrator = AgentOrchestrator(db=db, key_pool=key_pool)
    res = await orchestrator.handle_message_async(
        user_id=current_user.id,
        text=prompt_text,
        image_bytes=content,
        mime_type=file.content_type,
    )
    reply = res["reply"] if isinstance(res, dict) else str(res)
    tx_id = res.get("transaction_id") if isinstance(res, dict) else None
    tx_dict = res.get("transaction") if isinstance(res, dict) else None
    telemetry_dict = res.get("telemetry") if isinstance(res, dict) else None

    if telemetry_dict is None:
        try:
            runway = RunwayService(db).calculate_runway(current_user.id)
            telemetry_dict = {
                "operational_free_cash": runway.operational_free_cash,
                "daily_safe_runway": runway.daily_safe_runway,
                "days_remaining": runway.days_remaining,
                "health_status": runway.health_status,
            }
        except Exception:
            telemetry_dict = None

    meta_to_store = {}
    if tx_dict:
        meta_to_store["transaction"] = json.loads(json.dumps(tx_dict, default=str))
    if telemetry_dict:
        meta_to_store["telemetry"] = json.loads(json.dumps(telemetry_dict, default=str))

    assistant_msg = ChatMessage(
        user_id=current_user.id,
        role="assistant",
        content=reply,
        transaction_id=tx_id,
        metadata_json=json.dumps(meta_to_store) if meta_to_store else None,
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    tx_summary = TransactionSummary(**tx_dict) if tx_dict else None
    telemetry_snap = TelemetrySnapshot(**telemetry_dict) if telemetry_dict else None

    return EnrichedChatResponse(
        reply=reply,
        message_id=assistant_msg.id,
        transaction=tx_summary,
        telemetry=telemetry_snap,
    )


@dashboard_router.post("/ai-voice", response_model=EnrichedChatResponse)
async def ai_voice_endpoint(
    file: UploadFile = File(...),
    message: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    key_pool: RotaryKeyPool = Depends(get_gemini_key_pool),
) -> EnrichedChatResponse:
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
    result = await orchestrator.handle_voice_async(
        user_id=current_user.id,
        audio_bytes=content,
        caption=(message or "").strip() or None,
        mime_type=file.content_type or "audio/webm",
    )

    reply = result.get("reply", "") if isinstance(result, dict) else str(result)
    transcription = result.get("transcription", "") if isinstance(result, dict) else ""
    tx_id = result.get("transaction_id") if isinstance(result, dict) else None
    tx_dict = result.get("transaction") if isinstance(result, dict) else None
    telemetry_dict = result.get("telemetry") if isinstance(result, dict) else None

    user_content = (message or "").strip() or transcription or "Pesan Suara"
    user_msg = ChatMessage(
        user_id=current_user.id,
        role="user",
        content=user_content,
        metadata_json=json.dumps({"type": "voice", "transcription": transcription}),
    )
    db.add(user_msg)
    db.commit()

    if telemetry_dict is None:
        try:
            runway = RunwayService(db).calculate_runway(current_user.id)
            telemetry_dict = {
                "operational_free_cash": runway.operational_free_cash,
                "daily_safe_runway": runway.daily_safe_runway,
                "days_remaining": runway.days_remaining,
                "health_status": runway.health_status,
            }
        except Exception:
            telemetry_dict = None

    meta_to_store = {}
    if tx_dict:
        meta_to_store["transaction"] = json.loads(json.dumps(tx_dict, default=str))
    if telemetry_dict:
        meta_to_store["telemetry"] = json.loads(json.dumps(telemetry_dict, default=str))

    assistant_msg = ChatMessage(
        user_id=current_user.id,
        role="assistant",
        content=reply,
        transaction_id=tx_id,
        metadata_json=json.dumps(meta_to_store) if meta_to_store else None,
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    tx_summary = TransactionSummary(**tx_dict) if tx_dict else None
    telemetry_snap = TelemetrySnapshot(**telemetry_dict) if telemetry_dict else None

    return EnrichedChatResponse(
        reply=reply,
        message_id=assistant_msg.id,
        transaction=tx_summary,
        telemetry=telemetry_snap,
        transcription=transcription,
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
