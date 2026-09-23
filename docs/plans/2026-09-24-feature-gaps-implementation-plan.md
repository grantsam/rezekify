# Rezekify Feature Gaps & Frontend-Backend Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Every step uses checkbox (`- [ ]`) syntax for exact execution tracking.

**Goal:** Close all feature and architectural gaps between backend capabilities and frontend user experience in Rezekify. Deliver an autonomous, deterministic, and polished financial management platform adhering strictly to **frontend-design** aesthetic excellence, the **impeccable** craft protocol, test-driven development (TDD), zero-floating-point math, and multi-tenant row-level isolation.

---

## Architectural Invariants & Craft Standards

1. **Deterministic Math Invariant:**
   - Zero floating-point calculations in backend or frontend for monetary amounts, balances, or runway metrics.
   - All backend calculations enforce Python `decimal.Decimal` and PostgreSQL `NUMERIC(15, 2)`.
   - Frontend displays all currency values using `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })` paired with CSS `tabular-nums font-mono`.

2. **Multi-Tenant Row-Level Isolation Invariant:**
   - Every database operation is strictly scoped to `current_user.id` (`WHERE user_id = current_user.id`).
   - Cross-tenant references (`account_id`, `category_id`, `vault_id`) must be validated against `current_user.id` or fail immediately with HTTP 400 or HTTP 404.

3. **Frontend-Design Principles & Visual Identity:**
   - **Cohesive Dark Mode Slate Palette:** Deep background `bg-slate-950` (`#020617`), elevated surfaces `bg-slate-900/90` (`#0f172a`), borders `border-slate-800` (`#1e293b`), and subtle indigo accents `border-indigo-500/30`.
   - **Intentional Typography & Information Hierarchy:** Distinct scale utilizing high-contrast primary text (`text-slate-100`), muted secondary labels (`text-slate-400`), uppercase tracked section subtitles (`text-xs font-semibold uppercase tracking-wider text-slate-400`), and prominent numerical telemetry (`text-2xl` to `text-4xl font-extrabold`).
   - **Mobile-First Responsiveness (360px to 4K):** Touch-friendly interfaces with min 44x44px target bounds, responsive flex/grid wrappers (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`), fluid horizontal overflow controls, and zero horizontal scroll leaks on 360px viewports.
   - **Strict WCAG AA Contrast Compliance:** Minimum 4.5:1 contrast for all text against dark surfaces. Never use low-contrast grey-on-slate (`text-slate-600` on `bg-slate-900`). Telemetry status colors strictly bound to emerald (`#34d399`), amber (`#fbbf24`), and rose (`#f87171`).
   - **Fluid Micro-Interactions:** Leverages Framer Motion (`framer-motion`) for modal backdrops, spring-based progress bar transitions, audio recording waveform ripples, card hover elevations, and tab switches.

4. **Impeccable Craft Protocol:**
   - Every interactive component must handle 4 explicit states: **Loading** (pulsing skeleton), **Empty** (purpose-built icon + reassuring copy + clear primary CTA), **Error** (actionable error message with retry mechanism), and **Success** (optimistic update with clear visual feedback).
   - Validation with `impeccable:impeccable-finish-reviewer` for UI polish and spacing audits.
   - Central documentation maintained in `DESIGN.md` via `impeccable:impeccable-documenter`.

5. **Test-Driven Development (TDD) Protocol:**
   - Write failing automated tests first (pytest for backend, vitest + React Testing Library for frontend).
   - Implement minimal working solution adhering to "ponytail:" simplification comments where ceiling is identified.
   - Verify tests pass cleanly and suite regression count is preserved or increased.

---

## Phase 1: Critical UI Gaps for Existing Backend APIs

### Task 1: Impeccable Vaults Management Section & Cards (`VaultsSection.tsx`, `VaultCard.tsx`)

**Context & Scope:**
The backend router `rezekify/api/v1/vaults_router.py` already exposes full CRUD:
- `GET /api/v1/vaults`
- `POST /api/v1/vaults`
- `PATCH /api/v1/vaults/{vault_id}/toggle-lock`
- `PUT /api/v1/vaults/{vault_id}`
- `DELETE /api/v1/vaults/{vault_id}`
However, the frontend only has a creation modal (`VaultModal.tsx`). Users currently have no visual way to view their active vaults, inspect target progress, toggle vault locks, edit targets, or delete sinking funds.

**Files to create / edit:**
- Create: `frontend/src/components/VaultCard.tsx`
- Create: `frontend/src/components/VaultsSection.tsx`
- Create: `frontend/src/components/EditVaultModal.tsx`
- Modify: `frontend/src/services/apiClient.ts`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Create: `frontend/src/__tests__/VaultCard.test.tsx`
- Create: `frontend/src/__tests__/VaultsSection.test.tsx`
- Create: `frontend/src/__tests__/EditVaultModal.test.tsx`

**Acceptance Criteria:**
- Vault cards render name, type badge (`FIXED_BILL` / `SAVINGS`), target amount, allocated amount, and target date.
- Spring-animated progress bar displays percentage completed (`(allocated / target) * 100%`) with visual color coding.
- Lock toggle button invokes `PATCH /api/v1/vaults/{id}/toggle-lock` with optimistic state update and animated lock/unlock Lucide icon.
- Locked vaults display badge and prevent allocation decreases or deletions, showing clear explanatory tooltip.
- Edit button opens `EditVaultModal` allowing modification of target amount, allocated amount, and target date.
- Delete button triggers a confirmation dialog; locked vaults are blocked with clear feedback.
- Empty state provides a helpful explanation of sinking funds with a "+ Buat Vault Pertama" CTA button.

- [x] **Step 1.1: Add API client methods in `frontend/src/services/apiClient.ts`**
  Add `getVaults()`, `toggleVaultLock(vaultId: string)`, `updateVault(vaultId: string, data: VaultUpdateRequest)`, and `deleteVault(vaultId: string)`.

- [x] **Step 1.2: Write failing unit tests for `VaultCard` in `frontend/src/__tests__/VaultCard.test.tsx`**
  - Test vault data rendering: name, formatted allocated/target amounts, percentage progress bar, and days remaining until target date.
  - Test clicking lock toggle triggers `onToggleLock` callback with vault ID.
  - Test clicking edit button triggers `onEdit` callback.
  - Test clicking delete button triggers `onDelete` callback.
  - Test locked state disables delete action and shows padlock status.

- [x] **Step 1.3: Implement `frontend/src/components/VaultCard.tsx`**
  - Implement component using Tailwind slate palette: `bg-slate-900/90 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all`.
  - Add Framer Motion animated progress bar: `motion.div` with easeInOut transition.
  - Add lock status indicator (`Lock` vs `Unlock` icons from Lucide React) with accessible button bounds (`min-h-[38px] min-w-[38px]`).
  - Add formatted currency with `tabular-nums font-mono`.

- [x] **Step 1.4: Write failing unit tests for `EditVaultModal` in `frontend/src/__tests__/EditVaultModal.test.tsx`**
  - Test modal renders pre-populated values when open.
  - Test form validation (target amount > 0, allocated amount >= 0).
  - Test submitting form calls `updateVault` and triggers `onSuccess`.

- [x] **Step 1.5: Implement `frontend/src/components/EditVaultModal.tsx`**
  - Implement modal using HeroUI `Modal`, `ModalContent`, `ModalHeader`, `ModalBody`, `ModalFooter`.
  - Support updating `name`, `target_amount`, `allocated_amount`, and `target_date`.
  - Include validation guard preventing allocated amount reduction if vault is locked.

- [x] **Step 1.6: Write failing unit tests for `VaultsSection` in `frontend/src/__tests__/VaultsSection.test.tsx`**
  - Test renders loading skeleton state when `isLoading` is true.
  - Test renders empty state card when vaults list is empty with "+ Buat Vault Pertama" button.
  - Test renders list of `VaultCard` items in responsive grid when vaults are provided.
  - Test filtering by tab: "Semua", "Tagihan Tetap", "Tabungan".

- [x] **Step 1.7: Implement `frontend/src/components/VaultsSection.tsx`**
  - Bento grid layout: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`.
  - Tab filter chips for All / Fixed Bills / Savings.
  - Connect actions to `toggleVaultLock`, `deleteVault`, open `EditVaultModal`, and open `VaultModal`.

- [x] **Step 1.8: Integrate `VaultsSection` into `frontend/src/pages/DashboardPage.tsx`**
  - Add `vaults: Vault[]` state and fetch in `loadData()` via `getVaults()`.
  - Render `<VaultsSection>` in main dashboard flow.
  - Run `npm --prefix frontend test -- --run` and verify all new tests pass cleanly.

---

### Task 2: Impeccable Categories Management Modal (`CategoryManagerModal.tsx`)

**Context & Scope:**
The backend router `rezekify/api/v1/categories_router.py` provides category management (`GET`, `POST`, `PUT`, `DELETE /api/v1/categories`), but there is no frontend management modal. Users currently cannot view their custom categories, edit names/icons/colors, or delete categories.

**Files to create / edit:**
- Create: `frontend/src/components/CategoryManagerModal.tsx`
- Modify: `frontend/src/services/apiClient.ts`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Create: `frontend/src/__tests__/CategoryManagerModal.test.tsx`

**Acceptance Criteria:**
- Modal presents categories split into two tabs: `Pengeluaran (EXPENSE)` and `Pemasukan (INCOME)`.
- Each category item displays its custom color swatch, Lucide icon, name, and action buttons (Edit, Delete).
- Category editor form allows creating new categories or updating existing ones with:
  - Text input for Category Name (max 50 characters).
  - Palette color swatch selector (10 curated high-contrast hex codes).
  - Icon picker grid (12 curated financial and lifestyle icons).
- Deleting a category prompts for confirmation and updates the local state without requiring a full page refresh.
- Trigger button "+ Kategori" or "Kelola Kategori" integrated into dashboard navigation / settings.

- [x] **Step 2.1: Add API client methods in `frontend/src/services/apiClient.ts`**
  Add `getCategories()`, `createCategory(data: CategoryCreateRequest)`, `updateCategory(id: string, data: CategoryUpdateRequest)`, and `deleteCategory(id: string)`.

- [x] **Step 2.2: Write failing unit tests in `frontend/src/__tests__/CategoryManagerModal.test.tsx`**
  - Test modal renders categories list for active tab.
  - Test tab switching between EXPENSE and INCOME filters categories correctly.
  - Test adding a new category: validates name, submits payload with selected color swatch and icon.
  - Test editing category name and color.
  - Test deleting category triggers confirmation and deletes via API.

- [x] **Step 2.3: Implement `frontend/src/components/CategoryManagerModal.tsx`**
  - HeroUI modal with dark slate theme (`bg-slate-900 border border-slate-800 text-white`).
  - Curated color swatch list: `#64748b` (Slate), `#ef4444` (Red), `#f59e0b` (Amber), `#10b981` (Emerald), `#06b6d4` (Cyan), `#3b82f6` (Blue), `#6366f1` (Indigo), `#8b5cf6` (Purple), `#ec4899` (Pink), `#f43f5e` (Rose).
  - Curated icon map with Lucide components: `Tag`, `ShoppingBag`, `Utensils`, `Car`, `Home`, `Zap`, `Heart`, `Film`, `Smartphone`, `Coffee`, `Briefcase`, `Gift`.
  - Inline error notifications and loading spinner states on submit.

- [x] **Step 2.4: Integrate Category Management trigger into `DashboardPage.tsx`**
  - Add "+ Kategori" quick action button in top navigation bar or settings menu.
  - Pass loaded `categories` and `refreshCategories` handler to ensure `ManualTransactionModal` and `TransactionsTable` update instantly.
  - Run frontend test suite to ensure 100% pass rate.

---

## Phase 2: Financial Cycle Personalization & Data Scale

### Task 3: Profile Financial Cycle & Runway Threshold Configuration (`SettingsModal.tsx`)

**Context & Scope:**
Currently, `monthly_cycle_day` exists on the `User` model but lacks an API update endpoint and UI field. Furthermore, the safe runway threshold is hardcoded to `Decimal("30000.00")` in `rezekify/services/runway.py` (`HC-01`). Users need the ability to configure their monthly payday cycle day (1–31) and their personal daily safe runway threshold (e.g., Rp 50.000/day).

**Files to create / edit:**
- Modify: `rezekify/db/models.py` (add `safe_runway_threshold` to `User`)
- Create: `rezekify/db/migrations/versions/003_add_safe_runway_threshold.py`
- Modify: `rezekify/services/runway.py`
- Modify: `rezekify/schemas/settings.py`
- Modify: `rezekify/api/v1/settings_router.py`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/services/apiClient.ts`
- Modify: `frontend/src/components/SettingsModal.tsx`
- Modify: `tests/test_runway_service.py`
- Modify: `tests/test_settings_api.py`
- Modify: `frontend/src/__tests__/SettingsModal.test.tsx`

**Acceptance Criteria:**
- `User` table has `safe_runway_threshold NUMERIC(15, 2) NOT NULL DEFAULT 30000.00`.
- `RunwayService.calculate_runway` evaluates `HEALTHY`, `WARNING`, and `CRITICAL` against `user.safe_runway_threshold`.
- `PUT /api/v1/settings/profile` validates `monthly_cycle_day` (between 1 and 31) and `safe_runway_threshold` (> 0).
- `SettingsResponse` includes user profile info (`monthly_cycle_day`, `safe_runway_threshold`, `full_name`, `email`).
- `SettingsModal.tsx` contains a new "Siklus & Ambang Batas" tab with numeric input, currency formatting, and save action.

- [x] **Step 3.1: Write failing backend tests in `tests/test_runway_service.py` and `tests/test_settings_api.py`**
  - Assert runway health status is `WARNING` when daily safe is below customized threshold (e.g. daily safe = 40,000, user threshold = 50,000).
  - Assert runway health status is `HEALTHY` when daily safe is above customized threshold (e.g. daily safe = 25,000, user threshold = 20,000).
  - Assert `GET /api/v1/settings` returns profile fields.
  - Assert `PUT /api/v1/settings/profile` successfully updates `monthly_cycle_day` and `safe_runway_threshold`.
  - Assert `PUT /api/v1/settings/profile` rejects invalid `monthly_cycle_day` (< 1 or > 31) and negative threshold.

- [x] **Step 3.2: Add column to `User` model and create Alembic migration**
  - In `rezekify/db/models.py`: add `safe_runway_threshold = Column(Numeric(15, 2), nullable=False, default=Decimal("30000.00"))`.
  - Create migration script `rezekify/db/migrations/versions/003_add_safe_runway_threshold.py` with upgrade and downgrade functions.

- [x] **Step 3.3: Update `RunwayService` in `rezekify/services/runway.py`**
  - Replace hardcoded `Decimal("30000.00")` in `calculate_runway` and `simulate_purchase` with `user.safe_runway_threshold or Decimal("30000.00")`.

- [x] **Step 3.4: Update schemas and endpoints in `settings_router.py`**
  - In `rezekify/schemas/settings.py`, create `UserProfileResponse` and `UserProfileUpdateRequest`.
  - Add `profile: UserProfileResponse` to `SettingsResponse`.
  - In `rezekify/api/v1/settings_router.py`, implement `PUT /api/v1/settings/profile`.
  - Run pytest: `py -3.12 -m pytest tests/test_runway_service.py tests/test_settings_api.py -v`.

- [x] **Step 3.5: Write failing frontend tests in `frontend/src/__tests__/SettingsModal.test.tsx`**
  - Test rendering of the "Siklus & Ambang Batas" tab.
  - Test modifying cycle day and threshold input, and verify `updateUserProfile` is called with expected parameters.

- [x] **Step 3.6: Update `frontend/src/components/SettingsModal.tsx` and API clients**
  - Add `updateUserProfile(payload)` in `frontend/src/services/apiClient.ts`.
  - Add third tab `'profile'` in `SettingsModal.tsx` with inputs for `monthly_cycle_day` (1–31) and `safe_runway_threshold` (IDR currency formatted).
  - Verify all frontend tests pass with `npm --prefix frontend test -- --run`.

---

### Task 4: Server-Side Query Filtering & Pagination for Transactions (`TransactionsTable.tsx`)

**Context & Scope:**
Currently, `TransactionsTable.tsx` uses client-side filtering capped at ~500 items (`ponytail: client-side filter ceiling is ~500 items`). When transaction volume grows, memory consumption increases and filtering is incomplete. We must upgrade this to server-side query filtering with Account and Category selectors plus server-driven pagination.

**Files to create / edit:**
- Modify: `rezekify/api/v1/transactions_router.py`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/services/apiClient.ts`
- Modify: `frontend/src/components/TransactionsTable.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `tests/test_api_endpoints.py`
- Modify: `frontend/src/__tests__/TransactionsTable.test.tsx`

**Acceptance Criteria:**
- `GET /api/v1/transactions` supports query parameters:
  - `account_id: Optional[UUID]`
  - `category_id: Optional[UUID]`
  - `search: Optional[str]` (filters description and raw input text)
  - `start_date: Optional[datetime]`, `end_date: Optional[datetime]`
  - `page: int = 1`, `page_size: int = 20` (1–100)
- API returns a paginated envelope containing `items`, `total`, `page`, `page_size`, and `total_pages`.
- `TransactionsTable.tsx` includes:
  - Account select dropdown.
  - Category select dropdown.
  - Quick Date Filter buttons (`Semua`, `Hari Ini`, `7 Hari`, `Bulan Ini`).
  - Debounced search input (300ms).
  - Server-side pagination controls (Previous / Next, page counter, total item count).
- Zero floating-point math; all ledger amounts formatted deterministically.

- [x] **Step 4.1: Write failing backend tests in `tests/test_api_endpoints.py`**
  - Test filtering transactions by `account_id`.
  - Test filtering transactions by `category_id`.
  - Test text search by description keyword.
  - Test date range filtering (`start_date` and `end_date`).
  - Test pagination metadata (`total`, `page`, `total_pages`).

- [x] **Step 4.2: Implement server-side filtering and pagination in `rezekify/api/v1/transactions_router.py`**
  - Build dynamic SQLAlchemy query with tenant isolation `Transaction.user_id == current_user.id`.
  - Join `LedgerEntry` when `account_id` or `category_id` filter is supplied.
  - Compute `total = query.count()`, apply `.offset((page - 1) * page_size).limit(page_size)`.
  - Define `PaginatedTransactionsResponse` envelope and maintain backward compatibility.

- [x] **Step 4.3: Run verification backend tests**
  - Run `py -3.12 -m pytest tests/test_api_endpoints.py -v`.

- [x] **Step 4.4: Write failing frontend tests in `frontend/src/__tests__/TransactionsTable.test.tsx`**
  - Test rendering account and category dropdown filters.
  - Test filter selection triggers onParamsChange or server fetch.
  - Test clicking next/previous page invokes pagination handler.
  - Test rendering empty search results state.

- [x] **Step 4.5: Update `frontend/src/components/TransactionsTable.tsx` and `DashboardPage.tsx`**
  - Add filter controls bar above table: Search Input + Date Filter pills + Account Dropdown + Category Dropdown.
  - Implement bottom pagination bar with page information and accessible previous/next navigation buttons.
  - Connect state to `DashboardPage.tsx` for query refetching.
  - Verify with `npm --prefix frontend test -- --run`.

---

## Phase 3: Multi-Modal Voice Web Ingestion & Account Lifecycle

### Task 5: Web Audio Voice Ingestion (`POST /api/v1/dashboard/ai-voice` & Mic Button in `OmniInputHero.tsx`)

**Context & Scope:**
`AgentOrchestrator.handle_voice` and Telegram bot already support Groq Whisper transcription and autonomous ledger mutation from audio bytes. However, Web Dashboard users currently only have text and photo upload options. We must bridge this gap by exposing a Web voice ingestion endpoint and adding a native `MediaRecorder` microphone button with Framer Motion recording telemetry to `OmniInputHero.tsx`.

**Files to create / edit:**
- Modify: `rezekify/api/v1/dashboard_router.py`
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/services/apiClient.ts`
- Modify: `frontend/src/components/OmniInputHero.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `tests/test_api_endpoints.py`
- Modify: `frontend/src/__tests__/OmniInputHero.test.tsx`

**Acceptance Criteria:**
- `POST /api/v1/dashboard/ai-voice` accepts audio multipart upload (`audio/webm`, `audio/ogg`, `audio/wav`, `audio/mp4`, `audio/m4a`, `audio/mpeg`).
- Validates file size (max 25MB) and rejects empty files.
- Calls `orchestrator.handle_voice(user_id=current_user.id, audio_bytes=content, caption=message)` in threadpool.
- Returns `VoiceChatResponse(reply=result["reply"], transcription=result.get("transcription", ""))`.
- `OmniInputHero.tsx` features a microphone toggle button using native browser `navigator.mediaDevices.getUserMedia` and `MediaRecorder`.
- Active recording state shows recording timer (`00:04`), animated pulsing wave micro-interaction via Framer Motion, and a Stop/Submit button.
- On completion, audio is posted to `/api/v1/dashboard/ai-voice`, displaying both transcription preview and AI ledger response to the user.

- [x] **Step 5.1: Write failing backend test in `tests/test_api_endpoints.py`**
  - Mock Whisper transcription and assert `POST /api/v1/dashboard/ai-voice` returns 200 with transcription and ledger confirmation reply.
  - Assert unsupported audio MIME returns 400.
  - Assert oversized audio (> 25MB) returns 400.

- [x] **Step 5.2: Implement `POST /api/v1/dashboard/ai-voice` in `rezekify/api/v1/dashboard_router.py`**
  - Add allowed audio MIME types list.
  - Read bytes asynchronously, validate size and mime type.
  - Call `run_in_threadpool(orchestrator.handle_voice, ...)`.
  - Return response model with reply and transcription.

- [x] **Step 5.3: Run verification backend tests**
  - Run `py -3.12 -m pytest tests/test_api_endpoints.py -v`.

- [x] **Step 5.4: Write failing frontend tests in `frontend/src/__tests__/OmniInputHero.test.tsx`**
  - Test microphone button presence in input bar.
  - Test clicking mic initiates recording state (mock `MediaRecorder`).
  - Test stopping recording invokes voice submit handler with audio blob.

- [x] **Step 5.5: Implement Voice Recording in `frontend/src/components/OmniInputHero.tsx`**
  - Add native `MediaRecorder` hook/state management.
  - Add Framer Motion pulsing wave UI: `motion.div animate={{ scale: [1, 1.25, 1], opacity: [0.5, 1, 0.5] }}`.
  - Handle microphone permission rejection with an accessible warning banner.
  - Wire up submission to `DashboardPage.tsx` to call `/api/v1/dashboard/ai-voice`.
  - Verify all tests pass with `npm --prefix frontend test -- --run`.

---

### Task 6: Account Edit & Soft-Deactivation Lifecycle (`PUT` & `DELETE` in `/api/v1/accounts`)

**Context & Scope:**
Currently, `accounts_router.py` only allows listing (`GET`) and creating (`POST`) accounts. Users cannot rename accounts, change account types, or archive/deactivate unused accounts. Deleting an account must be a soft-deactivation (`is_active = False`) so existing double-entry ledger entries and audit history remain immutable.

**Files to create / edit:**
- Modify: `rezekify/api/v1/accounts_router.py`
- Modify: `frontend/src/services/apiClient.ts`
- Modify: `frontend/src/components/AccountModal.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `tests/test_api_endpoints.py`
- Modify: `frontend/src/__tests__/AccountModal.test.tsx`

**Acceptance Criteria:**
- `PUT /api/v1/accounts/{account_id}`:
  - Validates tenant isolation (`user_id == current_user.id`).
  - Updates `name` and/or `account_type`.
  - Returns updated `AccountResponse`.
- `DELETE /api/v1/accounts/{account_id}`:
  - Validates tenant isolation.
  - Soft-deactivates the account (`account.is_active = False`).
  - Does NOT delete past `LedgerEntry` or `Transaction` records.
  - Returns confirmation message.
- `GET /api/v1/accounts` respects `include_inactive: bool = False` query parameter.
- `AccountModal.tsx` supports both Create and Edit modes with a Deactivate button when editing.
- Dashboard Account strip provides an Edit trigger for each active account.

- [x] **Step 6.1: Write failing backend tests in `tests/test_api_endpoints.py`**
  - Test `PUT /api/v1/accounts/{id}` updates account name and type with tenant isolation.
  - Test `DELETE /api/v1/accounts/{id}` sets `is_active = False` without deleting ledger records.
  - Test modifying another tenant's account returns 404.

- [x] **Step 6.2: Implement `PUT` and `DELETE` endpoints in `rezekify/api/v1/accounts_router.py`**
  - Add `AccountUpdateRequest(name: Optional[str], account_type: Optional[AccountType])`.
  - Implement `update_account` and `deactivate_account` handlers with row-level locking or clean filter scoping.
  - Run backend tests: `py -3.12 -m pytest tests/test_api_endpoints.py -v`.

- [x] **Step 6.3: Write failing frontend tests in `frontend/src/__tests__/AccountModal.test.tsx`**
  - Test modal pre-populates existing account fields in edit mode.
  - Test submitting edit mode calls `updateAccount` API.
  - Test clicking deactivate button calls `deactivateAccount` API and triggers refresh.

- [x] **Step 6.4: Update `AccountModal.tsx` and integrate edit triggers in `DashboardPage.tsx`**
  - Add optional prop `accountToEdit?: Account | null`.
  - Support edit flow and soft-deactivation confirmation modal.
  - Add edit button/badge in `DashboardPage.tsx` account chips.
  - Verify with `npm --prefix frontend test -- --run`.

---

## Phase 4: Impeccable Quality Verification & Design System Documentation

### Task 7: Full Test Suite Verification

**Acceptance Criteria:**
- Backend: all pytest tests pass (230+ total tests).
- Backend: `ruff check .` passes with zero lint or formatting errors.
- Backend: `mypy rezekify` passes with zero type errors.
- Frontend: all vitest tests pass (120+ total tests).
- Frontend: `npm --prefix frontend run build` completes with exit code 0.

- [x] **Step 7.1: Run complete backend verification**
  - Run: `py -3.12 -m pytest -v` (assert 230+ passed).
  - Run: `ruff check .`
  - Run: `mypy rezekify`

- [x] **Step 7.2: Run complete frontend verification**
  - Run: `npm --prefix frontend test -- --run` (assert 120+ passed).
  - Run: `npm --prefix frontend run build` (assert zero build errors).

---

### Task 8: Impeccable Finish Review and `DESIGN.md` Documentation Update

**Acceptance Criteria:**
- Visual design review against WCAG AA standards and design tokens.
- Review mobile responsiveness at 360px, 768px, 1280px, and 4K viewports.
- Update `DESIGN.md` with new component tokens, animations, and invariants.

- [x] **Step 8.1: Conduct UI Polish & Spacing Audit**
  - Verify focus rings (`ring-indigo-500/40`), keyboard tab stops, and ARIA labels on all modal dialogs.
  - Ensure zero horizontal scroll on mobile (360px) in `VaultsSection` and `TransactionsTable`.
  - Verify Framer Motion transitions feel snappy (<= 250ms easeOut).

- [x] **Step 8.2: Update `DESIGN.md` via Impeccable Protocol**
  - Document `VaultCard` and `VaultsSection` bento grid structure.
  - Document `CategoryManagerModal` color palette tokens and icon mappings.
  - Document `OmniInputHero` audio visualizer pulse states.
  - Document `TransactionsTable` server pagination specifications.
  - Record the updated design tokens and accessibility checklists.
