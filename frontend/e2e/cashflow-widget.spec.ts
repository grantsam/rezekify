import { test, expect } from '@playwright/test';

// ponytail: static fixtures aligned with src/types/api.ts; upgrade to dynamic mock generator if scenario matrix grows.
const mockUser = {
  id: 'usr-e2e-cashflow',
  email: 'cashflow@rezekify.id',
  full_name: 'Cashflow Tester',
  telegram_chat_id: null,
};

const mockSummary = {
  total_liquid_cash: 10000000,
  vault_locked_cash: 2000000,
  operational_free_cash: 8000000,
  days_remaining: 15,
  daily_safe_runway: 250000,
  health_status: 'HEALTHY',
  upcoming_bills: [],
};

const mockAccounts = [
  {
    id: 'acc-e2e-1',
    name: 'BCA Utama',
    account_type: 'BANK',
    current_balance: 10000000,
    is_active: true,
  },
];

const mockDailySpending = {
  period: 'daily',
  daily_safe_runway: 250000,
  total_spent_in_period: 300000,
  items: [
    { date: '2026-10-23', day_label: 'Jum', amount: 50000, safe_runway_threshold: 250000, is_over_budget: false },
  ],
};

const mockCashflowHealthy = {
  period: 'cashflow',
  cycle_start_date: '2026-10-01',
  cycle_end_date: '2026-10-23',
  total_income: 12000000,
  total_expense: 4000000,
  net_cashflow: 8000000,
  savings_rate: 66.7,
  status: 'HEALTHY',
};

const mockCashflowDeficit = {
  period: 'cashflow',
  cycle_start_date: '2026-10-01',
  cycle_end_date: '2026-10-23',
  total_income: 5000000,
  total_expense: 8000000,
  net_cashflow: -3000000,
  savings_rate: 0.0,
  status: 'CRITICAL',
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'mock-token-e2e');
    localStorage.setItem('rezekify_auth_token', 'mock-token-e2e');
    localStorage.setItem('auth_user', JSON.stringify({ id: 'usr-e2e-cashflow', email: 'cashflow@rezekify.id', full_name: 'Cashflow Tester' }));
  });

  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ status: 200, json: mockUser });
  });

  await page.route('**/api/v1/dashboard/summary', async (route) => {
    await route.fulfill({ status: 200, json: mockSummary });
  });

  await page.route('**/api/v1/accounts*', async (route) => {
    await route.fulfill({ status: 200, json: mockAccounts });
  });

  await page.route('**/api/v1/vaults*', async (route) => {
    await route.fulfill({ status: 200, json: [] });
  });

  await page.route('**/api/v1/categories*', async (route) => {
    await route.fulfill({ status: 200, json: [] });
  });

  await page.route('**/api/v1/transactions*', async (route) => {
    await route.fulfill({ status: 200, json: { items: [], total: 0, page: 1, page_size: 10, total_pages: 0 } });
  });

  await page.route('**/api/v1/analytics/spending-breakdown*', async (route) => {
    const url = route.request().url();
    if (url.includes('period=cashflow')) {
      await route.fulfill({ status: 200, json: mockCashflowHealthy });
    } else {
      await route.fulfill({ status: 200, json: mockDailySpending });
    }
  });

  await page.route('**/api/v1/analytics/cashflow-summary', async (route) => {
    await route.fulfill({ status: 200, json: mockCashflowHealthy });
  });
});

test.describe('Net Cashflow & Savings Rate Widget E2E Suite', () => {
  test('tab switching, gauge rendering, and URL search param sync', async ({ page }) => {
    await page.goto('/');

    const card = page.getByTestId('expense-charts-card');
    await expect(card).toBeVisible();

    // Check that all 3 tabs are present
    const dailyTab = page.getByRole('tab', { name: /Harian/i });
    const monthlyTab = page.getByRole('tab', { name: /Bulanan/i });
    const cashflowTab = page.getByRole('tab', { name: /Arus Kas/i });

    await expect(dailyTab).toBeVisible();
    await expect(monthlyTab).toBeVisible();
    await expect(cashflowTab).toBeVisible();

    // Click Arus Kas tab
    await cashflowTab.click();

    // Verify URL query param updated
    await expect(page).toHaveURL(/.*period=cashflow.*/);

    // Verify Cashflow canvas and gauge
    await expect(page.getByTestId('cashflow-donut-gauge')).toBeVisible();
    await expect(page.getByTestId('center-savings-rate')).toHaveText('66.7%');
    await expect(page.getByText('Sangat Sehat')).toBeVisible();
    const canvas = page.getByTestId('cashflow-canvas-container');
    await expect(canvas.getByText('Pemasukan', { exact: true })).toBeVisible();
    await expect(canvas.getByText('Pengeluaran', { exact: true })).toBeVisible();
    await expect(page.getByText('Arus Kas Bersih')).toBeVisible();
    await expect(page.getByText('+Rp 8.000.000')).toBeVisible();
  });

  test('F5 reload persistence maintains ?period=cashflow state', async ({ page }) => {
    await page.goto('/?period=cashflow');

    await expect(page.getByTestId('cashflow-donut-gauge')).toBeVisible();
    await expect(page.getByTestId('center-savings-rate')).toHaveText('66.7%');

    // Reload page
    await page.reload();

    // Confirm state persisted
    await expect(page).toHaveURL(/.*period=cashflow.*/);
    await expect(page.getByTestId('cashflow-donut-gauge')).toBeVisible();
    await expect(page.getByTestId('center-savings-rate')).toHaveText('66.7%');
    await expect(page.getByText('Sangat Sehat')).toBeVisible();
  });

  test('deficit scenario displays CRITICAL badge and negative balance', async ({ page }) => {
    await page.route('**/api/v1/analytics/spending-breakdown*', async (route) => {
      await route.fulfill({ status: 200, json: mockCashflowDeficit });
    });
    await page.route('**/api/v1/analytics/cashflow-summary', async (route) => {
      await route.fulfill({ status: 200, json: mockCashflowDeficit });
    });

    await page.goto('/?period=cashflow');

    await expect(page.getByText('Arus Kas Negatif')).toBeVisible();
    await expect(page.getByText('-Rp 3.000.000')).toBeVisible();
    await expect(page.getByText('Defisit')).toBeVisible();
    await expect(page.getByTestId('center-savings-rate')).toHaveText('0.0%');
  });

  test('enforces zero Cumulative Layout Shift (CLS) on card container', async ({ page }) => {
    await page.goto('/');

    const card = page.getByTestId('expense-charts-card');
    await expect(card).toBeVisible();

    const boxBefore = await card.boundingBox();
    expect(boxBefore).not.toBeNull();
    expect(boxBefore!.height).toBeGreaterThanOrEqual(380);

    // Switch to Cashflow
    await page.getByRole('tab', { name: /Arus Kas/i }).click();
    await expect(page.getByTestId('cashflow-donut-gauge')).toBeVisible();

    // Allow any layout transitions/paint to settle
    await page.waitForTimeout(300);

    const boxAfter = await card.boundingBox();
    expect(boxAfter).not.toBeNull();
    expect(boxAfter!.height).toBeGreaterThanOrEqual(380);

    const heightDiff = Math.abs((boxAfter?.height ?? 0) - (boxBefore?.height ?? 0));
    expect(heightDiff).toBeLessThanOrEqual(4);
  });
});
