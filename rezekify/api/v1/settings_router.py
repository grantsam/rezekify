"""FastAPI router for user settings, Telegram lifecycle, and AI BYOK configuration."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from rezekify.api.deps import get_current_user, get_db
from rezekify.core.config import settings as app_settings
from rezekify.core.crypto import encrypt_key, mask_key
from rezekify.core.rate_limit import RateLimiter
from rezekify.db.models import AIProvider, User, UserSettings
from rezekify.schemas.settings import (
    AVAILABLE_MODELS,
    AIKeyValidateRequest,
    AIKeyValidateResponse,
    AISettingsResponse,
    AISettingsUpdateRequest,
    SettingsResponse,
    TelegramSettingsResponse,
    TelegramUnlinkResponse,
    UserProfileResponse,
    UserProfileUpdateRequest,
    validate_ai_credentials,
)

settings_router = APIRouter()
ai_validate_limiter = RateLimiter(max_requests=10, window_seconds=60)


def _get_or_create_settings(db: Session, user_id) -> UserSettings:
    """Retrieves user settings or creates default record if none exists."""
    settings_rec = db.query(UserSettings).filter_by(user_id=user_id).first()
    if not settings_rec:
        settings_rec = UserSettings(
            user_id=user_id,
            ai_provider=AIProvider.SYSTEM,
            ai_model="gemini-2.5-flash",
            is_custom_ai_enabled=False,
        )
        db.add(settings_rec)
        db.commit()
        db.refresh(settings_rec)
    return settings_rec


@settings_router.get("", response_model=SettingsResponse)
@settings_router.get("/", response_model=SettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SettingsResponse:
    """Returns the current user's Telegram connection status and AI BYOK settings."""
    settings_rec = _get_or_create_settings(db, current_user.id)

    telegram_resp = TelegramSettingsResponse(
        is_connected=current_user.telegram_chat_id is not None,
        telegram_chat_id=current_user.telegram_chat_id,
        bot_username=app_settings.TELEGRAM_BOT_USERNAME,
    )

    ai_resp = AISettingsResponse(
        is_custom_ai_enabled=settings_rec.is_custom_ai_enabled,
        provider=settings_rec.ai_provider,
        model=settings_rec.ai_model,
        has_api_key=bool(settings_rec.encrypted_api_key),
        key_hint=settings_rec.key_hint,
    )

    threshold = (
        current_user.safe_runway_threshold
        if getattr(current_user, "safe_runway_threshold", None) is not None
        else Decimal("30000.00")
    )
    profile_resp = UserProfileResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        monthly_cycle_day=current_user.monthly_cycle_day,
        safe_runway_threshold=threshold,
    )

    return SettingsResponse(telegram=telegram_resp, ai=ai_resp, profile=profile_resp)


@settings_router.put("/profile", response_model=UserProfileResponse)
def update_user_profile(
    payload: UserProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProfileResponse:
    """Updates user profile settings like monthly cycle day and safe runway threshold."""
    if payload.monthly_cycle_day is not None and not (1 <= payload.monthly_cycle_day <= 31):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hari siklus bulanan harus antara tanggal 1 dan 31.",
        )
    if payload.safe_runway_threshold is not None and payload.safe_runway_threshold <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ambang batas runway aman harus lebih besar dari 0.",
        )

    user = db.query(User).filter_by(id=current_user.id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pengguna tidak ditemukan.",
        )

    if payload.monthly_cycle_day is not None:
        user.monthly_cycle_day = payload.monthly_cycle_day
    if payload.safe_runway_threshold is not None:
        user.safe_runway_threshold = payload.safe_runway_threshold

    db.commit()
    db.refresh(user)

    return UserProfileResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        monthly_cycle_day=user.monthly_cycle_day,
        safe_runway_threshold=user.safe_runway_threshold,
    )


@settings_router.post("/ai/validate", response_model=AIKeyValidateResponse, dependencies=[Depends(ai_validate_limiter)])
def validate_ai_key(
    payload: AIKeyValidateRequest,
    current_user: User = Depends(get_current_user),
) -> AIKeyValidateResponse:
    """Performs live connectivity verification against the specified AI provider."""
    valid, message = validate_ai_credentials(
        provider=payload.provider,
        api_key=payload.api_key,
        model=payload.model,
    )
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        )
    return AIKeyValidateResponse(valid=True, message=message)


@settings_router.put("/ai", response_model=AISettingsResponse)
def update_ai_settings(
    payload: AISettingsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AISettingsResponse:
    """Updates AI provider, model, BYOK toggle, and optionally encrypts a new API key."""
    settings_rec = _get_or_create_settings(db, current_user.id)

    # Validate provider models
    valid_models = AVAILABLE_MODELS.get(payload.provider.value, [])
    if payload.provider != AIProvider.SYSTEM and payload.model not in valid_models:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Model '{payload.model}' tidak valid untuk provider {payload.provider.value}.",
        )

    # Check key requirement when enabling BYOK or switching provider
    has_existing_key = bool(settings_rec.encrypted_api_key)
    has_new_key = bool(payload.api_key and payload.api_key.strip())

    if payload.is_custom_ai_enabled and not has_existing_key and not has_new_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kunci API wajib diisi untuk mengaktifkan AI kustom (BYOK).",
        )

    if (
        payload.is_custom_ai_enabled
        and settings_rec.ai_provider != AIProvider.SYSTEM
        and payload.provider != settings_rec.ai_provider
        and not has_new_key
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kunci API baru wajib diisi saat mengganti provider AI.",
        )

    # Encrypt and store key if new one provided
    if has_new_key:
        raw_key = payload.api_key.strip()
        settings_rec.encrypted_api_key = encrypt_key(raw_key)
        settings_rec.key_hint = mask_key(raw_key)

    settings_rec.is_custom_ai_enabled = payload.is_custom_ai_enabled
    settings_rec.ai_provider = payload.provider
    settings_rec.ai_model = payload.model

    db.commit()
    db.refresh(settings_rec)

    return AISettingsResponse(
        is_custom_ai_enabled=settings_rec.is_custom_ai_enabled,
        provider=settings_rec.ai_provider,
        model=settings_rec.ai_model,
        has_api_key=bool(settings_rec.encrypted_api_key),
        key_hint=settings_rec.key_hint,
    )


@settings_router.post("/telegram/unlink", response_model=TelegramUnlinkResponse)
def unlink_telegram(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TelegramUnlinkResponse:
    """Disconnects the current user's Telegram integration."""
    user = db.query(User).filter_by(id=current_user.id).first()
    if user:
        user.telegram_chat_id = None
        user.telegram_pairing_code = None
        user.pairing_code_expires_at = None
    current_user.telegram_chat_id = None
    current_user.telegram_pairing_code = None
    current_user.pairing_code_expires_at = None
    db.commit()

    return TelegramUnlinkResponse(
        success=True,
        message="Akun Telegram berhasil diputuskan.",
    )
