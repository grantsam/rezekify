"""Unit tests for in-memory sliding-window RateLimiter."""

import time
from uuid import uuid4
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from rezekify.core.rate_limit import RateLimiter
from rezekify.core.security import create_access_token


def test_rate_limiter_allows_requests_within_threshold():
    app = FastAPI()
    limiter = RateLimiter(max_requests=3, window_seconds=60)

    @app.get("/test", dependencies=[Depends(limiter)])
    def test_endpoint():
        return {"ok": True}

    client = TestClient(app)
    for _ in range(3):
        res = client.get("/test")
        assert res.status_code == 200


def test_rate_limiter_rejects_burst_exceeding_threshold():
    app = FastAPI()
    limiter = RateLimiter(max_requests=2, window_seconds=60)

    @app.get("/test", dependencies=[Depends(limiter)])
    def test_endpoint():
        return {"ok": True}

    client = TestClient(app)
    assert client.get("/test").status_code == 200
    assert client.get("/test").status_code == 200

    # Third request must fail with 429
    res = client.get("/test")
    assert res.status_code == 429
    assert "Retry-After" in res.headers
    assert int(res.headers["Retry-After"]) > 0
    assert "Batas permintaan tercapai" in res.json()["detail"]


def test_rate_limiter_sliding_window_expiration():
    app = FastAPI()
    # 2 requests per 1 second window
    limiter = RateLimiter(max_requests=2, window_seconds=1)

    @app.get("/test", dependencies=[Depends(limiter)])
    def test_endpoint():
        return {"ok": True}

    client = TestClient(app)
    assert client.get("/test").status_code == 200
    assert client.get("/test").status_code == 200
    assert client.get("/test").status_code == 429

    # Wait for sliding window to elapse
    time.sleep(1.05)
    res = client.get("/test")
    assert res.status_code == 200


def test_rate_limiter_isolates_authenticated_users():
    app = FastAPI()
    limiter = RateLimiter(max_requests=2, window_seconds=60)

    @app.get("/test", dependencies=[Depends(limiter)])
    def test_endpoint():
        return {"ok": True}

    client = TestClient(app)
    user_a_token = create_access_token({"sub": str(uuid4())})
    user_b_token = create_access_token({"sub": str(uuid4())})

    headers_a = {"Authorization": f"Bearer {user_a_token}"}
    headers_b = {"Authorization": f"Bearer {user_b_token}"}

    # User A consumes their 2 requests
    assert client.get("/test", headers=headers_a).status_code == 200
    assert client.get("/test", headers=headers_a).status_code == 200
    assert client.get("/test", headers=headers_a).status_code == 429

    # User B has their own separate bucket and should succeed
    assert client.get("/test", headers=headers_b).status_code == 200
    assert client.get("/test", headers=headers_b).status_code == 200
    assert client.get("/test", headers=headers_b).status_code == 429


def test_rate_limiter_evicts_empty_keys():
    from fastapi import Request
    limiter = RateLimiter(max_requests=2, window_seconds=1)
    mock_request = Request({"type": "http", "headers": [], "client": ("127.0.0.1", 12345)})
    limiter(mock_request)
    assert "ip:127.0.0.1" in limiter._history
    time.sleep(1.1)
    # Next call after expiry should evict empty key before appending new
    limiter(mock_request)
    assert len(limiter._history["ip:127.0.0.1"]) == 1


def test_rate_limiter_evicts_empty_keys_when_all_requests_expire():
    from fastapi import Request
    limiter = RateLimiter(max_requests=2, window_seconds=1)
    req1 = Request({"type": "http", "headers": [], "client": ("192.168.1.10", 12345)})
    req2 = Request({"type": "http", "headers": [], "client": ("192.168.1.20", 12345)})

    limiter(req1)
    assert "ip:192.168.1.10" in limiter._history

    # Wait for req1 to expire
    time.sleep(1.1)

    # Next call from a different client triggers eviction of the expired empty key
    limiter(req2)
    assert "ip:192.168.1.10" not in limiter._history
    assert "ip:192.168.1.20" in limiter._history


def test_auth_login_rate_limit_exceeded():
    from rezekify.api.main import app
    from rezekify.api.v1.auth_router import auth_limiter

    auth_limiter.reset()
    client = TestClient(app, raise_server_exceptions=False)

    for _ in range(auth_limiter.max_requests):
        res = client.post(
            "/api/v1/auth/login",
            json={"email": "nonexistent@test.com", "password": "wrongpassword123"},
        )
        assert res.status_code != 429

    # Next request must be throttled with 429
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@test.com", "password": "wrongpassword123"},
    )
    assert res.status_code == 429
    assert "Retry-After" in res.headers
    auth_limiter.reset()


def test_settings_ai_validate_rate_limit_exceeded():
    from unittest.mock import patch
    from rezekify.api.main import app
    from rezekify.api.v1.settings_router import ai_validate_limiter
    from rezekify.api.deps import get_current_user
    from rezekify.db.models import User

    ai_validate_limiter.reset()
    mock_user = User(
        id=uuid4(),
        email="ai_test@rezekify.local",
        password_hash="dummy",
        full_name="AI Tester",
    )
    app.dependency_overrides[get_current_user] = lambda: mock_user
    client = TestClient(app, raise_server_exceptions=False)

    try:
        with patch("rezekify.api.v1.settings_router.validate_ai_credentials") as mock_val:
            mock_val.return_value = (True, "Valid")
            payload = {"provider": "GEMINI", "api_key": "AIzaSyDummy12345678", "model": "gemini-2.5-flash"}

            for _ in range(ai_validate_limiter.max_requests):
                res = client.post("/api/v1/settings/ai/validate", json=payload)
                assert res.status_code == 200

            # Next request must exceed limit and return 429
            res = client.post("/api/v1/settings/ai/validate", json=payload)
            assert res.status_code == 429
            assert "Retry-After" in res.headers
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        ai_validate_limiter.reset()


def test_rate_limiter_bounds_maximum_tracked_keys():
    from fastapi import Request
    limiter = RateLimiter(max_requests=5, window_seconds=60)
    limiter.max_tracked_keys = 20

    # Fill limiter with 30 unique IP requests
    for i in range(30):
        req = Request({"type": "http", "headers": [], "client": (f"10.0.0.{i}", 12345)})
        limiter(req)

    # Must be bounded around or below 20 keys
    assert len(limiter._history) <= 25


