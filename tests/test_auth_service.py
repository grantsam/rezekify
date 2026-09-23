"""Tests for AuthService and security utilities."""

from datetime import datetime, timedelta, timezone
import re
from unittest.mock import patch
import pytest
from jose import jwt

from rezekify.core.config import settings
from rezekify.core.security import PAIRING_ALPHABET, generate_pairing_code, verify_password
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
    assert re.match(r"^DK-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$", code)
    assert len(code) == 9  # DK-XXXXXX

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


def test_telegram_pairing_reassigns_chat_id_cleanly(db_session):
    auth = AuthService(db_session)
    user1 = auth.register("user1@test.local", "Password123!", "User 1")
    user2 = auth.register("user2@test.local", "Password123!", "User 2")

    code1 = auth.generate_telegram_pairing_code(user1.id)
    auth.link_telegram_chat_id(telegram_chat_id=1234567, pairing_code=code1)
    assert user1.telegram_chat_id == 1234567

    code2 = auth.generate_telegram_pairing_code(user2.id)
    auth.link_telegram_chat_id(telegram_chat_id=1234567, pairing_code=code2)
    db_session.refresh(user1)
    db_session.refresh(user2)
    assert user1.telegram_chat_id is None
    assert user2.telegram_chat_id == 1234567


def test_pairing_code_generator_entropy_and_alphabet():
    for _ in range(50):
        code = generate_pairing_code()
        assert re.match(r"^DK-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$", code)
        suffix = code.split("-")[1]
        assert len(suffix) == 6
        assert all(c in PAIRING_ALPHABET for c in suffix)


def test_telegram_pairing_collision_retry_succeeds(db_session):
    auth = AuthService(db_session)
    user1 = auth.register("col1@test.local", "Password123!", "Collision User 1")
    user2 = auth.register("col2@test.local", "Password123!", "Collision User 2")

    user1.telegram_pairing_code = "DK-COLLID"
    user1.pairing_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    db_session.commit()

    with patch(
        "rezekify.services.auth.generate_pairing_code",
        side_effect=["DK-COLLID", "DK-COLLID", "DK-UNIQUE"],
    ) as mock_gen:
        code = auth.generate_telegram_pairing_code(user2.id)
        assert code == "DK-UNIQUE"
        assert mock_gen.call_count == 3

    db_session.refresh(user2)
    assert user2.telegram_pairing_code == "DK-UNIQUE"


def test_telegram_pairing_collision_retry_exhausted_raises(db_session):
    auth = AuthService(db_session)
    user1 = auth.register("col3@test.local", "Password123!", "Collision User 3")
    user2 = auth.register("col4@test.local", "Password123!", "Collision User 4")

    user1.telegram_pairing_code = "DK-COLLID"
    user1.pairing_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    db_session.commit()

    with patch(
        "rezekify.services.auth.generate_pairing_code",
        return_value="DK-COLLID",
    ) as mock_gen:
        with pytest.raises(RuntimeError, match="Gagal menghasilkan kode pairing yang unik"):
            auth.generate_telegram_pairing_code(user2.id)
        assert mock_gen.call_count == 5


def test_telegram_pairing_collision_allows_expired_code(db_session):
    auth = AuthService(db_session)
    user1 = auth.register("col5@test.local", "Password123!", "Collision User 5")
    user2 = auth.register("col6@test.local", "Password123!", "Collision User 6")

    user1.telegram_pairing_code = "DK-EXPIRE"
    user1.pairing_code_expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    db_session.commit()

    with patch(
        "rezekify.services.auth.generate_pairing_code",
        return_value="DK-EXPIRE",
    ) as mock_gen:
        code = auth.generate_telegram_pairing_code(user2.id)
        assert code == "DK-EXPIRE"
        assert mock_gen.call_count == 1

    db_session.refresh(user1)
    db_session.refresh(user2)
    assert user1.telegram_pairing_code is None
    assert user2.telegram_pairing_code == "DK-EXPIRE"


def test_telegram_pairing_code_collision_retry(db_session):
    auth = AuthService(db_session)
    u1 = auth.register("u1@rezekify.local", "Password123!", "User 1")
    code1 = auth.generate_telegram_pairing_code(u1.id)
    assert len(code1) == 9


