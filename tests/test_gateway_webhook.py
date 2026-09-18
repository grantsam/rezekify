"""Tests for healthz probe and Telegram webhook gateway router."""

from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient

from rezekify.api.deps import get_db
from rezekify.api.main import app


@pytest.fixture
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_healthz_endpoint_healthy(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    data = response.json()
    assert data == {
        "status": "healthy",
        "database": "connected",
        "version": "1.0.0",
    }


def test_healthz_endpoint_unhealthy(client):
    mock_session = MagicMock()
    mock_session.execute.side_effect = Exception("Database connection failure")

    def broken_get_db():
        yield mock_session

    app.dependency_overrides[get_db] = broken_get_db
    try:
        response = client.get("/healthz")
        assert response.status_code == 503
        data = response.json()
        assert data == {
            "status": "unhealthy",
            "database": "disconnected",
            "version": "1.0.0",
        }
    finally:
        app.dependency_overrides.clear()


def test_telegram_webhook_start_command(client):
    payload = {
        "update_id": 10001,
        "message": {
            "message_id": 1,
            "chat": {"id": 12345},
            "text": "/start",
        },
    }
    response = client.post("/api/v1/gateway/telegram/webhook", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "Selamat datang di Bot Keuangan Rezekify" in data["result"]


def test_telegram_webhook_empty_payload(client):
    response = client.post("/api/v1/gateway/telegram/webhook", json={})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "Invalid update payload" in data["result"]


def test_telegram_webhook_unlinked_user(client):
    payload = {
        "update_id": 10002,
        "message": {
            "message_id": 2,
            "chat": {"id": 888888},
            "text": "beli kopi 25rb",
        },
    }
    response = client.post("/api/v1/gateway/telegram/webhook", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "belum terhubung" in data["result"]
