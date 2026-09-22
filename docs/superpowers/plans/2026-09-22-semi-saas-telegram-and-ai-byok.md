# Semi-SaaS Architecture, Telegram Connection Hub, and AI BYOK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transition Rezekify from a shared rotary pool single-tenant setup to a multi-tenant Semi-SaaS platform supporting self-service Telegram bot connection management and Bring Your Own Key (BYOK) for Google Gemini and Groq AI models with encrypted key storage and fallback.

**Architecture:** Symmetric Fernet key encryption at rest for tenant API credentials, 1:1 `user_settings` database model with Alembic migration, `/api/v1/settings` REST router with pre-save probe validation, dynamic tenant-aware `AgentOrchestrator` constructing ephemeral `ReActAgent` instances, `/start <CODE>` Telegram deep-linking, and a sleek dark-themed `SettingsModal.tsx` GUI.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, cryptography (Fernet), Pydantic v2, React 18, TypeScript, Tailwind CSS, HeroUI, Lucide React, Pytest, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-22-semi-saas-telegram-and-ai-byok-design.md`

## Global Constraints
- Strict TDD (Red-Green-Refactor): every implementation task must begin with a failing test and verify failure before authoring code.
- Zero Truncation Invariant: all code blocks must be complete, working code drops with zero placeholder comments (`// ...`, `TODO`).
- Deterministic Math Invariant: all money calculations, double-entry ledger entries, and safe runway calculations must remain in `decimal.Decimal` in Python. The LLM never calculates money.
- Row-Level Tenant Isolation: all database queries and updates must strictly enforce `WHERE user_id = current_user.id`.
- Zero Plaintext Secret Leakage: API keys must be encrypted at rest using Fernet (AES-128-CBC + HMAC-SHA256). API responses and database queries must never return plaintext or raw encrypted keys to the frontend; only `has_api_key: bool` and `key_hint: str` (e.g., `"...4x8B"`) are exposed.
- Environment & Platform: Windows with PowerShell syntax (use `;` or separate lines, never bash `&&`).
- Git Commit Discipline: Conventional Commits with attribution:
  ```
  Co-Authored-By: Claude Code <noreply@anthropic.com>
  ```

---

### Task 1: Symmetric Key Encryption (`rezekify/core/crypto.py`)

**Files:**
- Create: `rezekify/core/crypto.py`
- Modify: `rezekify/core/config.py:70-75`
- Test: `tests/test_crypto.py`

**Interfaces:**
- Consumes: `settings.SECRET_KEY`, `settings.ENCRYPTION_KEY` from `rezekify.core.config`
- Produces: `encrypt_key(raw_key: str) -> str`, `decrypt_key(ciphertext: str) -> str`, `mask_key(raw_key: str) -> str`

- [ ] **Step 1: Write failing test `tests/test_crypto.py`**

Create `tests/test_crypto.py`:
```python
"""Tests for symmetric Fernet API key encryption at rest and key masking."""

import base64
import os
import pytest
from cryptography.fernet import Fernet

from rezekify.core.config import settings
from rezekify.core.crypto import decrypt_key, encrypt_key, mask_key


def test_encrypt_and_decrypt_roundtrip():
    raw_keys = [
        "AIzaSyD-StandardGeminiKey1234567890",
        "gsk_CustomGroqKey_With_Special_Chars!@#$%",
        "A" * 128,
    ]
    for key in raw_keys:
        ciphertext = encrypt_key(key)
        assert ciphertext != key
        decrypted = decrypt_key(ciphertext)
        assert decrypted == key


def test_deterministic_derivation_from_secret_key(monkeypatch):
    monkeypatch.setattr(settings, "ENCRYPTION_KEY", None)
    raw = "test-api-key-abc-xyz"
    token = encrypt_key(raw)
    assert decrypt_key(token) == raw


def test_explicit_encryption_key_used_when_provided(monkeypatch):
    custom_fernet_key = Fernet.generate_key().decode("utf-8")
    monkeypatch.setattr(settings, "ENCRYPTION_KEY", custom_fernet_key)
    raw = "test-api-key-with-custom-fernet"
    token = encrypt_key(raw)
    assert decrypt_key(token) == raw


def test_decrypt_invalid_ciphertext_raises_value_error():
    with pytest.raises(ValueError, match="Failed to decrypt API key"):
        decrypt_key("not-a-valid-fernet-token-12345")


def test_encrypt_empty_key_raises_value_error():
    with pytest.raises(ValueError, match="Cannot encrypt an empty key"):
        encrypt_key("")
    with pytest.raises(ValueError, match="Cannot encrypt an empty key"):
        encrypt_key("   ")


def test_decrypt_empty_ciphertext_raises_value_error():
    with pytest.raises(ValueError, match="Cannot decrypt empty ciphertext"):
        decrypt_key("")
    with pytest.raises(ValueError, match="Cannot decrypt empty ciphertext"):
        decrypt_key("   ")


def test_mask_key():
    assert mask_key("AIzaSyD-XYZ1234") == "...1234"
    assert mask_key("gsk_9999") == "...9999"
    assert mask_key("abc") == "...abc"
    assert mask_key("abcd") == "...abcd"
    assert mask_key("") == ""
    assert mask_key("   ") == ""
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
pytest tests/test_crypto.py -v
```
Expected: FAIL with `ModuleNotFoundError: No module named 'rezekify.core.crypto'`

- [ ] **Step 3: Implement `rezekify/core/config.py` updates and `rezekify/core/crypto.py`**

In `rezekify/core/config.py`, add `ENCRYPTION_KEY` and `TELEGRAM_BOT_USERNAME` around line 73:
```python
    # Telegram Bot
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_WEBHOOK_SECRET: Optional[str] = None
    TELEGRAM_BOT_USERNAME: str = "RezekifyBot"

    # Security & Encryption
    ENCRYPTION_KEY: Optional[str] = None
```

Create `rezekify/core/crypto.py`:
```python
"""Cryptographic helpers for tenant API key encryption at rest and masking."""

import base64
import hashlib
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken

from rezekify.core.config import settings


def _get_fernet_instance() -> Fernet:
    """Instantiates Fernet using ENCRYPTION_KEY or derived from SECRET_KEY."""
    if settings.ENCRYPTION_KEY and settings.ENCRYPTION_KEY.strip():
        key = settings.ENCRYPTION_KEY.strip().encode("utf-8")
        return Fernet(key)

    # Deterministic fallback derivation from SECRET_KEY
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    derived_key = base64.urlsafe_b64encode(digest)
    return Fernet(derived_key)


def encrypt_key(raw_key: str) -> str:
    """Encrypts raw plaintext API key into Fernet ciphertext token string."""
    if not raw_key or not raw_key.strip():
        raise ValueError("Cannot encrypt an empty key.")
    f = _get_fernet_instance()
    ciphertext = f.encrypt(raw_key.strip().encode("utf-8"))
    return ciphertext.decode("utf-8")


def decrypt_key(ciphertext: str) -> str:
    """Decrypts ciphertext token string back to plaintext API key.

    Raises ValueError if ciphertext is invalid or tampered with.
    """
    if not ciphertext or not ciphertext.strip():
        raise ValueError("Cannot decrypt empty ciphertext.")
    f = _get_fernet_instance()
    try:
        plaintext = f.decrypt(ciphertext.strip().encode("utf-8"))
        return plaintext.decode("utf-8")
    except (InvalidToken, Exception) as e:
        raise ValueError("Failed to decrypt API key: invalid ciphertext or signature mismatch.") from e


def mask_key(raw_key: str) -> str:
    """Produces a safe display hint of the key (e.g. '...4x8B')."""
    cleaned = raw_key.strip()
    if not cleaned:
        return ""
    if len(cleaned) <= 4:
        return f"...{cleaned}"
    return f"...{cleaned[-4:]}"
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
pytest tests/test_crypto.py -v
```
Expected: PASS (7 tests passing)

- [ ] **Step 5: Commit**

```powershell
git add rezekify/core/config.py rezekify/core/crypto.py tests/test_crypto.py; git commit -m "feat(crypto): implement symmetric Fernet key encryption and masking

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: Database Schema & Migration (`UserSettings` model & Alembic migration)

**Files:**
- Modify: `rezekify/db/models.py:50-95`
- Create: `rezekify/db/migrations/versions/002_user_settings_and_byok.py`
- Modify: `tests/test_db_models.py`

**Interfaces:**
- Consumes: `Base`, `GUID`, `User`, `utc_now` from `rezekify.db.models`
- Produces: `AIProvider` enum (`SYSTEM`, `GEMINI`, `GROQ`), `UserSettings` model, `User.settings` 1:1 relationship, Alembic migration `002_user_settings_and_byok`

- [ ] **Step 1: Write failing test in `tests/test_db_models.py`**

Append to `tests/test_db_models.py`:
```python
def test_user_settings_model_and_relationship(db_session, sample_user):
    from rezekify.db.models import AIProvider, UserSettings

    settings = UserSettings(
        user_id=sample_user.id,
        ai_provider=AIProvider.GEMINI,
        ai_model="gemini-2.5-pro",
        encrypted_api_key="gAAAAABtestCiphertextToken12345",
        key_hint="...1234",
        is_custom_ai_enabled=True,
    )
    db_session.add(settings)
    db_session.commit()
    db_session.refresh(sample_user)

    assert sample_user.settings is not None
    assert sample_user.settings.ai_provider == AIProvider.GEMINI
    assert sample_user.settings.ai_model == "gemini-2.5-pro"
    assert sample_user.settings.encrypted_api_key == "gAAAAABtestCiphertextToken12345"
    assert sample_user.settings.key_hint == "...1234"
    assert sample_user.settings.is_custom_ai_enabled is True
    assert sample_user.settings.user.id == sample_user.id

    # Verify cascading delete
    db_session.delete(sample_user)
    db_session.commit()
    orphan = db_session.query(UserSettings).filter_by(id=settings.id).first()
    assert orphan is None
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
pytest tests/test_db_models.py -k test_user_settings -v
```
Expected: FAIL with `ImportError: cannot import name 'AIProvider' from 'rezekify.db.models'`

- [ ] **Step 3: Implement `UserSettings` model in `rezekify/db/models.py` and Alembic migration `002_user_settings_and_byok.py`**

In `rezekify/db/models.py`:
1. Add `AIProvider` enum before `User`:
```python
class AIProvider(str, Enum):
    SYSTEM = "SYSTEM"
    GEMINI = "GEMINI"
    GROQ = "GROQ"
```

2. Add `settings` relationship to `User`:
```python
class User(Base):
    __tablename__ = "users"
    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    telegram_chat_id = Column(BigInteger, unique=True, nullable=True, index=True)
    telegram_pairing_code = Column(String(32), unique=True, nullable=True, index=True)
    pairing_code_expires_at = Column(DateTime(timezone=True), nullable=True)
    monthly_cycle_day = Column(Integer, nullable=False, default=1)
    currency = Column(String(3), nullable=False, default="IDR")
    created_at = Column(DateTime(timezone=True), default=utc_now)

    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")
    vaults = relationship("Vault", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    settings = relationship(
        "UserSettings",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
```

3. Add `UserSettings` model definition:
```python
class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(
        GUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    ai_provider = Column(
        SQLEnum(AIProvider, native_enum=False),
        nullable=False,
        default=AIProvider.SYSTEM,
    )
    ai_model = Column(String(100), nullable=False, default="gemini-2.5-flash")
    encrypted_api_key = Column(Text, nullable=True)
    key_hint = Column(String(16), nullable=True)
    is_custom_ai_enabled = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="settings")
```

Create `rezekify/db/migrations/versions/002_user_settings_and_byok.py`:
```python
"""Add user_settings table for Telegram management and AI BYOK.

Revision ID: 002_user_settings_and_byok
Revises: 001_initial_schema
Create Date: 2026-09-22 12:00:00.000000
"""
from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op
from rezekify.db.models import GUID

revision: str = "002_user_settings_and_byok"
down_revision: str | None = "001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_settings",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("ai_provider", sa.String(length=20), nullable=False, server_default="SYSTEM"),
        sa.Column("ai_model", sa.String(length=100), nullable=False, server_default="gemini-2.5-flash"),
        sa.Column("encrypted_api_key", sa.Text(), nullable=True),
        sa.Column("key_hint", sa.String(length=16), nullable=True),
        sa.Column("is_custom_ai_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_settings_user_id"),
    )
    op.create_index(
        "ix_user_settings_user_id", "user_settings", ["user_id"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_user_settings_user_id", table_name="user_settings")
    op.drop_table("user_settings")
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
pytest tests/test_db_models.py -v
```
Expected: PASS (all tests in `test_db_models.py` passing)

- [ ] **Step 5: Commit**

```powershell
git add rezekify/db/models.py rezekify/db/migrations/versions/002_user_settings_and_byok.py tests/test_db_models.py; git commit -m "feat(db): add UserSettings model and Alembic migration 002

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Settings API Schemas & Probe Validator

**Files:**
- Create: `rezekify/schemas/settings.py`
- Create: `tests/test_settings_api.py`

**Interfaces:**
- Consumes: `AIProvider` from `rezekify.db.models`
- Produces: `AVAILABLE_MODELS`, `TelegramSettingsResponse`, `AISettingsResponse`, `SettingsResponse`, `AIKeyValidateRequest`, `AIKeyValidateResponse`, `AISettingsUpdateRequest`, `TelegramUnlinkResponse`, `validate_ai_credentials(provider: AIProvider, api_key: str, model: Optional[str] = None) -> tuple[bool, str]`

- [ ] **Step 1: Write failing test in `tests/test_settings_api.py`**

Create `tests/test_settings_api.py`:
```python
"""Tests for Settings API schemas, probe validator, and REST endpoints."""

from unittest.mock import MagicMock, patch
import pytest

from rezekify.db.models import AIProvider
from rezekify.schemas.settings import (
    AVAILABLE_MODELS,
    AIKeyValidateRequest,
    AIKeyValidateResponse,
    AISettingsResponse,
    AISettingsUpdateRequest,
    SettingsResponse,
    TelegramSettingsResponse,
    TelegramUnlinkResponse,
    validate_ai_credentials,
)


def test_settings_schemas_serialization():
    telegram_resp = TelegramSettingsResponse(
        is_connected=True,
        telegram_chat_id=123456789,
        bot_username="RezekifyBot",
    )
    assert telegram_resp.is_connected is True
    assert telegram_resp.telegram_chat_id == 123456789
    assert telegram_resp.bot_username == "RezekifyBot"

    ai_resp = AISettingsResponse(
        is_custom_ai_enabled=True,
        provider=AIProvider.GEMINI,
        model="gemini-2.5-flash",
        has_api_key=True,
        key_hint="...4x8B",
    )
    assert ai_resp.is_custom_ai_enabled is True
    assert ai_resp.provider == AIProvider.GEMINI
    assert "gemini-2.5-flash" in ai_resp.available_models["GEMINI"]

    settings_resp = SettingsResponse(telegram=telegram_resp, ai=ai_resp)
    assert settings_resp.telegram.is_connected is True
    assert settings_resp.ai.has_api_key is True


def test_validate_ai_credentials_gemini_success():
    with patch("google.genai.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_instance.models.generate_content.return_value = MagicMock(text="pong")
        mock_client_cls.return_value = mock_instance

        valid, msg = validate_ai_credentials(
            provider=AIProvider.GEMINI,
            api_key="valid-gemini-key-123",
            model="gemini-2.5-flash",
        )
        assert valid is True
        assert "berhasil" in msg.lower()
        mock_client_cls.assert_called_once_with(api_key="valid-gemini-key-123")


def test_validate_ai_credentials_gemini_failure():
    with patch("google.genai.Client") as mock_client_cls:
        mock_instance = MagicMock()
        mock_instance.models.generate_content.side_effect = Exception("API_KEY_INVALID")
        mock_client_cls.return_value = mock_instance

        valid, msg = validate_ai_credentials(
            provider=AIProvider.GEMINI,
            api_key="invalid-gemini-key",
            model="gemini-2.5-flash",
        )
        assert valid is False
        assert "API_KEY_INVALID" in msg


def test_validate_ai_credentials_groq_success():
    with patch("groq.Groq") as mock_groq_cls:
        mock_instance = MagicMock()
        mock_instance.chat.completions.create.return_value = MagicMock()
        mock_groq_cls.return_value = mock_instance

        valid, msg = validate_ai_credentials(
            provider=AIProvider.GROQ,
            api_key="valid-groq-key-123",
            model="llama-3.3-70b",
        )
        assert valid is True
        assert "berhasil" in msg.lower()
        mock_groq_cls.assert_called_once_with(api_key="valid-groq-key-123")


def test_validate_ai_credentials_groq_failure():
    with patch("groq.Groq") as mock_groq_cls:
        mock_instance = MagicMock()
        mock_instance.chat.completions.create.side_effect = Exception("Invalid API Key")
        mock_groq_cls.return_value = mock_instance

        valid, msg = validate_ai_credentials(
            provider=AIProvider.GROQ,
            api_key="invalid-groq-key",
            model="llama-3.3-70b",
        )
        assert valid is False
        assert "Invalid API Key" in msg


def test_validate_ai_credentials_unsupported_provider():
    valid, msg = validate_ai_credentials(
        provider=AIProvider.SYSTEM,
        api_key="any-key",
    )
    assert valid is False
    assert "tidak memerlukan validasi kunci" in msg.lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
pytest tests/test_settings_api.py -v
```
Expected: FAIL with `ModuleNotFoundError: No module named 'rezekify.schemas.settings'`

- [ ] **Step 3: Implement `rezekify/schemas/settings.py`**

Create `rezekify/schemas/settings.py`:
```python
"""Pydantic schemas and live validation logic for user settings and AI BYOK."""

from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from rezekify.db.models import AIProvider

AVAILABLE_MODELS: Dict[str, List[str]] = {
    "GEMINI": [
        "gemini-2.5-flash",
        "gemini-2.5-pro",
    ],
    "GROQ": [
        "llama-4-scout-17b",
        "llama-3.3-70b",
    ],
}


class TelegramSettingsResponse(BaseModel):
    is_connected: bool
    telegram_chat_id: Optional[int] = None
    bot_username: str


class AISettingsResponse(BaseModel):
    is_custom_ai_enabled: bool
    provider: AIProvider
    model: str
    has_api_key: bool
    key_hint: Optional[str] = None
    available_models: Dict[str, List[str]] = Field(default_factory=lambda: AVAILABLE_MODELS)


class SettingsResponse(BaseModel):
    telegram: TelegramSettingsResponse
    ai: AISettingsResponse


class AIKeyValidateRequest(BaseModel):
    provider: AIProvider
    api_key: str = Field(..., min_length=8, description="Raw API key to test")
    model: Optional[str] = None


class AIKeyValidateResponse(BaseModel):
    valid: bool
    message: str


class AISettingsUpdateRequest(BaseModel):
    is_custom_ai_enabled: bool
    provider: AIProvider
    model: str
    api_key: Optional[str] = Field(
        None,
        description="New raw API key to store. If omitted or empty, preserves existing stored key.",
    )


class TelegramUnlinkResponse(BaseModel):
    success: bool
    message: str


def validate_ai_credentials(
    provider: AIProvider, api_key: str, model: Optional[str] = None
) -> tuple[bool, str]:
    """Tests an API key against the provider with a lightweight ping probe."""
    clean_key = api_key.strip()
    if not clean_key:
        return False, "Kunci API tidak boleh kosong."

    if provider == AIProvider.GEMINI:
        try:
            from google import genai
            client = genai.Client(api_key=clean_key)
            target_model = model or "gemini-2.5-flash"
            client.models.generate_content(
                model=target_model,
                contents="ping",
            )
            return True, "Koneksi ke Google Gemini berhasil diverifikasi."
        except Exception as e:
            return False, f"Kunci API Google Gemini tidak valid: {str(e)}"

    elif provider == AIProvider.GROQ:
        try:
            from groq import Groq
            client = Groq(api_key=clean_key)
            target_model = "llama-3.3-70b-versatile"
            client.chat.completions.create(
                model=target_model,
                messages=[{"role": "user", "content": "ping"}],
                max_tokens=1,
            )
            return True, "Koneksi ke Groq Cloud berhasil diverifikasi."
        except Exception as e:
            return False, f"Kunci API Groq tidak valid: {str(e)}"

    return False, "Provider SYSTEM tidak memerlukan validasi kunci kustom."
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
pytest tests/test_settings_api.py -v
```
Expected: PASS (6 tests passing)

- [ ] **Step 5: Commit**

```powershell
git add rezekify/schemas/settings.py tests/test_settings_api.py; git commit -m "feat(schemas): add settings schemas and live probe validator

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Settings API Endpoints & Telegram Unlink

**Files:**
- Create: `rezekify/api/v1/settings_router.py`
- Modify: `rezekify/api/main.py:10-45`
- Modify: `tests/test_settings_api.py`

**Interfaces:**
- Consumes: `get_db`, `get_current_user`, `UserSettings`, `encrypt_key`, `mask_key`, schemas
- Produces: Router `settings_router` mounted at `/api/v1/settings`:
  - `GET /api/v1/settings`
  - `POST /api/v1/settings/ai/validate`
  - `PUT /api/v1/settings/ai`
  - `POST /api/v1/settings/telegram/unlink`

- [ ] **Step 1: Write failing integration tests in `tests/test_settings_api.py`**

Append to `tests/test_settings_api.py`:
```python
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from rezekify.api.deps import get_current_user, get_db
from rezekify.api.main import app
from rezekify.core.crypto import decrypt_key, encrypt_key
from rezekify.db.models import Base, User, UserSettings


@pytest.fixture
def api_test_client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    session = TestingSession()
    user = User(
        email="settings_user@rezekify.local",
        password_hash="test_pw_hash",
        full_name="Settings Tester",
        telegram_chat_id=888999,
        telegram_pairing_code="DK-TEST",
        pairing_code_expires_at=datetime.now(timezone.utc),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    def override_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    def override_user():
        db = TestingSession()
        try:
            return db.query(User).filter_by(id=user.id).one()
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = override_user
    client = TestClient(app, raise_server_exceptions=False)
    yield client, user, TestingSession
    app.dependency_overrides.clear()


def test_get_settings_auto_creates_default_and_omits_secrets(api_test_client):
    client, user, SessionMaker = api_test_client
    res = client.get("/api/v1/settings")
    assert res.status_code == 200
    data = res.json()

    assert "telegram" in data
    assert data["telegram"]["is_connected"] is True
    assert data["telegram"]["telegram_chat_id"] == 888999
    assert data["telegram"]["bot_username"] == "RezekifyBot"

    assert "ai" in data
    assert data["ai"]["is_custom_ai_enabled"] is False
    assert data["ai"]["provider"] == "SYSTEM"
    assert data["ai"]["model"] == "gemini-2.5-flash"
    assert data["ai"]["has_api_key"] is False
    assert data["ai"]["key_hint"] is None
    assert "encrypted_api_key" not in data["ai"]


def test_post_validate_ai_key_endpoint(api_test_client):
    client, _, _ = api_test_client
    with patch("rezekify.api.v1.settings_router.validate_ai_credentials") as mock_val:
        mock_val.return_value = (True, "Koneksi berhasil diverifikasi.")
        res = client.post(
            "/api/v1/settings/ai/validate",
            json={"provider": "GEMINI", "api_key": "AIzaSyTest12345678", "model": "gemini-2.5-flash"},
        )
        assert res.status_code == 200
        assert res.json()["valid"] is True

        mock_val.return_value = (False, "API_KEY_INVALID")
        res_fail = client.post(
            "/api/v1/settings/ai/validate",
            json={"provider": "GEMINI", "api_key": "bad-key-12345678"},
        )
        assert res_fail.status_code == 400
        assert "API_KEY_INVALID" in res_fail.json()["detail"]


def test_put_ai_settings_requires_key_when_enabling_byok(api_test_client):
    client, _, _ = api_test_client
    res = client.put(
        "/api/v1/settings/ai",
        json={
            "is_custom_ai_enabled": True,
            "provider": "GEMINI",
            "model": "gemini-2.5-flash",
            "api_key": None,
        },
    )
    assert res.status_code == 400
    assert "Kunci API wajib diisi" in res.json()["detail"]


def test_put_ai_settings_updates_key_and_hint(api_test_client):
    client, user, SessionMaker = api_test_client
    res = client.put(
        "/api/v1/settings/ai",
        json={
            "is_custom_ai_enabled": True,
            "provider": "GEMINI",
            "model": "gemini-2.5-flash",
            "api_key": "AIzaSyD-SuperSecret9999",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["is_custom_ai_enabled"] is True
    assert data["has_api_key"] is True
    assert data["key_hint"] == "...9999"

    # Verify encrypted key in DB
    db = SessionMaker()
    rec = db.query(UserSettings).filter_by(user_id=user.id).first()
    assert rec is not None
    assert rec.encrypted_api_key is not None
    assert decrypt_key(rec.encrypted_api_key) == "AIzaSyD-SuperSecret9999"
    db.close()


def test_put_ai_settings_preserves_existing_key_when_omitted(api_test_client):
    client, user, SessionMaker = api_test_client
    # Pre-populate DB with existing encrypted key
    db = SessionMaker()
    rec = UserSettings(
        user_id=user.id,
        ai_provider=AIProvider.GEMINI,
        ai_model="gemini-2.5-flash",
        encrypted_api_key=encrypt_key("existing-secret-key-1234"),
        key_hint="...1234",
        is_custom_ai_enabled=True,
    )
    db.merge(rec)
    db.commit()
    db.close()

    # Update only the model without providing api_key
    res = client.put(
        "/api/v1/settings/ai",
        json={
            "is_custom_ai_enabled": True,
            "provider": "GEMINI",
            "model": "gemini-2.5-pro",
            "api_key": "",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["model"] == "gemini-2.5-pro"
    assert data["has_api_key"] is True
    assert data["key_hint"] == "...1234"

    # Verify key wasn't deleted
    db = SessionMaker()
    db_rec = db.query(UserSettings).filter_by(user_id=user.id).first()
    assert decrypt_key(db_rec.encrypted_api_key) == "existing-secret-key-1234"
    db.close()


def test_unlink_telegram_endpoint(api_test_client):
    client, user, SessionMaker = api_test_client
    res = client.post("/api/v1/settings/telegram/unlink")
    assert res.status_code == 200
    assert res.json()["success"] is True

    # Verify user telegram fields cleared in DB
    db = SessionMaker()
    refreshed_user = db.query(User).filter_by(id=user.id).first()
    assert refreshed_user.telegram_chat_id is None
    assert refreshed_user.telegram_pairing_code is None
    assert refreshed_user.pairing_code_expires_at is None
    db.close()

    # Subsequent GET /settings reflects disconnected status
    get_res = client.get("/api/v1/settings")
    assert get_res.json()["telegram"]["is_connected"] is False
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
pytest tests/test_settings_api.py -k "test_get_settings" -v
```
Expected: FAIL with 404 Not Found

- [ ] **Step 3: Implement `rezekify/api/v1/settings_router.py` and register in `rezekify/api/main.py`**

Create `rezekify/api/v1/settings_router.py`:
```python
"""FastAPI router for user settings, Telegram lifecycle, and AI BYOK configuration."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from rezekify.api.deps import get_current_user, get_db
from rezekify.core.config import settings as app_settings
from rezekify.core.crypto import encrypt_key, mask_key
from rezekify.db.models import AIProvider, User, UserSettings
from rezekify.schemas.settings import (
    AVAILABLE_MODELS,
    AIKeyValidateRequest,
    AIKeyValidateResponse,
    AISettingsResponse,
    AISettingsUpdateRequest,
    SettingsResponse,
    TelegramSettingsResponse,
    TelegramUnlinkResponse,
    validate_ai_credentials,
)

settings_router = APIRouter()


def _get_or_create_settings(db: Session, user_id) -> UserSettings:
    """Retrieves user settings or creates default record if none exists."""
    settings_rec = db.query(UserSettings).filter_by(user_id=user_id).first()
    if not settings_rec:
        settings_rec = UserSettings(
            user_id=user_id,
            ai_provider=AIProvider.SYSTEM,
            ai_model="gemini-2.5-flash",
            is_custom_ai_enabled=False,
        )
        db.add(settings_rec)
        db.commit()
        db.refresh(settings_rec)
    return settings_rec


@settings_router.get("", response_model=SettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SettingsResponse:
    """Returns the current user's Telegram connection status and AI BYOK settings."""
    settings_rec = _get_or_create_settings(db, current_user.id)

    telegram_resp = TelegramSettingsResponse(
        is_connected=current_user.telegram_chat_id is not None,
        telegram_chat_id=current_user.telegram_chat_id,
        bot_username=app_settings.TELEGRAM_BOT_USERNAME,
    )

    ai_resp = AISettingsResponse(
        is_custom_ai_enabled=settings_rec.is_custom_ai_enabled,
        provider=settings_rec.ai_provider,
        model=settings_rec.ai_model,
        has_api_key=bool(settings_rec.encrypted_api_key),
        key_hint=settings_rec.key_hint,
    )

    return SettingsResponse(telegram=telegram_resp, ai=ai_resp)


@settings_router.post("/ai/validate", response_model=AIKeyValidateResponse)
def validate_ai_key(
    payload: AIKeyValidateRequest,
    current_user: User = Depends(get_current_user),
) -> AIKeyValidateResponse:
    """Performs live connectivity verification against the specified AI provider."""
    valid, message = validate_ai_credentials(
        provider=payload.provider,
        api_key=payload.api_key,
        model=payload.model,
    )
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=message,
        )
    return AIKeyValidateResponse(valid=True, message=message)


@settings_router.put("/ai", response_model=AISettingsResponse)
def update_ai_settings(
    payload: AISettingsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AISettingsResponse:
    """Updates AI provider, model, BYOK toggle, and optionally encrypts a new API key."""
    settings_rec = _get_or_create_settings(db, current_user.id)

    # Validate provider models
    valid_models = AVAILABLE_MODELS.get(payload.provider.value, [])
    if payload.provider != AIProvider.SYSTEM and payload.model not in valid_models:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Model '{payload.model}' tidak valid untuk provider {payload.provider.value}.",
        )

    # Check key requirement when enabling BYOK
    has_existing_key = bool(settings_rec.encrypted_api_key)
    has_new_key = bool(payload.api_key and payload.api_key.strip())

    if payload.is_custom_ai_enabled and not has_existing_key and not has_new_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kunci API wajib diisi untuk mengaktifkan AI kustom (BYOK).",
        )

    # Encrypt and store key if new one provided
    if has_new_key:
        raw_key = payload.api_key.strip()
        settings_rec.encrypted_api_key = encrypt_key(raw_key)
        settings_rec.key_hint = mask_key(raw_key)

    settings_rec.is_custom_ai_enabled = payload.is_custom_ai_enabled
    settings_rec.ai_provider = payload.provider
    settings_rec.ai_model = payload.model

    db.commit()
    db.refresh(settings_rec)

    return AISettingsResponse(
        is_custom_ai_enabled=settings_rec.is_custom_ai_enabled,
        provider=settings_rec.ai_provider,
        model=settings_rec.ai_model,
        has_api_key=bool(settings_rec.encrypted_api_key),
        key_hint=settings_rec.key_hint,
    )


@settings_router.post("/telegram/unlink", response_model=TelegramUnlinkResponse)
def unlink_telegram(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TelegramUnlinkResponse:
    """Disconnects the current user's Telegram integration."""
    current_user.telegram_chat_id = None
    current_user.telegram_pairing_code = None
    current_user.pairing_code_expires_at = None
    db.commit()

    return TelegramUnlinkResponse(
        success=True,
        message="Akun Telegram berhasil diputuskan.",
    )
```

In `rezekify/api/main.py`:
1. Import `settings_router`:
```python
from rezekify.api.v1.settings_router import settings_router
```
2. Mount the router:
```python
app.include_router(settings_router, prefix="/api/v1/settings", tags=["Settings"])
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
pytest tests/test_settings_api.py -v
```
Expected: PASS (all 12 tests passing)

- [ ] **Step 5: Commit**

```powershell
git add rezekify/api/v1/settings_router.py rezekify/api/main.py tests/test_settings_api.py; git commit -m "feat(api): implement /api/v1/settings endpoints and telegram unlinking

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: Telegram Gateway Deep Linking (`/start <CODE>`)

**Files:**
- Modify: `rezekify/gateway/telegram_bot.py:28-62`
- Modify: `tests/test_telegram_bot.py`

**Interfaces:**
- Consumes: `AuthService.link_telegram_chat_id`
- Produces: `/start <CODE>` deep link parsing alongside `/link <CODE>`

- [ ] **Step 1: Write failing tests in `tests/test_telegram_bot.py`**

Append to `tests/test_telegram_bot.py`:
```python
def test_start_with_pairing_code_links_account(db_session, sample_user):
    sample_user.telegram_pairing_code = "DK-5678"
    sample_user.pairing_code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    db_session.commit()

    gateway = TelegramGateway(db_session)
    reply = gateway.process_text_message(chat_id=11223344, text="/start DK-5678")

    db_session.refresh(sample_user)
    assert sample_user.telegram_chat_id == 11223344
    assert "berhasil terhubung" in reply.lower()


def test_start_without_code_unlinked_shows_instructions(db_session):
    gateway = TelegramGateway(db_session)
    reply = gateway.process_text_message(chat_id=990011, text="/start")
    assert "Selamat datang di Bot Keuangan Rezekify" in reply
    assert "Web Dashboard Rezekify" in reply


def test_start_without_code_linked_shows_welcome_back(db_session, sample_user):
    sample_user.telegram_chat_id = 990011
    db_session.commit()

    gateway = TelegramGateway(db_session)
    reply = gateway.process_text_message(chat_id=990011, text="/start")
    assert "Selamat datang kembali" in reply
    assert sample_user.full_name in reply


def test_start_with_invalid_code_shows_error(db_session):
    gateway = TelegramGateway(db_session)
    reply = gateway.process_text_message(chat_id=990011, text="/start DK-INVALID")
    assert "Gagal" in reply or "tidak valid" in reply
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
pytest tests/test_telegram_bot.py -k "test_start_with_pairing_code_links_account" -v
```
Expected: FAIL because `/start DK-5678` does not link pairing codes currently.

- [ ] **Step 3: Update `process_text_message` in `rezekify/gateway/telegram_bot.py`**

Replace `process_text_message` in `rezekify/gateway/telegram_bot.py`:
```python
    def process_text_message(self, chat_id: int, text: str) -> str:
        """Handles incoming text messages, pairing commands, and runway inquiries."""
        cleaned_text = text.strip()

        if cleaned_text.startswith("/start") or cleaned_text.startswith("/link"):
            parts = cleaned_text.split()
            if len(parts) >= 2:
                code = parts[1].strip()
                try:
                    user = self.auth.link_telegram_chat_id(telegram_chat_id=chat_id, pairing_code=code)
                    return (
                        f"🎉 Selamat datang {user.full_name}! Akun rezekify Anda berhasil terhubung. "
                        "Mulai sekarang Anda cukup ketik pengeluaran atau kirim foto struk di sini."
                    )
                except ValueError as e:
                    return f"❌ Gagal: {str(e)}"

            if cleaned_text.startswith("/link"):
                return "Format salah. Gunakan: `/link KODE-PAIRING` (dapatkan kode di Web Dashboard)."

            # Bare /start
            user = self.db.query(User).filter_by(telegram_chat_id=chat_id).first()
            if user:
                return (
                    f"👋 Selamat datang kembali, {user.full_name}!\n\n"
                    "Anda dapat langsung mengetik transaksi harian (misal: 'makan siang 25rb pake gopay'), "
                    "kirim foto struk belanja, atau cek kondisi keuangan dengan perintah /runway atau /saldo."
                )
            return (
                "👋 Selamat datang di Bot Keuangan Rezekify!\n\n"
                "Untuk menghubungkan bot ini dengan akun Rezekify Anda:\n"
                "1. Buka Web Dashboard Rezekify -> Pengaturan -> Integrasi Telegram.\n"
                "2. Klik 'Dapatkan Kode Pairing' atau gunakan tautan instan 1-klik.\n"
                "3. Atau kirim perintah `/link KODE-PAIRING` di sini.\n\n"
                "Setelah terhubung, Anda bisa langsung mengetik pengeluaran santai atau mengirim foto struk belanja!"
            )

        # Resolve user by telegram_chat_id
        user = self.db.query(User).filter_by(telegram_chat_id=chat_id).first()
        if not user:
            return (
                "Akun Telegram Anda belum terhubung ke rezekify. "
                "Silakan login ke Web Dashboard dan hubungkan akun dengan kode `/link KODE`."
            )
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
pytest tests/test_telegram_bot.py -v
```
Expected: PASS (all tests passing)

- [ ] **Step 5: Commit**

```powershell
git add rezekify/gateway/telegram_bot.py tests/test_telegram_bot.py; git commit -m "feat(telegram): support /start <CODE> deep-linking payload

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: AI Runtime Tenant Dynamic Key Resolver

**Files:**
- Modify: `rezekify/agent/runtime.py:27-70`
- Modify: `rezekify/agent/orchestrator.py:20-100`
- Modify: `tests/test_agent_orchestrator.py`

**Interfaces:**
- Consumes: `UserSettings`, `AIProvider`, `decrypt_key`, `RotaryKeyPool`, `ReActAgent`
- Produces: `_resolve_agent_for_user(user_id)` in `AgentOrchestrator`, parameterized `gemini_model` and `groq_model` in `ReActAgent`, and friendly 401/429 error messages.

- [ ] **Step 1: Write failing tests in `tests/test_agent_orchestrator.py`**

Append to `tests/test_agent_orchestrator.py`:
```python
from rezekify.core.crypto import encrypt_key
from rezekify.db.models import AIProvider, UserSettings


def test_resolve_agent_uses_system_pool_when_byok_disabled(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session)
    agent, is_custom = orchestrator._resolve_agent_for_user(sample_user.id)
    assert is_custom is False
    assert agent == orchestrator.agent


def test_resolve_agent_instantiates_byok_gemini_agent(db_session, sample_user):
    settings = UserSettings(
        user_id=sample_user.id,
        ai_provider=AIProvider.GEMINI,
        ai_model="gemini-2.5-pro",
        encrypted_api_key=encrypt_key("custom-gemini-key"),
        is_custom_ai_enabled=True,
    )
    db_session.add(settings)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    agent, is_custom = orchestrator._resolve_agent_for_user(sample_user.id)
    assert is_custom is True
    assert agent is not None
    assert agent.gemini_model == "gemini-2.5-pro"
    assert agent.gemini_pool.keys == ["custom-gemini-key"]


def test_resolve_agent_instantiates_byok_groq_agent(db_session, sample_user):
    settings = UserSettings(
        user_id=sample_user.id,
        ai_provider=AIProvider.GROQ,
        ai_model="llama-3.3-70b",
        encrypted_api_key=encrypt_key("custom-groq-key"),
        is_custom_ai_enabled=True,
    )
    db_session.add(settings)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    agent, is_custom = orchestrator._resolve_agent_for_user(sample_user.id)
    assert is_custom is True
    assert agent is not None
    assert agent.groq_model == "llama-3.3-70b"
    assert agent.groq_pool.keys == ["custom-groq-key"]


def test_handle_message_byok_401_error_feedback(db_session, sample_user):
    settings = UserSettings(
        user_id=sample_user.id,
        ai_provider=AIProvider.GEMINI,
        ai_model="gemini-2.5-flash",
        encrypted_api_key=encrypt_key("revoked-key"),
        is_custom_ai_enabled=True,
    )
    db_session.add(settings)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities = MagicMock(
        return_value={"action": "byok_error", "status_code": 401}
    )

    reply = orchestrator.handle_message(user_id=sample_user.id, text="beli pulsa 50rb")
    assert "Kunci API AI kustom Anda tidak valid" in reply


def test_handle_message_byok_429_error_feedback(db_session, sample_user):
    settings = UserSettings(
        user_id=sample_user.id,
        ai_provider=AIProvider.GEMINI,
        ai_model="gemini-2.5-flash",
        encrypted_api_key=encrypt_key("rate-limited-key"),
        is_custom_ai_enabled=True,
    )
    db_session.add(settings)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    orchestrator.extract_entities = MagicMock(
        return_value={"action": "byok_error", "status_code": 429}
    )

    reply = orchestrator.handle_message(user_id=sample_user.id, text="beli pulsa 50rb")
    assert "Kuota kunci API AI kustom Anda telah habis" in reply
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
pytest tests/test_agent_orchestrator.py -k "test_resolve_agent" -v
```
Expected: FAIL with `AttributeError: 'AgentOrchestrator' object has no attribute '_resolve_agent_for_user'`

- [ ] **Step 3: Update `ReActAgent` and `AgentOrchestrator`**

In `rezekify/agent/runtime.py`:
Update `ReActAgent.__init__` and model calls:
```python
class ReActAgent:
    """Agent runtime managing multimodal parsing with Gemini 2.5 Flash and Groq fallback."""

    def __init__(
        self,
        gemini_pool: Optional[RotaryKeyPool] = None,
        groq_pool: Optional[RotaryKeyPool] = None,
        gemini_model: str = "gemini-2.5-flash",
        groq_model: str = "meta-llama/llama-4-scout-17b-16e-instruct",
    ):
        self.gemini_pool = gemini_pool
        self.groq_pool = groq_pool
        self.gemini_model = gemini_model
        self.groq_model = groq_model
```

In `process_input` of `rezekify/agent/runtime.py`:
1. Check `if self.gemini_pool and self.gemini_pool.keys:` before trying Gemini.
2. In the `generate_content` call: use `model=self.gemini_model`.
3. In `_fallback_groq_vision`: use `model=self.groq_model`.
4. In `_fallback_groq`: use `model=self.groq_model`.
5. For BYOK agents (where `len(self.gemini_pool.keys) == 1` or `len(self.groq_pool.keys) == 1`), if a 401 or 429 error occurs:
```python
            except Exception as e:
                err_str = str(e).lower()
                if "401" in err_str or "unauthenticated" in err_str or "api_key_invalid" in err_str:
                    return {"action": "byok_error", "status_code": 401}
                if "429" in err_str or "resource_exhausted" in err_str or "rate limit" in err_str:
                    if self.gemini_pool:
                        self.gemini_pool.report_rate_limit(key)
                    if len(self.gemini_pool.keys) == 1 and not self.groq_pool:
                        return {"action": "byok_error", "status_code": 429}
                    continue
                break
```

In `rezekify/agent/orchestrator.py`:
Add imports:
```python
from rezekify.core.crypto import decrypt_key
from rezekify.db.models import AIProvider, UserSettings
from rezekify.agent.key_pool import RotaryKeyPool
```

Add `_resolve_agent_for_user`:
```python
    def _resolve_agent_for_user(self, user_id: UUID) -> tuple[Optional[ReActAgent], bool]:
        """Resolves an ephemeral ReActAgent for BYOK user or falls back to system agent.

        Returns:
            tuple[agent: Optional[ReActAgent], is_custom: bool]
        """
        settings_rec = (
            self.db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
        )

        if (
            settings_rec
            and settings_rec.is_custom_ai_enabled
            and settings_rec.encrypted_api_key
        ):
            try:
                raw_key = decrypt_key(settings_rec.encrypted_api_key)
                provider = settings_rec.ai_provider
                model = settings_rec.ai_model

                if provider == AIProvider.GEMINI:
                    user_pool = RotaryKeyPool(keys=[raw_key], cooldown_seconds=30)
                    agent = ReActAgent(
                        gemini_pool=user_pool,
                        groq_pool=None,
                        gemini_model=model,
                    )
                    return agent, True
                elif provider == AIProvider.GROQ:
                    user_pool = RotaryKeyPool(keys=[raw_key], cooldown_seconds=30)
                    agent = ReActAgent(
                        gemini_pool=None,
                        groq_pool=user_pool,
                        groq_model=model,
                    )
                    return agent, True
            except Exception:
                pass

        return self.agent, False
```

Update `extract_entities` in `rezekify/agent/orchestrator.py`:
```python
    def extract_entities(
        self,
        text: str,
        image_bytes: Optional[bytes] = None,
        user_id: Optional[UUID] = None,
        mime_type: Optional[str] = "image/jpeg",
    ) -> Dict[str, Any]:
        """Extracts structured financial transaction entities using ReActAgent runtime."""
        lower = text.lower().strip()
        if lower in ("cek runway", "runway", "saldo", "cek saldo", "status", "cek status", "cek runway hari ini"):
            return {"action": "query_runway"}

        agent_to_use = self.agent
        if user_id:
            resolved_agent, _ = self._resolve_agent_for_user(user_id)
            if resolved_agent:
                agent_to_use = resolved_agent

        if agent_to_use:
            uid = user_id or UUID("00000000-0000-0000-0000-000000000000")
            return agent_to_use.process_input(
                user_id=uid,
                text=text,
                image_bytes=image_bytes,
                mime_type=mime_type or "image/jpeg",
            )
        return {"action": "unknown", "text": text}
```

In `handle_message` in `rezekify/agent/orchestrator.py`, handle `action == "byok_error"`:
```python
        action = entities.get("action")

        if action == "byok_error":
            status_code = entities.get("status_code", 400)
            if status_code == 401:
                return "❌ Kunci API AI kustom Anda tidak valid atau telah dicabut. Silakan periksa di menu Pengaturan."
            elif status_code == 429:
                return (
                    "⚠️ Kuota kunci API AI kustom Anda telah habis (Rate Limit). "
                    "Silakan periksa kuota Anda di dashboard provider atau nonaktifkan BYOK untuk menggunakan kuota bersama."
                )
            return "❌ Terjadi kendala pada kunci API AI kustom Anda. Silakan periksa di menu Pengaturan."
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
pytest tests/test_agent_orchestrator.py -v
```
Expected: PASS (all tests passing)

- [ ] **Step 5: Commit**

```powershell
git add rezekify/agent/runtime.py rezekify/agent/orchestrator.py tests/test_agent_orchestrator.py; git commit -m "feat(agent): support dynamic BYOK key resolution and model selection

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: Frontend Types & API Client Services

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/services/apiClient.ts`
- Modify: `frontend/src/__tests__/apiClient.test.ts`

**Interfaces:**
- Produces: TypeScript types `AIProviderType`, `TelegramSettingsResponse`, `AISettingsResponse`, `SettingsResponse`, `AIKeyValidateRequest`, `AIKeyValidateResponse`, `AISettingsUpdateRequest`, `TelegramUnlinkResponse`, `TelegramPairingCodeResponse`
- Produces: API client functions `getSettings()`, `validateAIKey()`, `updateAISettings()`, `unlinkTelegram()`, `getTelegramPairingCode()`

- [ ] **Step 1: Write failing tests in `frontend/src/__tests__/apiClient.test.ts`**

Append to `frontend/src/__tests__/apiClient.test.ts`:
```typescript
import {
  getSettings,
  validateAIKey,
  updateAISettings,
  unlinkTelegram,
  getTelegramPairingCode,
} from '../services/apiClient';

describe('Settings and BYOK API Client functions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getSettings calls GET /settings', async () => {
    const mockSettings = {
      telegram: { is_connected: true, telegram_chat_id: 12345, bot_username: 'RezekifyBot' },
      ai: {
        is_custom_ai_enabled: false,
        provider: 'SYSTEM',
        model: 'gemini-2.5-flash',
        has_api_key: false,
        available_models: { GEMINI: ['gemini-2.5-flash'], GROQ: ['llama-3.3-70b'] },
      },
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSettings,
    });

    const res = await getSettings();
    expect(res).toEqual(mockSettings);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/settings',
      expect.objectContaining({ method: undefined })
    );
  });

  it('validateAIKey calls POST /settings/ai/validate', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ valid: true, message: 'Valid' }),
    });

    const res = await validateAIKey({
      provider: 'GEMINI',
      api_key: 'test-key-12345',
      model: 'gemini-2.5-flash',
    });
    expect(res.valid).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/settings/ai/validate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          provider: 'GEMINI',
          api_key: 'test-key-12345',
          model: 'gemini-2.5-flash',
        }),
      })
    );
  });

  it('updateAISettings calls PUT /settings/ai', async () => {
    const mockUpdated = {
      is_custom_ai_enabled: true,
      provider: 'GROQ',
      model: 'llama-3.3-70b',
      has_api_key: true,
      key_hint: '...70b',
      available_models: { GEMINI: [], GROQ: [] },
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockUpdated,
    });

    const res = await updateAISettings({
      is_custom_ai_enabled: true,
      provider: 'GROQ',
      model: 'llama-3.3-70b',
      api_key: 'groq-key-99',
    });
    expect(res).toEqual(mockUpdated);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/settings/ai',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          is_custom_ai_enabled: true,
          provider: 'GROQ',
          model: 'llama-3.3-70b',
          api_key: 'groq-key-99',
        }),
      })
    );
  });

  it('unlinkTelegram calls POST /settings/telegram/unlink', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, message: 'Unlinked' }),
    });

    const res = await unlinkTelegram();
    expect(res.success).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/settings/telegram/unlink',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('getTelegramPairingCode calls POST /auth/telegram-pairing-code', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ pairing_code: 'DK-4444' }),
    });

    const res = await getTelegramPairingCode();
    expect(res.pairing_code).toBe('DK-4444');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/auth/telegram-pairing-code',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
npm --prefix frontend test -- src/__tests__/apiClient.test.ts --run
```
Expected: FAIL with `getSettings is not defined`

- [ ] **Step 3: Implement types in `frontend/src/types/api.ts` and services in `frontend/src/services/apiClient.ts`**

Append to `frontend/src/types/api.ts`:
```typescript
export type AIProviderType = 'SYSTEM' | 'GEMINI' | 'GROQ';

export interface TelegramSettingsResponse {
  is_connected: boolean;
  telegram_chat_id?: number | null;
  bot_username: string;
}

export interface AISettingsResponse {
  is_custom_ai_enabled: boolean;
  provider: AIProviderType;
  model: string;
  has_api_key: boolean;
  key_hint?: string | null;
  available_models: Record<string, string[]>;
}

export interface SettingsResponse {
  telegram: TelegramSettingsResponse;
  ai: AISettingsResponse;
}

export interface AIKeyValidateRequest {
  provider: AIProviderType;
  api_key: string;
  model?: string;
}

export interface AIKeyValidateResponse {
  valid: boolean;
  message: string;
}

export interface AISettingsUpdateRequest {
  is_custom_ai_enabled: boolean;
  provider: AIProviderType;
  model: string;
  api_key?: string | null;
}

export interface TelegramUnlinkResponse {
  success: boolean;
  message: string;
}

export interface TelegramPairingCodeResponse {
  pairing_code: string;
}
```

In `frontend/src/services/apiClient.ts`, import types and export functions:
```typescript
import {
  Transaction,
  TransactionUpdateRequest,
  Vault,
  VaultUpdateRequest,
  SettingsResponse,
  AISettingsResponse,
  AIKeyValidateRequest,
  AIKeyValidateResponse,
  AISettingsUpdateRequest,
  TelegramUnlinkResponse,
  TelegramPairingCodeResponse,
} from '../types/api';
```

Append functions to `frontend/src/services/apiClient.ts`:
```typescript
export async function getSettings(): Promise<SettingsResponse> {
  return apiFetch<SettingsResponse>('/settings');
}

export async function validateAIKey(payload: AIKeyValidateRequest): Promise<AIKeyValidateResponse> {
  return apiFetch<AIKeyValidateResponse>('/settings/ai/validate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAISettings(payload: AISettingsUpdateRequest): Promise<AISettingsResponse> {
  return apiFetch<AISettingsResponse>('/settings/ai', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function unlinkTelegram(): Promise<TelegramUnlinkResponse> {
  return apiFetch<TelegramUnlinkResponse>('/settings/telegram/unlink', {
    method: 'POST',
  });
}

export async function getTelegramPairingCode(): Promise<TelegramPairingCodeResponse> {
  return apiFetch<TelegramPairingCodeResponse>('/auth/telegram-pairing-code', {
    method: 'POST',
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
npm --prefix frontend test -- src/__tests__/apiClient.test.ts --run
```
Expected: PASS (all tests in `apiClient.test.ts` passing)

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/types/api.ts frontend/src/services/apiClient.ts frontend/src/__tests__/apiClient.test.ts; git commit -m "feat(frontend): add settings types and API client methods

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: Frontend Settings Modal Component

**Files:**
- Create: `frontend/src/components/SettingsModal.tsx`
- Create: `frontend/src/__tests__/SettingsModal.test.tsx`

**Interfaces:**
- Consumes: HeroUI `Modal`, `ModalContent`, `ModalHeader`, `ModalBody`, `Button`, Lucide icons, `apiClient` functions
- Produces: `<SettingsModal isOpen={boolean} onClose={() => void} onSettingsUpdated?: () => void />`

- [ ] **Step 1: Write failing tests in `frontend/src/__tests__/SettingsModal.test.tsx`**

Create `frontend/src/__tests__/SettingsModal.test.tsx`:
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsModal } from '../components/SettingsModal';
import * as apiClient from '../services/apiClient';

describe('SettingsModal Component', () => {
  const mockSettings = {
    telegram: {
      is_connected: false,
      telegram_chat_id: null,
      bot_username: 'RezekifyBot',
    },
    ai: {
      is_custom_ai_enabled: false,
      provider: 'SYSTEM' as const,
      model: 'gemini-2.5-flash',
      has_api_key: false,
      key_hint: null,
      available_models: {
        GEMINI: ['gemini-2.5-flash', 'gemini-2.5-pro'],
        GROQ: ['llama-4-scout-17b', 'llama-3.3-70b'],
      },
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(apiClient, 'getSettings').mockResolvedValue(mockSettings);
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SettingsModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal header and tab triggers when open', async () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Pengaturan Akun & Sistem')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Integrasi Telegram/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Model & Kunci AI \(BYOK\)/i })).toBeInTheDocument();
    });
  });

  it('generates telegram pairing code and displays 1-click deep link', async () => {
    vi.spyOn(apiClient, 'getTelegramPairingCode').mockResolvedValue({
      pairing_code: 'DK-7788',
    });

    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Dapatkan Kode Pairing/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Dapatkan Kode Pairing/i }));

    await waitFor(() => {
      expect(screen.getByText('DK-7788')).toBeInTheDocument();
      const deepLink = screen.getByRole('link', { name: /Buka Telegram/i });
      expect(deepLink).toHaveAttribute('href', 'https://t.me/RezekifyBot?start=DK-7788');
      expect(deepLink).toHaveAttribute('target', '_blank');
    });
  });

  it('unlinks telegram when connected', async () => {
    vi.spyOn(apiClient, 'getSettings').mockResolvedValue({
      ...mockSettings,
      telegram: { is_connected: true, telegram_chat_id: 12345, bot_username: 'RezekifyBot' },
    });
    const unlinkSpy = vi.spyOn(apiClient, 'unlinkTelegram').mockResolvedValue({
      success: true,
      message: 'Unlinked',
    });

    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Terhubung: ID 12345/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Putuskan Hubungan/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Putuskan Hubungan/i }));

    await waitFor(() => {
      expect(unlinkSpy).toHaveBeenCalled();
    });
  });

  it('switches to AI BYOK tab, validates key and saves settings', async () => {
    const validateSpy = vi.spyOn(apiClient, 'validateAIKey').mockResolvedValue({
      valid: true,
      message: 'Koneksi ke Google Gemini berhasil diverifikasi.',
    });
    const updateSpy = vi.spyOn(apiClient, 'updateAISettings').mockResolvedValue({
      is_custom_ai_enabled: true,
      provider: 'GEMINI',
      model: 'gemini-2.5-flash',
      has_api_key: true,
      key_hint: '...9999',
      available_models: mockSettings.ai.available_models,
    });

    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Model & Kunci AI \(BYOK\)/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Model & Kunci AI \(BYOK\)/i }));

    // Toggle BYOK
    const byokCard = screen.getByRole('button', { name: /Bring Your Own Key/i });
    fireEvent.click(byokCard);

    // Fill API key
    const keyInput = screen.getByLabelText(/Kunci API/i);
    fireEvent.change(keyInput, { target: { value: 'AIzaSyD-TestKey9999' } });

    // Test connection
    const testBtn = screen.getByRole('button', { name: /Uji Koneksi/i });
    fireEvent.click(testBtn);

    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalledWith({
        provider: 'GEMINI',
        api_key: 'AIzaSyD-TestKey9999',
        model: 'gemini-2.5-flash',
      });
      expect(screen.getByText(/Koneksi ke Google Gemini berhasil diverifikasi/i)).toBeInTheDocument();
    });

    // Save settings
    const saveBtn = screen.getByRole('button', { name: /Simpan Pengaturan/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith({
        is_custom_ai_enabled: true,
        provider: 'GEMINI',
        model: 'gemini-2.5-flash',
        api_key: 'AIzaSyD-TestKey9999',
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
npm --prefix frontend test -- src/__tests__/SettingsModal.test.tsx --run
```
Expected: FAIL with `Cannot find module '../components/SettingsModal'`

- [ ] **Step 3: Implement `frontend/src/components/SettingsModal.tsx`**

Create `frontend/src/components/SettingsModal.tsx`:
```tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  Button,
} from '@heroui/react';
import {
  Bot,
  Send,
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Radio,
  Server,
} from 'lucide-react';
import {
  getSettings,
  validateAIKey,
  updateAISettings,
  unlinkTelegram,
  getTelegramPairingCode,
} from '../services/apiClient';
import { SettingsResponse, AIProviderType } from '../types/api';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'telegram' | 'ai'>('telegram');
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isUnlinking, setIsUnlinking] = useState<boolean>(false);

  // AI BYOK form state
  const [isCustomAi, setIsCustomAi] = useState<boolean>(false);
  const [provider, setProvider] = useState<AIProviderType>('GEMINI');
  const [model, setModel] = useState<string>('gemini-2.5-flash');
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ isError: boolean; text: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getSettings();
      setSettings(data);
      setIsCustomAi(data.ai.is_custom_ai_enabled);
      setProvider(data.ai.provider === 'SYSTEM' ? 'GEMINI' : data.ai.provider);
      setModel(data.ai.model || 'gemini-2.5-flash');
    } catch (err: any) {
      setFeedbackMsg({ isError: true, text: err?.message || 'Gagal memuat pengaturan.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      setValidationResult(null);
      setFeedbackMsg(null);
      setPairingCode(null);
    }
  }, [isOpen, fetchSettings]);

  if (!isOpen) return null;

  const handleGeneratePairingCode = async () => {
    try {
      setIsGeneratingCode(true);
      setFeedbackMsg(null);
      const res = await getTelegramPairingCode();
      setPairingCode(res.pairing_code);
    } catch (err: any) {
      setFeedbackMsg({ isError: true, text: err?.message || 'Gagal menghasilkan kode pairing.' });
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleCopyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleUnlinkTelegram = async () => {
    try {
      setIsUnlinking(true);
      setFeedbackMsg(null);
      await unlinkTelegram();
      setFeedbackMsg({ isError: false, text: 'Akun Telegram berhasil diputuskan.' });
      await fetchSettings();
      onSettingsUpdated?.();
    } catch (err: any) {
      setFeedbackMsg({ isError: true, text: err?.message || 'Gagal memutuskan hubungan Telegram.' });
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleValidateKey = async () => {
    if (!apiKey.trim()) {
      setValidationResult({ valid: false, message: 'Kunci API wajib diisi untuk menguji koneksi.' });
      return;
    }
    try {
      setIsValidating(true);
      setValidationResult(null);
      const res = await validateAIKey({
        provider,
        api_key: apiKey.trim(),
        model,
      });
      setValidationResult(res);
    } catch (err: any) {
      setValidationResult({ valid: false, message: err?.message || 'Validasi koneksi gagal.' });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSaveAISettings = async () => {
    try {
      setIsSaving(true);
      setFeedbackMsg(null);
      await updateAISettings({
        is_custom_ai_enabled: isCustomAi,
        provider: isCustomAi ? provider : 'SYSTEM',
        model,
        api_key: apiKey.trim() || undefined,
      });
      setFeedbackMsg({ isError: false, text: 'Pengaturan AI berhasil disimpan.' });
      setApiKey('');
      await fetchSettings();
      onSettingsUpdated?.();
    } catch (err: any) {
      setFeedbackMsg({ isError: true, text: err?.message || 'Gagal menyimpan pengaturan AI.' });
    } finally {
      setIsSaving(false);
    }
  };

  const availableModelsList = settings?.ai?.available_models?.[provider] || (
    provider === 'GEMINI' ? ['gemini-2.5-flash', 'gemini-2.5-pro'] : ['llama-4-scout-17b', 'llama-3.3-70b']
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      backdrop="blur"
      disableAnimation
      classNames={{
        base: 'bg-slate-900 border border-slate-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto',
        backdrop: 'bg-black/75',
        closeButton: 'hover:bg-slate-800 text-slate-400 hover:text-white',
      }}
    >
      <ModalContent>
        {() => (
          <div>
            <ModalHeader>
              <div className="flex items-center justify-between w-full pr-6">
                <div>
                  <h3 className="font-semibold text-lg text-slate-100">Pengaturan Akun & Sistem</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Kelola integrasi bot Telegram dan kuota AI kustom (BYOK)</p>
                </div>
              </div>
            </ModalHeader>

            <ModalBody className="pb-6">
              {feedbackMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    feedbackMsg.isError
                      ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                      : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  {feedbackMsg.isError ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  <span>{feedbackMsg.text}</span>
                </div>
              )}

              {/* Navigation Tabs */}
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('telegram')}
                  className={`py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'telegram'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  Integrasi Telegram
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ai')}
                  className={`py-2 px-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                    activeTab === 'ai'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  Model & Kunci AI (BYOK)
                </button>
              </div>

              {/* TAB 1: TELEGRAM */}
              {activeTab === 'telegram' && (
                <div className="space-y-4 pt-2">
                  <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 block mb-1">Status Koneksi</span>
                      {settings?.telegram?.is_connected ? (
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-sm font-semibold text-emerald-400">
                            Terhubung: ID {settings.telegram.telegram_chat_id}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                          <span className="text-sm font-semibold text-amber-400">Belum Terhubung</span>
                        </div>
                      )}
                    </div>
                    {settings?.telegram?.is_connected && (
                      <Button
                        size="sm"
                        variant="flat"
                        color="danger"
                        onClick={handleUnlinkTelegram}
                        disabled={isUnlinking}
                        className="text-rose-400 bg-rose-500/10 border border-rose-500/20 text-xs font-semibold rounded-xl"
                      >
                        {isUnlinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Putuskan Hubungan'}
                      </Button>
                    )}
                  </div>

                  {!settings?.telegram?.is_connected ? (
                    <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-4">
                      <h4 className="text-xs font-semibold text-slate-200">Langkah Menghubungkan:</h4>
                      <ol className="text-xs text-slate-400 space-y-2 list-decimal list-inside">
                        <li>Klik tombol <strong>Dapatkan Kode Pairing</strong> di bawah.</li>
                        <li>Klik tombol tautan instan 1-klik untuk membuka bot Telegram.</li>
                        <li>Tekan <strong>START</strong> di Telegram dan akun Anda langsung terhubung!</li>
                      </ol>

                      {!pairingCode ? (
                        <Button
                          size="sm"
                          onClick={handleGeneratePairingCode}
                          disabled={isGeneratingCode}
                          className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl"
                        >
                          {isGeneratingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Dapatkan Kode Pairing Baru'}
                        </Button>
                      ) : (
                        <div className="p-4 bg-indigo-950/40 border border-indigo-500/30 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-indigo-300 font-medium">Kode Pairing Anda:</span>
                            <span className="text-[11px] text-slate-400">Berlaku 15 menit</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-mono font-bold text-white tracking-wider bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 grow text-center">
                              {pairingCode}
                            </span>
                            <Button
                              size="sm"
                              variant="flat"
                              onClick={handleCopyCode}
                              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-xl min-h-[44px]"
                            >
                              {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                          <a
                            href={`https://t.me/${settings?.telegram?.bot_username || 'RezekifyBot'}?start=${pairingCode}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Buka Telegram Sekarang (1-Klik)
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-2 text-xs text-slate-400">
                      <p>✅ Bot Telegram aktif dan siap menerima pesan.</p>
                      <p>Anda dapat mencatat pengeluaran langsung via teks santai, foto struk belanja, atau pesan suara.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: AI BYOK */}
              {activeTab === 'ai' && (
                <div className="space-y-4 pt-2">
                  {/* Mode Toggles */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIsCustomAi(false)}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        !isCustomAi
                          ? 'bg-indigo-600/10 border-indigo-500/50 shadow-md shadow-indigo-600/10'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Server className={`w-4 h-4 ${!isCustomAi ? 'text-indigo-400' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold text-white">Shared Platform</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Infrastruktur rotary pool bersama gratis dari Rezekify. Tanpa konfigurasi.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsCustomAi(true)}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        isCustomAi
                          ? 'bg-indigo-600/10 border-indigo-500/50 shadow-md shadow-indigo-600/10'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Radio className={`w-4 h-4 ${isCustomAi ? 'text-indigo-400' : 'text-slate-400'}`} />
                        <span className="text-xs font-bold text-white">Bring Your Own Key</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Gunakan kuota API pribadi Anda (Gemini/Groq) untuk kapasitas tak terbatas.
                      </p>
                    </button>
                  </div>

                  {isCustomAi && (
                    <div className="space-y-4 p-4 bg-slate-950 border border-slate-800 rounded-xl">
                      {/* Provider Selector */}
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Provider AI</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['GEMINI', 'GROQ'] as const).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                setProvider(p);
                                setModel(p === 'GEMINI' ? 'gemini-2.5-flash' : 'llama-3.3-70b');
                                setValidationResult(null);
                              }}
                              className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                                provider === p
                                  ? 'bg-slate-800 text-white border-indigo-500 shadow-sm'
                                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              {p === 'GEMINI' ? 'Google Gemini' : 'Groq Cloud'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Model Selector */}
                      <div>
                        <label htmlFor="model-select" className="block text-xs font-medium text-slate-400 mb-1.5">
                          Model AI
                        </label>
                        <select
                          id="model-select"
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                          {availableModelsList.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* API Key Input */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label htmlFor="api-key-input" className="text-xs font-medium text-slate-400">
                            Kunci API {provider === 'GEMINI' ? 'Google Gemini' : 'Groq'}
                          </label>
                          {settings?.ai?.has_api_key && (
                            <span className="text-[11px] text-emerald-400">
                              Tersimpan ({settings.ai.key_hint || '...'})
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            id="api-key-input"
                            type={showKey ? 'text' : 'password'}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder={
                              settings?.ai?.has_api_key
                                ? 'Biarkan kosong jika tidak ingin mengubah'
                                : 'Masukkan kunci API Anda'
                            }
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            aria-label={showKey ? 'Sembunyikan API key' : 'Tampilkan API key'}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                          >
                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="mt-1 flex justify-end">
                          <a
                            href={
                              provider === 'GEMINI'
                                ? 'https://aistudio.google.com/app/apikey'
                                : 'https://console.groq.com/keys'
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-indigo-400 hover:underline inline-flex items-center gap-1"
                          >
                            Dapatkan API Key di {provider === 'GEMINI' ? 'Google AI Studio' : 'Groq Console'}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>

                      {/* Connection Test Banner */}
                      {validationResult && (
                        <div
                          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                            validationResult.valid
                              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                              : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                          }`}
                        >
                          {validationResult.valid ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                          <span>{validationResult.message}</span>
                        </div>
                      )}

                      <div className="pt-2 flex items-center justify-between gap-3">
                        <Button
                          size="sm"
                          variant="flat"
                          onClick={handleValidateKey}
                          disabled={isValidating || !apiKey.trim()}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold"
                        >
                          {isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Uji Koneksi'}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="pt-3 flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSaveAISettings}
                      disabled={isSaving}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs px-5 min-h-[38px]"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Pengaturan'}
                    </Button>
                  </div>
                </div>
              )}
            </ModalBody>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
npm --prefix frontend test -- src/__tests__/SettingsModal.test.tsx --run
```
Expected: PASS (all tests passing)

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/components/SettingsModal.tsx frontend/src/__tests__/SettingsModal.test.tsx; git commit -m "feat(frontend): create SettingsModal component for Telegram and AI BYOK

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 9: Dashboard Integration & Trigger Button

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/__tests__/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `<SettingsModal />`, `<Settings />` from `lucide-react`
- Produces: "Pengaturan" navbar button and modal trigger

- [ ] **Step 1: Write failing test in `frontend/src/__tests__/DashboardPage.test.tsx`**

Append to `frontend/src/__tests__/DashboardPage.test.tsx`:
```typescript
  it('renders Pengaturan button and clicking opens SettingsModal', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint === '/transactions') return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint === '/categories') return [];
      if (endpoint === '/settings') {
        return {
          telegram: { is_connected: false, telegram_chat_id: null, bot_username: 'RezekifyBot' },
          ai: {
            is_custom_ai_enabled: false,
            provider: 'SYSTEM',
            model: 'gemini-2.5-flash',
            has_api_key: false,
            available_models: {},
          },
        };
      }
      return {};
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Pengaturan/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Pengaturan/i }));

    await waitFor(() => {
      expect(screen.getByText('Pengaturan Akun & Sistem')).toBeInTheDocument();
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
npm --prefix frontend test -- src/__tests__/DashboardPage.test.tsx -t "renders Pengaturan button" --run
```
Expected: FAIL with "Unable to find an element with text: Pengaturan"

- [ ] **Step 3: Modify `frontend/src/pages/DashboardPage.tsx`**

In `frontend/src/pages/DashboardPage.tsx`:
1. Import `Settings` from `lucide-react`:
```typescript
import {
  PlusCircle,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Building2,
  Receipt,
  Calculator,
  Wallet,
  Settings,
} from 'lucide-react';
```

2. Import `SettingsModal`:
```typescript
import { SettingsModal } from '../components/SettingsModal';
```

3. Add state inside `DashboardPage`:
```typescript
const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
```

4. Add "Pengaturan" button in header action buttons right after "+ Transaksi Manual":
```tsx
            <Button
              size="sm"
              variant="flat"
              onClick={() => setIsSettingsModalOpen(true)}
              startContent={<Settings className="w-3.5 h-3.5 text-indigo-400" />}
              className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 min-h-[38px] rounded-xl text-xs font-semibold shrink-0"
            >
              Pengaturan
            </Button>
```

5. At bottom of component alongside existing modals, render `<SettingsModal>`:
```tsx
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSettingsUpdated={loadData}
      />
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
npm --prefix frontend test -- src/__tests__/DashboardPage.test.tsx --run
```
Expected: PASS (all dashboard tests passing)

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/pages/DashboardPage.tsx frontend/src/__tests__/DashboardPage.test.tsx; git commit -m "feat(frontend): integrate SettingsModal trigger into DashboardPage navbar

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 10: End-to-End System Verification & Quality Gate

**Files:**
- All modified and new files across backend and frontend

- [ ] **Step 1: Execute full backend test suite**

Run:
```powershell
pytest
```
Expected: PASS with exit code 0.

- [ ] **Step 2: Run backend linter**

Run:
```powershell
ruff check .
```
Expected: PASS with 0 errors.

- [ ] **Step 3: Run backend type checking**

Run:
```powershell
mypy rezekify
```
Expected: PASS with 0 errors.

- [ ] **Step 4: Run full frontend test suite**

Run:
```powershell
npm --prefix frontend test -- --run
```
Expected: PASS with exit code 0 across all Vitest suites.

- [ ] **Step 5: Run frontend typecheck and production build**

Run:
```powershell
npm --prefix frontend run build
```
Expected: PASS with exit code 0 and successful Vite bundle output.
