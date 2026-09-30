# Multi-Provider BYOK — Custom Endpoint (OpenAI-/Anthropic-compatible)

Date: 2026-09-28
Status: Approved (brainstorming) — pending implementation plan
Path type: Architectural

## Intent & Success Criteria

Rezekify BYOK currently only supports two hardcoded providers (Gemini, Groq). The user wants BYOK to be a single **custom** mode where the user configures their own endpoint, key, and model, and selects which API **protocol** the endpoint speaks: OpenAI-compatible or Anthropic-compatible. This automatically covers OpenAI, OpenRouter, Together, DeepSeek, Mistral, Groq, Google (OpenAI-compat), Anthropic, etc. — without a curated per-provider list.

Success:
- A user can enable custom AI by entering: protocol (OpenAI/Anthropic), base_url, model name (free text), and API key.
- Text, image (receipt OCR), and audio (voice) all attempt through the BYOK endpoint; unsupported capabilities return a clear error.
- The built-in `SYSTEM` free-tier rotary pool (Gemini + Groq) is unchanged and remains the default.

## Decisions (locked)

1. **Provider set:** No curated providers. `AIProvider` collapses to `SYSTEM | CUSTOM`. Custom mode carries an `AIProtocol` of `OPENAI` or `ANTHROPIC`.
2. **Multimodal:** BYOK attempts all modalities (text, image, audio). If the protocol/endpoint does not support a modality (e.g. Anthropic audio transcription), return a clear capability error to the user. No silent degradation.
3. **Failure behavior:** BYOK failures (401 / 429 / unsupported capability) hard-fail with a clear error to the user. NO silent fallback to SYSTEM. The user who enables custom AI owns their key.
4. **Migration:** Auto-map existing rows. `GEMINI` -> `CUSTOM` + protocol `OPENAI` + base_url `https://generativelanguage.googleapis.com/v1beta/openai`. `GROQ` -> `CUSTOM` + protocol `OPENAI` + base_url `https://api.groq.com/openai/v1`. Existing encrypted key and model are preserved.
5. **Architecture:** Isolated protocol-adapter module (`rezekify/agent/providers/`). SYSTEM rotary path is untouched.
6. **SSRF mitigation:** `base_url` must be a valid `https://` URL; block private / loopback / link-local IP ranges. (Consequence: local endpoints like Ollama `http://localhost` are not supported — acceptable, focus is cloud OpenAI/Anthropic-compatible.)

## Design

### 1. Data model & migration
- `AIProvider` enum: `SYSTEM`, `CUSTOM` (remove `GEMINI`, `GROQ`).
- New enum `AIProtocol`: `OPENAI`, `ANTHROPIC`.
- `UserSettings` new columns:
  - `ai_protocol` — `SQLEnum(AIProtocol, native_enum=False)`, nullable (set when provider is CUSTOM).
  - `ai_base_url` — `String(512)`, nullable.
  - `ai_model` stays `String(100)`, now free text.
- Because `ai_provider` uses `native_enum=False` (stored as VARCHAR), the enum member change needs no Postgres type ALTER — only data updates.
- Alembic revision `005` (down_revision `004`):
  - `add_column` `ai_protocol`, `ai_base_url`.
  - `UPDATE user_settings SET ai_provider='CUSTOM', ai_protocol='OPENAI', ai_base_url='https://generativelanguage.googleapis.com/v1beta/openai' WHERE ai_provider='GEMINI';`
  - `UPDATE user_settings SET ai_provider='CUSTOM', ai_protocol='OPENAI', ai_base_url='https://api.groq.com/openai/v1' WHERE ai_provider='GROQ';`
  - Downgrade reverses columns; data reversal best-effort (documented as lossy for protocol/base_url).

### 2. Provider adapters — new unit `rezekify/agent/providers/`
- `base.py`:
  - Typed errors: `CapabilityUnsupported`, `AuthError` (maps HTTP 401), `RateLimitError` (maps HTTP 429).
  - A common interface. Return value = the same dict shape produced by `ReActAgent._clean_json_response` today (`{"action": ...}` etc.), so the orchestrator downstream is unchanged.
  - Shared JSON-extraction helper reused from runtime (avoid duplicating `_clean_json_response`).
- `openai_compatible.py`:
  - Text/vision: `POST {base_url}/chat/completions`, system prompt = existing `SYSTEM_PROMPT`. Vision via a `content` array with `{"type":"image_url","image_url":{"url":"data:{mime};base64,..."}}`.
  - Audio: `POST {base_url}/audio/transcriptions` (whisper-style multipart), then feed transcript text back through chat completion.
  - Map 401 -> `AuthError`, 429 -> `RateLimitError`.
- `anthropic_compatible.py`:
  - Text/vision: `POST {base_url}/v1/messages` with `anthropic-version` header; system prompt as top-level `system`. Vision via `{"type":"image","source":{"type":"base64","media_type":mime,"data":...}}` content blocks.
  - Audio: `raise CapabilityUnsupported` (Anthropic has no transcription endpoint).
  - Map 401 -> `AuthError`, 429 -> `RateLimitError`.
- All adapters use `httpx` (already a dependency). No Gemini/Groq SDK usage in the BYOK path.

### 3. Runtime & orchestrator integration
- `AgentOrchestrator._resolve_agent_for_user`: remove the `GEMINI`/`GROQ` branches. When `settings_rec.is_custom_ai_enabled` and `ai_provider == CUSTOM` and an encrypted key exists: decrypt the key and build a BYOK `ReActAgent` carrying a small config object `(protocol, base_url, model, api_key)`.
- `ReActAgent`: add an optional `byok` config field. In `process_input` and the audio path, when `self.byok` is set, delegate to the selected adapter (chosen by `protocol`) instead of the rotary Gemini/Groq logic. When `byok` is not set, existing SYSTEM rotary behavior is unchanged.
- Error handling: adapter typed errors are caught and converted to the existing BYOK error contract:
  - `AuthError` -> `{"action": "byok_error", "status_code": 401}`
  - `RateLimitError` -> `{"action": "byok_error", "status_code": 429}`
  - `CapabilityUnsupported` -> `{"action": "byok_error", "reason": "unsupported_capability"}`
  - No fallback to SYSTEM.

### 4. Validation & API schemas
- `validate_ai_credentials(protocol, base_url, api_key, model)`: perform a lightweight text ping via the same adapter; return `(ok, message)` with a clear per-protocol message. Enforce SSRF rules here too (https + block private ranges) before making the request.
- Remove the curated `AVAILABLE_MODELS` dict; model becomes free text.
- Schemas (`rezekify/schemas/settings.py`):
  - `AISettingsResponse`: expose `provider` (SYSTEM/CUSTOM), `protocol`, `base_url`, `model`, `has_api_key`, `key_hint`. Drop `available_models`.
  - `AISettingsUpdateRequest`: add `protocol` and `base_url`. Validate at trust boundary: when `is_custom_ai_enabled` and provider CUSTOM, `protocol` and `base_url` are required and `base_url` must pass the SSRF/https validator.
  - `AIKeyValidateRequest`: add `protocol` and `base_url`.
- A shared `base_url` validator (https scheme + reject private/loopback/link-local hosts via `ipaddress`) lives in one place and is reused by schema validation and the adapter/validation call.

### 5. Frontend (`frontend/src/components/SettingsModal.tsx`, `frontend/src/types/api.ts`)
- `AIProviderType` -> `'SYSTEM' | 'CUSTOM'`.
- Custom form fields: protocol selector (OpenAI-compatible / Anthropic-compatible), base_url input, free-text model input, API key input.
- "Validate" button posts protocol + base_url + model + key to `/ai/validate`.
- Follow the project Impeccable frontend protocol; dispatch `impeccable:impeccable-finish-reviewer` before UI is considered complete.

### 6. Testing (TDD, sequential via worker subagents)
- Adapter unit tests (mock `httpx`): text, vision, audio for OpenAI-compatible; text + vision for Anthropic; Anthropic audio -> `CapabilityUnsupported`; 401 -> `AuthError`; 429 -> `RateLimitError`.
- Replace `test_resolve_agent_instantiates_byok_gemini_agent` / `..._groq_agent` with CUSTOM + OpenAI / CUSTOM + Anthropic resolution tests.
- Update `tests/test_async_llm.py` / `tests/test_agent_runtime.py` BYOK-error expectations to the new adapter delegation; SYSTEM rotary failover tests remain valid.
- Settings API tests: validate + update with protocol/base_url, and SSRF rejection (http, private IP).
- Migration smoke test: GEMINI/GROQ rows map to CUSTOM/OPENAI + correct base_url.

## Out of scope (YAGNI)
- Curated provider dropdown / per-provider model catalogs.
- Multi-key rotation for BYOK custom (single user key; SYSTEM keeps its rotary pool).
- Local/self-hosted `http://` endpoints (blocked by SSRF policy).
- Silent SYSTEM fallback on BYOK failure.

## Blast radius (verify on edit)
- `rezekify/db/models.py` (AIProvider, UserSettings), new Alembic `005`.
- `rezekify/agent/key_pool.py` (Gemini/Groq client helpers may lose BYOK callers but stay for SYSTEM), `rezekify/agent/runtime.py` (ReActAgent), `rezekify/agent/orchestrator.py` (_resolve_agent_for_user).
- `rezekify/schemas/settings.py`, `rezekify/api/v1/settings_router.py`, `rezekify/api/deps.py`.
- `frontend/src/types/api.ts`, `frontend/src/components/SettingsModal.tsx`.
- Tests: `tests/test_agent_orchestrator.py`, `tests/test_async_llm.py`, `tests/test_agent_runtime.py`, `tests/test_settings_api.py`, `tests/test_key_pool.py`, `tests/test_db_models.py`.
