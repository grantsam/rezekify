import { test, expect } from '@playwright/test';
import { purgeUserByEmail, checkUserExists } from './helpers/db-cleanup';

test.describe('Master Full-App User Journey E2E Live Suite', () => {
  // Generate unique test email to prevent collisions across runs
  const uniqueId = Math.random().toString(36).substring(2, 10);
  const testEmail = `e2e_master_${uniqueId}@rezekify.id`;
  const testPassword = 'Password123!';
  const testFullName = 'Master Journey Tester';

  test.afterAll(async () => {
    // Teardown: purge user from PostgreSQL container; cascade deletes all related records
    const purged = purgeUserByEmail(testEmail);
    expect(purged).toBe(true);
    expect(checkUserExists(testEmail)).toBe(false);
  });

  test('executes complete 9-phase continuous user lifecycle against port 80', async ({ page }) => {
    test.setTimeout(60000);

    // =========================================================================
    // Phase 1: Landing Page
    // =========================================================================
    await page.goto('/');

    const heroHeading = page.getByRole('button', { name: /Mulai Sekarang/i }).first();
    await expect(heroHeading).toBeVisible();
    await expect(page.getByText('AI-Powered Personal Finance')).toBeVisible();

    await heroHeading.click();
    await expect(page).toHaveURL(/\/register/);

    // =========================================================================
    // Phase 2: Registration & Native JWT Authentication
    // =========================================================================
    const registerTab = page.getByRole('button', { name: 'Daftar Akun' });
    await registerTab.click();
    await expect(page.locator('#auth-fullname')).toBeVisible();

    await page.locator('#auth-fullname').fill(testFullName);
    await page.locator('#auth-email').fill(testEmail);
    await page.locator('#auth-password').fill(testPassword);

    await expect(page.locator('#auth-fullname')).toHaveValue(testFullName);
    await expect(page.locator('#auth-email')).toHaveValue(testEmail);

    const registerPromise = page.waitForResponse(
      (res) => res.url().includes('/api/v1/auth/register') && res.status() === 200
    );
    await page.locator('button[type="submit"]:has-text("Buat Akun Sekarang")').click();
    await registerPromise;

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    const token = await page.evaluate(
      () => localStorage.getItem('auth_token') || localStorage.getItem('rezekify_auth_token')
    );
    expect(token).toBeTruthy();

    // =========================================================================
    // Phase 3: Financial Setup (Liquid Bank & Liability PayLater Accounts)
    // =========================================================================
    // 1. Bank Account (BCA Utama - Rp 5.000.000)
    const addFirstAccountBtn = page.getByRole('button', { name: /Tambah (Akun|Rekening)/i }).first();
    await expect(addFirstAccountBtn).toBeVisible();
    await addFirstAccountBtn.click();

    await expect(page.locator('#account-name')).toBeVisible();
    await page.locator('#account-name').fill('BCA Utama');
    await page.locator('[role="radiogroup"][aria-label="Tipe Akun"] button:has-text("Bank")').click();
    await page.locator('#initial-balance').fill('5000000');

    const bankSavePromise = page.waitForResponse(
      (res) => res.url().includes('/api/v1/accounts') && res.request().method() === 'POST' && res.status() === 200
    );
    await page.locator('button:has-text("Simpan Akun")').click();
    await bankSavePromise;
    await expect(page.locator('#account-name')).not.toBeVisible();

    // 2. Liability Account (GoPay Later - Rp 500.000)
    const capsuleStrip = page.locator('[data-testid="account-capsule-strip"]');
    await expect(capsuleStrip).toBeVisible();

    const addSecondAccountBtn = capsuleStrip.getByRole('button', { name: /Tambah Akun/i });
    await addSecondAccountBtn.click();

    await expect(page.locator('#account-name')).toBeVisible();
    await page.locator('#account-name').fill('GoPay Later');
    await page.locator('[role="radiogroup"][aria-label="Tipe Akun"] button:has-text("PayLater / Kredit")').click();
    await page.locator('#initial-balance').fill('500000');

    const liabilitySavePromise = page.waitForResponse(
      (res) => res.url().includes('/api/v1/accounts') && res.request().method() === 'POST' && res.status() === 200
    );
    await page.locator('button:has-text("Simpan Akun")').click();
    await liabilitySavePromise;
    await expect(page.locator('#account-name')).not.toBeVisible();

    // Verify capsules in capsule strip
    await expect(capsuleStrip.getByText('BCA Utama:')).toBeVisible();
    await expect(capsuleStrip.getByText('Rp 5.000.000')).toBeVisible();
    await expect(capsuleStrip.getByText('GoPay Later:')).toBeVisible();
    await expect(capsuleStrip.getByText('Tagihan Rp 500.000')).toBeVisible();
    await expect(capsuleStrip.locator('button:has-text("Lunasi")')).toBeVisible();

    // =========================================================================
    // Phase 4: Category Budget Management
    // =========================================================================
    await page.locator('aside button:has-text("Buku Besar")').click();

    const addCategoryBtn = page.getByRole('button', { name: /\+ Kategori/i });
    await expect(addCategoryBtn).toBeVisible();
    await addCategoryBtn.click();

    await expect(page.locator('#category-name-input')).toBeVisible();
    await page.locator('#category-name-input').fill('Kuliner & Jajan');

    const quickChip1jt = page.locator('button:has-text("+1jt")');
    await quickChip1jt.click();
    await expect(page.locator('#category-budget-input')).toHaveValue('1.000.000');

    const catSavePromise = page.waitForResponse(
      (res) => res.url().includes('/api/v1/categories') && res.request().method() === 'POST' && res.status() === 200
    );
    await page.locator('button:has-text("Tambah Kategori")').click();
    await catSavePromise;

    await expect(page.getByText('Kategori "Kuliner & Jajan" berhasil ditambahkan.')).toBeVisible();
    await expect(page.getByText('Rp 1.000.000/bln').first()).toBeVisible();

    const closeCategoryModalBtn = page.locator(
      '[role="dialog"] button[aria-label="Close"], [role="dialog"] [data-slot="close-button"]'
    );
    if (await closeCategoryModalBtn.isVisible()) {
      await closeCategoryModalBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await expect(page.locator('#category-name-input')).not.toBeVisible();

    // =========================================================================
    // Phase 5: Sinking Fund Vault Commitment
    // =========================================================================
    await page.locator('aside button:has-text("Komitmen & Vaults")').click();

    const addVaultBtn = page.getByRole('button', { name: /\+ Tambah Vault/i });
    await expect(addVaultBtn).toBeVisible();
    await addVaultBtn.click();

    await expect(page.locator('#vault-name')).toBeVisible();
    await page.locator('#vault-name').fill('Tagihan Wifi');
    await page.locator('[role="radiogroup"][aria-label="Tipe Pos"] button:has-text("Tagihan Tetap")').click();
    await page.locator('#target-amount').fill('350000');
    await page.locator('#allocated-amount').fill('350000');
    await page.locator('#is_locked_toggle').check();

    const vaultSavePromise = page.waitForResponse(
      (res) => res.url().includes('/api/v1/vaults') && res.request().method() === 'POST' && res.status() === 200
    );
    await page.locator('button:has-text("Simpan Komitmen")').click();
    await vaultSavePromise;
    await expect(page.locator('#vault-name')).not.toBeVisible();

    await expect(page.getByText('Tagihan Wifi')).toBeVisible();

    // =========================================================================
    // Phase 6: Transactions & Financial Invariant Audit
    // =========================================================================
    await page.locator('aside button:has-text("Ringkasan")').click();

    const manualTxBtn = page.getByRole('button', { name: /Catat Manual/i }).first();
    await expect(manualTxBtn).toBeVisible();
    await manualTxBtn.click();

    await expect(page.locator('#amount-input')).toBeVisible();
    await page.locator('#amount-input').fill('50000');
    await page.locator('#desc-input').fill('Makan Siang Soto');

    // Link category "Kuliner & Jajan"
    const categoryDropdown = page.locator('#category-select, button[aria-label="Kategori (Opsional)"]').first();
    if (await categoryDropdown.isVisible()) {
      await categoryDropdown.click();
      const catOption = page.locator('[role="option"]:has-text("Kuliner & Jajan")').first();
      await catOption.click();
    }

    const txSavePromise = page.waitForResponse(
      (res) => res.url().includes('/api/v1/transactions') && res.request().method() === 'POST' && res.status() === 200
    );
    await page.locator('button:has-text("Simpan Transaksi")').click();
    await txSavePromise;
    await expect(page.locator('#amount-input')).not.toBeVisible();

    // Deterministic runway / operational free cash:
    // Initial liquid (Rp 5.000.000) - Expense (Rp 50.000) - Vault (Rp 350.000) - Liability (Rp 500.000) = Rp 4.100.000
    const freeCashCard = page.locator('div').filter({ hasText: 'UANG BEBAS PAKAI' }).filter({ hasText: 'Rp 4.100.000' }).first();
    await expect(freeCashCard).toBeVisible();

    // =========================================================================
    // Phase 7: 3-Tab Analytics & URL Reload Persistence
    // =========================================================================
    const chartsCard = page.locator('[data-testid="expense-charts-card"]');
    await expect(chartsCard).toBeVisible();

    // Tab Bulanan
    const monthlyTab = chartsCard.getByRole('tab', { name: /Bulanan/i });
    await monthlyTab.click();
    await expect(page).toHaveURL(/period=monthly/);
    await expect(chartsCard.getByText('Kuliner & Jajan')).toBeVisible();

    // Tab Arus Kas
    const cashflowPromise = page.waitForResponse(
      (res) => res.url().includes('period=cashflow') && res.status() === 200
    );
    const cashflowTab = chartsCard.getByRole('tab', { name: /Arus Kas/i });
    await cashflowTab.click();
    await cashflowPromise;
    await expect(page).toHaveURL(/period=cashflow/);
    await expect(page.locator('[data-testid="cashflow-donut-gauge"]')).toBeVisible();

    // F5 Reload Persistence
    await page.reload();
    await expect(page).toHaveURL(/period=cashflow/);
    await expect(page.locator('[data-testid="cashflow-donut-gauge"]')).toBeVisible();

    // =========================================================================
    // Phase 8: Ledger Audit Trail
    // =========================================================================
    await page.locator('aside button:has-text("Buku Besar")').click();

    const ledgerTable = page.locator('table');
    await expect(ledgerTable).toBeVisible();
    await expect(ledgerTable.getByText('Makan Siang Soto')).toBeVisible();
    await expect(ledgerTable.getByText('- Rp 50.000')).toBeVisible();

    // =========================================================================
    // Phase 9: Logout & Session Invalidation
    // =========================================================================
    const logoutBtn = page.locator('aside button[aria-label="Keluar (Logout)"]');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    await expect(page).toHaveURL(/\/(login)?$/);
    const tokenAfterLogout = await page.evaluate(
      () => localStorage.getItem('auth_token') || localStorage.getItem('rezekify_auth_token')
    );
    expect(tokenAfterLogout).toBeNull();
  });
});
