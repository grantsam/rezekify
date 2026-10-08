"""Tests for Password Reset OTP endpoints and lifecycle logic."""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from rezekify.api.deps import get_db
from rezekify.api.main import app
from rezekify.core.security import hash_password, verify_password
from rezekify.db.models import User
from tests.test_api_endpoints import override_get_db

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def override_db(db_session):
    def _get_db():
        yield db_session
    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides[get_db] = override_get_db



@pytest.fixture
def test_user(db_session):
    user = User(
        email="reset_target@example.com",
        password_hash=hash_password("OldPassword123!"),
        full_name="Target User",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@patch("rezekify.services.email.EmailService.send_password_reset_email", return_value=True)
def test_forgot_password_unknown_email_returns_200(mock_send):
    resp = client.post("/api/v1/auth/forgot-password", json={"email": "nonexistent@example.com"})
    assert resp.status_code == 200
    assert "kode verifikasi" in resp.json()["message"].lower()
    assert not mock_send.called


@patch("rezekify.services.email.EmailService.send_password_reset_email", return_value=True)
def test_forgot_password_valid_user_creates_otp_hash_and_sends_email(mock_send, test_user, db_session):
    resp = client.post("/api/v1/auth/forgot-password", json={"email": test_user.email})
    assert resp.status_code == 200
    assert mock_send.called
    to_email, otp_code = mock_send.call_args[0]
    assert to_email == test_user.email
    assert len(otp_code) == 6
    assert otp_code.isdigit()

    db_session.refresh(test_user)
    assert test_user.password_reset_otp_hash is not None
    expires_at = test_user.password_reset_expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    assert expires_at > datetime.now(timezone.utc)
    assert test_user.password_reset_attempts == 0


@patch("rezekify.services.email.EmailService.send_password_reset_email", return_value=True)
def test_reset_password_success(mock_send, test_user, db_session):
    # 1. Request OTP
    client.post("/api/v1/auth/forgot-password", json={"email": test_user.email})
    otp_code = mock_send.call_args[0][1]

    # 2. Reset with correct OTP
    resp = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": test_user.email,
            "otp_code": otp_code,
            "new_password": "BrandNewPassword123!",
        },
    )
    assert resp.status_code == 200
    assert "berhasil" in resp.json()["message"].lower()

    # 3. Verify DB state
    db_session.refresh(test_user)
    assert verify_password("BrandNewPassword123!", test_user.password_hash) is True
    assert test_user.password_reset_otp_hash is None
    assert test_user.password_reset_expires_at is None
    assert test_user.password_reset_attempts == 0


@patch("rezekify.services.email.EmailService.send_password_reset_email", return_value=True)
def test_reset_password_expired_otp_rejected(mock_send, test_user, db_session):
    client.post("/api/v1/auth/forgot-password", json={"email": test_user.email})
    otp_code = mock_send.call_args[0][1]

    # Force expiration into past
    db_session.refresh(test_user)
    test_user.password_reset_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db_session.commit()

    resp = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": test_user.email,
            "otp_code": otp_code,
            "new_password": "BrandNewPassword123!",
        },
    )
    assert resp.status_code == 400
    assert "kadaluwarsa" in resp.json()["detail"].lower()


@patch("rezekify.services.email.EmailService.send_password_reset_email", return_value=True)
def test_reset_password_wrong_otp_increments_attempts(mock_send, test_user, db_session):
    client.post("/api/v1/auth/forgot-password", json={"email": test_user.email})

    resp = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": test_user.email,
            "otp_code": "000000",
            "new_password": "BrandNewPassword123!",
        },
    )
    assert resp.status_code == 400
    assert "sisa percobaan: 4" in resp.json()["detail"].lower()

    db_session.refresh(test_user)
    assert test_user.password_reset_attempts == 1


@patch("rezekify.services.email.EmailService.send_password_reset_email", return_value=True)
def test_reset_password_fifth_attempt_invalidates_otp(mock_send, test_user, db_session):
    client.post("/api/v1/auth/forgot-password", json={"email": test_user.email})

    db_session.refresh(test_user)
    test_user.password_reset_attempts = 4
    db_session.commit()

    # 5th failed attempt
    resp = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": test_user.email,
            "otp_code": "000000",
            "new_password": "BrandNewPassword123!",
        },
    )
    assert resp.status_code == 400
    assert "dibatalkan" in resp.json()["detail"].lower()

    db_session.refresh(test_user)
    assert test_user.password_reset_otp_hash is None
    assert test_user.password_reset_expires_at is None
    assert test_user.password_reset_attempts == 0
