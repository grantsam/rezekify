# REZEKIFY: Frontend Full-Stack Integration & Autonomous User Flow Specification

**Document Type:** Architectural & Technical Design Specification (Spec)  
**Document ID:** `SPEC-2026-09-19-FRONTEND-FULL-INTEGRATION`  
**Target File:** `docs/specs/2026-09-19-frontend-full-integration-design.md`  
**Author:** Principal System Architect  
**Status:** Ready for Plan Generation  
**Project Classification:** Program Komputer / Rekayasa Perangkat Lunak Berbasis Kecerdasan Buatan (HKI)  

---

## 1. Executive Summary & Problem Statement

### 1.1 Context & The "UX Deadlock"
Rezekify's backend possesses a complete, highly resilient Layer 1 deterministic accounting engine (`LedgerService`), runway telemetry calculator (`RunwayService`), multimodal vision OCR orchestrator (`AgentOrchestrator`), and secure REST API routers (`auth`, `accounts`, `vaults`, `transactions`, `dashboard`, `analytics`).

However, the frontend client (`frontend/src/`) was previously operating as a static prototype, leading to a critical **UX Deadlock**:
1. **Zero Auth UI:** No registration or login view existed. Unauthenticated users were routed directly to `DashboardPage`, failing all API queries with silent 401 errors.
2. **Zero Account Creation UI:** Because no UI existed to create accounts, users could not select an account in `ManualTransactionModal`. Thus, no transactions could ever be recorded.
3. **Zero Vault Creation UI:** Fixed commitments (H-7 bills) could not be created from the browser, leaving the runway formula without locked expense deductions.
4. **Pseudo-Multipart OCR Ingestion:** `OmniInputHero` converted receipt image files into a text string (`"${text} [Lampiran file: ${file.name}]"`) rather than streaming real binary multipart data to the vision agent.
5. **Disconnected Analytics & Simulator:** `ExpenseCharts` rendered hardcoded static arrays, and the backend's deterministic `simulate_purchase` calculation had no corresponding UI component.

### 1.2 Core Integration Objectives
This specification designs the complete client-side architecture to unlock full-lifecycle usability:
* **Deliver Dedicated Auth Flow:** `AuthContext` + `AuthPage` with JWT local storage, auto-login session restoration, and navbar user profile/logout.
* **Deliver Onboarding & Quick Action Modals:** `AccountModal` (+ Tambah Rekening) with onboarding empty-state banner, and `VaultModal` (+ Tambah Pos Tagihan H-7).
* **Deliver Real Multipart Receipt Upload:** Wire `OmniInputHero` to send real `FormData` to `POST /api/v1/dashboard/ai-receipt` (or multipart `/ai-chat`).
* **Deliver What-If Purchase Simulator:** Expose `POST /api/v1/dashboard/simulate-purchase` and integrate `SimulatePurchaseModal` for real-time runway impact testing.
* **Deliver Reactive Analytics:** Bind `ExpenseCharts` to `GET /api/v1/analytics/spending-breakdown` with real transaction data.

---

## 2. Core Architectural Invariants Preserved

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       REZEKIFY ARCHITECTURAL INVARIANTS                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Deterministic Math      │ Python decimal.Decimal & SQL NUMERIC(15,2).    │
│                            │ Zero LLM calculation of balances or runway.    │
├────────────────────────────┼────────────────────────────────────────────────┤
│ 2. Balanced Ledger         │ Strict Double-Entry: Sum(Debit) = Sum(Credit). │
│                            │ Unbalanced transactions atomically rolled back.│
├────────────────────────────┼────────────────────────────────────────────────┤
│ 3. Tenant Isolation        │ Strict Row-Level Scoping: WHERE user_id = :uid │
│                            │ on every query, aggregation, and mutation.     │
├────────────────────────────┼────────────────────────────────────────────────┤
│ 4. Rotary Key Resilience   │ RotaryKeyPool multi-key round-robin for Gemini │
│                            │ 2.5 Flash Vision OCR with HTTP 429 failover.   │
├────────────────────────────┼────────────────────────────────────────────────┤
│ 5. Zero-Bloat Scope        │ Daily Safe Runway + H-7 Bills focus only.      │
│                            │ Strict rejection of yearly queries (HTTP 422). │
└────────────────────────────┴────────────────────────────────────────────────┘
```

All arithmetic (amounts, remaining days, daily runway drops, percentages) is computed in Python backend services using `decimal.Decimal`. The frontend formats numerical values strictly via `tabular-nums` and Indonesian Rupiah currency formatters (`Intl.NumberFormat('id-ID')`), never computing business accounting logic client-side.

---

## 3. Frontend Architecture & Component Topology

```
                                  ┌────────────────────────┐
                                  │      main.tsx          │
                                  └───────────┬────────────┘
                                              │
                                  ┌───────────▼────────────┐
                                  │     AuthProvider       │
                                  │   (AuthContext.tsx)    │
                                  └───────────┬────────────┘
                                              │
                                  ┌───────────▼────────────┐
                                  │        App.tsx         │
                                  └─────┬────────────┬─────┘
                     !isAuthenticated   │            │  isAuthenticated
                                        │            │
                     ┌──────────────────▼──┐      ┌──▼─────────────────────────┐
                     │     AuthPage.tsx    │      │     DashboardPage.tsx      │
                     │  - Login Form       │      │  - Header + User Bar       │
                     │  - Register Form    │      │  - Onboarding Banner       │
                     │  - Cycle Day Input  │      │  - OmniInputHero (OCR)     │
                     └─────────────────────┘      │  - RunwayMetricCard        │
                                                  │  - UpcomingBillsCard       │
                                                  │  - ExpenseCharts (Dynamic) │
                                                  │  - TransactionsTable       │
                                                  └──────────────┬─────────────┘
                                                                 │
                                    ┌────────────────────────────┼────────────────────────────┐
                                    │                            │                            │
                     ┌──────────────▼───────────┐ ┌──────────────▼───────────┐ ┌──────────────▼───────────┐
                     │    AccountModal.tsx      │ │      VaultModal.tsx      │ │ SimulatePurchaseModal.tsx│
                     │ - Bank / e-Wallet / Cash │ │ - Fixed Bill H-7 / Save  │ │ - What-If Runway Drop    │
                     │ - Initial Balance        │ │ - Target & Due Date      │ │ - Real-Time AI Verdict   │
                     └──────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘
```

---

## 4. Subsystem Specifications & Interface Contracts

### 4.1 Subsystem 1: Auth State & Gating (`frontend/src/context/AuthContext.tsx`)

#### State Interface:
```typescript
export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  telegram_chat_id?: number | null;
}

export interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
}
```

#### Behavioral Contract:
1. **Initialization:** On component mount, inspect `localStorage.getItem('rezekify_auth_token')`.
   - If token exists, dispatch `GET /api/v1/auth/me`.
   - On HTTP 200, populate `user` and set `isAuthenticated = true`.
   - On HTTP 401/error, invoke `clearAuthToken()`, set `user = null`, `isAuthenticated = false`.
2. **Login Dispatch:**
   - POST to `/api/v1/auth/login` with `{ email, password }`.
   - Store `access_token` into `localStorage`.
   - Fetch profile via `GET /api/v1/auth/me` and set `user`.
3. **Register Dispatch:**
   - POST to `/api/v1/auth/register` with `{ email, password, full_name }`.
   - Store returned `access_token` and populate `user`.
4. **Logout Dispatch:**
   - Clear `rezekify_auth_token` from `localStorage`.
   - Reset state: `user = null`, `token = null`, `isAuthenticated = false`.

---

### 4.2 Subsystem 2: Dedicated Auth View (`frontend/src/pages/AuthPage.tsx`)

#### Visual & UX Specifications:
- **Design Language:** Dark-slate canvas (`bg-slate-950`), neon accent glows (`indigo-500/20`, `emerald-500/10`), crisp typography with Indonesian financial terminology.
- **Tabbed Interface:**
  - Tab 1: **"Masuk (Login)"** — fields: Email (`type="email"`), Password (`type="password"`).
  - Tab 2: **"Daftar Akun Baru (Register)"** — fields: Nama Lengkap (`type="text"`), Email, Password (min 8 karakter).
- **Error Presentation:** Inline alert with `AlertCircle` icon displaying exact validation or backend error messages (e.g., "Email already registered" or "Invalid email or password").
- **Submit Loading State:** Submit button disabled with animated `Loader2` spinner.

---

### 4.3 Subsystem 3: Account Creation & Onboarding Flow (`AccountModal.tsx`)

#### Backend Contract:
- `POST /api/v1/accounts`
- **Request Body:**
  ```json
  {
    "name": "BCA Utama",
    "account_type": "BANK",
    "initial_balance": 1500000.00
  }
  ```
- **Response Model:** `AccountResponse` (`id`, `name`, `account_type`, `current_balance`, `is_active`).

#### Frontend Component (`AccountModal.tsx`):
- Modal opens via **"+ Rekening"** button in navbar or CTA on empty-state banner.
- Form inputs:
  - Nama Rekening (e.g., "Bank Mandiri", "GoPay", "Dompet Tunai")
  - Tipe Rekening: Segmented buttons / dropdown (`BANK`, `EWALLET`, `CASH`)
  - Saldo Awal: Numeric input with Rupiah prefix (`Rp `).
- Upon success: Trigger `onAccountCreated()` callback, close modal, and trigger `loadData()` in `DashboardPage`.

---

### 4.4 Subsystem 4: Fixed Commitments & Vaults Flow (`VaultModal.tsx`)

#### Backend Contract:
- `POST /api/v1/vaults`
- **Request Body:**
  ```json
  {
    "name": "Sewa Kos Bulanan",
    "vault_type": "FIXED_BILL",
    "target_amount": 1200000.00,
    "allocated_amount": 1200000.00,
    "target_date": "2026-09-25"
  }
  ```
- **Response Model:** `VaultResponse` (`id`, `name`, `vault_type`, `target_amount`, `allocated_amount`, `target_date`, `is_locked`).

#### Frontend Component (`VaultModal.tsx`):
- Modal opens via **"+ Tagihan"** button in navbar.
- Form inputs:
  - Nama Komitmen (e.g., "Tagihan Listrik & WiFi", "Cicilan Motor")
  - Tipe Pos: `FIXED_BILL` (Komitmen Tagihan) atau `SAVINGS` (Tabungan Impian)
  - Target Biaya (Rp)
  - Dana Terkunci Saat Ini (Rp)
  - Tanggal Jatuh Tempo (`target_date`) via date input.
- Upon success: Trigger `onVaultCreated()` callback, close modal, and refresh dashboard telemetry.

---

### 4.5 Subsystem 5: What-If Purchase Simulator (`SimulatePurchaseModal.tsx`)

#### Backend Contract:
- `POST /api/v1/dashboard/simulate-purchase`
- **Request Body:**
  ```json
  {
    "planned_amount": 350000.00
  }
  ```
- **Response Model:**
  ```json
  {
    "current_daily_runway": 120000.00,
    "projected_daily_runway": 85000.00,
    "daily_drop_amount": 35000.00,
    "is_safe": true,
    "advice": "Pembelian sebesar Rp 350,000 aman dilakukan. Jatah harian Anda tersisa Rp 85,000/hari."
  }
  ```

#### Frontend Component (`SimulatePurchaseModal.tsx`):
- Modal opens via **"Simulasi Belanja"** button in navbar.
- Real-time debounced or on-change simulation when planned amount is entered.
- Visual telemetry display:
  - Current Daily Runway vs Projected Daily Runway with delta drop pill (`-Rp 35.000/hari`).
  - Status Badge: Emerald (`AMAN DIKERJAKAN`) if `is_safe == true`, Amber/Rose (`PERINGATAN RUNWAY KRITIS`) if `is_safe == false`.
  - Indonesian financial advice banner computed by `RunwayService`.

---

### 4.6 Subsystem 6: Real Multipart Web Receipt OCR Ingestion

#### Backend Contract:
- `POST /api/v1/dashboard/ai-receipt`
- **Content-Type:** `multipart/form-data`
- **Form Fields:**
  - `file: UploadFile` (Required receipt image: JPEG, PNG, or WebP; maximum 10MB)
  - `message: Optional[str]` (Optional additional note / natural language instruction)
- **Execution:** Reads binary bytes, routes through `AgentOrchestrator.handle_message(user_id, text=message or "Foto struk belanja", image_bytes=bytes)`.
- **Response:**
  ```json
  {
    "reply": "✅ Tercatat: Rp 45,000 (Makan Siang) via GoPay.\n📊 Sisa Jatah Belanja Hari Ini: Rp 155,000"
  }
  ```

#### Frontend Refactor (`OmniInputHero.tsx` & `DashboardPage.tsx`):
- Update `onSubmit` signature to accept `(text: string, file: File | null)`.
- When `file` is present, construct native browser `FormData`:
  ```typescript
  const formData = new FormData();
  formData.append('file', file);
  if (text.trim()) formData.append('message', text.trim());
  ```
- Dispatch via `apiFetch('/dashboard/ai-receipt', { method: 'POST', body: formData })`.

---

### 4.7 Subsystem 7: Dynamic Real Spending Analytics (`ExpenseCharts.tsx`)

#### Backend Contract:
- `GET /api/v1/analytics/spending-breakdown?period=(daily|monthly)`
- **Daily Response:** 7-day array of daily expenses vs `safe_runway_threshold`.
- **Monthly Response:** Category distribution array with amount and percentage.

#### Frontend Refactor (`ExpenseCharts.tsx`):
- Fetch actual data from `/analytics/spending-breakdown?period=${period}`.
- Render dynamic bar heights for daily trend and category breakdown.
- Render accessible zero-data state: *"Belum ada data pengeluaran pada siklus ini"* when items are empty.

---

## 5. Security & Tenant Scoping Verification

1. **Authorization Token Propagation:**
   `apiClient.ts` automatically attaches `Authorization: Bearer <token>` to all requests. If any request returns HTTP 401, `AuthContext` immediately invalidates the session and prompts `AuthPage`.
2. **Strict Row-Level Scoping:**
   All backend endpoints receive `current_user: User = Depends(get_current_user)`. All database operations filter strictly by `user_id == current_user.id`.
3. **Receipt File Validation:**
   The backend inspects file header magic bytes and content length before passing bytes to the vision API, preventing arbitrary binary exploitation.

---

## 6. Testing Strategy & Acceptance Criteria

### 6.1 Unit & Component Tests (Vitest & React Testing Library)
* `AuthContext.test.tsx`: Token persistence, login, logout, 401 handling.
* `AuthPage.test.tsx`: Form rendering, tab switching, submit actions.
* `AccountModal.test.tsx`: Form input validation, payload submission.
* `VaultModal.test.tsx`: Date picker, target amount submission.
* `SimulatePurchaseModal.test.tsx`: Real-time calculation and advice rendering.
* `OmniInputHero.test.tsx`: `FormData` dispatch with attached file.
* `ExpenseCharts.test.tsx`: Dynamic data rendering and empty states.

### 6.2 Backend Route Integration Tests (Pytest)
* `test_auth_endpoints.py`: Register, login, `/auth/me` profile retrieval.
* `test_dashboard_receipt.py`: Multipart upload endpoint with mock vision payload.
* `test_simulate_purchase.py`: Verified `simulate_purchase` endpoint response.

### 6.3 End-to-End Acceptance Flow
1. Open web application $\rightarrow$ `AuthPage` renders.
2. Register new user $\rightarrow$ `DashboardPage` appears with empty-state onboarding banner.
3. Click "+ Rekening" $\rightarrow$ Add BCA account Rp 2,000,000 $\rightarrow$ Runway metric shows Rp 2,000,000.
4. Click "+ Tagihan" $\rightarrow$ Add Sewa Kos Rp 500,000 due in 5 days $\rightarrow$ Operational Free Cash becomes Rp 1,500,000.
5. Click "Simulasi Belanja" $\rightarrow$ Test Rp 300,000 purchase $\rightarrow$ See instant runway drop projection.
6. Upload receipt photo in `OmniInputHero` $\rightarrow$ Real `FormData` sent, double-entry transaction recorded.
7. Click "Logout" $\rightarrow$ Session cleared, user returned to `AuthPage`.
