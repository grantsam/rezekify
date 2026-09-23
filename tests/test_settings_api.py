"""Tests for Settings API schemas, probe validator, and REST endpoints."""

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from rezekify.api.deps import get_current_user, get_db
from rezekify.api.main import app
from rezekify.core.crypto import decrypt_key, encrypt_key
from rezekify.db.models import AIProvider, Base, User, UserSettings
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

    profile_resp = UserProfileResponse(
        id="user-123",
        email="test@user.local",
        full_name="Test User",
        monthly_cycle_day=1,
        safe_runway_threshold=Decimal("30000.00"),
    )
    assert profile_resp.monthly_cycle_day == 1
    assert profile_resp.safe_runway_threshold == Decimal("30000.00")

    settings_resp = SettingsResponse(telegram=telegram_resp, ai=ai_resp, profile=profile_resp)
    assert settings_resp.telegram.is_connected is True
    assert settings_resp.ai.has_api_key is True
    assert settings_resp.profile is not None
    assert settings_resp.profile.monthly_cycle_day == 1


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
            model="llama-3.3-70b-versatile",
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
            model="llama-3.3-70b-versatile",
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


@pytest.fixture
def api_test_client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    session = TestingSession()
    user = User(
        email="settings_user@rezekify.local",
        password_hash="test_pw_hash",
        full_name="Settings Tester",
        telegram_chat_id=888999,
        telegram_pairing_code="DK-TEST",
        pairing_code_expires_at=datetime.now(timezone.utc),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    def override_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    def override_user():
        db = TestingSession()
        try:
            return db.query(User).filter_by(id=user.id).one()
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user
    client = TestClient(app, raise_server_exceptions=False)
    yield client, user, TestingSession
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)


def test_get_settings_auto_creates_default_and_omits_secrets(api_test_client):
    client, user, SessionMaker = api_test_client
    res = client.get("/api/v1/settings")
    assert res.status_code == 200
    data = res.json()

    assert "telegram" in data
    assert data["telegram"]["is_connected"] is True
    assert data["telegram"]["telegram_chat_id"] == 888999
    assert data["telegram"]["bot_username"] == "RezekifyBot"

    assert "ai" in data
    assert data["ai"]["is_custom_ai_enabled"] is False
    assert data["ai"]["provider"] == "SYSTEM"
    assert data["ai"]["model"] == "gemini-2.5-flash"
    assert data["ai"]["has_api_key"] is False
    assert data["ai"]["key_hint"] is None
    assert "encrypted_api_key" not in data["ai"]


def test_post_validate_ai_key_endpoint(api_test_client):
    client, _, _ = api_test_client
    with patch("rezekify.api.v1.settings_router.validate_ai_credentials") as mock_val:
        mock_val.return_value = (True, "Koneksi berhasil diverifikasi.")
        res = client.post(
            "/api/v1/settings/ai/validate",
            json={"provider": "GEMINI", "api_key": "AIzaSyTest12345678", "model": "gemini-2.5-flash"},
        )
        assert res.status_code == 200
        assert res.json()["valid"] is True

        mock_val.return_value = (False, "API_KEY_INVALID")
        res_fail = client.post(
            "/api/v1/settings/ai/validate",
            json={"provider": "GEMINI", "api_key": "bad-key-12345678"},
        )
        assert res_fail.status_code == 400
        assert "API_KEY_INVALID" in res_fail.json()["detail"]


def test_put_ai_settings_requires_key_when_enabling_byok(api_test_client):
    client, _, _ = api_test_client
    res = client.put(
        "/api/v1/settings/ai",
        json={
            "is_custom_ai_enabled": True,
            "provider": "GEMINI",
            "model": "gemini-2.5-flash",
            "api_key": None,
        },
    )
    assert res.status_code == 400
    assert "Kunci API wajib diisi" in res.json()["detail"]


def test_put_ai_settings_updates_key_and_hint(api_test_client):
    client, user, SessionMaker = api_test_client
    res = client.put(
        "/api/v1/settings/ai",
        json={
            "is_custom_ai_enabled": True,
            "provider": "GEMINI",
            "model": "gemini-2.5-flash",
            "api_key": "AIzaSyD-SuperSecret9999",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_custom_ai_enabled"] is True
    assert data["has_api_key"] is True
    assert data["key_hint"] == "...9999"

    # Verify encrypted key in DB
    db = SessionMaker()
    rec = db.query(UserSettings).filter_by(user_id=user.id).first()
    assert rec is not None
    assert rec.encrypted_api_key is not None
    assert decrypt_key(rec.encrypted_api_key) == "AIzaSyD-SuperSecret9999"
    db.close()


def test_put_ai_settings_preserves_existing_key_when_omitted(api_test_client):
    client, user, SessionMaker = api_test_client
    # Pre-populate DB with existing encrypted key
    db = SessionMaker()
    rec = UserSettings(
        user_id=user.id,
        ai_provider=AIProvider.GEMINI,
        ai_model="gemini-2.5-flash",
        encrypted_api_key=encrypt_key("existing-secret-key-1234"),
        key_hint="...1234",
        is_custom_ai_enabled=True,
    )
    db.merge(rec)
    db.commit()
    db.close()

    # Update only the model without providing api_key
    res = client.put(
        "/api/v1/settings/ai",
        json={
            "is_custom_ai_enabled": True,
            "provider": "GEMINI",
            "model": "gemini-2.5-pro",
            "api_key": "",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["model"] == "gemini-2.5-pro"
    assert data["has_api_key"] is True
    assert data["key_hint"] == "...1234"

    # Verify key wasn't deleted
    db = SessionMaker()
    db_rec = db.query(UserSettings).filter_by(user_id=user.id).first()
    assert decrypt_key(db_rec.encrypted_api_key) == "existing-secret-key-1234"
    db.close()


def test_put_ai_settings_requires_new_key_when_switching_provider(api_test_client):
    client, user, SessionMaker = api_test_client
    # Pre-populate DB with existing GEMINI key
    db = SessionMaker()
    rec = UserSettings(
        user_id=user.id,
        ai_provider=AIProvider.GEMINI,
        ai_model="gemini-2.5-flash",
        encrypted_api_key=encrypt_key("existing-gemini-key"),
        key_hint="...1234",
        is_custom_ai_enabled=True,
    )
    db.merge(rec)
    db.commit()
    db.close()

    # Attempt to switch to GROQ without new api_key
    res = client.put(
        "/api/v1/settings/ai",
        json={
            "is_custom_ai_enabled": True,
            "provider": "GROQ",
            "model": "llama-3.3-70b-versatile",
            "api_key": None,
        },
    )
    assert res.status_code == 400
    assert "Kunci API baru wajib diisi saat mengganti provider AI." in res.json()["detail"]

    # Now provide new key for GROQ - should succeed
    res_ok = client.put(
        "/api/v1/settings/ai",
        json={
            "is_custom_ai_enabled": True,
            "provider": "GROQ",
            "model": "llama-3.3-70b-versatile",
            "api_key": "gsk_newgroqkey9999",
        },
    )
    assert res_ok.status_code == 200
    data = res_ok.json()
    assert data["provider"] == "GROQ"
    assert data["model"] == "llama-3.3-70b-versatile"
    assert data["key_hint"] == "...9999"


def test_unlink_telegram_endpoint(api_test_client):
    client, user, SessionMaker = api_test_client
    res = client.post("/api/v1/settings/telegram/unlink")
    assert res.status_code == 200
    assert res.json()["success"] is True

    # Verify user telegram fields cleared in DB
    db = SessionMaker()
    refreshed_user = db.query(User).filter_by(id=user.id).first()
    assert refreshed_user.telegram_chat_id is None
    assert refreshed_user.telegram_pairing_code is None
    assert refreshed_user.pairing_code_expires_at is None
    db.close()

    # Subsequent GET /settings reflects disconnected status
    get_res = client.get("/api/v1/settings")
    assert get_res.json()["telegram"]["is_connected"] is False


def test_get_settings_returns_profile(api_test_client):
    client, user, SessionMaker = api_test_client
    res = client.get("/api/v1/settings")
    assert res.status_code == 200
    data = res.json()
    assert "profile" in data
    profile = data["profile"]
    assert profile["email"] == "settings_user@rezekify.local"
    assert profile["monthly_cycle_day"] == 1
    assert Decimal(str(profile["safe_runway_threshold"])) == Decimal("30000.00")


def test_put_user_profile_success(api_test_client):
    client, user, SessionMaker = api_test_client
    res = client.put(
        "/api/v1/settings/profile",
        json={
            "monthly_cycle_day": 15,
            "safe_runway_threshold": 45000.00,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["monthly_cycle_day"] == 15
    assert Decimal(str(data["safe_runway_threshold"])) == Decimal("45000.00")

    # Verify DB persistence
    db = SessionMaker()
    refreshed_user = db.query(User).filter_by(id=user.id).first()
    assert refreshed_user.monthly_cycle_day == 15
    assert Decimal(str(refreshed_user.safe_runway_threshold)) == Decimal("45000.00")
    db.close()

    # Subsequent GET /settings reflects updated profile
    get_res = client.get("/api/v1/settings")
    assert get_res.json()["profile"]["monthly_cycle_day"] == 15
    assert Decimal(str(get_res.json()["profile"]["safe_runway_threshold"])) == Decimal("45000.00")


def test_put_user_profile_validation_rejections(api_test_client):
    client, user, SessionMaker = api_test_client
    # monthly_cycle_day = 32 (invalid, > 31)
    res_bad_day = client.put(
        "/api/v1/settings/profile",
        json={"monthly_cycle_day": 32},
    )
    assert res_bad_day.status_code in (400, 422)

    # safe_runway_threshold = -1000 (invalid, <= 0)
    res_bad_threshold = client.put(
        "/api/v1/settings/profile",
        json={"safe_runway_threshold": -1000.00},
    )
    assert res_bad_threshold.status_code in (400, 422)

