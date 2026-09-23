# Rezekify Audit Remediation & PRD Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate all critical and medium security vulnerabilities (VULN-01 to VULN-06), close the functional gap on the Auxiliary Manual CRUD Fallback (FR-6.4), sync the dynamic runway formula with locked vaults (FR-2.2 & FR-3.2), prune identified dead code (DEAD-01 to DEAD-06), and harden Docker packaging as documented in `PROJECT_AUDIT_REPORT.md`.

**Architecture:** A 4-phase hardening and feature completion sequence:
1. **Phase 1 (P0 Security Hardening)**: Webhook constant-time secret enforcement, high-entropy 6-char alphanumeric OTP with lockout defense, cross-tenant category validation on ledger mutations, authentication endpoint rate limiting, and rate-limiter memory leak cleanup.
2. **Phase 2 (P1 PRD Compliance & Core CRUD)**: Dedicated Category CRUD router (`/api/v1/categories`), full-featured `ManualTransactionModal.tsx` (category dropdown, date picker, receipt dropzone), client-side keyword search & date range filtering in `TransactionsTable.tsx`, and edge-case calendar & locked-vault runway formula fixes.
3. **Phase 3 (P2 Dead Code Pruning & Packaging)**: Removal of dead methods (`handle_receipt`, `bootstrap_database`), orphaned components (`AuthModal.tsx`), unused interfaces (`ReceiptUploadResponse`), and addition of `alembic.ini` to Docker packaging.
4. **Phase 4 (P3 Async Resilience & Dynamic Settings)**: Asynchronous background dispatch for Telegram webhook updates to prevent 5-second webhook timeout retry storms, and user-configurable safe daily runway threshold.

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, PostgreSQL 16 / SQLite (in-memory test runner), React 18, Vite, Vitest, TypeScript, Tailwind CSS, HeroUI, Lucide React, Framer Motion.

**Source Audit Report:** `PROJECT_AUDIT_REPORT.md`

---

## Global Constraints & Invariants

* **Invariant 1 (Deterministic Math):** Zero floating-point math. All money amounts, account balance adjustments, and runway metrics use Python `decimal.Decimal` and SQL `NUMERIC(15, 2)`.
* **Invariant 2 (Balanced Ledger):** Every financial transaction must atomically enforce $\sum \text{Debit} = \sum \text{Credit}$.
* **Invariant 3 (Row-Level Tenant Isolation):** All database queries must enforce `WHERE user_id = current_user_id`. Creating transactions with foreign `category_id` or `account_id` must fail with 400/404.
* **Invariant 4 (Windows PowerShell Syntax):** All commands must use PowerShell statement terminators (semicolon `;` or new lines). Never chain commands with unescaped bash `&&`.
* **Invariant 5 (Zero Truncation Rule):** Code in every step must be 100% complete and fully compilable without ellipsis or placeholders.
* **Invariant 6 (Conventional Commits):** Commits must use `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, with the standard Co-Authored-By trailer.

---

## Phase 1: Security Hardening (P0 Immediate Security Fixes)

### Task 1: Telegram Webhook Authentication Enforcement & Constant-Time Comparison (`VULN-01`)

**Files:**
- Modify: `rezekify/core/config.py`
- Modify: `rezekify/api/v1/gateway_router.py`
- Modify: `tests/test_gateway_webhook.py`

**Interfaces:**
- `gateway_router.py` must reject requests with HTTP 403 when `TELEGRAM_WEBHOOK_SECRET` is unset or header does not match.
- Use `secrets.compare_digest(x_telegram_bot_api_secret_token, settings.TELEGRAM_WEBHOOK_SECRET)`.

- [x] **Step 1.1: Write failing test in `tests/test_gateway_webhook.py`**
  Assert that when `TELEGRAM_WEBHOOK_SECRET` is set, invalid tokens return 403, missing headers return 403, and matching token returns 200 via `secrets.compare_digest`. Assert that if webhook secret is unset in non-development mode, access is denied.

- [x] **Step 1.2: Implement constant-time token comparison in `rezekify/api/v1/gateway_router.py`**
  ```python
  import secrets
  from fastapi import APIRouter, Body, Depends, Header, HTTPException, status
  from rezekify.core.config import settings

  @gateway_router.post("/telegram/webhook")
  def telegram_webhook(
      payload: Dict[str, Any] = Body(default_factory=dict),
      x_telegram_bot_api_secret_token: Optional[str] = Header(None, alias="X-Telegram-Bot-Api-Secret-Token"),
      db: Session = Depends(get_db),
  ) -> Dict[str, Any]:
      if not settings.TELEGRAM_WEBHOOK_SECRET and settings.ENVIRONMENT.lower() == "production":
          raise HTTPException(
              status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
              detail="Telegram webhook secret must be configured in production.",
          )
      if settings.TELEGRAM_WEBHOOK_SECRET:
          if not x_telegram_bot_api_secret_token or not secrets.compare_digest(
              x_telegram_bot_api_secret_token, settings.TELEGRAM_WEBHOOK_SECRET
          ):
              raise HTTPException(
                  status_code=status.HTTP_403_FORBIDDEN,
                  detail="Invalid Telegram webhook secret token",
              )
      gateway = TelegramGateway(db=db)
      result = gateway.handle_update(payload)
      return {"status": "ok", "result": result}
  ```

- [x] **Step 1.3: Run verification test**
  Run: `pytest tests/test_gateway_webhook.py -v`

---

### Task 2: High-Entropy OTP Pairing Code & Brute-Force Lockout Defense (`VULN-02`, `VULN-03`)

**Files:**
- Modify: `rezekify/core/security.py`
- Modify: `rezekify/services/auth.py`
- Modify: `rezekify/gateway/telegram_bot.py`
- Modify: `tests/test_auth_service.py`
- Modify: `tests/test_telegram_bot.py`

**Interfaces:**
- `generate_pairing_code() -> str`: Produces `DK-` followed by 6 uppercase alphanumeric characters (excluding confusing chars like 0, O, 1, I). Samples from `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` ($32^6 \approx 1.07$ billion combinations).
- `generate_telegram_pairing_code(user_id)`: Retry loop (up to 5 attempts) to prevent unique constraint collisions.
- `link_telegram_chat_id(telegram_chat_id, pairing_code)`: Tracks failed attempts per `telegram_chat_id` (max 5 failed attempts within 15 minutes before temporary lockout).

- [x] **Step 2.1: Write failing tests in `tests/test_auth_service.py` and `tests/test_telegram_bot.py`**
  Test 6-character code format, collision-retry loop, and lockout after 5 consecutive invalid pairing attempts.

- [x] **Step 2.2: Implement 6-char alphanumeric pairing generator in `rezekify/core/security.py`**
  ```python
  import secrets

  PAIRING_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

  def generate_pairing_code() -> str:
      """Generates a secure 6-character base32 alphanumeric code with DK- prefix."""
      suffix = "".join(secrets.choice(PAIRING_ALPHABET) for _ in range(6))
      return f"DK-{suffix}"
  ```

- [x] **Step 2.3: Implement collision retry loop in `rezekify/services/auth.py`**
  Add retry loop in `generate_telegram_pairing_code` catching duplicate codes and handling expiration.

- [x] **Step 2.4: Implement attempt lockout in `TelegramGateway` or `AuthService`**
  Record failed attempts with timestamp. Reject link attempt if failed count $\ge 5$ within 15 minutes with message: `"Terlalu banyak percobaan gagal. Silakan coba lagi dalam 15 menit."`.

- [x] **Step 2.5: Run verification tests**
  Run: `pytest tests/test_auth_service.py tests/test_telegram_bot.py -v`

---

### Task 3: Cross-Tenant Category Ownership Defense in Ledger Mutations (`VULN-04`)

**Files:**
- Modify: `rezekify/services/ledger.py`
- Modify: `tests/test_ledger_service.py`

**Interfaces:**
- In `record_expense` and `record_income`: If `category_id` is not None, assert `Category.filter_by(id=category_id, user_id=user_id)` exists, otherwise raise `ValueError("Category not found or access denied.")`.

- [x] **Step 3.1: Write failing test in `tests/test_ledger_service.py`**
  Add `test_record_expense_with_foreign_category_rejected` and `test_record_income_with_foreign_category_rejected`.

- [x] **Step 3.2: Implement category tenant check in `record_expense` and `record_income`**
  ```python
  # rezekify/services/ledger.py in record_expense:
  if category_id:
      category = (
          self.db.query(Category)
          .filter_by(id=category_id, user_id=user_id)
          .one_or_none()
      )
      if not category:
          raise ValueError("Category not found or access denied.")

  # rezekify/services/ledger.py in record_income:
  if category_id:
      category = (
          self.db.query(Category)
          .filter_by(id=category_id, user_id=user_id)
          .one_or_none()
      )
      if not category:
          raise ValueError("Category not found or access denied.")
  ```

- [x] **Step 3.3: Run verification tests**
  Run: `pytest tests/test_ledger_service.py -v`

---

### Task 4: Rate Limiting on Auth/Settings Endpoints & Memory Leak Cleanup (`VULN-05`, `DEAD-06`)

**Files:**
- Modify: `rezekify/core/rate_limit.py`
- Modify: `rezekify/api/v1/auth_router.py`
- Modify: `rezekify/api/v1/settings_router.py`
- Modify: `tests/test_rate_limit.py`

**Interfaces:**
- In `RateLimiter`: After pruning expired timestamps from `deque`, if `len(q) == 0`, delete the key from `self._history` to prevent memory leaks.
- Attach `auth_limiter = RateLimiter(max_requests=5, window_seconds=60)` to `POST /api/v1/auth/login` and `POST /api/v1/auth/register`.
- Attach `ai_probe_limiter = RateLimiter(max_requests=10, window_seconds=60)` to `POST /api/v1/settings/ai/validate`.

- [x] **Step 4.1: Write failing tests in `tests/test_rate_limit.py`**
  Test key eviction on empty deque to verify bounded memory. Test 429 response on login spam and AI key validation spam.

- [x] **Step 4.2: Implement memory eviction in `rezekify/core/rate_limit.py`**
  ```python
  boundary = now - self.window_seconds
  while q and q[0] <= boundary:
      q.popleft()

  if not q and key in self._history:
      del self._history[key]
  ```

- [x] **Step 4.3: Attach rate limiters to `auth_router.py` and `settings_router.py`**
  Add dependencies on `/login`, `/register`, and `/ai/validate`.

- [x] **Step 4.4: Run verification tests**
  Run: `pytest tests/test_rate_limit.py tests/test_auth_service.py tests/test_settings_api.py -v`

---

## Phase 2: PRD Compliance & Auxiliary Manual CRUD (P1)

### Task 5: Category Management Domain Router (`FR-6.4`, `DEAD-05`)

**Files:**
- Create: `rezekify/api/v1/categories_router.py`
- Modify: `rezekify/api/main.py`
- Create: `tests/test_categories_api.py`

**Interfaces:**
- `GET /api/v1/categories`: Lists all categories for current user.
- `POST /api/v1/categories`: Creates category (`name`, `category_type`, `icon`, `color`).
- `PUT /api/v1/categories/{id}`: Updates category name/color/icon.
- `DELETE /api/v1/categories/{id}`: Deletes category (only if no ledger entries depend on it or nullifies reference).

- [x] **Step 5.1: Write failing tests in `tests/test_categories_api.py`**
  Cover full Category CRUD lifecycle with row-level tenant isolation.

- [x] **Step 5.2: Create `rezekify/api/v1/categories_router.py`**
  Implement Pydantic schemas and FastAPI endpoints for Category management.

- [x] **Step 5.3: Register `categories_router` in `rezekify/api/main.py`**
  ```python
  from rezekify.api.v1.categories_router import categories_router
  app.include_router(categories_router, prefix="/api/v1/categories", tags=["Categories"])
  ```

- [x] **Step 5.4: Run verification tests**
  Run: `pytest tests/test_categories_api.py -v`

---

### Task 6: Full-Featured Manual Transaction Modal & Dashboard Integration (`FR-6.4`)

**Files:**
- Modify: `frontend/src/components/ManualTransactionModal.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/__tests__/ManualTransactionModal.test.tsx`
- Modify: `rezekify/api/v1/transactions_router.py` (ensure `transaction_date` accepted in create request)

**Interfaces:**
- `ManualTransactionModal` accepts `categories: Category[]`.
- Displays Category select dropdown (filtered by `EXPENSE` or `INCOME`).
- Displays datetime-local picker for `transaction_date` (defaults to current time).
- Displays optional receipt image dropzone / file picker.

- [x] **Step 6.1: Update backend `TransactionCreateRequest` to accept `transaction_date`**
  In `rezekify/api/v1/transactions_router.py`, add `transaction_date: Optional[datetime] = None`.
  Forward `transaction_date` to `LedgerService` if provided.

- [x] **Step 6.2: Add unit tests in `frontend/src/__tests__/ManualTransactionModal.test.tsx`**
  Verify category selection, date picker change, and submission payload.

- [x] **Step 6.3: Implement category select & date picker in `ManualTransactionModal.tsx`**
  Update component props, form state, and UI layout.

- [x] **Step 6.4: Pass `categories` to `ManualTransactionModal` in `DashboardPage.tsx`**
  Ensure loaded categories from `/api/v1/categories` populate the modal.

---

### Task 7: Transactions History Search & Date Range Filtering (`FR-6.4`)

**Files:**
- Modify: `frontend/src/components/TransactionsTable.tsx`
- Modify: `frontend/src/__tests__/TransactionsTable.test.tsx`

**Interfaces:**
- Add real-time text input for filtering by transaction description or channel.
- Add Date filter (All, Today, Last 7 Days, This Month, Custom Date Range).

- [x] **Step 7.1: Write tests in `frontend/src/__tests__/TransactionsTable.test.tsx`**
  Test filtering by search query and date filtering logic.

- [x] **Step 7.2: Implement search input bar and date range selector in `TransactionsTable.tsx`**
  Add state `searchQuery` and `dateFilter`. Filter `transactions` array before mapping table rows.

---

### Task 8: Dynamic Runway Calendar Edge-Case & Locked Vault Formula (`FR-2.1`, `FR-2.2`, `FR-3.2`)

**Files:**
- Modify: `rezekify/services/runway.py`
- Modify: `tests/test_runway_service.py`

**Interfaces:**
- `calculate_runway`:
  1. Only sum `allocated_amount` where `Vault.is_locked == True` for `vault_locked_cash` and deduction from `operational_free_cash`.
  2. Handle month-end cycle day capping: `effective_cycle_day = min(user.monthly_cycle_day, days_in_current_month)`.

- [x] **Step 8.1: Write failing test in `tests/test_runway_service.py`**
  Test `monthly_cycle_day = 31` on February 20 (must return 8 days remaining, not 11). Test that unlocked vaults do not deduct from operational cash.

- [x] **Step 8.2: Implement locked-vault filter and month-length cap in `rezekify/services/runway.py`**
  ```python
  # Locked vault sum:
  vault_sum = (
      self.db.query(func.coalesce(func.sum(Vault.allocated_amount), Decimal("0.00")))
      .filter(Vault.user_id == user_id, Vault.is_locked == True)
      .scalar()
  )

  # Calendar days remaining:
  _, days_in_cur_month = monthrange(today.year, today.month)
  effective_cycle_day = min(cycle_day, days_in_cur_month)
  if today.day < effective_cycle_day:
      days_remaining = effective_cycle_day - today.day
  else:
      # Next month cycle day
      next_year = today.year + 1 if today.month == 12 else today.year
      next_month = 1 if today.month == 12 else today.month + 1
      _, days_in_next_month = monthrange(next_year, next_month)
      next_effective_cycle = min(cycle_day, days_in_next_month)
      days_remaining = (days_in_cur_month - today.day) + next_effective_cycle
  ```

- [x] **Step 8.3: Run verification tests**
  Run: `pytest tests/test_runway_service.py -v`

---

## Phase 3: Dead Code Removal & DevOps Packaging (P2)

### Task 9: Prune Dead Methods, Unused Interfaces, and Orphaned Components

**Files:**
- Modify: `rezekify/agent/orchestrator.py` (remove `handle_receipt`)
- Modify: `tests/test_agent_orchestrator.py` (update test to use `handle_message`)
- Modify: `rezekify/db/init_db.py` (remove `bootstrap_database`)
- Delete: `frontend/src/components/AuthModal.tsx`
- Delete: `frontend/src/__tests__/AuthModal.test.tsx`
- Modify: `frontend/src/types/api.ts` (remove `ReceiptUploadResponse`)
- Modify: `frontend/src/pages/DashboardPage.tsx` (clean unused import)

- [x] **Step 9.1: Consolidate `test_agent_orchestrator.py` and remove `handle_receipt`**
  Ensure test tests `handle_message` with `image_bytes`. Remove ~116 lines of dead code in `AgentOrchestrator`.

- [x] **Step 9.2: Remove `bootstrap_database` from `rezekify/db/init_db.py`**
  Clean up unused alias.

- [x] **Step 9.3: Delete `AuthModal.tsx` and `AuthModal.test.tsx`**
  Verify `App.tsx` and `AuthPage.tsx` remain healthy.

- [x] **Step 9.4: Clean unused types and imports in frontend**
  Remove `ReceiptUploadResponse` from `types/api.ts` and `DashboardPage.tsx`.

- [x] **Step 9.5: Run test suite to verify no broken dependencies**
  Run: `pytest; ruff check .`

---

### Task 10: Docker Packaging Fix (`alembic.ini` Copy Directive)

**Files:**
- Modify: `Dockerfile.backend`
- Modify: `tests/test_docker_syntax.py`

- [x] **Step 10.1: Add `COPY alembic.ini` test to `tests/test_docker_syntax.py`**
  Assert that `Dockerfile.backend` explicitly copies `alembic.ini` to `/app/alembic.ini`.

- [x] **Step 10.2: Update `Dockerfile.backend`**
  ```dockerfile
  COPY --chown=rezekify:rezekify rezekify/ /app/rezekify/
  COPY --chown=rezekify:rezekify pyproject.toml /app/
  COPY --chown=rezekify:rezekify alembic.ini /app/
  COPY --chown=rezekify:rezekify docker/backend/docker-entrypoint.sh /app/docker-entrypoint.sh
  ```

- [x] **Step 10.3: Run verification test**
  Run: `pytest tests/test_docker_syntax.py -v`

---

## Phase 4: Scalability & Architecture Evolution (P3)

### Task 11: Asynchronous Telegram Webhook Dispatcher

**Files:**
- Modify: `rezekify/api/v1/gateway_router.py`
- Modify: `rezekify/gateway/telegram_bot.py`
- Modify: `tests/test_gateway_webhook.py`

**Interfaces:**
- Endpoint `/api/v1/gateway/telegram/webhook` returns `{"status": "accepted"}` immediately ($< 200\text{ ms}$).
- Offloads parsing and ledger mutation to FastAPI `BackgroundTasks`.
- Sends asynchronous response back to Telegram via `bot.send_message` if bot token is configured.

- [ ] **Step 11.1: Write tests for background webhook task offloading**
- [ ] **Step 11.2: Refactor `gateway_router.py` to use `BackgroundTasks`**
- [ ] **Step 11.3: Run verification tests**
  Run: `pytest tests/test_gateway_webhook.py -v`

---

### Task 12: User-Configurable Safe Daily Runway Threshold (`HC-01`)

**Files:**
- Modify: `rezekify/db/models.py` (add `safe_runway_threshold` column to `User` or `UserSettings`, default 30000.00)
- Create migration: `rezekify/db/migrations/versions/003_custom_safe_threshold.py`
- Modify: `rezekify/services/runway.py`
- Modify: `tests/test_runway_service.py`

- [ ] **Step 12.1: Write failing test in `tests/test_runway_service.py`**
  Verify runway health status respects `user.safe_runway_threshold`.

- [ ] **Step 12.2: Add column and migration**
  Add `safe_runway_threshold = Column(Numeric(15, 2), nullable=False, default=Decimal("30000.00"))`.

- [ ] **Step 12.3: Update `RunwayService` to read user threshold**
  Replace hardcoded `Decimal("30000.00")` with `user.safe_runway_threshold`.

- [ ] **Step 12.4: Run verification tests**
  Run: `pytest tests/test_runway_service.py tests/test_migrations.py -v`

---

## Final Verification Checklist

- [x] 1. All backend tests pass: pytest -v (222 passed)
- [x] 2. Linter & formatting checks pass: ruff check .
- [x] 3. Type checking passes: mypy rezekify
- [x] 4. Frontend builds and passes tests: 105 passed, build 0 error
- [ ] 5. Git status is clean and all commits adhere to Conventional Commits.
