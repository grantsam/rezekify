# Technical Specification: Semi-SaaS Architecture, Telegram Connection Management, and AI BYOK

- **Date:** 2026-09-22
- **Scope:** Multi-Tenant Architecture Expansion (User Settings, Fernet Key Encryption, Telegram Self-Service Management, Bring Your Own Key AI Runtime, and Settings GUI)
- **Status:** Approved for Implementation

---

## 1. Architectural Goals & Problem Statement

### 1.1 Context & Motivation
Rezekify originally operated under a single-tenant paradigm with shared platform resources:
1. **Shared Rotary LLM Pool Contention:** All users shared the platform's free-tier API keys (`GEMINI_API_KEYS`, `GROQ_API_KEYS`). During traffic spikes or batch receipt scans, shared rotary pools risked quota exhaustion (HTTP 429), degrading user experience across all tenants.
2. **Fixed AI Model Tiering:** Users were locked into default models (`gemini-2.5-flash` and `llama-4-scout-17b`) without the ability to leverage larger, high-reasoning models (e.g., `gemini-2.5-pro` or `llama-3.3-70b`) or private corporate quotas.
3. **Friction in Telegram Integration:** Connecting a Telegram account required requesting a pairing code via API and manually typing `/link KODE` inside Telegram. There was no visual connection status, no 1-click deep link to auto-start the bot, and no self-service mechanism in the web interface to unlink an existing Telegram account.

### 1.2 Target Architecture: Semi-SaaS Model
The Semi-SaaS model transforms Rezekify into a multi-tenant platform balancing zero-cost barrier to entry with self-service power features:
- **Zero-Cost Shared Platform Mode (Default):** New users can immediately use the platform out of the box using Rezekify's shared rotary key pool without needing any API keys.
- **Bring Your Own Key (BYOK) Mode:** Advanced users and teams can supply their own private API keys (Google Gemini or Groq Cloud) and select specialized models. These keys are encrypted at rest and resolved dynamically per request.
- **Hybrid Fallback Engine:** When a user's custom key is disabled, absent, or fails gracefully during non-fatal scenarios, the runtime falls back to the system's rotary pool or provides precise, actionable error feedback.
- **Self-Service Telegram Hub:** A unified settings interface in the web dashboard displaying real-time connection telemetry, 1-click pairing code generation with automated deep link (`https://t.me/<bot_username>?start=<pairing_code>`), and secure unlinking.

### 1.3 Core Invariants
1. **Mathematical Determinism (Invariant 1):** AI models (whether shared or BYOK) strictly perform entity extraction. Balance arithmetic, ledger double-entry bookkeeping, and daily safe runway formulas remain 100% deterministic Python logic using `decimal.Decimal`.
2. **Row-Level Tenant Isolation (Invariant 3):** User settings and encrypted secrets are strictly scoped to `user_id = current_user.id`. No user can inspect or modify another user's API keys or Telegram connection state.
3. **Zero Plaintext Secret Exposure:** Raw API keys are encrypted at rest using AES-128-CBC/HMAC-SHA256 (Fernet). Raw keys are never logged, never returned in API payloads, and never persisted in unencrypted database columns. Only a non-sensitive key hint (e.g., `"...4x8B"`) and a boolean flag (`has_api_key`) are exposed to the client.
4. **Balanced Ledger Enforcement (Invariant 2):** Any transaction produced via custom AI extraction must satisfy $\sum \text{Debit} = \sum \text{Credit}$ before persisting to the ledger.

---

## 2. Data Modeling & Database Architecture

### 2.1 Domain Model (`UserSettings`)
A new database model, `UserSettings`, stores tenant-specific AI preferences and encrypted credentials. It maintains a strict 1:1 relationship with `User`.

#### Location: `rezekify/db/models.py`

```python
class AIProvider(str, Enum):
    SYSTEM = "SYSTEM"
    GEMINI = "GEMINI"
    GROQ = "GROQ"


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

#### Updates to `User` Model in `rezekify/db/models.py`:
```python
class User(Base):
    # ... existing columns ...
    settings = relationship(
        "UserSettings",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
```

### 2.2 Model Schema Specifications

| Column | Type | Constraints | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | GUID / CHAR(36) | Primary Key | `uuid.uuid4` | Unique identifier for the settings record |
| `user_id` | GUID / CHAR(36) | Foreign Key (`users.id`), Unique, Indexed | Required | Foreign key with `ON DELETE CASCADE` |
| `ai_provider` | SQLEnum(AIProvider) | Non-null | `SYSTEM` | Active provider: `SYSTEM`, `GEMINI`, or `GROQ` |
| `ai_model` | String(100) | Non-null | `gemini-2.5-flash` | Selected AI model identifier |
| `encrypted_api_key`| Text | Nullable | `None` | Fernet-encrypted ciphertext of user's API key |
| `key_hint` | String(16) | Nullable | `None` | Masked representation of key (e.g. `"...4x8B"`) |
| `is_custom_ai_enabled` | Boolean | Non-null | `False` | Toggle enabling BYOK over system rotary pool |
| `created_at` | DateTime(tz=True) | Non-null | `utc_now` | Timestamp of creation |
| `updated_at` | DateTime(tz=True) | Non-null | `utc_now` | Timestamp of last modification |

### 2.3 Alembic Migration (`002_user_settings_and_byok.py`)
Alembic migration creates the `user_settings` table with proper foreign key constraints, indexes, and reversibility.

#### Location: `rezekify/db/migrations/versions/002_user_settings_and_byok.py`
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

---

## 3. Cryptography & Key Management (`rezekify/core/crypto.py`)

### 3.1 Encryption Algorithm & Key Derivation
- **Standard**: Symmetric authenticated encryption using Python's `cryptography.fernet.Fernet` (AES-128-CBC with PKCS7 padding and HMAC-SHA256 authenticated integrity verification).
- **Key Derivation Scheme**:
  1. If `settings.ENCRYPTION_KEY` is explicitly configured in environment variables and valid 32-byte base64 string, use it directly.
  2. If `settings.ENCRYPTION_KEY` is unset or blank, derive a deterministic 32-byte key from `settings.SECRET_KEY` using SHA-256 and base64 urlsafe encoding:
     $$\text{Key} = \text{base64url}(\text{SHA256}(\text{settings.SECRET_KEY}))$$
  3. This ensures zero operational friction in local and development environments while offering dedicated master key segregation in production.

### 3.2 Configuration Updates (`rezekify/core/config.py`)
```python
# Security & Encryption
ENCRYPTION_KEY: Optional[str] = None
TELEGRAM_BOT_USERNAME: str = "RezekifyBot"
```

### 3.3 Crypto Module Implementation Contract

#### Location: `rezekify/core/crypto.py`
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
    if not raw_key:
        raise ValueError("Cannot encrypt an empty key.")
    f = _get_fernet_instance()
    ciphertext = f.encrypt(raw_key.strip().encode("utf-8"))
    return ciphertext.decode("utf-8")


def decrypt_key(ciphertext: str) -> str:
    """Decrypts ciphertext token string back to plaintext API key.

    Raises ValueError if ciphertext is invalid or tampered with.
    """
    if not ciphertext:
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

### 3.4 Key Sanitization Invariants
- `encrypt_key` strips surrounding whitespace before encryption.
- Plaintext keys are never output to standard loggers, `DEBUG` dumps, or tracebacks.
- Database queries and API serialization schemas completely omit `encrypted_api_key`.

---

## 4. API Contracts (`/api/v1/settings` Router)

### 4.1 Available Model Matrix
The platform supports four verified AI models across two providers:

| Provider | Model Identifier | Capability | Best Use Case |
| :--- | :--- | :--- | :--- |
| **GEMINI** | `gemini-2.5-flash` | Multimodal (Text, Image) | Ultra-fast daily transactions & receipts |
| **GEMINI** | `gemini-2.5-pro` | Multimodal (Text, Image) | Complex receipts & deep financial reasoning |
| **GROQ** | `llama-4-scout-17b` | Multimodal (Vision & Text) | Open-source fast vision OCR via GroqCloud |
| **GROQ** | `llama-3.3-70b` | Text-only | High-throughput conversational transactions |

### 4.2 Schema Definitions

#### Location: `rezekify/schemas/settings.py`
```python
from enum import Enum
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
```

### 4.3 Router Endpoints Specification

#### Location: `rezekify/api/v1/settings_router.py`

#### 1. `GET /api/v1/settings`
- **Description:** Returns the tenant's current Telegram connection status and AI settings. If the user has no `UserSettings` record yet, creates a default one automatically.
- **Security:** Requires Bearer JWT authentication (`current_user`).
- **Response Code:** `200 OK`
- **Response Body:** `SettingsResponse`
```json
{
  "telegram": {
    "is_connected": true,
    "telegram_chat_id": 123456789,
    "bot_username": "RezekifyBot"
  },
  "ai": {
    "is_custom_ai_enabled": true,
    "provider": "GEMINI",
    "model": "gemini-2.5-flash",
    "has_api_key": true,
    "key_hint": "...4x8B",
    "available_models": {
      "GEMINI": ["gemini-2.5-flash", "gemini-2.5-pro"],
      "GROQ": ["llama-4-scout-17b", "llama-3.3-70b"]
    }
  }
}
```

#### 2. `POST /api/v1/settings/ai/validate`
- **Description:** Performs a lightweight live probe call to the specified provider with the candidate API key to verify authentication and quota validity before saving. Does NOT mutate the database.
- **Security:** Requires Bearer JWT authentication.
- **Request Body:** `AIKeyValidateRequest`
- **Behavior:**
  - For `GEMINI`: Calls `google.genai.Client(api_key=api_key).models.generate_content(model="gemini-2.5-flash", contents="test ping")` or `count_tokens`.
  - For `GROQ`: Calls `groq.Groq(api_key=api_key).chat.completions.create(model="llama-3.3-70b-versatile", messages=[{"role": "user", "content": "ping"}], max_tokens=1)`.
- **Response Codes:**
  - `200 OK` -> `{"valid": true, "message": "Koneksi ke Google Gemini berhasil diverifikasi."}`
  - `400 Bad Request` -> `{"valid": false, "message": "Kunci API tidak valid atau kuota habis: API_KEY_INVALID"}`

#### 3. `PUT /api/v1/settings/ai`
- **Description:** Updates the tenant's AI provider, model selection, BYOK toggle, and optionally encrypts a newly provided API key.
- **Security:** Requires Bearer JWT authentication.
- **Validation Rules:**
  - If `is_custom_ai_enabled=True`, either a new non-empty `api_key` must be provided OR an existing `encrypted_api_key` must already exist in database. Otherwise, raises `400 Bad Request` (`"Kunci API wajib diisi untuk mengaktifkan AI kustom (BYOK)."`).
  - Selected `model` must belong to the selected `provider`'s available models.
  - If `api_key` is provided with non-empty text, it is encrypted via `encrypt_key`, `key_hint` is generated via `mask_key`, and both are saved.
  - If `api_key` is `None` or `""`, the existing `encrypted_api_key` and `key_hint` are retained.
- **Response Code:** `200 OK`
- **Response Body:** `AISettingsResponse`

#### 4. `POST /api/v1/settings/telegram/unlink`
- **Description:** Disconnects the tenant's Telegram integration.
- **Security:** Requires Bearer JWT authentication.
- **State Changes:**
  - Sets `current_user.telegram_chat_id = None`.
  - Clears `current_user.telegram_pairing_code = None`.
  - Clears `current_user.pairing_code_expires_at = None`.
  - Flushes and commits database session.
- **Response Code:** `200 OK`
- **Response Body:** `TelegramUnlinkResponse`
```json
{
  "success": true,
  "message": "Akun Telegram berhasil diputuskan."
}
```

#### 5. Integration with Existing `POST /api/v1/auth/telegram-pairing-code`
- Generates a temporary random 6-character OTP pairing code (e.g., `DK-9482`) with a 15-minute expiry stored on `users.telegram_pairing_code`.
- The frontend uses the returned `pairing_code` to generate the 1-click deep link:
  $$\text{DeepLink} = \text{https://t.me/} + \text{bot\_username} + \text{?start=} + \text{pairing\_code}$$

---

## 5. Telegram Deep Linking & Gateway Lifecycle

### 5.1 Deep Link Flow Architecture
1. **User Request:** User opens "Integrasi Telegram" tab in `SettingsModal` and clicks "Dapatkan Kode Pairing".
2. **Code Generation:** Frontend calls `POST /api/v1/auth/telegram-pairing-code`, which returns `{"pairing_code": "DK-8492"}`.
3. **Deep Link Construction:** Frontend forms URL `https://t.me/RezekifyBot?start=DK-8492` and provides a direct "Buka Telegram (1-Klik)" button.
4. **Telegram App Redirect:** User taps the button. Telegram client opens the chat with `@RezekifyBot` and automatically prompts the user with a "START" button.
5. **Start Payload Delivery:** Tapping "START" delivers the payload `/start DK-8492` to the webhook handler.
6. **Automatic Account Linking:** The bot extracts the code from `/start <CODE>`, validates the pairing code against database expiry, updates `user.telegram_chat_id = chat_id`, and immediately sends a welcoming confirmation message back to the chat.

```
[Web Dashboard]                          [Telegram App]                      [Rezekify Backend]
       |                                       |                                     |
       |--- 1. POST /auth/telegram-pairing --->|                                     |
       |<-- 2. pairing_code: "DK-8492" --------|                                     |
       |                                       |                                     |
       |--- 3. User clicks deep link --------->|                                     |
       |    (t.me/RezekifyBot?start=DK-8492)   |                                     |
       |                                       |--- 4. Sends `/start DK-8492` ------>|
       |                                       |                                     | 5. Links chat_id
       |                                       |                                     |    to user_id
       |                                       |<-- 6. "Akun berhasil terhubung!" ---|
```

### 5.2 Gateway Enhancement (`rezekify/gateway/telegram_bot.py`)
Enhance `process_text_message` to parse `/start <CODE>` payloads seamlessly alongside the existing `/link <CODE>` command:

```python
# In TelegramBotGateway.process_text_message
cleaned_text = text.strip()

# Support both /start with parameter (deep linking) and explicit /link
if cleaned_text.startswith("/start") or cleaned_text.startswith("/link"):
    parts = cleaned_text.split()
    if len(parts) >= 2:
        code = parts[1].strip()
        try:
            user = self.auth.link_telegram_chat_id(telegram_chat_id=chat_id, pairing_code=code)
            return (
                f"🎉 Selamat datang {user.full_name}! Akun Rezekify Anda berhasil terhubung.\n\n"
                "Mulai sekarang Anda cukup ketik transaksi pengeluaran, kirim pesan suara, "
                "atau kirim foto struk belanja di sini."
            )
        except ValueError as e:
            return f"❌ Gagal menghubungkan akun: {str(e)}"

    if cleaned_text == "/start":
        user = self.db.query(User).filter_by(telegram_chat_id=chat_id).first()
        if user:
            return (
                f"👋 Selamat datang kembali, {user.full_name}!\n\n"
                "Ketik transaksi harian, kirim foto struk belanja, atau cek kondisi runway dengan /runway."
            )
        return (
            "👋 Selamat datang di Bot Keuangan Rezekify!\n\n"
            "Untuk menghubungkan bot ini dengan akun Rezekify Anda:\n"
            "1. Buka Web Dashboard Rezekify -> Pengaturan -> Integrasi Telegram.\n"
            "2. Dapatkan kode pairing atau klik tautan instan.\n"
            "3. Atau kirim perintah: `/link KODE-PAIRING` di sini."
        )
```

---

## 6. AI Runtime Tenant Resolver & Hybrid Fallback Engine

### 6.1 Multi-Tenant Key Resolution Architecture
Currently, `AgentOrchestrator` relies on a static singleton `ReActAgent` initialized with the system `RotaryKeyPool`. To support per-user BYOK without sacrificing shared performance, `AgentOrchestrator` implements a dynamic tenant agent resolver:

```
                          [User Input (Text / Image)]
                                       |
                       [AgentOrchestrator.handle_message]
                                       |
                   Query `user_settings` for `user_id`
                                       |
                    +------------------+------------------+
                    |                                     |
       is_custom_ai_enabled = True           is_custom_ai_enabled = False
        & encrypted_api_key present                 or key absent
                    |                                     |
           [Decrypt User Key]               [Default System Rotary Pool]
                    |                       - Gemini 2.5 Flash Pool
       +------------+------------+          - Groq Llama-4 Fallback Pool
       |                         |                        |
[User GEMINI Key]        [User GROQ Key]                  |
- gemini-2.5-flash       - llama-4-scout-17b              |
- gemini-2.5-pro         - llama-3.3-70b                  |
       |                         |                        |
       +------------+------------+                        |
                    |                                     |
             [Execute Agent]                              |
                    |                                     |
         +----------+----------+                          |
         |                     |                          |
      Success               401 / 429 Error               |
         |                     |                          |
   [Return Data]       [Friendly Alert Error]             |
                               or                         |
                      [Platform Safe Fallback] <----------+
```

### 6.2 Implementation Details (`rezekify/agent/orchestrator.py`)

#### Dynamic Agent Factory:
```python
def _resolve_agent_for_user(self, user_id: UUID) -> tuple[ReActAgent, bool]:
    """Resolves an ephemeral ReActAgent for BYOK user or falls back to system agent.

    Returns:
        tuple[agent: ReActAgent, is_custom: bool]
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
                # Ephemeral agent targeting user's custom Gemini model
                agent = ReActAgent(
                    gemini_pool=user_pool,
                    groq_pool=None,
                    gemini_model=model,
                )
                return agent, True
            elif provider == AIProvider.GROQ:
                user_pool = RotaryKeyPool(keys=[raw_key], cooldown_seconds=30)
                # Ephemeral agent targeting user's custom Groq model
                agent = ReActAgent(
                    gemini_pool=None,
                    groq_pool=user_pool,
                    groq_model=model,
                )
                return agent, True
        except Exception as e:
            # If decryption or initialization fails, fallback to platform agent
            pass

    # Default fallback: system agent
    return self.agent, False
```

### 6.3 Updates to `ReActAgent` (`rezekify/agent/runtime.py`)
Modify `ReActAgent` to accept optional `gemini_model: str` and `groq_model: str` parameters with defaults (`"gemini-2.5-flash"` and `"meta-llama/llama-4-scout-17b-16e-instruct"`).

```python
class ReActAgent:
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

### 6.4 Error Resilience & Feedback Policy
If a BYOK user's custom API key fails during processing:
- **HTTP 401 Unauthorized / Invalid API Key:** Return an explicit, friendly Indonesian error message:
  `"❌ Kunci API AI kustom Anda tidak valid atau telah dicabut. Silakan periksa di menu Pengaturan."`
- **HTTP 429 Quota Exhausted:** Return:
  `"⚠️ Kuota kunci API AI kustom Anda telah habis (Rate Limit). Silakan periksa kuota Anda di dashboard provider atau nonaktifkan BYOK untuk menggunakan kuota bersama."`
- This ensures users are never confused about whether an error originated from Rezekify or from their own third-party API quotas.

---

## 7. Frontend GUI & UX Architecture (`SettingsModal.tsx`)

### 7.1 Dashboard Navigation & Trigger
In `frontend/src/pages/DashboardPage.tsx`:
- Add a `<SettingsModal />` component triggered by a state variable: `const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);`.
- In the top navigation bar, place a dedicated "Pengaturan" button with `<Settings className="w-3.5 h-3.5" />` icon adjacent to existing action buttons:
  ```tsx
  <Button
    size="sm"
    variant="flat"
    onClick={() => setIsSettingsModalOpen(true)}
    startContent={<Settings className="w-3.5 h-3.5 text-slate-300" />}
    className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 min-h-[38px] rounded-xl text-xs font-semibold shrink-0"
  >
    Pengaturan
  </Button>
  ```

### 7.2 Modal Architecture & Tab Layout
The `SettingsModal` is styled with Rezekify's dark theme design system (`bg-slate-900 border border-slate-800` backdrop, crisp typography, and fluid micro-interactions). It contains two primary tabs:

```
+---------------------------------------------------------------+
|  Pengaturan Akun & Sistem                                 [X] |
+---------------------------------------------------------------+
|  [ 📱 Integrasi Telegram ]    [ 🤖 Model & Kunci AI (BYOK) ]  |
+---------------------------------------------------------------+
|                                                               |
|  (Content renders dynamically based on active tab)            |
|                                                               |
+---------------------------------------------------------------+
```

### 7.3 Tab 1: "Integrasi Telegram"
Displays connection telemetry, pairing code generation, and unlinking actions.

#### UI State A: Belum Terhubung (Not Connected)
1. **Status Badge:** Amber indicator (`Belum Terhubung`).
2. **Instruction Card:** Clear 3-step explanation:
   - Step 1: Klik tombol "Dapatkan Kode Pairing".
   - Step 2: Buka bot Telegram melalui tombol instan.
   - Step 3: Bot langsung terhubung dan siap mencatat transaksi.
3. **Action Button:** "Dapatkan Kode Pairing Baru".
4. **Generated State:**
   - Monospace display badge showing code: `DK-8492` with 1-click "Salin Kode" button.
   - 1-Click Deep Link Button: "Buka Telegram Sekarang" (`href="https://t.me/RezekifyBot?start=DK-8492"`, target `_blank`).
   - Countdown timer showing code validity (15 minutes).

#### UI State B: Terhubung (Connected)
1. **Status Badge:** Emerald indicator (`Terhubung: ID 123456789`).
2. **Details:** Confirms that transaction logging via text, voice notes, and receipts is active.
3. **Unlink Button:** "Putuskan Hubungan Telegram" (styled with `text-rose-400 bg-rose-500/10 border-rose-500/20`).
4. **Confirmation Modal / Prompt:** Requires confirmation before resetting credentials to prevent accidental disconnects.

### 7.4 Tab 2: "Model & Kunci AI (BYOK)"
Enables tenants to switch between the shared platform pool and their private API keys.

#### UI Components:
1. **Mode Toggle Cards:**
   - **Card 1: Shared Platform (Default):**
     - Subtitle: "Gunakan infrastruktur rotary pool Rezekify secara gratis."
     - Status: Zero configuration needed.
   - **Card 2: Bring Your Own Key (BYOK):**
     - Subtitle: "Gunakan kunci API Google Gemini atau Groq pribadi Anda untuk kuota tak terbatas & model mutakhir."
2. **Provider Selector (Visible when BYOK active):**
   - Toggle buttons: `Google Gemini` vs `Groq Cloud`.
3. **Model Selection Dropdown:**
   - For Gemini: `gemini-2.5-flash` (Rekomendasi Cepat) / `gemini-2.5-pro` (Penalaran Kompleks).
   - For Groq: `llama-4-scout-17b` (Vision & Struk) / `llama-3.3-70b` (Kapasitas Besar).
4. **API Key Input Field:**
   - Masked password input with toggle visibility eye icon.
   - If key already saved on server: shows hint `Tersimpan (...4x8B)` and placeholder `Biarkan kosong jika tidak ingin mengubah`.
   - Helpful external links: "Dapatkan API Key di Google AI Studio" or "Dapatkan API Key di Groq Console".
5. **Action Bar:**
   - **"Uji Koneksi" Button:** Calls `POST /api/v1/settings/ai/validate`. Shows loading spinner. Displays green checkmark or red error banner with detail message.
   - **"Simpan Pengaturan" Button:** Calls `PUT /api/v1/settings/ai`. Displays toast or status banner on success.

### 7.5 API Client Methods (`frontend/src/services/apiClient.ts`)
```typescript
// Settings APIs
export async function getSettings(): Promise<SettingsResponse> {
  return apiFetch<SettingsResponse>('/settings');
}

export async function validateAIKey(payload: {
  provider: 'GEMINI' | 'GROQ';
  api_key: string;
  model?: string;
}): Promise<{ valid: boolean; message: string }> {
  return apiFetch<{ valid: boolean; message: string }>('/settings/ai/validate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAISettings(payload: {
  is_custom_ai_enabled: boolean;
  provider: 'GEMINI' | 'GROQ';
  model: string;
  api_key?: string;
}): Promise<AISettingsResponse> {
  return apiFetch<AISettingsResponse>('/settings/ai', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function unlinkTelegram(): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>('/settings/telegram/unlink', {
    method: 'POST',
  });
}

export async function getTelegramPairingCode(): Promise<{ pairing_code: string }> {
  return apiFetch<{ pairing_code: string }>('/auth/telegram-pairing-code', {
    method: 'POST',
  });
}
```

---

## 8. Testing & Verification Strategy

### 8.1 Backend Unit Tests: Cryptography (`tests/test_crypto.py`)
- **Roundtrip Integrity:** Assert `decrypt_key(encrypt_key(raw))` equals `raw` for diverse API key formats (standard ASCII, special characters, long strings).
- **Deterministic Derivation:** Assert that without `ENCRYPTION_KEY`, the key derived from `SECRET_KEY` produces valid, repeatable encryption/decryption.
- **Tamper Resistance:** Assert `decrypt_key("invalid-token")` raises `ValueError` with clear error message.
- **Masking:**
  - `mask_key("AIzaSyD-XYZ1234")` -> `"...1234"`
  - `mask_key("abc")` -> `"...abc"`
  - `mask_key("")` -> `""`

### 8.2 Backend Router Tests (`tests/test_settings_api.py`)
- **GET /api/v1/settings:**
  - New user: auto-creates default `user_settings` (`SYSTEM`, `gemini-2.5-flash`, `is_custom_ai_enabled=False`).
  - Existing user: returns stored settings.
  - Invariant Check: Verify response JSON never contains `encrypted_api_key`.
- **POST /api/v1/settings/ai/validate:**
  - Valid key mock: returns `200` with `{"valid": true}`.
  - Invalid key mock: returns `400` with descriptive Indonesian message.
- **PUT /api/v1/settings/ai:**
  - Enabling BYOK without key when none stored raises `400 Bad Request`.
  - Updating key encrypts it and updates `key_hint`.
  - Updating model without supplying new key retains existing encrypted key.
- **POST /api/v1/settings/telegram/unlink:**
  - Clears `telegram_chat_id`, `telegram_pairing_code`, and expiration.
  - Subsequent `GET /settings` reflects `is_connected=False`.

### 8.3 Telegram Gateway & Deep Link Tests (`tests/test_telegram_bot.py`)
- Test `/start DK-8492` triggers automatic linking identical to `/link DK-8492`.
- Test `/start` without arguments on unlinked account returns connection instructions.
- Test `/start` without arguments on already-linked account returns personalized greeting.

### 8.4 Agent Tenant Resolver Tests (`tests/test_agent_orchestrator.py`)
- User with BYOK disabled: orchestrator routes through default `RotaryKeyPool`.
- User with BYOK enabled (Gemini): orchestrator resolves custom key, instantiates ephemeral agent with specified model.
- User with BYOK enabled (Groq): orchestrator routes through Groq with specified model.
- User custom key fails with 401/429: verifies graceful, user-friendly Indonesian error message.

### 8.5 Frontend Component Tests (`frontend/src/__tests__/SettingsModal.test.tsx`)
- Renders modal when open.
- Switches between "Integrasi Telegram" and "Model & Kunci AI" tabs.
- Generates pairing code and verifies deep link format (`href="https://t.me/RezekifyBot?start=..."`).
- Toggles BYOK on/off and shows/hides provider and model controls.
- Mocks API validation call and displays success/error states.
- Submits settings form and verifies API call payload.

---

## 9. Implementation Plan & Phased Milestones

| Phase | Tasks | Primary Artifacts |
| :--- | :--- | :--- |
| **Phase 1: Crypto & DB Migration** | Implement `crypto.py`, update `models.py` with `UserSettings`, generate and apply Alembic migration `002`. | `rezekify/core/crypto.py`<br>`rezekify/db/models.py`<br>`rezekify/db/migrations/versions/002_...` |
| **Phase 2: Settings API & Telegram** | Build `/api/v1/settings` router, schemas, and enhance `telegram_bot.py` with `/start CODE` deep linking. | `rezekify/schemas/settings.py`<br>`rezekify/api/v1/settings_router.py`<br>`rezekify/gateway/telegram_bot.py` |
| **Phase 3: AI Tenant Resolver** | Update `AgentOrchestrator` and `ReActAgent` to support dynamic per-tenant key and model resolution. | `rezekify/agent/runtime.py`<br>`rezekify/agent/orchestrator.py` |
| **Phase 4: Frontend Settings GUI** | Implement `SettingsModal.tsx`, update `apiClient.ts`, `api.ts`, and integrate trigger button in `DashboardPage.tsx`. | `frontend/src/components/SettingsModal.tsx`<br>`frontend/src/pages/DashboardPage.tsx`<br>`frontend/src/services/apiClient.ts` |
| **Phase 5: Verification & Quality Gate** | Execute unit test suites, integration tests, type checks (`mypy`, `tsc`), and linter (`ruff`). | `tests/test_crypto.py`<br>`tests/test_settings_api.py`<br>`frontend/src/__tests__/SettingsModal.test.tsx` |
