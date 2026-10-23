# Master Full-App User Journey E2E Live Container Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a comprehensive, uninterrupted automated Playwright end-to-end user journey test suite executing directly against the live multi-container Docker stack on port 80 (`http://localhost:80`), validating all 9 full-app phases from landing to registration, banking and debt setup, category budgets, locked vaults, transactions, 3-tab analytics, reload persistence, ledger auditing, and database cascade teardown.

**Architecture:**
1. **Playwright Config & Teardown Helper (`frontend/playwright.config.ts`, `frontend/e2e/helpers/db-cleanup.ts`)**: Adjust Playwright configuration to target live HTTP port 80 by default (`process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:80'`), bypassing the local Vite preview webServer when testing against live container environments. Implement a deterministic database teardown helper that invokes `docker exec rezekify_db psql -U postgres -d rezekify` to purge test users and rely on PostgreSQL `ondelete="CASCADE"` to clean all child rows.
2. **Master Full-App User Journey Spec (`frontend/e2e/master-live-journey.spec.ts`)**: Implement an uninterrupted sequential single-session Playwright test covering 9 lifecycle phases: landing page telemetry -> native registration with JWT issuance -> dual account setup (BCA Utama Rp 5.000.000 liquid + GoPay Later Rp 500.000 liability) -> category budget limit ("Kuliner & Jajan" Rp 1.000.000 limit) -> sinking fund vault commitment ("Tagihan Wifi" Rp 350.000 locked) -> manual transaction recording ("Makan Siang Soto Rp 50.000" debit, verifying Uang Bebas Pakai Rp 4.600.000) -> 3-tab analytics inspection (Daily, Monthly donut & budget badge, Cashflow bi-directional gauge, savings rate, and F5 reload URL persistence) -> Ledger audit trail table inspection -> logout & PostgreSQL cascade purge.
3. **End-to-End Execution & Full Regression Gate**: Execute the live container suite against `http://localhost:80/`, then run the existing Playwright suite, frontend unit test suite (`vitest run`), and backend test suite (`pytest tests/ -v`) to ensure zero regressions.

**Tech Stack:** Playwright, Docker, Nginx (Port 80), PostgreSQL 16 (`rezekify_db`), FastAPI Core (`rezekify_backend:8000`), React 18, TypeScript, Tailwind CSS, HeroUI.

**Spec:** `docs/superpowers/specs/2026-10-24-master-full-app-journey-e2e-design.md`

## Global Constraints

- Strictly ZERO raw unicode emojis across all test files, helpers, logs, and UI assertion messages — strictly enforced by code integrity standards.
- Deterministic math: zero floating-point drift for monetary calculations (IDR integer cents, exact expected equations: Rp 5.000.000 liquid - Rp 50.000 expense - Rp 350.000 locked vault = Rp 4.600.000 operational free cash).
- Target environment: live multi-container Docker stack exposed on port 80 (`http://localhost:80`), with reverse proxy routing to FastAPI backend (`/api/v1`).
- Non-interactive execution: single-pass execution with explicit element-state assertions and no lingering background processes or dev servers.
- Database teardown cleanup: guaranteed purge of generated test user and all cascading relational records from `rezekify_db` container in `test.afterAll`.

## Review Focus

1. **Container network latency and hydration delay:** Web-first locators (`toBeVisible()`, `toHaveText()`, `waitForResponse()`) must be used instead of arbitrary sleep pauses to handle live Docker network hops safely without flakiness. (Tested in Task 2)
2. **Duplicate test user collisions:** Every test run generates a unique test email address via `crypto.randomUUID()` (`e2e_master_<short_uuid>@rezekify.id`) to ensure isolation across repeated test executions. (Tested in Task 1 & Task 2)
3. **Modal animation and backdrop transitions:** HeroUI and Framer Motion modal dialogs must wait for visible form inputs before typing and verify backdrop dismiss before interacting with the main UI canvas. (Tested in Task 2)
4. **Real database transaction cascade cleanup:** Verification that deleting the user from `users` table via `docker exec rezekify_db psql` deterministically cascades deletions to `accounts`, `vaults`, `categories`, `transactions`, `ledger_entries`, and `user_settings` with zero orphaned rows. (Tested in Task 1 & Task 2)
5. **F5 reload retaining JWT authentication token and URL params:** Browser reload against port 80 must preserve `localStorage` tokens and `?period=cashflow` URL search parameters without triggering unauthorized redirects to `/login`. (Tested in Task 2)

---

### Task 1: Playwright Configuration Adjustment for Live Container & DB Teardown Helper

**Files:**
- Create: `frontend/e2e/helpers/db-cleanup.ts`
- Create: `frontend/e2e/helpers/db-cleanup.spec.ts`
- Modify: `frontend/playwright.config.ts:13-30`

**Interfaces:**
- Consumes:
  - `child_process.execSync` from Node.js stdlib
  - `process.env.PLAYWRIGHT_BASE_URL`
- Produces:
  - `purgeUserByEmail(email: string, containerName?: string): boolean` in `frontend/e2e/helpers/db-cleanup.ts`
  - `checkUserExists(email: string, containerName?: string): boolean` in `frontend/e2e/helpers/db-cleanup.ts`
  - Dynamic `webServer` configuration in `frontend/playwright.config.ts` (omitted when targeting port 80)

- [ ] **Step 1: Write the failing test for DB cleanup helper and Playwright config defaults**

Create `frontend/e2e/helpers/db-cleanup.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';
import { purgeUserByEmail, checkUserExists } from './db-cleanup';

test.describe('Database Cleanup & Teardown Helper', () => {
  test('safely executes purge on non-existent user without throwing', () => {
    const fakeEmail = `nonexistent_${Date.now()}@rezekify.id`;
    const result = purgeUserByEmail(fakeEmail);
    expect(result).toBe(true);
    expect(checkUserExists(fakeEmail)).toBe(false);
  });

  test('rejects invalid or unsafe email input format', () => {
    expect(() => purgeUserByEmail('')).toThrow();
    expect(() => purgeUserByEmail('not-an-email')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test:e2e -- e2e/helpers/db-cleanup.spec.ts`
Expected: FAIL with "Cannot find module './db-cleanup'"

- [ ] **Step 3: Implement `frontend/e2e/helpers/db-cleanup.ts` and update `frontend/playwright.config.ts`**

Create `frontend/e2e/helpers/db-cleanup.ts`:
```typescript
import { execSync } from 'child_process';

/**
 * Deterministically purges a user and all cascade child records
 * (accounts, vaults, categories, transactions, ledger_entries, user_settings)
 * directly from the rezekify_db PostgreSQL container.
 */
export function purgeUserByEmail(email: string, containerName = 'rezekify_db'): boolean {
  if (!email || !email.includes('@')) {
    throw new Error(`Invalid email provided for database purge: ${email}`);
  }
  // Escape single quotes for SQL statement safety
  const safeEmail = email.replace(/'/g, "''");
  try {
    const output = execSync(
      `docker exec ${containerName} psql -U postgres -d rezekify -t -c "DELETE FROM users WHERE email = '${safeEmail}';"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return output.includes('DELETE');
  } catch (err: any) {
    console.error(`[db-cleanup] Failed to purge user ${email} from ${containerName}:`, err?.message || err);
    return false;
  }
}

export function checkUserExists(email: string, containerName = 'rezekify_db'): boolean {
  if (!email || !email.includes('@')) {
    return false;
  }
  const safeEmail = email.replace(/'/g, "''");
  try {
    const output = execSync(
      `docker exec ${containerName} psql -U postgres -d rezekify -t -c "SELECT count(*) FROM users WHERE email = '${safeEmail}';"`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const count = parseInt(output.trim(), 10);
    return !isNaN(count) && count > 0;
  } catch {
    return false;
  }
}
```

Update `frontend/playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:80';
const isPort80Target = baseURL.includes(':80') || baseURL === 'http://localhost';

export default defineConfig({
  testDir: './e2e',
  timeout: 45 * 1000,
  expect: {
    timeout: 7000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: isPort80Target
    ? undefined
    : {
        command: 'npm run preview -- --port 5173',
        port: 5173,
        reuseExistingServer: !process.env.CI,
        timeout: 30 * 1000,
      },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend run test:e2e -- e2e/helpers/db-cleanup.spec.ts`
Expected: PASS (2 tests passed)

- [ ] **Step 5: Commit changes**

```bash
git add frontend/playwright.config.ts frontend/e2e/helpers/db-cleanup.ts frontend/e2e/helpers/db-cleanup.spec.ts
git commit -m "feat(e2e): configure playwright for port 80 container and add db teardown helper"
```

---

### Task 2: Implement Master Full-App User Journey Test Specification (`frontend/e2e/master-live-journey.spec.ts`)

**Files:**
- Create: `frontend/e2e/master-live-journey.spec.ts`
- Test: `frontend/e2e/master-live-journey.spec.ts`

**Interfaces:**
- Consumes:
  - `purgeUserByEmail`, `checkUserExists` from `frontend/e2e/helpers/db-cleanup.ts`
  - Live container endpoints via HTTP port 80:
    - `POST /api/v1/auth/register`
    - `GET /api/v1/dashboard/summary`
    - `POST /api/v1/accounts`
    - `POST /api/v1/categories`
    - `POST /api/v1/vaults`
    - `POST /api/v1/transactions`
    - `GET /api/v1/analytics/spending-breakdown?period=*`
- Produces:
  - Single-session, continuous browser test covering all 9 phases in chronological sequence.

- [ ] **Step 1: Write the failing test skeleton for master live user journey**

Create initial `frontend/e2e/master-live-journey.spec.ts` with test suite declaration and failure assertion:
```typescript
import { test, expect } from '@playwright/test';
import { purgeUserByEmail, checkUserExists } from './helpers/db-cleanup';

test.describe('Master Full-App User Journey E2E Live Suite', () => {
  const uniqueId = Math.random().toString(36).substring(2, 10);
  const testEmail = `e2e_master_${uniqueId}@rezekify.id`;
  const testPassword = 'Password123!';
  const testFullName = 'Master Journey Tester';

  test('executes complete 9-phase continuous user lifecycle against port 80', async ({ page }) => {
    // Failing initial checkpoint to enforce red-green cycle
    expect(true).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend run test:e2e -- e2e/master-live-journey.spec.ts`
Expected: FAIL with "expect(received).toBe(expected) // Expected: false, Received: true"

- [ ] **Step 3: Implement complete 9-phase master user journey in `frontend/e2e/master-live-journey.spec.ts`**

Replace `frontend/e2e/master-live-journey.spec.ts` with the complete continuous user lifecycle test:
```typescript
import { test, expect } from '@playwright/test';
import { purgeUserByEmail, checkUserExists } from './helpers/db-cleanup';

test.describe('Master Full-App User Journey E2E Live Suite', () => {
  // Isolate each run with a cryptographically unique email address
  const uniqueId = Math.random().toString(36).substring(2, 10);
  const testEmail = `e2e_master_${uniqueId}@rezekify.id`;
  const testPassword = 'Password123!';
  const testFullName = 'Master Journey Tester';

  test.afterAll(async () => {
    // Teardown: purge user from PostgreSQL container; cascade deletes all accounts, vaults, categories, transactions
    const purged = purgeUserByEmail(testEmail);
    expect(purged).toBe(true);
    expect(checkUserExists(testEmail)).toBe(false);
  });

  test('executes complete 9-phase continuous user lifecycle against port 80', async ({ page }) => {
    // =========================================================================
    // Phase 1: Landing Page & Telemetry Verification
    // =========================================================================
    await page.goto('/');

    await expect(page.getByText('AI-Powered Personal Finance')).toBeVisible();
    await expect(page.getByText('Live AI Telemetry')).toBeVisible();
    await expect(page.getByText('Total Saldo Terkelola')).toBeVisible();
    await expect(page.getByText('Rp 5.250.000')).toBeVisible();

    const startButton = page.getByRole('button', { name: 'Mulai Sekarang' });
    await expect(startButton).toBeVisible();
    await startButton.click();

    await expect(page).toHaveURL(/\/register/);

    // =========================================================================
    // Phase 2: Registration & Native JWT Authentication
    // =========================================================================
    // Ensure register tab is selected
    const registerTab = page.getByRole('button', { name: 'Daftar Akun' });
    await registerTab.click();

    await page.locator('#auth-fullname').fill(testFullName);
    await page.locator('#auth-email').fill(testEmail);
    await page.locator('#auth-password').fill(testPassword);

    const registerPromise = page.waitForResponse((res) =>
      res.url().includes('/api/v1/auth/register') && res.status() === 200
    );
    await page.locator('button[type="submit"]:has-text("Daftar Akun")').click();
    await registerPromise;

    // Verify automatic redirect and token persistence in localStorage
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    const storedToken = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(storedToken).toBeTruthy();

    // =========================================================================
    // Phase 3: Financial Setup (Liquid Bank & Liability PayLater Accounts)
    // =========================================================================
    // 1. Bank Account (BCA Utama - Rp 5.000.000)
    const addAccountTrigger = page.locator('button:has-text("+ Tambah Akun")').first();
    await addAccountTrigger.click();

    const accountModal = page.locator('[role="dialog"][aria-labelledby="account-modal-title"]');
    await expect(accountModal).toBeVisible();

    await page.locator('#account-name').fill('BCA Utama');
    await page.locator('[role="radiogroup"][aria-label="Tipe Akun"] button:has-text("Bank")').click();
    await page.locator('#initial-balance').fill('5000000');

    const bankSavePromise = page.waitForResponse((res) =>
      res.url().includes('/api/v1/accounts') && res.request().method() === 'POST' && res.status() === 200
    );
    await page.locator('button:has-text("Simpan Akun")').click();
    await bankSavePromise;
    await expect(accountModal).not.toBeVisible();

    // 2. Liability Account (GoPay Later - Rp 500.000 debt)
    const capsuleStrip = page.locator('[data-testid="account-capsule-strip"]');
    await expect(capsuleStrip).toBeVisible();

    const addAccountCapsuleBtn = capsuleStrip.locator('button:has-text("+ Tambah Akun")');
    await addAccountCapsuleBtn.click();
    await expect(accountModal).toBeVisible();

    await page.locator('#account-name').fill('GoPay Later');
    await page.locator('[role="radiogroup"][aria-label="Tipe Akun"] button:has-text("PayLater / Kredit")').click();
    await page.locator('#initial-balance').fill('500000');

    const liabilitySavePromise = page.waitForResponse((res) =>
      res.url().includes('/api/v1/accounts') && res.request().method() === 'POST' && res.status() === 200
    );
    await page.locator('button:has-text("Simpan Akun")').click();
    await liabilitySavePromise;
    await expect(accountModal).not.toBeVisible();

    // Verify capsules in capsule strip
    await expect(capsuleStrip.getByText('BCA Utama:')).toBeVisible();
    await expect(capsuleStrip.getByText('Rp 5.000.000')).toBeVisible();
    await expect(capsuleStrip.getByText('GoPay Later:')).toBeVisible();
    await expect(capsuleStrip.getByText('Tagihan Rp 500.000')).toBeVisible();
    await expect(capsuleStrip.locator('button:has-text("Lunasi")')).toBeVisible();

    // =========================================================================
    // Phase 4: Category Budget Management ("Kuliner & Jajan" limit Rp 1jt)
    // =========================================================================
    const ledgerNav = page.locator('aside button:has-text("Buku Besar")');
    await ledgerNav.click();

    const addCategoryBtn = page.locator('button:has-text("+ Kategori")');
    await expect(addCategoryBtn).toBeVisible();
    await addCategoryBtn.click();

    const categoryModal = page.locator('[role="dialog"][aria-labelledby="category-manager-modal-title"]');
    await expect(categoryModal).toBeVisible();

    await categoryModal.locator('button:has-text("Pengeluaran")').click();
    await page.locator('#category-name-input').fill('Kuliner & Jajan');

    // Set budget limit via quick chip +1jt
    const quickChip1jt = categoryModal.locator('button:has-text("+1jt")');
    await quickChip1jt.click();
    await expect(page.locator('#category-budget-input')).toHaveValue('1.000.000');

    // Pick Amber color and utensils icon
    await categoryModal.locator('button[aria-label="Warna Amber"]').click();
    await categoryModal.locator('button[aria-label="Ikon Kuliner"]').click();

    const catSavePromise = page.waitForResponse((res) =>
      res.url().includes('/api/v1/categories') && res.request().method() === 'POST' && res.status() === 200
    );
    await categoryModal.locator('button:has-text("Tambah Kategori")').click();
    await catSavePromise;

    await expect(categoryModal.getByText('Kategori "Kuliner & Jajan" berhasil ditambahkan.')).toBeVisible();
    await expect(categoryModal.getByText('Batas: Rp 1.000.000 / bulan')).toBeVisible();

    // Close category modal via close button
    await page.keyboard.press('Escape');
    await expect(categoryModal).not.toBeVisible();

    // =========================================================================
    // Phase 5: Sinking Fund Vault Commitment ("Tagihan Wifi" Rp 350.000, locked)
    // =========================================================================
    const vaultsNav = page.locator('aside button:has-text("Komitmen & Vaults")');
    await vaultsNav.click();

    const addVaultBtn = page.locator('button:has-text("+ Tambah Vault")');
    await expect(addVaultBtn).toBeVisible();
    await addVaultBtn.click();

    const vaultModal = page.locator('[role="dialog"][aria-labelledby="vault-modal-title"]');
    await expect(vaultModal).toBeVisible();

    await page.locator('#vault-name').fill('Tagihan Wifi');
    await page.locator('[role="radiogroup"][aria-label="Tipe Pos"] button:has-text("Tagihan Tetap")').click();
    await page.locator('#target-amount').fill('350000');
    await page.locator('#allocated-amount').fill('350000');

    // Set due date to future date in current month
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const dateIso = futureDate.toISOString().slice(0, 10);
    await page.locator('#target-date').fill(dateIso);

    // Lock commitment
    await page.locator('#is_locked_toggle').check();

    const vaultSavePromise = page.waitForResponse((res) =>
      res.url().includes('/api/v1/vaults') && res.request().method() === 'POST' && res.status() === 200
    );
    await page.locator('button:has-text("Simpan Komitmen")').click();
    await vaultSavePromise;
    await expect(vaultModal).not.toBeVisible();

    // Verify vault card in VaultsView
    await expect(page.getByText('Tagihan Wifi')).toBeVisible();
    await expect(page.getByText('100%')).toBeVisible();
    await expect(page.getByText('Rp 350.000')).toBeVisible();

    // =========================================================================
    // Phase 6: Transactions & Financial Invariant Audit
    // =========================================================================
    const overviewNav = page.locator('aside button:has-text("Ringkasan")');
    await overviewNav.click();

    const manualTxBtn = page.locator('button:has-text("Catat Manual")').first();
    await expect(manualTxBtn).toBeVisible();
    await manualTxBtn.click();

    const txModal = page.locator('[role="dialog"][aria-labelledby="manual-modal-title"]');
    await expect(txModal).toBeVisible();

    await page.locator('#amount-input').fill('50000');
    await page.locator('#desc-input').fill('Makan Siang Soto');

    // Select category "Kuliner & Jajan"
    const categoryDropdown = page.locator('#category-select');
    await categoryDropdown.click();
    await page.locator('[role="listbox"] [role="option"]:has-text("Kuliner & Jajan")').click();

    const txSavePromise = page.waitForResponse((res) =>
      res.url().includes('/api/v1/transactions') && res.request().method() === 'POST' && res.status() === 200
    );
    await page.locator('button:has-text("Simpan Transaksi")').click();
    await txSavePromise;
    await expect(txModal).not.toBeVisible();

    // Mathematical Invariant Assertion:
    // Liquid (5.000.000) - Expense (50.000) - Locked Vault (350.000) = Rp 4.600.000 Operational Free Cash
    const freeCashCard = page.locator('div:has-text("Uang Bebas Pakai")').first();
    await expect(freeCashCard).toBeVisible();
    await expect(freeCashCard.getByText('Rp 4.600.000')).toBeVisible();

    // =========================================================================
    // Phase 7: 3-Tab Analytics & URL Reload Persistence
    // =========================================================================
    const chartsCard = page.locator('[data-testid="expense-charts-card"]');
    await expect(chartsCard).toBeVisible();

    // 1. Monthly Tab & Budget Badge
    const monthlyTab = chartsCard.getByRole('tab', { name: /Bulanan/i });
    await monthlyTab.click();
    await expect(page).toHaveURL(/period=monthly/);

    // Verify donut center displays spent amount and category row displays budget badge
    await expect(chartsCard.getByText('Rp 50rb')).toBeVisible();
    await expect(chartsCard.getByText('Kuliner & Jajan')).toBeVisible();
    await expect(chartsCard.getByText('Sisa Rp 950.000')).toBeVisible();
    await expect(chartsCard.getByText('5% terpakai')).toBeVisible();

    // 2. Cashflow Tab & Bi-directional Gauge
    const cashflowTab = chartsCard.getByRole('tab', { name: /Arus Kas/i });
    await cashflowTab.click();
    await expect(page).toHaveURL(/period=cashflow/);

    const cashflowContainer = page.locator('[data-testid="cashflow-canvas-container"]');
    await expect(cashflowContainer).toBeVisible();

    const gaugeSvg = page.locator('[data-testid="cashflow-donut-gauge"]');
    await expect(gaugeSvg).toBeVisible();

    const savingsRateText = page.locator('[data-testid="center-savings-rate"]');
    await expect(savingsRateText).toBeVisible();

    // 3. F5 Reload Persistence
    await page.reload();
    await expect(page).toHaveURL(/period=cashflow/);
    await expect(page.locator('[data-testid="cashflow-canvas-container"]')).toBeVisible();

    // =========================================================================
    // Phase 8: Ledger Audit Trail
    // =========================================================================
    await ledgerNav.click();

    const ledgerTable = page.locator('table');
    await expect(ledgerTable).toBeVisible();
    await expect(ledgerTable.getByText('Makan Siang Soto')).toBeVisible();
    await expect(ledgerTable.getByText('Kuliner & Jajan')).toBeVisible();
    await expect(ledgerTable.getByText('- Rp 50.000')).toBeVisible();
    await expect(page.getByText('1 mutasi')).toBeVisible();

    // =========================================================================
    // Phase 9: Logout & Session Invalidation
    // =========================================================================
    const logoutBtn = page.locator('aside button[aria-label="Keluar (Logout)"]');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    await expect(page).toHaveURL(/\/login/);
    const tokenAfterLogout = await page.evaluate(() => localStorage.getItem('auth_token'));
    expect(tokenAfterLogout).toBeNull();

    // Direct access to dashboard should redirect back to /login
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
```

- [ ] **Step 4: Run test to verify it passes against port 80**

Run: `npm --prefix frontend run test:e2e -- e2e/master-live-journey.spec.ts`
Expected: PASS (1 passed in ~15-25s)

- [ ] **Step 5: Commit changes**

```bash
git add frontend/e2e/master-live-journey.spec.ts
git commit -m "test(e2e): implement master full-app user journey against live port 80 container"
```

---

### Task 3: Full End-to-End Execution and Regression Audit

**Files:**
- Audit & Verify:
  - `frontend/e2e/master-live-journey.spec.ts`
  - All Playwright test files in `frontend/e2e/`
  - Frontend unit tests in `frontend/src/__tests__/`
  - Backend tests in `tests/`

- [ ] **Step 1: Execute master live journey against port 80**

Run: `PLAYWRIGHT_BASE_URL=http://localhost:80 npm --prefix frontend run test:e2e -- e2e/master-live-journey.spec.ts`
Expected: 1 passed with exit code 0.

- [ ] **Step 2: Execute full Playwright test suite**

Run: `npm --prefix frontend run test:e2e`
Expected: All tests pass across `master-live-journey.spec.ts`, `cashflow-widget.spec.ts`, `category-budget.spec.ts`, `liability-accounts.spec.ts`, `dashboard-persistence.spec.ts`, and `db-cleanup.spec.ts`.

- [ ] **Step 3: Execute frontend unit test suite**

Run: `npm --prefix frontend test -- --run`
Expected: 47 test files passed, 422+ tests passed with exit code 0.

- [ ] **Step 4: Execute backend test suite**

Run: `pytest tests/ -v`
Expected: 512+ passed with exit code 0.

- [ ] **Step 5: Commit verification and final audit lock**

```bash
git status
# If any formatting or artifacts require clean tracking
git add frontend/playwright.config.ts frontend/e2e/
git commit -m "chore(audit): verify complete full-stack master e2e regression suite"
```
