"""Tests for FastAPI OpenAPI documentation disabling and CORS method restrictions."""

from fastapi.testclient import TestClient
from rezekify.core.config import settings
from rezekify.api.main import app


def test_docs_hidden_when_show_docs_false(monkeypatch):
    client = TestClient(app)
    if not settings.SHOW_DOCS:
        res = client.get("/docs")
        assert res.status_code == 404
        res_json = client.get("/openapi.json")
        assert res_json.status_code == 404


def test_cors_options_headers():
    client = TestClient(app)
    res = client.options(
        "/healthz",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert res.status_code == 200
    allow_methods = res.headers.get("access-control-allow-methods", "")
    assert "DELETE" in allow_methods
    assert "*" not in allow_methods
