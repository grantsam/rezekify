"""Application configuration settings using pydantic-settings."""

import json
from typing import List, Optional, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_DEV_SECRET = "rezekify-secure-random-jwt-key-development"


class Settings(BaseSettings):
    PROJECT_NAME: str = "rezekify"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SHOW_DOCS: bool = False

    # Database
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/rezekify"
    TEST_DATABASE_URL: str = "sqlite:///:memory:"

    # Security
    SECRET_KEY: str = DEFAULT_DEV_SECRET
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: Union[str, List[str]]) -> List[str]:
        # ponytail: parses comma-separated or JSON list strings; upgrade to pydantic AnyHttpUrl if scheme validation needed.
        if isinstance(v, str):
            v_stripped = v.strip()
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                try:
                    parsed = json.loads(v_stripped)
                    if isinstance(parsed, list):
                        return [str(o).strip().rstrip("/") for o in parsed if str(o).strip()]
                except (json.JSONDecodeError, ValueError):
                    pass
            return [o.strip().rstrip("/") for o in v.split(",") if o.strip()]
        if isinstance(v, list):
            return [str(o).strip().rstrip("/") for o in v if str(o).strip()]
        return v

    ALLOWED_HOSTS: List[str] = ["localhost", "127.0.0.1", "testserver"]

    @field_validator("ALLOWED_HOSTS", mode="before")
    @classmethod
    def parse_allowed_hosts(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                try:
                    parsed = json.loads(v_stripped)
                    if isinstance(parsed, list):
                        return [str(o).strip() for o in parsed if str(o).strip()]
                except (json.JSONDecodeError, ValueError):
                    pass
            return [o.strip() for o in v.split(",") if o.strip()]
        if isinstance(v, list):
            return [str(o).strip() for o in v if str(o).strip()]
        return v

    # LLM Key Pools (comma-separated strings)
    GEMINI_API_KEYS: str = ""
    GROQ_API_KEYS: str = ""

    # Telegram Bot
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_WEBHOOK_SECRET: Optional[str] = None
    TELEGRAM_BOT_USERNAME: str = "RezekifyBot"

    # Security & Encryption
    ENCRYPTION_KEY: Optional[str] = None

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        # ponytail: validates against development default; upgrade to entropy/min-length checks if needed.
        if self.ENVIRONMENT.lower() == "production":
            secret = self.SECRET_KEY.strip() if self.SECRET_KEY else ""
            if not secret or secret == DEFAULT_DEV_SECRET:
                raise ValueError(
                    "SECRET_KEY must be securely set in production and cannot use the development default."
                )
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
