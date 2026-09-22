import pytest
from pydantic import ValidationError
from rezekify.core.config import Settings


def test_development_allows_default_secret_key():
    s = Settings(ENVIRONMENT="development", SECRET_KEY="rezekify-secure-random-jwt-key-development")
    assert s.SECRET_KEY == "rezekify-secure-random-jwt-key-development"


def test_production_rejects_default_secret_key():
    with pytest.raises(ValidationError) as exc:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="rezekify-secure-random-jwt-key-development",
        )
    assert "SECRET_KEY must be securely set in production" in str(exc.value)


def test_production_rejects_empty_secret_key():
    with pytest.raises(ValidationError) as exc:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="",
        )
    assert "SECRET_KEY must be securely set in production" in str(exc.value)


def test_production_rejects_whitespace_secret_key():
    with pytest.raises(ValidationError) as exc:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="   ",
        )
    assert "SECRET_KEY must be securely set in production" in str(exc.value)


def test_production_accepts_secure_secret_key():
    s = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="a-very-strong-production-secret-key-32-chars-long",
    )
    assert s.SECRET_KEY == "a-very-strong-production-secret-key-32-chars-long"


def test_trusted_host_middleware_blocks_unauthorized_host():
    from fastapi.testclient import TestClient
    from rezekify.api.main import app

    client = TestClient(app)
    # Valid host
    res_valid = client.get("/healthz", headers={"host": "localhost"})
    assert res_valid.status_code in [200, 503]

    # Spoofed/Untrusted host
    res_invalid = client.get("/healthz", headers={"host": "malicious-domain.com"})
    assert res_invalid.status_code == 400
    assert "Invalid host header" in res_invalid.text

