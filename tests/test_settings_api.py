"""Tests for Settings API schemas, probe validator, and REST endpoints."""

from unittest.mock import MagicMock, patch
import pytest

from rezekify.db.models import AIProvider
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


def test_settings_schemas_serialization():
    telegram_resp = TelegramSettingsResponse(
        is_connected=True,
        telegram_chat_id=123456789,
        bot_username="RezekifyBot",
    )
    assert telegram_resp.is_connected is True
    assert telegram_resp.telegram_chat_id == 123456789
    assert telegram_resp.bot_username == "RezekifyBot"

    ai_resp = AISettingsResponse(
        is_custom_ai_enabled=True,
        provider=AIProvider.GEMINI,
        model="gemini-2.5-flash",
        has_api_key=True,
        key_hint="...4x8B",
    )
    assert ai_resp.is_custom_ai_enabled is True
    assert ai_resp.provider == AIProvider.GEMINI
    assert "gemini-2.5-flash" in ai_resp.available_models["GEMINI"]

    settings_resp = SettingsResponse(telegram=telegram_resp, ai=ai_resp)
    assert settings_resp.telegram.is_connected is True
    assert settings_resp.ai.has_api_key is True


def test_validate_ai_credentials_gemini_success():
    with patch("google.genai.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_instance.models.generate_content.return_value = MagicMock(text="pong")
        mock_client_cls.return_value = mock_instance

        valid, msg = validate_ai_credentials(
            provider=AIProvider.GEMINI,
            api_key="valid-gemini-key-123",
            model="gemini-2.5-flash",
        )
        assert valid is True
        assert "berhasil" in msg.lower()
        mock_client_cls.assert_called_once_with(api_key="valid-gemini-key-123")


def test_validate_ai_credentials_gemini_failure():
    with patch("google.genai.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_instance.models.generate_content.side_effect = Exception("API_KEY_INVALID")
        mock_client_cls.return_value = mock_instance

        valid, msg = validate_ai_credentials(
            provider=AIProvider.GEMINI,
            api_key="invalid-gemini-key",
            model="gemini-2.5-flash",
        )
        assert valid is False
        assert "API_KEY_INVALID" in msg


def test_validate_ai_credentials_groq_success():
    with patch("groq.Groq") as mock_groq_cls:
        mock_instance = MagicMock()
        mock_instance.chat.completions.create.return_value = MagicMock()
        mock_groq_cls.return_value = mock_instance

        valid, msg = validate_ai_credentials(
            provider=AIProvider.GROQ,
            api_key="valid-groq-key-123",
            model="llama-3.3-70b",
        )
        assert valid is True
        assert "berhasil" in msg.lower()
        mock_groq_cls.assert_called_once_with(api_key="valid-groq-key-123")


def test_validate_ai_credentials_groq_failure():
    with patch("groq.Groq") as mock_groq_cls:
        mock_instance = MagicMock()
        mock_instance.chat.completions.create.side_effect = Exception("Invalid API Key")
        mock_groq_cls.return_value = mock_instance

        valid, msg = validate_ai_credentials(
            provider=AIProvider.GROQ,
            api_key="invalid-groq-key",
            model="llama-3.3-70b",
        )
        assert valid is False
        assert "Invalid API Key" in msg


def test_validate_ai_credentials_unsupported_provider():
    valid, msg = validate_ai_credentials(
        provider=AIProvider.SYSTEM,
        api_key="any-key",
    )
    assert valid is False
    assert "tidak memerlukan validasi kunci" in msg.lower()
