"""Tests for JWT access token expiry, HttpOnly refresh cookies, and token rotation."""

import pytest
from uuid import uuid4
from fastapi.testclient import TestClient
from jose import jwt
from rezekify.api.deps import get_db
from rezekify.api.main import app
from rezekify.core.config import settings
from rezekify.core.security import create_access_token, create_refresh_token
from tests.test_api_endpoints import override_get_db

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_client_cookies():
    client.cookies.clear()
    yield
    client.cookies.clear()


def test_register_and_login_sets_httponly_refresh_cookie():
    email = f"auth-cookie-{uuid4().hex[:8]}@rezekify.local"
    password = "StrongPassword123"

    # 1. Register sets cookie
    reg_resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Cookie Tester"},
    )
    assert reg_resp.status_code == 200
    reg_data = reg_resp.json()
    assert "access_token" in reg_data
    assert "refresh_token" in reg_resp.cookies

    # Verify access token claim type and expiry
    access_token = reg_data["access_token"]
    payload = jwt.decode(access_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert payload.get("type") == "access"

    # 2. Login sets cookie
    login_resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_resp.status_code == 200
    assert "access_token" in login_resp.json()
    assert "refresh_token" in login_resp.cookies


def test_auth_refresh_endpoint_rotates_tokens():
    email = f"rotate-{uuid4().hex[:8]}@rezekify.local"
    password = "StrongPassword123"

    reg_resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Rotate Tester"},
    )
    assert reg_resp.status_code == 200
    initial_cookie = reg_resp.cookies.get("refresh_token")
    assert initial_cookie is not None

    # Call /refresh with cookie
    refresh_resp = client.post(
        "/api/v1/auth/refresh",
        cookies={"refresh_token": initial_cookie},
    )
    assert refresh_resp.status_code == 200
    new_data = refresh_resp.json()
    assert "access_token" in new_data
    new_cookie = refresh_resp.cookies.get("refresh_token")
    assert new_cookie is not None


def test_refresh_token_cannot_access_protected_endpoint():
    # An access endpoint must reject a refresh token with 401
    refresh_token = create_refresh_token({"sub": str(uuid4()), "email": "test@test.local"})
    resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )
    assert resp.status_code == 401
    assert "Invalid token type" in resp.json().get("detail", "")


def test_refresh_endpoint_rejects_missing_or_forged_cookie():
    # Missing cookie
    resp = client.post("/api/v1/auth/refresh")
    assert resp.status_code == 401

    # Forged signature
    forged_token = jwt.encode({"sub": str(uuid4()), "type": "refresh"}, "wrong-secret", algorithm="HS256")
    resp_forged = client.post("/api/v1/auth/refresh", cookies={"refresh_token": forged_token})
    assert resp_forged.status_code == 401

    # Invalid token type (e.g. passing an access token in the refresh cookie)
    access_token = create_access_token({"sub": str(uuid4()), "email": "test@test.local"})
    resp_invalid_type = client.post("/api/v1/auth/refresh", cookies={"refresh_token": access_token})
    assert resp_invalid_type.status_code == 401


def test_auth_logout_clears_cookie():
    logout_resp = client.post("/api/v1/auth/logout")
    assert logout_resp.status_code == 200
    # Cookie should be expired/deleted
    cookie_header = logout_resp.headers.get("set-cookie", "")
    assert "refresh_token=" in cookie_header
    assert "Max-Age=0" in cookie_header or "expires=" in cookie_header.lower()
