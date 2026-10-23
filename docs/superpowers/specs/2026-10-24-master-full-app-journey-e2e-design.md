# Master Full-App User Journey E2E Live Container Suite

- **Date**: 2026-10-24
- **Target Environment**: Live Containerized Docker Stack (`http://localhost:80`)
- **Scope**: Full-stack end-to-end integration across Nginx reverse proxy, React SPA bundle, FastAPI backend (`/api/v1`), and PostgreSQL 16
- **Status**: Approved

---

## 1. Intent & Purpose

Rezekify is an autonomous personal finance management platform engineered around daily runway predictability, double-entry ledger immutability, and zero floating-point drift. While individual units and components are tested with isolated in-memory fixtures and mocked API handlers, verifying real-world system behavior requires a comprehensive, continuous end-to-end user journey executed against the production Docker container stack.

This specification defines the test architecture, execution workflow, assertion gates, and cleanup mechanisms for the **Master Full-App User Journey E2E Test Suite**. The suite simulates a real user performing their complete initial setup and financial cycle operations in a single uninterrupted browser session against `http://localhost:80`.

---

## 2. Target Environment & Stack Topology

The test suite runs against the multi-container Docker composition defined in `docker-compose.yml`:

```
                                  [ Playwright E2E Suite ]
                                             |
                                             v  HTTP Port 80
+-----------------------------------------------------------------------------------------+
| Docker Network (`rezekify_net`)                                                         |
|                                                                                         |
|  +-----------------------+           +-----------------------+                          |
|  |   rezekify_frontend   |           |   rezekify_backend    |                          |
|  |     (Nginx Proxy)     | --------> |   (FastAPI Core)      |                          |
|  |  - Serves React SPA   |  /api/v1  |  - Port 8000 (Internal|                          |
|  |  - Port 80 (Exposed)  |           |  - SQLAlchemy 2.0     |                          |
|  +-----------------------+           +-----------------------+                          |
|                                                  |                                      |
|                                                  v :5432                                |
|                                      +-----------------------+                          |
|                                      |      rezekify_db      |                          |
|                                      |    (PostgreSQL 16)    |                          |
|                                      |  - Strict Foreign Keys|                          |
|                                      |  - CASCADE Deletions  |                          |
|                                      +-----------------------+                          |
+-----------------------------------------------------------------------------------------+
```

### 2.1 Environmental Invariants
- **Nginx Reverse Proxy (`http://localhost:80`)**: Routes root traffic `/` and static SPA assets (`index.html`, `/assets/*`) directly; proxies `/api/v1/*` to `rezekify_backend:8000`.
- **Database Engine (`rezekify_db`)**: PostgreSQL 16 on internal port 5432 with persistent volume `rezekify_postgres_data`.
- **Stateless Session Tokens**: Bearer JWT tokens stored in browser `localStorage` (`auth_token` and `rezekify_auth_token`), evaluated on every HTTP API request via `Authorization: Bearer <token>`.

---

## 3. Test Account Lifecycle & Idempotency Strategy

To guarantee strict repeatability and prevent data collision across test runs:

### 3.1 Dynamic Identity Generation
Each test run generates a cryptographically unique email address:
- **Email Pattern**: `e2e_master_<uuid4_short>@rezekify.id` (e.g., `e2e_master_a1b2c3d4@rezekify.id`)
- **Password**: `Password123!`
- **Full Name**: `Master Journey Tester`

### 3.2 Automated Registration
The test creates the account natively through the live UI form at `/register` using user interactions, verifying that the frontend auth flow, validation hooks, backend hashing (`bcrypt`), and JWT issuance function correctly in unison.

### 3.3 Teardown & Database Purge
Post-test cleanup is executed directly against PostgreSQL via container command or direct database connection:
```sql
DELETE FROM users WHERE email = 'e2e_master_<uuid4_short>@rezekify.id';
```
Because `accounts`, `vaults`, `categories`, `transactions`, and `user_settings` specify `ondelete="CASCADE"` on their `user_id` foreign keys, deleting the user record deterministically purges all associated ledger entries, accounts, vaults, and categories.

---

## 4. Master Journey Steps (Single Continuous Browser Session)

The master journey executes as a single, stateful browser scenario in chronological sequence.

```
+---------------------------------------------------------------------------------------------+
|                                MASTER USER JOURNEY TIMELINE                                 |
+---------------------------------------------------------------------------------------------+
|                                                                                             |
| 1. Landing Page   --> 2. Register & Auth --> 3. Financial Setup --> 4. Category Budget      |
|    - Hero Stats          - Auto-login JWT       - Bank: BCA 5jt        - "Kuliner & Jajan"  |
|    - CTA Click           - Land /dashboard      - Debt: GoPay 500k     - Limit Rp 1jt       |
|                                                 - Capsule Strip                             |
|                                                                                             |
| 5. Vault Commit   --> 6. Transactions    --> 7. 3-Tab Analytics --> 8. Ledger Audit         |
|    - Wifi 350k           - Soto Rp 50k          - Monthly Donut        - Double-entry row   |
|    - Locked state        - Runway recalc        - Cashflow Gauge       - Mutasi verified    |
|                          - Uang Bebas 4.6jt     - F5 Persistence                            |
|                                                                                             |
| 9. Logout & Teardown                                                                        |
|    - Session clear                                                                          |
|    - Landing redirect                                                                       |
|    - Postgres user purge                                                                    |
+---------------------------------------------------------------------------------------------+
```

---

### Step 1: Landing Page & Telemetry Verification
1. **Navigation**: Browser navigates to `http://localhost:80/`.
2. **Telemetry Verification**:
   - Verify presence of the top badge `"AI-Powered Personal Finance"`.
   - Verify `"Live AI Telemetry"` card is mounted with active indicator.
   - Verify hero balance `"Total Saldo Terkelola"` displays `"Rp 5.250.000"`.
3. **Action**:
   - Locate CTA button `"Mulai Sekarang"` in the hero section.
   - Click the button.
4. **Assertion**:
   - Browser navigates to `http://localhost:80/register`.
   - URL matches `**/register`.

---

### Step 2: Registration & Authentication
1. **Context**: Page mounts `AuthPage.tsx` at `/register`.
2. **Form Interaction**:
   - Ensure registration tab is active (click tab button `"Daftar Akun"` if initial view is login).
   - Fill input `#auth-fullname` with `"Master Journey Tester"`.
   - Fill input `#auth-email` with generated test email (`e2e_master_<uuid>@rezekify.id`).
   - Fill input `#auth-password` with `"Password123!"`.
3. **Submission**:
   - Click submit button (`button[type="submit"]`: `"Daftar Akun"`).
4. **Assertion**:
   - Network call `POST /api/v1/auth/register` responds with status `200 OK` and `{ access_token, user }`.
   - `localStorage.getItem('auth_token')` is populated.
   - Page redirects automatically to `/dashboard`.
   - Welcome/onboarding state renders without errors.

---

### Step 3: Financial Setup (Liquid & Liability Accounts)
1. **Initial Account Creation (Bank)**:
   - Onboarding card or "+ Tambah Akun" trigger opens `AccountModal`.
   - Fill input `#account-name` with `"BCA Utama"`.
   - Select account type `BANK` (radio option `"Bank"`).
   - Fill input `#initial-balance` with `"5000000"` (Rp 5.000.000).
   - Click submit button `"Simpan Akun"`.
   - Assert modal closes and `POST /api/v1/accounts` responds `200 OK`.
2. **Liability Account Creation (PayLater)**:
   - Click button `+ Tambah Akun` on the Account Capsule Strip.
   - Fill input `#account-name` with `"GoPay Later"`.
   - Select account type `LIABILITY` (radio option `"PayLater / Kredit"`).
   - Fill input `#initial-balance` with `"500000"` (Rp 500.000 debt).
   - Click submit button `"Simpan Akun"`.
   - Assert modal closes and `POST /api/v1/accounts` responds `200 OK`.
3. **Account Capsule Strip Assertion**:
   - Locate `div[data-testid="account-capsule-strip"]`.
   - Verify capsule 1 renders text `"BCA Utama:"` with `"Rp 5.000.000"`.
   - Verify capsule 2 renders text `"GoPay Later:"` with `"Tagihan Rp 500.000"`.
   - Verify capsule 2 features rose warning styling and button `"Lunasi"`.

---

### Step 4: Category Budget Management
1. **Modal Trigger**:
   - Navigate to `LedgerView` (`Buku Besar`) or use quick action to click `+ Kategori`.
   - `CategoryManagerModal` opens.
2. **Category Configuration**:
   - Select tab `"Pengeluaran"` (`EXPENSE`).
   - Fill input `#category-name-input` with `"Kuliner & Jajan"`.
   - Set monthly budget limit by clicking quick chip `+1jt` (`button:has-text("+1jt")`) or typing `1000000` into `#category-budget-input`.
   - Verify `#category-budget-input` formats as `"1.000.000"`.
   - Select accent color (Emerald or Amber) and category icon.
   - Click submit button `"Tambah Kategori"`.
3. **Assertion**:
   - Network call `POST /api/v1/categories` responds `200 OK`.
   - Success alert banner displays `"Kategori "Kuliner & Jajan" berhasil ditambahkan."`.
   - Category `"Kuliner & Jajan"` appears under the expense list with `"Batas: Rp 1.000.000 / bulan"`.
   - Close modal via close button.

---

### Step 5: Sinking Fund Vault Commitment
1. **Modal Trigger**:
   - In sidebar menu, click `"Komitmen & Vaults"`.
   - On `VaultsView`, click button `+ Tambah Vault`.
   - `VaultModal` opens.
2. **Vault Setup**:
   - Fill input `#vault-name` with `"Tagihan Wifi"`.
   - Select type `"Tagihan Tetap"` (`FIXED_BILL`).
   - Fill input `#target-amount` with `"350000"` (Rp 350.000).
   - Fill input `#allocated-amount` with `"350000"` (Rp 350.000).
   - Set `#target-date` to current cycle due date (e.g. 5 days from today).
   - Check toggle `#is_locked_toggle` (`Kunci Dana Komitmen`).
   - Click submit button `"Simpan Komitmen"`.
3. **Assertion**:
   - Network call `POST /api/v1/vaults` responds `200 OK`.
   - Vault card `"Tagihan Wifi"` renders in `VaultsView` with lock icon (`Lock`), progress `100%`, and allocated `"Rp 350.000"`.

---

### Step 6: Transactions & Runway Impact
1. **Transaction Entry**:
   - Navigate to `Ringkasan` (Overview view).
   - Focus `QuickCaptureBar` input or open `ManualTransactionModal`.
   - Enter expense: `"Makan Siang Soto Rp 50.000"` under category `"Kuliner & Jajan"` from account `"BCA Utama"`.
   - Submit transaction.
2. **Mathematical Invariant Verification**:
   - **Total Liquid Cash**: $\text{Rp 5.000.000} - \text{Rp 50.000} = \text{Rp 4.950.000}$.
   - **Vault Locked Cash**: $\text{Rp 350.000}$ (locked in "Tagihan Wifi").
   - **Operational Free Cash (Uang Bebas Pakai)**: $\text{Rp 4.950.000} - \text{Rp 350.000} = \text{Rp 4.600.000}$.
   - **Daily Safe Runway**: Deterministically equals $\frac{\text{Rp 4.600.000}}{\text{days\_remaining}}$ (rounded to integer cents).
3. **UI Assertions**:
   - Bento KPI card `"Uang Bebas Pakai"` displays `"Rp 4.600.000"`.
   - KPI card `"Jatah Belanja Hari Ini"` updates safely above threshold (`Sangat Aman`).

---

### Step 7: 3-Tab Analytics & Persistence
1. **Monthly Breakdown (`Bulanan`)**:
   - Click tab button `"Bulanan (Monthly)"` in `ExpenseCharts`.
   - Verify SVG Donut chart renders active arc with center total `"Rp 50rb"`.
   - In category list, locate `"Kuliner & Jajan"`.
   - Verify budget badge displays `"Sisa Rp 950.000"` with emerald status icon (`CheckCircle2`).
   - Verify budget progress bar displays `5% terpakai`.
2. **Cashflow Breakdown (`Arus Kas`)**:
   - Click tab button `"Arus Kas (Cashflow)"`.
   - Verify URL search params update to `?period=cashflow`.
   - Verify Bi-directional SVG Donut gauge mounts (`div[data-testid="cashflow-canvas-container"]`).
   - Verify Net Cashflow (`Arus Kas Bersih`) row renders.
   - Verify savings rate gauge center displays numeric percentage (`[data-testid="center-savings-rate"]`).
3. **URL & Layout Persistence**:
   - Perform full page refresh (`page.reload()` / F5).
   - Assert URL retains `?period=cashflow`.
   - Assert `ExpenseCharts` re-hydrates directly into the Cashflow view.
   - Assert no Cumulative Layout Shift (container height remains steady at `min-h-[380px]`).

---

### Step 8: Ledger Audit Trail
1. **Navigation**:
   - Click `"Buku Besar"` in sidebar navigation (`activeView = 'ledger'`).
2. **Ledger Table Assertions**:
   - Verify transaction table renders recorded item:
     - Description: `"Makan Siang Soto"`.
     - Category badge: `"Kuliner & Jajan"`.
     - Account: `"BCA Utama"`.
     - Nominal: `"-Rp 50.000"` (Debit).
   - Verify audit trail counter reflects total recorded transactions.

---

### Step 9: Logout & Session Invalidation
1. **Action**:
   - Click sidebar logout button (`button[aria-label="Keluar (Logout)"]`).
2. **Assertion**:
   - Browser tokens cleared: `localStorage.getItem('auth_token') === null`.
   - Redirect to landing page `/` or `/login`.
   - Direct navigation to `/dashboard` redirects back to `/login`.

---

### Teardown & Idempotency Hook
Post-scenario teardown executes via database command:
```sql
DELETE FROM users WHERE email = 'e2e_master_<uuid>@rezekify.id';
```
Verify zero orphaned records remain in `accounts`, `vaults`, `transactions`, and `categories`.

---

## 5. Playwright Implementation Details

### 5.1 Test File Location
- **Spec Path**: `frontend/e2e/master-journey.spec.ts`
- **Config**: Uses `baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:80'`

### 5.2 Deterministic Selectors & Attributes

| Element / Action | Locator / Selector Strategy |
|---|---|
| Landing Hero CTA | `button:has-text("Mulai Sekarang")` |
| Auth Switcher | `button:has-text("Daftar Akun")` |
| Auth Inputs | `#auth-fullname`, `#auth-email`, `#auth-password` |
| Capsule Strip | `[data-testid="account-capsule-strip"]` |
| Account Modal | `#account-name`, `#initial-balance`, `button:has-text("Simpan Akun")` |
| Category Modal | `#category-name-input`, `#category-budget-input`, `button:has-text("Tambah Kategori")` |
| Vault Modal | `#vault-name`, `#target-amount`, `#allocated-amount`, `#is_locked_toggle` |
| Quick Capture | `input[placeholder*="Ketik mutasi"]` |
| Analytics Tabs | `div[role="tablist"] button[role="tab"]` |
| Cashflow Container | `[data-testid="cashflow-canvas-container"]` |
| Logout Button | `button[aria-label="Keluar (Logout)"]` |

---

## 6. Definition of Done

1. **Spec Approval**: Spec document committed to `docs/superpowers/specs/2026-10-24-master-full-app-journey-e2e-design.md`.
2. **Branch Hygiene**: Work committed on branch `feat/master-full-app-journey-e2e`.
3. **Single Session Continuity**: The entire 9-step journey executes sequentially in a single continuous browser context.
4. **Zero Flakiness**: All assertions rely on explicit element states and network responses, with zero hard-coded sleeps.
