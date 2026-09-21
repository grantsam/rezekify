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


def test_production_accepts_secure_secret_key():
    s = Settings(
        ENVIRONMENT="production",
        SECRET_KEY="a-very-strong-production-secret-key-32-chars-long",
    )
    assert s.SECRET_KEY == "a-very-strong-production-secret-key-32-chars-long"
