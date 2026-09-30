# Multi-Provider BYOK (Custom Endpoint) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two hardcoded BYOK providers (Gemini, Groq) with a single CUSTOM mode where the user supplies a protocol (OpenAI- or Anthropic-compatible), base_url, model, and API key, routed through an isolated protocol-adapter module.

**Architecture:** `AIProvider` collapses to `SYSTEM | CUSTOM`; CUSTOM carries an `AIProtocol` (`OPENAI | ANTHROPIC`). A new `rezekify/agent/providers/` package holds `httpx`-based adapters that return the same dict shape as `ReActAgent._clean_json_response`. The SYSTEM rotary pool (Gemini + Groq) is untouched and remains the default. BYOK failures hard-fail with a clear error; there is no silent fallback to SYSTEM.

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic, `httpx`, `decimal.Decimal`; React 18 + Vite + TypeScript + Tailwind (frontend). Tests: `pytest`.

**Spec:** `docs/superpowers/specs/2026-09-28-multi-provider-byok-design.md`

## Global Constraints

- `AIProvider` enum members are exactly `SYSTEM`, `CUSTOM` (remove `GEMINI`, `GROQ`).
- `AIProtocol` enum members are exactly `OPENAI`, `ANTHROPIC`.
- `ai_provider`, `ai_protocol` use `SQLEnum(..., native_enum=False)` (stored as VARCHAR) — no Postgres native enum ALTER.
- Adapters use `httpx` only. No `google-genai` / `groq` SDK usage anywhere in the BYOK path.
- BYOK failures NEVER fall back to SYSTEM. `AuthError` -> `{"action":"byok_error","status_code":401}`; `RateLimitError` -> `{"action":"byok_error","status_code":429}`; `CapabilityUnsupported` -> `{"action":"byok_error","reason":"unsupported_capability"}`; any other exception -> `{"action":"byok_error"}`.
- `base_url` must be `https://`; IP-literal private/loopback/link-local/reserved/multicast hosts are rejected. DNS resolution of hostnames is performed only at request time (`resolve=True`), never inside Pydantic schema validation (keeps schema hermetic).
- Migration auto-maps existing rows: `GEMINI` -> CUSTOM/OPENAI/`https://generativelanguage.googleapis.com/v1beta/openai`; `GROQ` -> CUSTOM/OPENAI/`https://api.groq.com/openai/v1`. Existing encrypted key and model preserved.
- Windows/PowerShell environment. Conventional Commits. End every commit message with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Money is never computed by the LLM (unchanged invariant). Row-level tenant isolation unchanged.

## Review Focus

- **Non-https base_url (`http://...`)** — must be rejected with a 400/clear ValueError, never attempted. (Task 8, schema + validate_ai_credentials)
- **base_url pointing at a private/loopback IP literal (`https://10.0.0.1`, `https://127.0.0.1`)** — must be rejected before any outbound request. (Task 8)
- **Anthropic audio input** — must return a clear capability error to the user, never a 500/crash. (Task 5 adapter; Task 7 orchestrator message)
- **Endpoint returns malformed / non-JSON body** — `extract_json` returns `{"action":"unknown","raw":...}`, never raises. (Task 3)
- **`is_custom_ai_enabled=true` + provider CUSTOM but protocol/base_url omitted** — API returns 400, not 500. (Task 8 schema; Task 9 router)

---

### Task 1: Data model — collapse AIProvider, add AIProtocol + UserSettings columns

**Files:**
- Modify: `rezekify/db/models.py` (AIProvider enum ~70-73; UserSettings ~181-204)
- Test: `tests/test_db_models.py` (existing `test_user_settings_model_and_relationship` ~120-136)

**Interfaces:**
- Produces: `AIProvider.SYSTEM`, `AIProvider.CUSTOM`; `AIProtocol.OPENAI`, `AIProtocol.ANTHROPIC`; `UserSettings.ai_protocol` (nullable), `UserSettings.ai_base_url` (nullable String(512)).

- [ ] **Step 1: Update the model test to CUSTOM + protocol**

In `tests/test_db_models.py`, replace the body of `test_user_settings_model_and_relationship` so it imports and uses the new enums:

```python
def test_user_settings_model_and_relationship(db_session, sample_user):
    from rezekify.db.models import AIProtocol, AIProvider, UserSettings

    settings = UserSettings(
        user_id=sample_user.id,
        ai_provider=AIProvider.CUSTOM,
        ai_protocol=AIProtocol.OPENAI,
        ai_base_url="https://api.openai.com/v1",
        ai_model="gpt-4o-mini",
        is_custom_ai_enabled=True,
    )
    db_session.add(settings)
    db_session.commit()
    db_session.refresh(sample_user)

    assert sample_user.settings is not None
    assert sample_user.settings.ai_provider == AIProvider.CUSTOM
    assert sample_user.settings.ai_protocol == AIProtocol.OPENAI
    assert sample_user.settings.ai_base_url == "https://api.openai.com/v1"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_db_models.py::test_user_settings_model_and_relationship -v`
Expected: FAIL with `AttributeError`/`ImportError` (no `AIProtocol`, no `CUSTOM`).

- [ ] **Step 3: Update the model**

In `rezekify/db/models.py` replace the `AIProvider` class with:

```python
class AIProvider(str, Enum):
    SYSTEM = "SYSTEM"
    CUSTOM = "CUSTOM"


class AIProtocol(str, Enum):
    OPENAI = "OPENAI"
    ANTHROPIC = "ANTHROPIC"
```

In `UserSettings`, add two columns immediately after the `ai_provider` column:

```python
    ai_protocol = Column(
        SQLEnum(AIProtocol, native_enum=False),
        nullable=True,
    )
    ai_base_url = Column(String(512), nullable=True)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_db_models.py::test_user_settings_model_and_relationship -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/db/models.py tests/test_db_models.py
git commit -m "feat(models): collapse AIProvider to SYSTEM/CUSTOM and add AIProtocol + custom endpoint columns"
```

---

### Task 2: Alembic migration 005 + migration smoke test

**Files:**
- Create: `rezekify/db/migrations/versions/005_multi_provider_byok.py`
- Test: `tests/test_migrations.py` (append one test)

**Interfaces:**
- Consumes: `UserSettings` columns from Task 1.
- Produces: revision `005_multi_provider_byok`, down_revision `004_add_performance_indexes`.

- [ ] **Step 1: Write the failing migration smoke test**

Append to `tests/test_migrations.py`:

```python
def test_migration_005_maps_gemini_groq_to_custom(tmp_path: Path):
    """005 upgrade adds columns and remaps legacy GEMINI/GROQ rows to CUSTOM/OPENAI."""
    db_path = tmp_path / "test_005.db"
    db_url = f"sqlite:///{db_path.as_posix()}"

    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", db_url)

    # Upgrade only up to 004 so we can seed legacy rows
    command.upgrade(cfg, "004_add_performance_indexes")

    engine = sa.create_engine(db_url)
    with engine.begin() as conn:
        conn.execute(sa.text(
            "INSERT INTO users (id, email, password_hash, full_name, monthly_cycle_day, currency) "
            "VALUES ('u1', 'a@b.co', 'h', 'A', 1, 'IDR'), ('u2', 'c@d.co', 'h', 'C', 1, 'IDR')"
        ))
        conn.execute(sa.text(
            "INSERT INTO user_settings (id, user_id, ai_provider, ai_model, is_custom_ai_enabled) "
            "VALUES ('s1', 'u1', 'GEMINI', 'gemini-2.5-pro', 1), "
            "('s2', 'u2', 'GROQ', 'llama-3.3-70b-versatile', 1)"
        ))

    # Upgrade to head (runs 005)
    command.upgrade(cfg, "head")

    with engine.connect() as conn:
        rows = conn.execute(sa.text(
            "SELECT user_id, ai_provider, ai_protocol, ai_base_url FROM user_settings ORDER BY user_id"
        )).fetchall()
    engine.dispose()

    by_user = {r[0]: r for r in rows}
    assert by_user["u1"][1] == "CUSTOM"
    assert by_user["u1"][2] == "OPENAI"
    assert by_user["u1"][3] == "https://generativelanguage.googleapis.com/v1beta/openai"
    assert by_user["u2"][1] == "CUSTOM"
    assert by_user["u2"][2] == "OPENAI"
    assert by_user["u2"][3] == "https://api.groq.com/openai/v1"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_migrations.py::test_migration_005_maps_gemini_groq_to_custom -v`
Expected: FAIL (revision 005 does not exist / columns missing).

- [ ] **Step 3: Write the migration**

Create `rezekify/db/migrations/versions/005_multi_provider_byok.py`:

```python
"""Multi-provider BYOK: add ai_protocol/ai_base_url and remap legacy providers to CUSTOM.

Revision ID: 005_multi_provider_byok
Revises: 004_add_performance_indexes
Create Date: 2026-09-28 00:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "005_multi_provider_byok"
down_revision: str | None = "004_add_performance_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("user_settings", sa.Column("ai_protocol", sa.String(length=20), nullable=True))
    op.add_column("user_settings", sa.Column("ai_base_url", sa.String(length=512), nullable=True))

    op.execute(
        "UPDATE user_settings SET ai_provider='CUSTOM', ai_protocol='OPENAI', "
        "ai_base_url='https://generativelanguage.googleapis.com/v1beta/openai' "
        "WHERE ai_provider='GEMINI'"
    )
    op.execute(
        "UPDATE user_settings SET ai_provider='CUSTOM', ai_protocol='OPENAI', "
        "ai_base_url='https://api.groq.com/openai/v1' "
        "WHERE ai_provider='GROQ'"
    )


def downgrade() -> None:
    # Best-effort, lossy reversal: map CUSTOM rows back to GEMINI (protocol/base_url discarded).
    op.execute("UPDATE user_settings SET ai_provider='GEMINI' WHERE ai_provider='CUSTOM'")
    op.drop_column("user_settings", "ai_base_url")
    op.drop_column("user_settings", "ai_protocol")
```

- [ ] **Step 4: Run test to verify it passes (and full migration suite still green)**

Run: `pytest tests/test_migrations.py -v`
Expected: PASS (including the existing upgrade/downgrade lifecycle tests).

- [ ] **Step 5: Commit**

```bash
git add rezekify/db/migrations/versions/005_multi_provider_byok.py tests/test_migrations.py
git commit -m "feat(db): add alembic 005 remapping legacy BYOK providers to CUSTOM/OPENAI"
```

---

### Task 3: Provider package base — errors, config, shared helpers, SSRF validator

**Files:**
- Create: `rezekify/agent/providers/__init__.py`
- Create: `rezekify/agent/providers/base.py`
- Test: `tests/test_provider_base.py`

**Interfaces:**
- Produces:
  - `class CapabilityUnsupported(Exception)`, `class AuthError(Exception)`, `class RateLimitError(Exception)`
  - `@dataclass class BYOKConfig: protocol: str; base_url: str; model: str; api_key: str`
  - `extract_json(text: str) -> dict` (same shape as `ReActAgent._clean_json_response`)
  - `validate_base_url(base_url: str, *, resolve: bool = False) -> str` (returns normalized url, `rstrip('/')`; raises `ValueError`)
  - `get_adapter(config: BYOKConfig)` -> adapter instance (defined fully in Task 4/5; base module raises for unknown protocol)

- [ ] **Step 1: Write the failing tests**

Create `tests/test_provider_base.py`:

```python
import pytest

from rezekify.agent.providers.base import (
    AuthError,
    BYOKConfig,
    CapabilityUnsupported,
    RateLimitError,
    extract_json,
    validate_base_url,
)


def test_extract_json_parses_embedded_object():
    assert extract_json('prefix {"action": "expense", "amount": 5000} suffix') == {
        "action": "expense",
        "amount": 5000,
    }


def test_extract_json_malformed_returns_unknown():
    out = extract_json("not json at all")
    assert out["action"] == "unknown"
    assert out["raw"] == "not json at all"


def test_validate_base_url_requires_https():
    with pytest.raises(ValueError):
        validate_base_url("http://api.openai.com/v1")


def test_validate_base_url_blocks_private_ip_literal():
    with pytest.raises(ValueError):
        validate_base_url("https://10.0.0.1/v1")
    with pytest.raises(ValueError):
        validate_base_url("https://127.0.0.1/v1")


def test_validate_base_url_normalizes_trailing_slash():
    assert validate_base_url("https://api.openai.com/v1/") == "https://api.openai.com/v1"


def test_byok_config_and_errors_exist():
    cfg = BYOKConfig(protocol="OPENAI", base_url="https://x/v1", model="m", api_key="k")
    assert cfg.protocol == "OPENAI"
    assert issubclass(AuthError, Exception)
    assert issubclass(RateLimitError, Exception)
    assert issubclass(CapabilityUnsupported, Exception)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_provider_base.py -v`
Expected: FAIL (module `rezekify.agent.providers.base` does not exist).

- [ ] **Step 3: Write the base module**

Create `rezekify/agent/providers/base.py`:

```python
"""Typed errors, config, and shared helpers for BYOK protocol adapters."""

import ipaddress
import json
import re
import socket
from dataclasses import dataclass
from typing import Any, Dict
from urllib.parse import urlparse


class CapabilityUnsupported(Exception):
    """Raised when a protocol/endpoint does not support a requested modality."""


class AuthError(Exception):
    """Raised on HTTP 401 from a BYOK endpoint."""


class RateLimitError(Exception):
    """Raised on HTTP 429 from a BYOK endpoint."""


@dataclass
class BYOKConfig:
    protocol: str  # "OPENAI" | "ANTHROPIC"
    base_url: str
    model: str
    api_key: str


def extract_json(text: str) -> Dict[str, Any]:
    """Extracts the first JSON object from an LLM response.

    Mirrors ReActAgent._clean_json_response so BYOK adapters return the same shape.
    """
    text = (text or "").strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        text = match.group(0)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"action": "unknown", "raw": text}


def validate_base_url(base_url: str, *, resolve: bool = False) -> str:
    """Validates an https base_url and blocks SSRF-prone hosts.

    Always: require https scheme and a host; block private/loopback/link-local/
    reserved/multicast IP literals. When resolve=True (request time only, never
    inside Pydantic validation), also DNS-resolve hostnames and apply the same block.
    Returns the trimmed url with any trailing slash removed. Raises ValueError.
    """
    raw = (base_url or "").strip()
    parsed = urlparse(raw)
    if parsed.scheme != "https":
        raise ValueError("base_url harus menggunakan skema https://")
    host = parsed.hostname
    if not host:
        raise ValueError("base_url tidak memiliki host yang valid.")

    candidates = []
    try:
        candidates = [ipaddress.ip_address(host)]
    except ValueError:
        if resolve:
            try:
                infos = socket.getaddrinfo(host, None)
            except socket.gaierror as e:
                raise ValueError(f"Host base_url tidak dapat diresolusi: {host}") from e
            candidates = [ipaddress.ip_address(info[4][0]) for info in infos]

    for ip in candidates:
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
        ):
            raise ValueError("base_url menunjuk ke alamat privat/loopback yang tidak diizinkan.")

    return raw.rstrip("/")


def get_adapter(config: BYOKConfig):
    """Returns the protocol adapter instance for the given config."""
    if config.protocol == "OPENAI":
        from rezekify.agent.providers.openai_compatible import OpenAICompatibleAdapter

        return OpenAICompatibleAdapter(config)
    if config.protocol == "ANTHROPIC":
        from rezekify.agent.providers.anthropic_compatible import AnthropicCompatibleAdapter

        return AnthropicCompatibleAdapter(config)
    raise ValueError(f"Protokol AI tidak dikenal: {config.protocol}")
```

- [ ] **Step 4: Write the package __init__ re-exports**

Create `rezekify/agent/providers/__init__.py`:

```python
"""BYOK protocol adapters (OpenAI-/Anthropic-compatible)."""

from rezekify.agent.providers.base import (
    AuthError,
    BYOKConfig,
    CapabilityUnsupported,
    RateLimitError,
    extract_json,
    get_adapter,
    validate_base_url,
)

__all__ = [
    "AuthError",
    "BYOKConfig",
    "CapabilityUnsupported",
    "RateLimitError",
    "extract_json",
    "get_adapter",
    "validate_base_url",
]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/test_provider_base.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add rezekify/agent/providers/__init__.py rezekify/agent/providers/base.py tests/test_provider_base.py
git commit -m "feat(providers): add BYOK adapter base (errors, config, json + SSRF helpers)"
```

---

### Task 4: OpenAI-compatible adapter

**Files:**
- Create: `rezekify/agent/providers/openai_compatible.py`
- Test: `tests/test_openai_adapter.py`

**Interfaces:**
- Consumes: `BYOKConfig`, `AuthError`, `RateLimitError`, `extract_json` (Task 3); `SYSTEM_PROMPT` (imported lazily from `rezekify.agent.runtime`).
- Produces: `class OpenAICompatibleAdapter` with:
  - `__init__(self, config: BYOKConfig, timeout: float = 20.0)`
  - `process_input(self, text: str, image_bytes: Optional[bytes] = None, mime_type: str = "image/jpeg") -> dict`
  - `process_audio(self, audio_bytes: bytes, mime_type: str = "audio/webm", text_context: Optional[str] = None) -> dict`
  - `ping(self) -> None` (raises AuthError/RateLimitError/httpx error; returns None on success)

- [ ] **Step 1: Write the failing tests**

Create `tests/test_openai_adapter.py`:

```python
from unittest.mock import patch

import httpx
import pytest

from rezekify.agent.providers.base import AuthError, BYOKConfig, RateLimitError
from rezekify.agent.providers.openai_compatible import OpenAICompatibleAdapter


def _cfg(model="gpt-4o-mini"):
    return BYOKConfig(protocol="OPENAI", base_url="https://api.openai.com/v1", model=model, api_key="sk-test")


def _chat_response(payload_text: str, status_code: int = 200):
    body = {"choices": [{"message": {"content": payload_text}}]}
    return httpx.Response(
        status_code=status_code,
        json=body,
        request=httpx.Request("POST", "https://api.openai.com/v1/chat/completions"),
    )


def test_process_input_text_returns_parsed_json():
    adapter = OpenAICompatibleAdapter(_cfg())
    with patch("httpx.Client.post", return_value=_chat_response('{"action":"expense","amount":15000}')):
        out = adapter.process_input("kopi 15rb")
    assert out == {"action": "expense", "amount": 15000}


def test_process_input_vision_sends_image_url_block():
    adapter = OpenAICompatibleAdapter(_cfg())
    captured = {}

    def _fake_post(self, url, **kwargs):
        captured["url"] = url
        captured["json"] = kwargs.get("json")
        return _chat_response('{"action":"expense","amount":42000}')

    with patch("httpx.Client.post", new=_fake_post):
        out = adapter.process_input("struk", image_bytes=b"img", mime_type="image/png")
    assert out["amount"] == 42000
    assert captured["url"].endswith("/chat/completions")
    user_msg = captured["json"]["messages"][-1]["content"]
    assert any(part.get("type") == "image_url" for part in user_msg)
    assert user_msg[-1]["image_url"]["url"].startswith("data:image/png;base64,")


def test_process_input_maps_401_to_autherror():
    adapter = OpenAICompatibleAdapter(_cfg())
    with patch("httpx.Client.post", return_value=_chat_response("nope", status_code=401)):
        with pytest.raises(AuthError):
            adapter.process_input("halo")


def test_process_input_maps_429_to_ratelimiterror():
    adapter = OpenAICompatibleAdapter(_cfg())
    with patch("httpx.Client.post", return_value=_chat_response("slow down", status_code=429)):
        with pytest.raises(RateLimitError):
            adapter.process_input("halo")


def test_process_audio_transcribes_then_extracts():
    adapter = OpenAICompatibleAdapter(_cfg())
    transcript = httpx.Response(
        status_code=200,
        json={"text": "makan siang 30000 cash"},
        request=httpx.Request("POST", "https://api.openai.com/v1/audio/transcriptions"),
    )
    chat = _chat_response('{"action":"expense","amount":30000}')

    responses = iter([transcript, chat])

    def _fake_post(self, url, **kwargs):
        return next(responses)

    with patch("httpx.Client.post", new=_fake_post):
        out = adapter.process_audio(b"audio", mime_type="audio/webm")
    assert out["action"] == "expense"
    assert out["transcription"] == "makan siang 30000 cash"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_openai_adapter.py -v`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Write the adapter**

Create `rezekify/agent/providers/openai_compatible.py`:

```python
"""OpenAI-compatible chat/completions + audio/transcriptions BYOK adapter."""

import base64
from typing import Any, Dict, Optional

import httpx

from rezekify.agent.providers.base import (
    AuthError,
    BYOKConfig,
    RateLimitError,
    extract_json,
)

# ponytail: transcription model pinned to whisper-1. Upgrade to a configurable STT
# model field only if users need a non-default transcription model.
_TRANSCRIBE_MODEL = "whisper-1"


class OpenAICompatibleAdapter:
    """Talks to any OpenAI-compatible endpoint (OpenAI, OpenRouter, Groq, Gemini-compat, ...)."""

    def __init__(self, config: BYOKConfig, timeout: float = 20.0):
        self.config = config
        self.timeout = timeout

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }

    @staticmethod
    def _raise_for_auth_rate(resp: httpx.Response) -> None:
        if resp.status_code == 401:
            raise AuthError("401 Unauthorized")
        if resp.status_code == 429:
            raise RateLimitError("429 Too Many Requests")

    def process_input(
        self,
        text: str,
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg",
    ) -> Dict[str, Any]:
        from rezekify.agent.runtime import SYSTEM_PROMPT

        if image_bytes:
            b64 = base64.b64encode(image_bytes).decode("utf-8")
            user_content: Any = [
                {"type": "text", "text": text or "Ekstrak informasi transaksi dari struk belanja ini."},
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64}"}},
            ]
        else:
            user_content = text

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(
                f"{self.config.base_url}/chat/completions",
                json={"model": self.config.model, "messages": messages, "temperature": 0.1},
                headers=self._headers(),
            )
            self._raise_for_auth_rate(resp)
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"] or ""
            return extract_json(content)

    def process_audio(
        self,
        audio_bytes: bytes,
        mime_type: str = "audio/webm",
        text_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        ext_map = {
            "audio/webm": ".webm",
            "audio/wav": ".wav",
            "audio/mp3": ".mp3",
            "audio/mpeg": ".mp3",
            "audio/ogg": ".ogg",
        }
        filename = f"voice{ext_map.get(mime_type, '.ogg')}"
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(
                f"{self.config.base_url}/audio/transcriptions",
                files={"file": (filename, audio_bytes, mime_type)},
                data={"model": _TRANSCRIBE_MODEL},
                headers={"Authorization": f"Bearer {self.config.api_key}"},
            )
            self._raise_for_auth_rate(resp)
            resp.raise_for_status()
            transcription = (resp.json().get("text") or "").strip()

        combined = transcription
        if text_context:
            combined = f"{transcription} ({text_context})"
        result = self.process_input(combined)
        result["transcription"] = transcription
        return result

    def ping(self) -> None:
        self.process_input("ping")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_openai_adapter.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/agent/providers/openai_compatible.py tests/test_openai_adapter.py
git commit -m "feat(providers): add OpenAI-compatible BYOK adapter (text/vision/audio)"
```

---

### Task 5: Anthropic-compatible adapter

**Files:**
- Create: `rezekify/agent/providers/anthropic_compatible.py`
- Test: `tests/test_anthropic_adapter.py`

**Interfaces:**
- Consumes: `BYOKConfig`, `AuthError`, `RateLimitError`, `CapabilityUnsupported`, `extract_json` (Task 3); `SYSTEM_PROMPT` (lazy import).
- Produces: `class AnthropicCompatibleAdapter` with `__init__(config, timeout=20.0)`, `process_input(text, image_bytes=None, mime_type="image/jpeg")`, `process_audio(...)` (raises `CapabilityUnsupported`), `ping()`.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_anthropic_adapter.py`:

```python
from unittest.mock import patch

import httpx
import pytest

from rezekify.agent.providers.anthropic_compatible import AnthropicCompatibleAdapter
from rezekify.agent.providers.base import AuthError, BYOKConfig, CapabilityUnsupported, RateLimitError


def _cfg(model="claude-3-5-sonnet-latest"):
    return BYOKConfig(protocol="ANTHROPIC", base_url="https://api.anthropic.com", model=model, api_key="sk-ant")


def _msg_response(payload_text: str, status_code: int = 200):
    body = {"content": [{"type": "text", "text": payload_text}]}
    return httpx.Response(
        status_code=status_code,
        json=body,
        request=httpx.Request("POST", "https://api.anthropic.com/v1/messages"),
    )


def test_process_input_text_returns_parsed_json():
    adapter = AnthropicCompatibleAdapter(_cfg())
    captured = {}

    def _fake_post(self, url, **kwargs):
        captured["url"] = url
        captured["json"] = kwargs.get("json")
        captured["headers"] = kwargs.get("headers")
        return _msg_response('{"action":"income","amount":500000}')

    with patch("httpx.Client.post", new=_fake_post):
        out = adapter.process_input("gaji masuk 500rb")
    assert out == {"action": "income", "amount": 500000}
    assert captured["url"].endswith("/v1/messages")
    assert captured["headers"]["anthropic-version"]
    assert captured["json"]["system"]


def test_process_input_vision_sends_image_block():
    adapter = AnthropicCompatibleAdapter(_cfg())
    captured = {}

    def _fake_post(self, url, **kwargs):
        captured["json"] = kwargs.get("json")
        return _msg_response('{"action":"expense","amount":9000}')

    with patch("httpx.Client.post", new=_fake_post):
        adapter.process_input("struk", image_bytes=b"img", mime_type="image/png")
    blocks = captured["json"]["messages"][0]["content"]
    assert any(b.get("type") == "image" and b["source"]["media_type"] == "image/png" for b in blocks)


def test_process_input_maps_401_and_429():
    adapter = AnthropicCompatibleAdapter(_cfg())
    with patch("httpx.Client.post", return_value=_msg_response("no", status_code=401)):
        with pytest.raises(AuthError):
            adapter.process_input("halo")
    with patch("httpx.Client.post", return_value=_msg_response("no", status_code=429)):
        with pytest.raises(RateLimitError):
            adapter.process_input("halo")


def test_process_audio_raises_capability_unsupported():
    adapter = AnthropicCompatibleAdapter(_cfg())
    with pytest.raises(CapabilityUnsupported):
        adapter.process_audio(b"audio", mime_type="audio/webm")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_anthropic_adapter.py -v`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Write the adapter**

Create `rezekify/agent/providers/anthropic_compatible.py`:

```python
"""Anthropic-compatible (Messages API) BYOK adapter."""

import base64
from typing import Any, Dict, Optional

import httpx

from rezekify.agent.providers.base import (
    AuthError,
    BYOKConfig,
    CapabilityUnsupported,
    RateLimitError,
    extract_json,
)

_ANTHROPIC_VERSION = "2023-06-01"
_MAX_TOKENS = 1024


class AnthropicCompatibleAdapter:
    """Talks to any Anthropic-compatible /v1/messages endpoint."""

    def __init__(self, config: BYOKConfig, timeout: float = 20.0):
        self.config = config
        self.timeout = timeout

    def _headers(self) -> Dict[str, str]:
        return {
            "x-api-key": self.config.api_key,
            "anthropic-version": _ANTHROPIC_VERSION,
            "content-type": "application/json",
        }

    @staticmethod
    def _raise_for_auth_rate(resp: httpx.Response) -> None:
        if resp.status_code == 401:
            raise AuthError("401 Unauthorized")
        if resp.status_code == 429:
            raise RateLimitError("429 Too Many Requests")

    def process_input(
        self,
        text: str,
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg",
    ) -> Dict[str, Any]:
        from rezekify.agent.runtime import SYSTEM_PROMPT

        content = []
        if image_bytes:
            b64 = base64.b64encode(image_bytes).decode("utf-8")
            content.append(
                {"type": "image", "source": {"type": "base64", "media_type": mime_type, "data": b64}}
            )
        content.append({"type": "text", "text": text or "Ekstrak informasi transaksi dari struk belanja ini."})

        payload = {
            "model": self.config.model,
            "max_tokens": _MAX_TOKENS,
            "system": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": content}],
        }
        with httpx.Client(timeout=self.timeout) as client:
            resp = client.post(
                f"{self.config.base_url}/v1/messages",
                json=payload,
                headers=self._headers(),
            )
            self._raise_for_auth_rate(resp)
            resp.raise_for_status()
            blocks = resp.json().get("content", [])
            text_out = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
            return extract_json(text_out)

    def process_audio(
        self,
        audio_bytes: bytes,
        mime_type: str = "audio/webm",
        text_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        raise CapabilityUnsupported(
            "Protokol Anthropic tidak mendukung transkripsi audio. Gunakan input teks atau gambar."
        )

    def ping(self) -> None:
        self.process_input("ping")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_anthropic_adapter.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/agent/providers/anthropic_compatible.py tests/test_anthropic_adapter.py
git commit -m "feat(providers): add Anthropic-compatible BYOK adapter (text/vision; audio unsupported)"
```

---

### Task 6: Runtime — ReActAgent BYOK delegation

**Files:**
- Modify: `rezekify/agent/runtime.py` (imports; `__init__` ~48-60; `_clean_json_response` ~62-71; `process_input` ~73; `process_audio` ~237; `aprocess_input` ~464; `aprocess_audio` ~517)
- Test: `tests/test_agent_runtime.py` (replace `test_react_agent_byok_guarded_errors` ~330-353 and `test_react_agent_process_audio_byok_401` ~446); `tests/test_async_llm.py` (replace `test_aprocess_input_byok_guarded_errors` ~156)

**Interfaces:**
- Consumes: `BYOKConfig`, `get_adapter`, `AuthError`, `RateLimitError`, `CapabilityUnsupported` (Task 3).
- Produces: `ReActAgent.__init__` gains `byok: Optional[BYOKConfig] = None`; helpers `_byok_process_input(text, image_bytes, mime_type) -> dict` and `_byok_process_audio(audio_bytes, mime_type, text_context) -> dict`; when `self.byok` is set, sync + async entrypoints delegate to these helpers.

- [ ] **Step 1: Rewrite the runtime BYOK tests**

In `tests/test_agent_runtime.py`, replace `test_react_agent_byok_guarded_errors` with:

```python
def test_react_agent_byok_delegates_and_maps_errors():
    from rezekify.agent.providers.base import AuthError, BYOKConfig, RateLimitError
    from rezekify.agent.runtime import ReActAgent

    cfg = BYOKConfig(protocol="OPENAI", base_url="https://api.openai.com/v1", model="m", api_key="k")
    agent = ReActAgent(byok=cfg, is_byok=True)

    with patch(
        "rezekify.agent.providers.openai_compatible.OpenAICompatibleAdapter.process_input",
        return_value={"action": "expense", "amount": 1000},
    ):
        assert agent.process_input(user_id=uuid4(), text="kopi 1rb")["action"] == "expense"

    with patch(
        "rezekify.agent.providers.openai_compatible.OpenAICompatibleAdapter.process_input",
        side_effect=AuthError("401"),
    ):
        res = agent.process_input(user_id=uuid4(), text="halo")
        assert res == {"action": "byok_error", "status_code": 401}

    with patch(
        "rezekify.agent.providers.openai_compatible.OpenAICompatibleAdapter.process_input",
        side_effect=RateLimitError("429"),
    ):
        res = agent.process_input(user_id=uuid4(), text="halo")
        assert res == {"action": "byok_error", "status_code": 429}
```

In `tests/test_agent_runtime.py`, replace `test_react_agent_process_audio_byok_401` with:

```python
def test_react_agent_process_audio_byok_unsupported_capability():
    from rezekify.agent.providers.base import BYOKConfig, CapabilityUnsupported
    from rezekify.agent.runtime import ReActAgent

    cfg = BYOKConfig(protocol="ANTHROPIC", base_url="https://api.anthropic.com", model="m", api_key="k")
    agent = ReActAgent(byok=cfg, is_byok=True)

    with patch(
        "rezekify.agent.providers.anthropic_compatible.AnthropicCompatibleAdapter.process_audio",
        side_effect=CapabilityUnsupported("no audio"),
    ):
        res = agent.process_audio(b"audio", mime_type="audio/webm")
        assert res == {"action": "byok_error", "reason": "unsupported_capability"}
```

In `tests/test_async_llm.py`, replace `test_aprocess_input_byok_guarded_errors` with:

```python
@pytest.mark.asyncio
async def test_aprocess_input_byok_delegates_and_maps_errors():
    from rezekify.agent.providers.base import AuthError, BYOKConfig, RateLimitError
    from rezekify.agent.runtime import ReActAgent

    cfg = BYOKConfig(protocol="OPENAI", base_url="https://api.openai.com/v1", model="m", api_key="k")
    agent = ReActAgent(byok=cfg, is_byok=True)

    with patch(
        "rezekify.agent.providers.openai_compatible.OpenAICompatibleAdapter.process_input",
        side_effect=AuthError("401"),
    ):
        res = await agent.aprocess_input(user_id=uuid4(), text="halo")
        assert res == {"action": "byok_error", "status_code": 401}

    with patch(
        "rezekify.agent.providers.openai_compatible.OpenAICompatibleAdapter.process_input",
        side_effect=RateLimitError("429"),
    ):
        res = await agent.aprocess_input(user_id=uuid4(), text="halo")
        assert res == {"action": "byok_error", "status_code": 429}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_agent_runtime.py::test_react_agent_byok_delegates_and_maps_errors tests/test_agent_runtime.py::test_react_agent_process_audio_byok_unsupported_capability tests/test_async_llm.py::test_aprocess_input_byok_delegates_and_maps_errors -v`
Expected: FAIL (`ReActAgent.__init__` has no `byok` kwarg).

- [ ] **Step 3: Add BYOK delegation to the runtime**

In `rezekify/agent/runtime.py`, add at the top of the file (after `import re`):

```python
import asyncio
```

Add import (after `from rezekify.agent.key_pool import RotaryKeyPool`):

```python
from rezekify.agent.providers import (
    AuthError,
    BYOKConfig,
    CapabilityUnsupported,
    RateLimitError,
    extract_json,
    get_adapter,
)
```

Change `ReActAgent.__init__` signature to add `byok`:

```python
    def __init__(
        self,
        gemini_pool: Optional[RotaryKeyPool] = None,
        groq_pool: Optional[RotaryKeyPool] = None,
        gemini_model: str = "gemini-2.5-flash",
        groq_model: str = "meta-llama/llama-4-scout-17b-16e-instruct",
        is_byok: bool = False,
        byok: Optional[BYOKConfig] = None,
    ):
        self.gemini_pool = gemini_pool
        self.groq_pool = groq_pool
        self.gemini_model = gemini_model
        self.groq_model = groq_model
        self.is_byok = is_byok
        self.byok = byok
```

Replace the body of `_clean_json_response` to delegate to the shared helper:

```python
    def _clean_json_response(self, text: str) -> Dict[str, Any]:
        """Extracts and parses JSON object from LLM response text."""
        return extract_json(text)
```

Add these two helpers to the class (place them just after `_clean_json_response`):

```python
    def _byok_process_input(
        self, text: str, image_bytes: Optional[bytes] = None, mime_type: str = "image/jpeg"
    ) -> Dict[str, Any]:
        """Delegates a text/vision request to the configured BYOK adapter and maps errors."""
        adapter = get_adapter(self.byok)
        try:
            return adapter.process_input(text, image_bytes=image_bytes, mime_type=mime_type)
        except AuthError:
            return {"action": "byok_error", "status_code": 401}
        except RateLimitError:
            return {"action": "byok_error", "status_code": 429}
        except CapabilityUnsupported:
            return {"action": "byok_error", "reason": "unsupported_capability"}
        except Exception:
            return {"action": "byok_error"}

    def _byok_process_audio(
        self, audio_bytes: bytes, mime_type: str = "audio/webm", text_context: Optional[str] = None
    ) -> Dict[str, Any]:
        """Delegates an audio request to the configured BYOK adapter and maps errors."""
        adapter = get_adapter(self.byok)
        try:
            return adapter.process_audio(audio_bytes, mime_type=mime_type, text_context=text_context)
        except AuthError:
            return {"action": "byok_error", "status_code": 401}
        except RateLimitError:
            return {"action": "byok_error", "status_code": 429}
        except CapabilityUnsupported:
            return {"action": "byok_error", "reason": "unsupported_capability"}
        except Exception:
            return {"action": "byok_error"}
```

Add a BYOK short-circuit as the FIRST statement inside each of the four entrypoints:

In `process_input` (right after the docstring, before the `if self.gemini_pool` block):

```python
        if self.byok:
            return self._byok_process_input(text, image_bytes=image_bytes, mime_type=mime_type)
```

In `process_audio` (right after the `if not audio_bytes:` guard returns, before the size check is fine too; place it immediately after the `if not audio_bytes` block):

```python
        if self.byok:
            return self._byok_process_audio(audio_bytes, mime_type=mime_type, text_context=text_context)
```

In `aprocess_input` (first statement after the docstring):

```python
        if self.byok:
            return await asyncio.to_thread(
                self._byok_process_input, text, image_bytes, mime_type
            )
```

In `aprocess_audio` (first statement after the docstring):

```python
        if self.byok:
            return await asyncio.to_thread(
                self._byok_process_audio, audio_bytes, mime_type, text_context
            )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_agent_runtime.py tests/test_async_llm.py -v`
Expected: PASS (new BYOK delegation tests pass; existing SYSTEM rotary/failover tests remain green).

- [ ] **Step 5: Commit**

```bash
git add rezekify/agent/runtime.py tests/test_agent_runtime.py tests/test_async_llm.py
git commit -m "feat(agent): delegate BYOK modalities to protocol adapters in ReActAgent"
```

---

### Task 7: Orchestrator — resolve CUSTOM agent + capability error message

**Files:**
- Modify: `rezekify/agent/orchestrator.py` (imports ~12-18; `_resolve_agent_for_user` ~38-75; `_execute_action` byok_error branch ~151-160)
- Test: `tests/test_agent_orchestrator.py` (replace `test_resolve_agent_instantiates_byok_gemini_agent` ~386 and `..._groq_agent` ~406; update legacy-provider references in `test_handle_message_byok_401_error_feedback`/`..._429...`; add a capability test)

**Interfaces:**
- Consumes: `AIProvider.CUSTOM`, `UserSettings.ai_protocol`/`ai_base_url` (Task 1); `BYOKConfig` (Task 3); `ReActAgent(byok=...)` (Task 6).
- Produces: `_resolve_agent_for_user(user_id) -> tuple[Optional[ReActAgent], bool]` returning a BYOK agent for CUSTOM users; `_execute_action` returns a clear message for `reason == "unsupported_capability"`.

- [ ] **Step 1: Rewrite the resolution + feedback tests**

In `tests/test_agent_orchestrator.py`, replace `test_resolve_agent_instantiates_byok_gemini_agent` and `test_resolve_agent_instantiates_byok_groq_agent` with:

```python
def test_resolve_agent_instantiates_byok_openai_agent(db_session, sample_user):
    from rezekify.db.models import AIProtocol

    settings = UserSettings(
        user_id=sample_user.id,
        ai_provider=AIProvider.CUSTOM,
        ai_protocol=AIProtocol.OPENAI,
        ai_base_url="https://api.openai.com/v1",
        ai_model="gpt-4o-mini",
        encrypted_api_key=encrypt_key("sk-custom-openai"),
        is_custom_ai_enabled=True,
    )
    db_session.add(settings)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    agent, is_custom = orchestrator._resolve_agent_for_user(sample_user.id)
    assert is_custom is True
    assert agent is not None
    assert agent.is_byok is True
    assert agent.byok.protocol == "OPENAI"
    assert agent.byok.base_url == "https://api.openai.com/v1"
    assert agent.byok.model == "gpt-4o-mini"
    assert agent.byok.api_key == "sk-custom-openai"


def test_resolve_agent_instantiates_byok_anthropic_agent(db_session, sample_user):
    from rezekify.db.models import AIProtocol

    settings = UserSettings(
        user_id=sample_user.id,
        ai_provider=AIProvider.CUSTOM,
        ai_protocol=AIProtocol.ANTHROPIC,
        ai_base_url="https://api.anthropic.com",
        ai_model="claude-3-5-sonnet-latest",
        encrypted_api_key=encrypt_key("sk-ant-custom"),
        is_custom_ai_enabled=True,
    )
    db_session.add(settings)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    agent, is_custom = orchestrator._resolve_agent_for_user(sample_user.id)
    assert is_custom is True
    assert agent.byok.protocol == "ANTHROPIC"
    assert agent.byok.api_key == "sk-ant-custom"


def test_execute_action_byok_unsupported_capability_message(db_session, sample_user):
    orchestrator = AgentOrchestrator(db=db_session)
    reply = orchestrator._execute_action(
        sample_user.id, {"action": "byok_error", "reason": "unsupported_capability"}, "voice"
    )
    assert "tidak mendukung" in reply.lower()
```

In the same file, in `test_handle_message_byok_401_error_feedback` and `test_handle_message_byok_429_error_feedback`, change the seeded `UserSettings(...)` to the CUSTOM shape (these tests mock `extract_entities`, so only the row must be valid):

```python
    settings = UserSettings(
        user_id=sample_user.id,
        ai_provider=AIProvider.CUSTOM,
        ai_protocol=AIProtocol.OPENAI,
        ai_base_url="https://api.openai.com/v1",
        ai_model="gpt-4o-mini",
        encrypted_api_key=encrypt_key("revoked-key"),
        is_custom_ai_enabled=True,
    )
```

(Use `"rate-limited-key"` for the 429 test, matching the original.) Add `AIProtocol` to the models import at the top of the file (`from rezekify.db.models import AIProvider, AIProtocol, UserSettings, ...`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_agent_orchestrator.py -k "byok or unsupported_capability" -v`
Expected: FAIL (resolution still branches on GEMINI/GROQ; `agent.byok` unset; capability message missing).

- [ ] **Step 3: Update the orchestrator**

In `rezekify/agent/orchestrator.py`, update the models import to keep `AIProvider` and add the providers import:

```python
from rezekify.agent.providers import BYOKConfig
```

Replace the whole `_resolve_agent_for_user` method body with:

```python
    def _resolve_agent_for_user(self, user_id: UUID) -> tuple[Optional[ReActAgent], bool]:
        """Resolves an ephemeral BYOK ReActAgent for a CUSTOM user or falls back to the system agent."""
        settings_rec = (
            self.db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
        )

        if (
            settings_rec
            and settings_rec.is_custom_ai_enabled
            and settings_rec.encrypted_api_key
            and settings_rec.ai_provider == AIProvider.CUSTOM
            and settings_rec.ai_protocol
            and settings_rec.ai_base_url
        ):
            try:
                raw_key = decrypt_key(settings_rec.encrypted_api_key)
                protocol = getattr(settings_rec.ai_protocol, "value", str(settings_rec.ai_protocol))
                config = BYOKConfig(
                    protocol=protocol,
                    base_url=settings_rec.ai_base_url,
                    model=settings_rec.ai_model,
                    api_key=raw_key,
                )
                agent = ReActAgent(byok=config, is_byok=True)
                return agent, True
            except Exception:
                pass

        return self.agent, False
```

In `_execute_action`, replace the `if action == "byok_error":` block with:

```python
        if action == "byok_error":
            reason = entities.get("reason")
            if reason == "unsupported_capability":
                return (
                    "❌ Endpoint AI kustom Anda tidak mendukung jenis input ini "
                    "(misalnya audio pada protokol Anthropic). Silakan gunakan input teks atau gambar, "
                    "atau ganti protokol/endpoint di menu Pengaturan."
                )
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_agent_orchestrator.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/agent/orchestrator.py tests/test_agent_orchestrator.py
git commit -m "feat(agent): resolve CUSTOM BYOK agent and surface capability errors"
```

---

### Task 8: Schemas + live validation (SSRF-guarded, free-text model)

**Files:**
- Modify: `rezekify/schemas/settings.py` (remove `AVAILABLE_MODELS`; update `AISettingsResponse`, `AIKeyValidateRequest`, `AISettingsUpdateRequest`; rewrite `validate_ai_credentials`)
- Test: `tests/test_settings_api.py` (schema/validation-level tests ~31-135)

**Interfaces:**
- Consumes: `AIProvider`, `AIProtocol` (Task 1); `BYOKConfig`, `get_adapter`, `AuthError`, `RateLimitError`, `CapabilityUnsupported`, `validate_base_url` (Task 3/4/5).
- Produces:
  - `AISettingsResponse(is_custom_ai_enabled, provider, protocol: Optional[AIProtocol], base_url: Optional[str], model, has_api_key, key_hint)` — no `available_models`.
  - `AIKeyValidateRequest(protocol: AIProtocol, base_url: str, api_key: str, model: Optional[str])` with an https/SSRF `base_url` field validator.
  - `AISettingsUpdateRequest(is_custom_ai_enabled, provider, protocol: Optional[AIProtocol], base_url: Optional[str], model, api_key)` with a model validator enforcing protocol+base_url when custom.
  - `validate_ai_credentials(protocol: AIProtocol, base_url: str, api_key: str, model: Optional[str]=None) -> tuple[bool, str]`.

- [ ] **Step 1: Rewrite the schema/validation tests**

In `tests/test_settings_api.py`, update the imports block (top of file) to drop `AVAILABLE_MODELS` and add `AIProtocol`:

```python
from rezekify.db.models import AIProtocol, AIProvider
from rezekify.schemas.settings import (
    AIKeyValidateRequest,
    AISettingsResponse,
    AISettingsUpdateRequest,
    validate_ai_credentials,
)
```

Replace `test_settings_schemas_serialization` with:

```python
def test_settings_schemas_serialization():
    ai_resp = AISettingsResponse(
        is_custom_ai_enabled=True,
        provider=AIProvider.CUSTOM,
        protocol=AIProtocol.OPENAI,
        base_url="https://api.openai.com/v1",
        model="gpt-4o-mini",
        has_api_key=True,
        key_hint="...ab12",
    )
    assert ai_resp.provider == AIProvider.CUSTOM
    assert ai_resp.protocol == AIProtocol.OPENAI
    assert ai_resp.base_url == "https://api.openai.com/v1"
```

Replace the four `test_validate_ai_credentials_*` provider tests and the unsupported-provider test with adapter-mocked versions plus SSRF tests:

```python
def test_validate_ai_credentials_success(monkeypatch):
    from rezekify.schemas import settings as settings_mod

    monkeypatch.setattr(
        "rezekify.agent.providers.openai_compatible.OpenAICompatibleAdapter.ping",
        lambda self: None,
    )
    ok, msg = settings_mod.validate_ai_credentials(
        protocol=AIProtocol.OPENAI,
        base_url="https://api.openai.com/v1",
        api_key="sk-valid-key",
        model="gpt-4o-mini",
    )
    assert ok is True


def test_validate_ai_credentials_auth_failure(monkeypatch):
    from rezekify.agent.providers.base import AuthError
    from rezekify.schemas import settings as settings_mod

    def _raise(self):
        raise AuthError("401")

    monkeypatch.setattr(
        "rezekify.agent.providers.openai_compatible.OpenAICompatibleAdapter.ping", _raise
    )
    ok, msg = settings_mod.validate_ai_credentials(
        protocol=AIProtocol.OPENAI,
        base_url="https://api.openai.com/v1",
        api_key="sk-bad-key",
        model="gpt-4o-mini",
    )
    assert ok is False
    assert "401" in msg


def test_validate_ai_credentials_rejects_http_scheme():
    ok, msg = validate_ai_credentials(
        protocol=AIProtocol.OPENAI,
        base_url="http://api.openai.com/v1",
        api_key="sk-valid-key",
        model="gpt-4o-mini",
    )
    assert ok is False
    assert "https" in msg.lower()


def test_validate_ai_credentials_rejects_private_ip():
    ok, msg = validate_ai_credentials(
        protocol=AIProtocol.OPENAI,
        base_url="https://10.0.0.1/v1",
        api_key="sk-valid-key",
        model="gpt-4o-mini",
    )
    assert ok is False


def test_update_request_requires_protocol_and_base_url_when_custom():
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        AISettingsUpdateRequest(
            is_custom_ai_enabled=True,
            provider=AIProvider.CUSTOM,
            model="gpt-4o-mini",
        )


def test_validate_request_rejects_http_base_url():
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        AIKeyValidateRequest(
            protocol=AIProtocol.OPENAI,
            base_url="http://api.openai.com/v1",
            api_key="sk-valid-key",
            model="gpt-4o-mini",
        )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_settings_api.py -k "validate_ai_credentials or schemas_serialization or update_request or validate_request" -v`
Expected: FAIL (old signatures / `AVAILABLE_MODELS` import).

- [ ] **Step 3: Rewrite `rezekify/schemas/settings.py`**

Replace the file with:

```python
"""Pydantic schemas and live validation logic for user settings and AI BYOK."""

from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from rezekify.agent.providers import (
    AuthError,
    BYOKConfig,
    CapabilityUnsupported,
    RateLimitError,
    get_adapter,
    validate_base_url,
)
from rezekify.db.models import AIProtocol, AIProvider


class TelegramSettingsResponse(BaseModel):
    is_connected: bool
    telegram_chat_id: Optional[int] = None
    bot_username: str


class AISettingsResponse(BaseModel):
    is_custom_ai_enabled: bool
    provider: AIProvider
    protocol: Optional[AIProtocol] = None
    base_url: Optional[str] = None
    model: str
    has_api_key: bool
    key_hint: Optional[str] = None


class UserProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str
    monthly_cycle_day: int
    safe_runway_threshold: Decimal


class UserProfileUpdateRequest(BaseModel):
    monthly_cycle_day: Optional[int] = Field(None, ge=1, le=31)
    safe_runway_threshold: Optional[Decimal] = Field(None, gt=Decimal("0.00"))


class SettingsResponse(BaseModel):
    telegram: TelegramSettingsResponse
    ai: AISettingsResponse
    profile: Optional[UserProfileResponse] = None


class AIKeyValidateRequest(BaseModel):
    protocol: AIProtocol
    base_url: str
    api_key: str = Field(..., min_length=8, description="Raw API key to test")
    model: Optional[str] = None

    @field_validator("base_url")
    @classmethod
    def _validate_base_url(cls, v: str) -> str:
        return validate_base_url(v)


class AIKeyValidateResponse(BaseModel):
    valid: bool
    message: str


class AISettingsUpdateRequest(BaseModel):
    is_custom_ai_enabled: bool
    provider: AIProvider
    protocol: Optional[AIProtocol] = None
    base_url: Optional[str] = None
    model: str
    api_key: Optional[str] = Field(
        None,
        description="New raw API key to store. If omitted or empty, preserves existing stored key.",
    )

    @model_validator(mode="after")
    def _require_custom_fields(self) -> "AISettingsUpdateRequest":
        if self.is_custom_ai_enabled and self.provider == AIProvider.CUSTOM:
            if self.protocol is None:
                raise ValueError("protocol wajib diisi untuk AI kustom (BYOK).")
            if not self.base_url:
                raise ValueError("base_url wajib diisi untuk AI kustom (BYOK).")
            # https + SSRF check (hermetic: IP-literal only, no DNS in schema).
            validate_base_url(self.base_url)
        return self


class TelegramUnlinkResponse(BaseModel):
    success: bool
    message: str


def validate_ai_credentials(
    protocol: AIProtocol,
    base_url: str,
    api_key: str,
    model: Optional[str] = None,
) -> tuple[bool, str]:
    """Tests BYOK credentials by pinging the configured protocol adapter.

    Enforces the https + SSRF policy (with DNS resolution) before any request.
    """
    clean_key = (api_key or "").strip()
    if not clean_key:
        return False, "Kunci API tidak boleh kosong."

    try:
        safe_url = validate_base_url(base_url, resolve=True)
    except ValueError as e:
        return False, str(e)

    protocol_value = getattr(protocol, "value", str(protocol))
    config = BYOKConfig(
        protocol=protocol_value,
        base_url=safe_url,
        model=(model or "").strip(),
        api_key=clean_key,
    )
    try:
        adapter = get_adapter(config)
        adapter.ping()
        return True, f"Koneksi ke endpoint {protocol_value} berhasil diverifikasi."
    except AuthError:
        return False, "Kunci API ditolak (401 Unauthorized). Periksa kembali API key Anda."
    except RateLimitError:
        return False, "Endpoint membatasi permintaan (429 Rate Limit). Coba lagi nanti."
    except CapabilityUnsupported as e:
        return False, str(e)
    except Exception as e:
        return False, f"Gagal terhubung ke endpoint: {str(e)}"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_settings_api.py -k "validate_ai_credentials or schemas_serialization or update_request or validate_request" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/schemas/settings.py tests/test_settings_api.py
git commit -m "feat(schemas): free-text model, protocol+base_url fields, SSRF-guarded BYOK validation"
```

---

### Task 9: Settings router — validate + update endpoints

**Files:**
- Modify: `rezekify/api/v1/settings_router.py` (imports ~12-25; `get_settings` ai_resp ~62-68; `validate_ai_key` ~128-144; `update_ai_settings` ~147-204)
- Test: `tests/test_settings_api.py` (endpoint tests ~185-346)

**Interfaces:**
- Consumes: updated schemas + `validate_ai_credentials` (Task 8); `AIProvider.CUSTOM`, `AIProtocol` (Task 1).
- Produces: `PUT /settings/ai` stores `ai_protocol`/`ai_base_url` for CUSTOM and returns them; `POST /settings/ai/validate` accepts protocol+base_url+model+key.

- [ ] **Step 1: Rewrite the endpoint tests**

In `tests/test_settings_api.py`, update the endpoint tests:

```python
def test_post_validate_ai_key_endpoint(api_test_client):
    from unittest.mock import patch

    with patch("rezekify.api.v1.settings_router.validate_ai_credentials") as mock_val:
        mock_val.return_value = (True, "OK")
        res = api_test_client.post(
            "/api/v1/settings/ai/validate",
            json={
                "protocol": "OPENAI",
                "base_url": "https://api.openai.com/v1",
                "api_key": "sk-Test12345678",
                "model": "gpt-4o-mini",
            },
        )
        assert res.status_code == 200
        assert res.json()["valid"] is True

        mock_val.return_value = (False, "bad key")
        res = api_test_client.post(
            "/api/v1/settings/ai/validate",
            json={
                "protocol": "OPENAI",
                "base_url": "https://api.openai.com/v1",
                "api_key": "bad-key-12345678",
            },
        )
        assert res.status_code == 400


def test_post_validate_ai_key_rejects_http(api_test_client):
    res = api_test_client.post(
        "/api/v1/settings/ai/validate",
        json={
            "protocol": "OPENAI",
            "base_url": "http://api.openai.com/v1",
            "api_key": "sk-Test12345678",
            "model": "gpt-4o-mini",
        },
    )
    assert res.status_code == 422  # Pydantic field validation rejects http scheme


def test_put_ai_settings_requires_key_when_enabling_byok(api_test_client):
    res = api_test_client.put(
        "/api/v1/settings/ai",
        json={
            "is_custom_ai_enabled": True,
            "provider": "CUSTOM",
            "protocol": "OPENAI",
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-4o-mini",
        },
    )
    assert res.status_code == 400
    assert "Kunci API wajib diisi" in res.json()["detail"]


def test_put_ai_settings_updates_key_and_stores_endpoint(api_test_client):
    res = api_test_client.put(
        "/api/v1/settings/ai",
        json={
            "is_custom_ai_enabled": True,
            "provider": "CUSTOM",
            "protocol": "OPENAI",
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-4o-mini",
            "api_key": "sk-brandNewKey123",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["provider"] == "CUSTOM"
    assert data["protocol"] == "OPENAI"
    assert data["base_url"] == "https://api.openai.com/v1"
    assert data["has_api_key"] is True
    assert data["key_hint"] == "...y123"


def test_put_ai_settings_missing_protocol_returns_422(api_test_client):
    res = api_test_client.put(
        "/api/v1/settings/ai",
        json={
            "is_custom_ai_enabled": True,
            "provider": "CUSTOM",
            "base_url": "https://api.openai.com/v1",
            "model": "gpt-4o-mini",
            "api_key": "sk-brandNewKey123",
        },
    )
    assert res.status_code == 422  # model validator: protocol required
```

Delete `test_put_ai_settings_preserves_existing_key_when_omitted` and `test_put_ai_settings_requires_new_key_when_switching_provider` if present (they assert GEMINI/GROQ curated behaviour). Replace the preserve-key test with a CUSTOM variant:

```python
def test_put_ai_settings_preserves_existing_key_when_omitted(api_test_client):
    from rezekify.db.models import AIProtocol, AIProvider, UserSettings
    from rezekify.core.crypto import encrypt_key
    from tests.test_settings_api import _seed_user_and_settings  # if such a helper exists; otherwise seed inline

    # Seed a CUSTOM settings row with an existing key via the app's db session fixture.
    # (Follow the existing seeding pattern already used in this file for the authenticated user.)
```

NOTE FOR IMPLEMENTER: If `test_put_ai_settings_preserves_existing_key_when_omitted` in the current file seeds `UserSettings` inline against a session fixture, keep that exact seeding pattern but set `ai_provider=AIProvider.CUSTOM, ai_protocol=AIProtocol.OPENAI, ai_base_url="https://api.openai.com/v1"`, then PUT with `provider=CUSTOM, protocol=OPENAI, base_url=..., model=..., api_key` omitted, and assert the response `has_api_key is True` and `key_hint` unchanged. Do not invent a new fixture.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_settings_api.py -v`
Expected: FAIL (router still imports `AVAILABLE_MODELS`, validates against curated models, doesn't store protocol/base_url).

- [ ] **Step 3: Update the router**

In `rezekify/api/v1/settings_router.py`:

Update imports — drop `AVAILABLE_MODELS`, add `AIProtocol`:

```python
from rezekify.db.models import AIProvider, AIProtocol, User, UserSettings
from rezekify.schemas.settings import (
    AIKeyValidateRequest,
    AIKeyValidateResponse,
    AISettingsResponse,
    AISettingsUpdateRequest,
    SettingsResponse,
    TelegramSettingsResponse,
    TelegramUnlinkResponse,
    UserProfileResponse,
    UserProfileUpdateRequest,
    validate_ai_credentials,
)
```

In `get_settings`, build `ai_resp` with the new fields:

```python
    ai_resp = AISettingsResponse(
        is_custom_ai_enabled=settings_rec.is_custom_ai_enabled,
        provider=settings_rec.ai_provider,
        protocol=settings_rec.ai_protocol,
        base_url=settings_rec.ai_base_url,
        model=settings_rec.ai_model,
        has_api_key=bool(settings_rec.encrypted_api_key),
        key_hint=settings_rec.key_hint,
    )
```

Replace `validate_ai_key` with:

```python
@settings_router.post("/ai/validate", response_model=AIKeyValidateResponse, dependencies=[Depends(ai_validate_limiter)])
def validate_ai_key(
    payload: AIKeyValidateRequest,
    current_user: User = Depends(get_current_user),
) -> AIKeyValidateResponse:
    """Performs live connectivity verification against the user's custom AI endpoint."""
    valid, message = validate_ai_credentials(
        protocol=payload.protocol,
        base_url=payload.base_url,
        api_key=payload.api_key,
        model=payload.model,
    )
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
    return AIKeyValidateResponse(valid=True, message=message)
```

Replace `update_ai_settings` with:

```python
@settings_router.put("/ai", response_model=AISettingsResponse)
def update_ai_settings(
    payload: AISettingsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AISettingsResponse:
    """Updates AI provider (SYSTEM/CUSTOM), protocol, endpoint, model, BYOK toggle, and optional key."""
    settings_rec = _get_or_create_settings(db, current_user.id)

    has_existing_key = bool(settings_rec.encrypted_api_key)
    has_new_key = bool(payload.api_key and payload.api_key.strip())

    if payload.is_custom_ai_enabled and not has_existing_key and not has_new_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kunci API wajib diisi untuk mengaktifkan AI kustom (BYOK).",
        )

    if has_new_key:
        raw_key = payload.api_key.strip()
        settings_rec.encrypted_api_key = encrypt_key(raw_key)
        settings_rec.key_hint = mask_key(raw_key)

    settings_rec.is_custom_ai_enabled = payload.is_custom_ai_enabled
    settings_rec.ai_provider = payload.provider
    settings_rec.ai_model = payload.model

    if payload.provider == AIProvider.CUSTOM:
        settings_rec.ai_protocol = payload.protocol
        settings_rec.ai_base_url = payload.base_url
    else:
        settings_rec.ai_protocol = None
        settings_rec.ai_base_url = None

    db.commit()
    db.refresh(settings_rec)

    return AISettingsResponse(
        is_custom_ai_enabled=settings_rec.is_custom_ai_enabled,
        provider=settings_rec.ai_provider,
        protocol=settings_rec.ai_protocol,
        base_url=settings_rec.ai_base_url,
        model=settings_rec.ai_model,
        has_api_key=bool(settings_rec.encrypted_api_key),
        key_hint=settings_rec.key_hint,
    )
```

- [ ] **Step 4: Run the full settings + agent suites**

Run: `pytest tests/test_settings_api.py tests/test_agent_orchestrator.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/api/v1/settings_router.py tests/test_settings_api.py
git commit -m "feat(api): settings endpoints accept protocol/base_url and drop curated model list"
```

---

### Task 10: Frontend — CUSTOM protocol/endpoint form (Impeccable)

**Files:**
- Modify: `frontend/src/types/api.ts` (`AIProviderType` ~197; `AISettingsResponse` ~205-212; `AIKeyValidateRequest` ~233-237; `AISettingsUpdateRequest` ~244-249)
- Modify: `frontend/src/components/SettingsModal.tsx` (AI tab state + form ~60-214, ~390-597)

**Interfaces:**
- Consumes: backend `/settings`, `/settings/ai`, `/settings/ai/validate` contracts from Tasks 8-9.
- Produces: a CUSTOM BYOK form with protocol selector (OpenAI-compatible / Anthropic-compatible), base_url input, free-text model input, and API key input; validate + save send `protocol` + `base_url` + `model` + `api_key`.

> **REQUIRED:** Invoke `impeccable:impeccable` (Skill) before editing frontend code, applying the project's dark-slate palette, ≥38px touch targets, ≤250ms transitions, and WCAG contrast. This task ends only after `impeccable:impeccable-finish-reviewer` returns no material fixes.

- [ ] **Step 1: Invoke the Impeccable skill**

Run the `impeccable:impeccable` Skill and follow its direction for the AI settings tab redesign (protocol/endpoint/model/key form). Keep the existing modal shell, tabs, and telegram/profile tabs unchanged.

- [ ] **Step 2: Update the TypeScript contracts**

In `frontend/src/types/api.ts`:

```typescript
export type AIProviderType = 'SYSTEM' | 'CUSTOM';
export type AIProtocolType = 'OPENAI' | 'ANTHROPIC';
```

```typescript
export interface AISettingsResponse {
  is_custom_ai_enabled: boolean;
  provider: AIProviderType;
  protocol?: AIProtocolType | null;
  base_url?: string | null;
  model: string;
  has_api_key: boolean;
  key_hint?: string | null;
}
```

```typescript
export interface AIKeyValidateRequest {
  protocol: AIProtocolType;
  base_url: string;
  api_key: string;
  model?: string;
}
```

```typescript
export interface AISettingsUpdateRequest {
  is_custom_ai_enabled: boolean;
  provider: AIProviderType;
  protocol?: AIProtocolType | null;
  base_url?: string | null;
  model: string;
  api_key?: string | null;
}
```

- [ ] **Step 3: Rework the AI tab in `SettingsModal.tsx`**

Replace the AI BYOK form state and the "TAB 2: AI BYOK" custom section so that, when `isCustomAi` is true, the form collects:
- **Protocol** (radiogroup): `OPENAI` ("OpenAI-compatible") / `ANTHROPIC` ("Anthropic-compatible"). State `const [protocol, setProtocol] = useState<AIProtocolType>('OPENAI');`
- **Base URL** (`<input type="url">`, placeholder `https://api.openai.com/v1`), state `baseUrl`.
- **Model** (free-text `<input type="text">`, placeholder `gpt-4o-mini`), state `model` (remove the `Select`/`availableModelsList` logic and `AVAILABLE_MODELS` usage).
- **API key** input (keep existing show/hide).

Update `fetchSettings` to hydrate `protocol` from `data.ai.protocol ?? 'OPENAI'`, `baseUrl` from `data.ai.base_url ?? ''`, `model` from `data.ai.model ?? ''`; and set `provider` display to `data.ai.provider` (SYSTEM/CUSTOM).

Update `handleValidateKey` to require `apiKey`, `baseUrl` and call:

```typescript
const res = await validateAIKey({ protocol, base_url: baseUrl.trim(), model: model.trim(), api_key: apiKey.trim() });
```

Update `handleSaveAISettings` to send:

```typescript
await updateAISettings({
  is_custom_ai_enabled: isCustomAi,
  provider: isCustomAi ? 'CUSTOM' : 'SYSTEM',
  protocol: isCustomAi ? protocol : undefined,
  base_url: isCustomAi ? baseUrl.trim() : undefined,
  model: model.trim(),
  api_key: apiKey.trim() || undefined,
});
```

Replace the "Get API Key" helper links with protocol-appropriate copy (OpenAI-compatible: link to the endpoint provider's key page generically; Anthropic-compatible: link to `https://console.anthropic.com/settings/keys`). Update the BYOK description text to reference "custom endpoint (OpenAI/Anthropic-compatible)" rather than "Gemini/Groq".

- [ ] **Step 4: Typecheck / build the frontend**

Run (inside `frontend/`): `npx tsc --noEmit`
Expected: exit code 0, no type errors.

- [ ] **Step 5: Impeccable finish review**

Dispatch `impeccable:impeccable-finish-reviewer` on the AI settings tab. Address every material fix it reports (contrast, touch targets, hierarchy, states) and re-run `npx tsc --noEmit`. The task is complete only when the reviewer returns no material fixes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/components/SettingsModal.tsx
git commit -m "feat(frontend): custom BYOK endpoint form (protocol/base_url/model) replacing curated providers"
```

---

### Task 11: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the whole backend suite**

Run: `pytest`
Expected: all pass, exit code 0. Investigate any remaining reference to `AIProvider.GEMINI`/`AIProvider.GROQ`/`AVAILABLE_MODELS`/`available_models` across `tests/` and `rezekify/` and fix in the owning module (grep: `GEMINI|GROQ|AVAILABLE_MODELS|available_models`).

- [ ] **Step 2: Lint / type-check backend**

Run: `ruff check .` then `mypy rezekify`
Expected: clean (or no new findings vs. baseline).

- [ ] **Step 3: Frontend build**

Run (inside `frontend/`): `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Final commit (only if fixes were needed)**

```bash
git add -A
git commit -m "test: green full suite for multi-provider BYOK custom endpoint"
```
