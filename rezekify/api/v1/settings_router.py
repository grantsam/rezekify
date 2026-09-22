"""FastAPI router for user settings, Telegram lifecycle, and AI BYOK configuration."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from rezekify.api.deps import get_current_user, get_db
from rezekify.core.config import settings as app_settings
from rezekify.core.crypto import encrypt_key, mask_key
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
    validate_ai_credentials,
)

settings_router = APIRouter()


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

    return SettingsResponse(telegram=telegram_resp, ai=ai_resp)


@settings_router.post("/ai/validate", response_model=AIKeyValidateResponse)
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
