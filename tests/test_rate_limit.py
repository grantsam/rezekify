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
