"""Pydantic schemas and live validation logic for user settings and AI BYOK."""

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from rezekify.agent.providers import (
    AuthError,
    BYOKConfig,
    CapabilityUnsupported,
    RateLimitError,
    get_adapter,
    validate_base_url,
)
from rezekify.db.models import AIProtocol, AIProvider


class TelegramSettingsResponse(BaseModel):
    is_connected: bool
    telegram_chat_id: Optional[int] = None
    bot_username: str


class AISettingsResponse(BaseModel):
    is_custom_ai_enabled: bool
    provider: AIProvider
    protocol: Optional[AIProtocol] = None
    base_url: Optional[str] = None
    model: str
    has_api_key: bool
    key_hint: Optional[str] = None


class UserProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str
    monthly_cycle_day: int
    safe_runway_threshold: Decimal


class UserProfileUpdateRequest(BaseModel):
    monthly_cycle_day: Optional[int] = Field(None, ge=1, le=31)
    safe_runway_threshold: Optional[Decimal] = Field(None, gt=Decimal("0.00"))


class SettingsResponse(BaseModel):
    telegram: TelegramSettingsResponse
    ai: AISettingsResponse
    profile: Optional[UserProfileResponse] = None


class AIKeyValidateRequest(BaseModel):
    protocol: AIProtocol
    base_url: str
    api_key: str = Field(..., min_length=8, description="Raw API key to test")
    model: Optional[str] = None

    @field_validator("base_url")
    @classmethod
    def _validate_base_url(cls, v: str) -> str:
        return validate_base_url(v)


class AIKeyValidateResponse(BaseModel):
    valid: bool
    message: str


class AISettingsUpdateRequest(BaseModel):
    is_custom_ai_enabled: bool
    provider: AIProvider
    protocol: Optional[AIProtocol] = None
    base_url: Optional[str] = None
    model: str
    api_key: Optional[str] = Field(
        None,
        description="New raw API key to store. If omitted or empty, preserves existing stored key.",
    )

    @model_validator(mode="after")
    def _require_custom_fields(self) -> "AISettingsUpdateRequest":
        if self.is_custom_ai_enabled and self.provider == AIProvider.CUSTOM:
            if self.protocol is None:
                raise ValueError("protocol wajib diisi untuk AI kustom (BYOK).")
            if not self.base_url:
                raise ValueError("base_url wajib diisi untuk AI kustom (BYOK).")
            # https + SSRF check (hermetic: IP-literal only, no DNS in schema).
            validate_base_url(self.base_url)
        return self


class TelegramUnlinkResponse(BaseModel):
    success: bool
    message: str


def validate_ai_credentials(
    protocol: AIProtocol,
    base_url: str,
    api_key: str,
    model: Optional[str] = None,
) -> tuple[bool, str]:
    """Tests BYOK credentials by pinging the configured protocol adapter.

    Enforces the https + SSRF policy (with DNS resolution) before any request.
    """
    clean_key = (api_key or "").strip()
    if not clean_key:
        return False, "Kunci API tidak boleh kosong."

    try:
        safe_url = validate_base_url(base_url, resolve=True)
    except ValueError as e:
        return False, str(e)

    protocol_value = getattr(protocol, "value", str(protocol))
    config = BYOKConfig(
        protocol=protocol_value,
        base_url=safe_url,
        model=(model or "").strip(),
        api_key=clean_key,
    )
    try:
        adapter = get_adapter(config)
        adapter.ping()
        return True, f"Koneksi ke endpoint {protocol_value} berhasil diverifikasi."
    except AuthError:
        return False, "Kunci API ditolak (401 Unauthorized). Periksa kembali API key Anda."
    except RateLimitError:
        return False, "Endpoint membatasi permintaan (429 Rate Limit). Coba lagi nanti."
    except CapabilityUnsupported as e:
        return False, str(e)
    except Exception as e:
        return False, f"Gagal terhubung ke endpoint: {str(e)}"
