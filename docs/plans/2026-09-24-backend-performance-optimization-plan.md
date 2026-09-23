# Rezekify Backend Performance & Reliability Optimization Plan

**Goal**: Maximize throughput, eliminate thread-blocking bottlenecks, prevent duplicate transaction mutations from webhook retries, and ensure deterministic sub-10ms query execution across growing ledger records without adding external infrastructure (Zero-New-Dependencies / YAGNI discipline).

---

## 1. Identified Bottlenecks & Architectural Solutions

| Area | Current Behavior | Bottleneck / Risk | Optimization Strategy (The Ladder) |
|---|---|---|---|
| **Database Queries** | Sequential scans on `transactions` and `ledger_entries` filtering by `user_id` and sorting by `date` | High query latency when transactions reach 10,000+ records | **PostgreSQL Composite B-Tree Indexes** via Alembic migration (`004_add_performance_indexes.py`) |
| **Telegram Webhook** | Synchronously waits for Gemini/Groq LLM response (1.5 - 4s) inside the webhook HTTP handler | Telegram times out after 5s and retries the webhook, causing duplicate transaction recordings | **Fast-Ack BackgroundTasks**: Immediately respond `200 OK` to Telegram within 20ms; execute LLM and ledger mutations via FastAPI `BackgroundTasks` |
| **Password Hashing** | Bcrypt CPU-bound hashing runs directly in async event loop thread | Event loop starvation (100-200ms freeze per auth request) | **Starlette / AnyIO Threadpool Offloading**: Run `verify_password` and `hash_password` via worker threads (`run_in_threadpool`) |
| **HTTP Client Keep-Alive** | Ephemeral HTTP connection setup per LLM invocation | 100-200ms TLS/TCP handshake overhead on each AI call | **Shared HTTP Connection Pool** with TCP keep-alive |

---

## 2. Proposed Changes & Implementation Spec

### Phase 1: Database Composite B-Tree Indexes (Alembic Migration 004)
- **Target File**: `rezekify/db/migrations/versions/004_add_performance_indexes.py`
- **Revises**: `003_add_safe_runway_threshold`
- **Indexes to create**:
  1. `idx_transactions_user_date`: `transactions(user_id, transaction_date DESC)` — speeds up ledger history & runway period queries.
  2. `idx_ledger_account_type`: `ledger_entries(account_id, entry_type)` — speeds up balance calculations & account activity queries.
  3. `idx_ledger_category_type`: `ledger_entries(category_id, entry_type)` — speeds up category breakdown analytics.
  4. `idx_vaults_user_due`: `vaults(user_id, target_date)` — speeds up H-7 upcoming commitments filtering.
- **Models**: Update `rezekify/db/models.py` with `Index(...)` definitions on `Transaction`, `LedgerEntry`, and `Vault`.

### Phase 2: Telegram Webhook Fast-Ack & Concurrency Defense
- **Target File**: `rezekify/api/v1/gateway_router.py` & `rezekify/gateway/telegram_bot.py`
- Add `BackgroundTasks` parameter to `POST /telegram/webhook`.
- Verify webhook secret and payload structure immediately.
- Enqueue `gateway.process_update_async(...)` in background tasks and return `{"status": "ok", "detail": "queued"}` immediately.
- Prevent duplicate processing using an idempotent message update ID cache (`update_id`).

### Phase 3: CPU-Bound Auth Offload & HTTP Keep-Alive
- **Target File**: `rezekify/services/auth.py` and `rezekify/api/v1/auth_router.py`
- Wrap `verify_password` and `hash_password` in `concurrency.run_in_threadpool` or verify async friendliness so auth endpoints never block event loops.
- Ensure `httpx.AsyncClient` or keep-alive connection pool is maintained for rotary key pool and outbound calls.

### Phase 4: Full Regression & Verification Gate
- Run migration upgrade: `alembic upgrade head`.
- Run backend unit and integration test suites: `pytest`.
- Run live Docker blackbox test suite: `pytest tests/test_frontend_blackbox.py`.
- Rebuild backend container to ensure zero drift.

---

## 3. Execution Checklist

- [x] **Phase 1: Database Composite Indexes**
  - [x] 1.1 Create migration `004_add_performance_indexes.py` with indices for `transactions`, `ledger_entries`, `vaults`.
  - [x] 1.2 Update SQLAlchemy model metadata in `rezekify/db/models.py`.
  - [x] 1.3 Apply migration and verify with `pytest tests/test_migrations.py`.

- [x] **Phase 2: Telegram Webhook Fast-Ack**
  - [x] 2.1 Refactor `rezekify/api/v1/gateway_router.py` to use `BackgroundTasks`.
  - [x] 2.2 Add update deduplication guard in `rezekify/gateway/telegram_bot.py`.
  - [x] 2.3 Verify with `pytest tests/test_gateway_webhook.py tests/test_telegram_bot.py`.

- [x] **Phase 3: Auth Threadpool Offload & Connection Pooling**
  - [x] 3.1 Offload password hashing/verification to worker threadpool in `rezekify/services/auth.py`.
  - [x] 3.2 Verify auth endpoints and rate limiting with `pytest tests/test_auth_service.py tests/test_api_endpoints.py`.

- [x] **Phase 4: Full System Verification & Regression Gate**
  - [x] 4.1 Run full backend pytest suite (100% pass rate: 237 passed in 61.96s).
  - [x] 4.2 Rebuild backend container & verify health (`docker compose ps` reports `rezekify_backend` Up and healthy).
  - [x] 4.3 Run live frontend blackbox tests against Docker port 80 (6 passed in 2.73s).
  - [x] 4.4 Update `docs/plans/2026-09-24-backend-performance-optimization-plan.md` with execution proofs.

### Verification Results Summary (Phase 4):
- **Pytest Full Suite**: 237 passed, 0 failed, 0 errors in 61.96s (`py -3.12 -m pytest -v --ignore=tests/test_live_docker_integration.py --ignore=tests/test_frontend_blackbox.py`).
- **Container Build & Health**: `docker compose build backend && docker compose up -d backend` recreated container; `rezekify_backend` reached `healthy` status on port 8000.
- **Frontend Blackbox**: 6 passed in 2.73s against `http://localhost:80` (`py -3.12 -m pytest tests/test_frontend_blackbox.py -v`).
