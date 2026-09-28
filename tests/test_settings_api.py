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
from rezekify.db.models import AIProtocol, AIProvider, Base, User, UserSettings
from rezekify.schemas.settings import (
    AIKeyValidateRequest,
    AISettingsResponse,
    AISettingsUpdateRequest,
    validate_ai_credentials,
)


def test_settings_schemas_serialization():
    ai_resp = AISettingsResponse(
        is_custom_ai_enabled=True,
        provider=AIProvider.CUSTOM,
        protocol=AIProtocol.OPENAI,
        base_url="https://api.openai.com/v1",
        model="gpt-4o-mini",
        has_api_key=True,
        key_hint="...ab12",
    )
    assert ai_resp.provider == AIProvider.CUSTOM
    assert ai_resp.protocol == AIProtocol.OPENAI
    assert ai_resp.base_url == "https://api.openai.com/v1"


def test_validate_ai_credentials_success(monkeypatch):
    from rezekify.schemas import settings as settings_mod

    monkeypatch.setattr(
        "rezekify.agent.providers.openai_compatible.OpenAICompatibleAdapter.ping",
        lambda self: None,
    )
    ok, msg = settings_mod.validate_ai_credentials(
        protocol=AIProtocol.OPENAI,
        base_url="https://api.openai.com/v1",
        api_key="sk-valid-key",
        model="gpt-4o-mini",
    )
    assert ok is True


def test_validate_ai_credentials_auth_failure(monkeypatch):
    from rezekify.agent.providers.base import AuthError
    from rezekify.schemas import settings as settings_mod

    def _raise(self):
        raise AuthError("401")

    monkeypatch.setattr(
        "rezekify.agent.providers.openai_compatible.OpenAICompatibleAdapter.ping", _raise
    )
    ok, msg = settings_mod.validate_ai_credentials(
        protocol=AIProtocol.OPENAI,
        base_url="https://api.openai.com/v1",
        api_key="sk-bad-key",
        model="gpt-4o-mini",
    )
    assert ok is False
    assert "401" in msg


def test_validate_ai_credentials_rejects_http_scheme():
    ok, msg = validate_ai_credentials(
        protocol=AIProtocol.OPENAI,
        base_url="http://api.openai.com/v1",
        api_key="sk-valid-key",
        model="gpt-4o-mini",
    )
    assert ok is False
    assert "https" in msg.lower()


def test_validate_ai_credentials_rejects_private_ip():
    ok, msg = validate_ai_credentials(
        protocol=AIProtocol.OPENAI,
        base_url="https://10.0.0.1/v1",
        api_key="sk-valid-key",
        model="gpt-4o-mini",
    )
    assert ok is False


def test_update_request_requires_protocol_and_base_url_when_custom():
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        AISettingsUpdateRequest(
            is_custom_ai_enabled=True,
            provider=AIProvider.CUSTOM,
            model="gpt-4o-mini",
        )


def test_update_request_normalizes_trailing_slash_in_base_url():
    req = AISettingsUpdateRequest(
        is_custom_ai_enabled=True,
        provider=AIProvider.CUSTOM,
        protocol=AIProtocol.OPENAI,
        base_url="https://api.openai.com/v1/",
        model="gpt-4o-mini",
    )
    assert req.base_url == "https://api.openai.com/v1"



def test_validate_request_rejects_http_base_url():
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        AIKeyValidateRequest(
            protocol=AIProtocol.OPENAI,
            base_url="http://api.openai.com/v1",
            api_key="sk-valid-key",
            model="gpt-4o-mini",
        )


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
    assert data["ai"]["protocol"] is None
    assert data["ai"]["base_url"] is None
    assert data["ai"]["model"] == "gemini-2.5-flash"
    assert data["ai"]["has_api_key"] is False
    assert data["ai"]["key_hint"] is None
    assert "encrypted_api_key" not in data["ai"]


def test_post_validate_ai_key_endpoint(api_test_client):
    client, _, _ = api_test_client
    with patch("rezekify.api.v1.settings_router.validate_ai_credentials") as mock_val:
        mock_val.return_value = (True, "OK")
        res = client.post(
            "/api/v1/settings/ai/validate",
            json={
                "protocol": "OPENAI",
                "base_url": "https://api.openai.com/v1",
                "api_key": "sk-Test12345678",
                "model": "gpt-4o-mini",
            },
        )
        assert res.status_code == 200
        assert res.json()["valid"] is True

        mock_val.return_value = (False, "bad key")
        res = client.post(
            "/api/v1/settings/ai/validate",
            json={
                "protocol": "OPENAI",
                "base_url": "https://api.openai.com/v1",
                "api_key": "bad-key-12345678",
            },
        )
        assert res.status_code == 400


def test_post_validate_ai_key_rejects_http(api_test_client):
    client, _, _ = api_test_client
    res = client.post(
        "/api/v1/settings/ai/validate",
        json={
            "protocol": "OPENAI",
            "base_url": "http://api.openai.com/v1",
            "api_key": "sk-Test12345678",
            "model": "gpt-4o-mini",
        },
    )
    assert res.status_code == 422  # Pydantic field validation rejects http scheme


def test_put_ai_settings_requires_key_when_enabling_byok(api_test_client):
    client, _, _ = api_test_client
    res = client.put(
        "/api/v1/settings/ai",
        json={
            "is_custom_ai_enabled": True,
            "provider": "CUSTOM",
            "protocol": "OPENAI",
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-4o-mini",
        },
    )
    assert res.status_code == 400
    assert "Kunci API wajib diisi" in res.json()["detail"]


def test_put_ai_settings_updates_key_and_stores_endpoint(api_test_client):
    client, user, SessionMaker = api_test_client
    res = client.put(
        "/api/v1/settings/ai",
        json={
            "is_custom_ai_enabled": True,
            "provider": "CUSTOM",
            "protocol": "OPENAI",
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-4o-mini",
            "api_key": "sk-brandNewKey123",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["provider"] == "CUSTOM"
    assert data["protocol"] == "OPENAI"
    assert data["base_url"] == "https://api.openai.com/v1"
    assert data["has_api_key"] is True
    assert data["key_hint"] == "...y123"

    # Verify DB persistence
    db = SessionMaker()
    rec = db.query(UserSettings).filter_by(user_id=user.id).first()
    assert rec is not None
    assert rec.ai_provider == AIProvider.CUSTOM
    assert rec.ai_protocol == AIProtocol.OPENAI
    assert rec.ai_base_url == "https://api.openai.com/v1"
    assert decrypt_key(rec.encrypted_api_key) == "sk-brandNewKey123"
    db.close()


def test_put_ai_settings_missing_protocol_returns_422(api_test_client):
    client, _, _ = api_test_client
    res = client.put(
        "/api/v1/settings/ai",
        json={
            "is_custom_ai_enabled": True,
            "provider": "CUSTOM",
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-4o-mini",
            "api_key": "sk-brandNewKey123",
        },
    )
    assert res.status_code == 422  # model validator: protocol required


def test_put_ai_settings_preserves_existing_key_when_omitted(api_test_client):
    client, user, SessionMaker = api_test_client
    # Pre-populate DB with existing encrypted key
    db = SessionMaker()
    rec = UserSettings(
        user_id=user.id,
        ai_provider=AIProvider.CUSTOM,
        ai_protocol=AIProtocol.OPENAI,
        ai_base_url="https://api.openai.com/v1",
        ai_model="gpt-4o-mini",
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
            "provider": "CUSTOM",
            "protocol": "OPENAI",
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-4o",
            "api_key": "",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["model"] == "gpt-4o"
    assert data["protocol"] == "OPENAI"
    assert data["base_url"] == "https://api.openai.com/v1"
    assert data["has_api_key"] is True
    assert data["key_hint"] == "...1234"

    # Verify key wasn't deleted
    db = SessionMaker()
    db_rec = db.query(UserSettings).filter_by(user_id=user.id).first()
    assert decrypt_key(db_rec.encrypted_api_key) == "existing-secret-key-1234"
    db.close()


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

