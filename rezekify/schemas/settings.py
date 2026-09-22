"""Pydantic schemas and live validation logic for user settings and AI BYOK."""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from rezekify.db.models import AIProvider

AVAILABLE_MODELS: Dict[str, List[str]] = {
    "GEMINI": [
        "gemini-2.5-flash",
        "gemini-2.5-pro",
    ],
    "GROQ": [
        "llama-4-scout-17b",
        "llama-3.3-70b",
    ],
}


class TelegramSettingsResponse(BaseModel):
    is_connected: bool
    telegram_chat_id: Optional[int] = None
    bot_username: str


class AISettingsResponse(BaseModel):
    is_custom_ai_enabled: bool
    provider: AIProvider
    model: str
    has_api_key: bool
    key_hint: Optional[str] = None
    available_models: Dict[str, List[str]] = Field(default_factory=lambda: AVAILABLE_MODELS)


class SettingsResponse(BaseModel):
    telegram: TelegramSettingsResponse
    ai: AISettingsResponse


class AIKeyValidateRequest(BaseModel):
    provider: AIProvider
    api_key: str = Field(..., min_length=8, description="Raw API key to test")
    model: Optional[str] = None


class AIKeyValidateResponse(BaseModel):
    valid: bool
    message: str


class AISettingsUpdateRequest(BaseModel):
    is_custom_ai_enabled: bool
    provider: AIProvider
    model: str
    api_key: Optional[str] = Field(
        None,
        description="New raw API key to store. If omitted or empty, preserves existing stored key.",
    )


class TelegramUnlinkResponse(BaseModel):
    success: bool
    message: str


def validate_ai_credentials(
    provider: AIProvider, api_key: str, model: Optional[str] = None
) -> tuple[bool, str]:
    """Tests an API key against the provider with a lightweight ping probe."""
    clean_key = api_key.strip()
    if not clean_key:
        return False, "Kunci API tidak boleh kosong."

    if provider == AIProvider.GEMINI:
        try:
            from google import genai
            gemini_client = genai.Client(api_key=clean_key)
            target_model = model or "gemini-2.5-flash"
            gemini_client.models.generate_content(
                model=target_model,
                contents="ping",
            )
            return True, "Koneksi ke Google Gemini berhasil diverifikasi."
        except Exception as e:
            return False, f"Kunci API Google Gemini tidak valid: {str(e)}"

    elif provider == AIProvider.GROQ:
        try:
            from groq import Groq
            groq_client = Groq(api_key=clean_key)
            target_model = "llama-3.3-70b-versatile"
            groq_client.chat.completions.create(
                model=target_model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=1,
            )
            return True, "Koneksi ke Groq Cloud berhasil diverifikasi."
        except Exception as e:
            return False, f"Kunci API Groq tidak valid: {str(e)}"

    return False, "Provider SYSTEM tidak memerlukan validasi kunci kustom."
