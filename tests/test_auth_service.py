"""Tests for AuthService and security utilities."""

from datetime import datetime, timedelta, timezone
import pytest
from jose import jwt

from rezekify.core.config import settings
from rezekify.core.security import verify_password
from rezekify.services.auth import AuthService


def test_user_registration_and_pairing_flow(db_session):
    auth = AuthService(db_session)
    user = auth.register("test@kampus.ac.id", "SecretPass123", "Budi Santoso")
    assert user.email == "test@kampus.ac.id"
    assert user.full_name == "Budi Santoso"
    assert verify_password("SecretPass123", user.password_hash) is True

    token = auth.login("test@kampus.ac.id", "SecretPass123")
    assert token is not None
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload["sub"] == str(user.id)
    assert payload["email"] == "test@kampus.ac.id"

    code = auth.generate_telegram_pairing_code(user.id)
    assert code.startswith("DK-")
    assert len(code) == 7  # DK-XXXX

    linked_user = auth.link_telegram_chat_id(telegram_chat_id=123456789, pairing_code=code)
    assert linked_user.id == user.id
    assert linked_user.telegram_chat_id == 123456789
    assert linked_user.telegram_pairing_code is None


def test_duplicate_registration_rejected(db_session):
    auth = AuthService(db_session)
    auth.register("dupe@test.local", "Pass1", "User A")
    with pytest.raises(ValueError, match="Email sudah terdaftar"):
        auth.register("dupe@test.local", "Pass2", "User B")


def test_invalid_login_credentials(db_session):
    auth = AuthService(db_session)
    auth.register("login@test.local", "CorrectPassword", "Login Tester")

    with pytest.raises(ValueError, match="Email atau kata sandi tidak valid"):
        auth.login("login@test.local", "WrongPassword")

    with pytest.raises(ValueError, match="Email atau kata sandi tidak valid"):
        auth.login("nonexistent@test.local", "AnyPassword")


def test_expired_telegram_pairing_code_rejected(db_session):
    auth = AuthService(db_session)
    user = auth.register("expired@test.local", "Password123", "Expired User")
    code = auth.generate_telegram_pairing_code(user.id)

    # Force code expiration into past
    user.pairing_code_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db_session.commit()

    with pytest.raises(ValueError, match="Kode pairing tidak valid atau telah kedaluwarsa"):
        auth.link_telegram_chat_id(telegram_chat_id=999, pairing_code=code)


def test_invalid_pairing_code_rejected(db_session):
    auth = AuthService(db_session)
    with pytest.raises(ValueError, match="Kode pairing tidak valid atau telah kedaluwarsa"):
        auth.link_telegram_chat_id(telegram_chat_id=999, pairing_code="DK-0000")
