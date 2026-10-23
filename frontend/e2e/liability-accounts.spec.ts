import { test, expect } from '@playwright/test';

// ponytail: static fixtures aligned with src/types/api.ts; upgrade to dynamic mock generator if scenario matrix grows.
const mockUser = {
  id: 'usr-e2e',
  email: 'test@rezekify.id',
  full_name: 'Tester',
  telegram_chat_id: null,
};

const mockSummaryWithLiability = {
  total_liquid_cash: 5000000,
  vault_locked_cash: 1000000,
  operational_free_cash: 3600000,
  total_liability_debt: 400000,
  days_remaining: 15,
  daily_safe_runway: 240000,
  health_status: 'HEALTHY',
  upcoming_bills: [],
};

const mockAccounts = [
  {
    id: 'acc-1',
    name: 'BCA Utama',
    account_type: 'BANK',
    current_balance: 5000000,
    is_active: true,
  },
  {
    id: 'acc-2',
    name: 'Shopee PayLater',
    account_type: 'LIABILITY',
    current_balance: 400000,
    is_active: true,
  },
];

const mockVaults = [
  {
    id: 'vault-1',
    name: 'Dana Darurat',
    vault_type: 'SAVINGS',
    target_amount: 10000000,
    allocated_amount: 1000000,
    is_locked: true,
  },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'mock-token-e2e');
    localStorage.setItem('rezekify_auth_token', 'mock-token-e2e');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ id: 'usr-e2e', email: 'test@rezekify.id', full_name: 'Tester' })
    );
  });

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockUser),
      });
    }

    if (path.endsWith('/dashboard/summary')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSummaryWithLiability),
      });
    }

    if (path.endsWith('/accounts')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAccounts),
      });
    }

    if (path.endsWith('/vaults')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockVaults),
      });
    }

    if (path.includes('/transactions')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          total: 0,
          page: 1,
          page_size: 20,
          total_pages: 1,
        }),
      });
    }

    if (path.endsWith('/categories')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    if (path.includes('/analytics/spending-breakdown')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          period: 'daily',
          daily_safe_runway: 240000,
          total_spent_in_period: 0,
          items: [],
        }),
      });
    }

    if (path.includes('/chat/messages')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    if (path.endsWith('/settings')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          telegram: { is_connected: false, telegram_chat_id: null, bot_username: 'RezekifyBot' },
          ai: { is_custom_ai_enabled: false, provider: 'SYSTEM', protocol: null, base_url: null, model: 'gemini-2.5-flash', has_api_key: false },
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
});

test.describe('Liability Accounts & PayLater Tracking E2E Suite', () => {
  test('displays liability account capsule with rose accent, Tagihan label, and 1-tap Lunasi button', async ({ page }) => {
    await page.goto('/dashboard');

    const capsuleStrip = page.locator('[data-testid="account-capsule-strip"]');
    await expect(capsuleStrip).toBeVisible();

    const liabilityCapsule = capsuleStrip.locator('div', { hasText: 'Shopee PayLater:' });
    await expect(liabilityCapsule).toBeVisible();
    await expect(liabilityCapsule).toHaveClass(/border-rose-500/);

    await expect(capsuleStrip.getByText('Shopee PayLater:')).toBeVisible();
    await expect(capsuleStrip.getByText(/Tagihan Rp\s*400\.000/)).toBeVisible();

    const lunasiBtn = capsuleStrip.getByRole('button', { name: /Lunasi/i });
    await expect(lunasiBtn).toBeVisible();
  });

  test('displays Tagihan Berjalan in KPI Card 2', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.getByText('UANG BEBAS PAKAI')).toBeVisible();
    const debtBadge = page.locator('[data-testid="liability-debt-badge"]');
    await expect(debtBadge).toBeVisible();
    await expect(debtBadge).toContainText('Tagihan Berjalan:');
    await expect(debtBadge).toContainText(/Rp\s*400\.000/);
  });

  test('clicking Lunasi button opens manual transaction modal', async ({ page }) => {
    await page.goto('/dashboard');

    const capsuleStrip = page.locator('[data-testid="account-capsule-strip"]');
    const lunasiBtn = capsuleStrip.getByRole('button', { name: /Lunasi/i });
    await expect(lunasiBtn).toBeVisible();
    await lunasiBtn.click();

    // Verify manual transaction modal appears
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Tambah Transaksi Manual')).toBeVisible();
  });

  test('account creation modal exposes PayLater / Kredit type with adapted label', async ({ page }) => {
    await page.goto('/dashboard');

    const tambahAkunBtn = page.getByRole('button', { name: /Tambah Akun/i });
    await expect(tambahAkunBtn).toBeVisible();
    await tambahAkunBtn.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Tambah Akun Baru')).toBeVisible();

    const paylaterOption = page.getByRole('radio', { name: /PayLater \/ Kredit/i });
    await expect(paylaterOption).toBeVisible();

    await paylaterOption.click();
    await expect(page.getByText(/Saldo Tagihan Awal/i)).toBeVisible();
  });
});
