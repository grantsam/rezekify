import { test, expect } from '@playwright/test';

const mockUser = {
  id: 'usr-e2e',
  email: 'test@rezekify.id',
  full_name: 'Tester',
  telegram_chat_id: null,
};

const mockSummary = {
  total_liquid_cash: 5000000,
  vault_locked_cash: 1000000,
  operational_free_cash: 4000000,
  days_remaining: 15,
  daily_safe_runway: 150000,
  health_status: 'HEALTHY',
  upcoming_bills: [
    {
      name: 'Internet & WiFi',
      target_amount: 350000,
      allocated_amount: 150000,
      target_date: '2026-10-30',
      days_until_due: 7,
    },
  ],
};

const mockAccounts = [
  {
    id: 'acc-1',
    name: 'BCA Utama',
    account_type: 'BANK',
    current_balance: 5000000,
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

const mockTransactions = [
  {
    id: 'tx-101',
    description: 'Makan Siang Soto Ayam',
    source_channel: 'WEB_MANUAL',
    transaction_date: '2026-10-23T12:00:00Z',
    amount: 25000,
    type: 'EXPENSE',
    account_name: 'BCA Utama',
    category_name: 'Makanan',
    ledger_entries: [
      { id: 'le-1', entry_type: 'DEBIT', amount: 25000 },
      { id: 'le-2', entry_type: 'CREDIT', amount: 25000 },
    ],
  },
];

const mockDailySpending = {
  period: 'daily',
  daily_safe_runway: 150000,
  total_spent_in_period: 240000,
  items: [
    { date: '2026-10-17', day_label: 'Sab', amount: 20000, safe_runway_threshold: 150000, is_over_budget: false },
    { date: '2026-10-18', day_label: 'Min', amount: 50000, safe_runway_threshold: 150000, is_over_budget: false },
    { date: '2026-10-19', day_label: 'Sen', amount: 35000, safe_runway_threshold: 150000, is_over_budget: false },
    { date: '2026-10-20', day_label: 'Sel', amount: 40000, safe_runway_threshold: 150000, is_over_budget: false },
    { date: '2026-10-21', day_label: 'Rab', amount: 25000, safe_runway_threshold: 150000, is_over_budget: false },
    { date: '2026-10-22', day_label: 'Kam', amount: 30000, safe_runway_threshold: 150000, is_over_budget: false },
    { date: '2026-10-23', day_label: 'Jum', amount: 40000, safe_runway_threshold: 150000, is_over_budget: false },
  ],
};

const mockMonthlySpending = {
  period: 'monthly',
  cycle_start_date: '2026-10-01',
  cycle_end_date: '2026-10-31',
  total_spent: 1250000,
  items: [
    {
      category_id: 'cat-1',
      category_name: 'Makanan & Minuman',
      amount: 750000,
      percentage: 60,
      color: '#64748b',
    },
    {
      category_id: 'cat-2',
      category_name: 'Transportasi',
      amount: 500000,
      percentage: 40,
      color: '#64748b',
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'mock-token-e2e');
    localStorage.setItem('rezekify_auth_token', 'mock-token-e2e');
    localStorage.setItem('auth_user', JSON.stringify({ id: 'usr-e2e', email: 'test@rezekify.id', full_name: 'Tester' }));
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
        body: JSON.stringify(mockSummary),
      });
    }

    if (path.includes('/analytics/spending-breakdown')) {
      const periodParam = url.searchParams.get('period');
      if (periodParam === 'monthly') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockMonthlySpending),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDailySpending),
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
          items: mockTransactions,
          total: mockTransactions.length,
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

test.describe('Dashboard Persistence and DataViz Suite', () => {
  test('persists ?view=ledger across page reload', async ({ page }) => {
    await page.goto('/dashboard?view=ledger');

    const ledgerHeading = page.getByRole('heading', { name: 'Buku Besar (Ledger)' });
    await expect(ledgerHeading).toBeVisible();

    await page.reload();

    await expect(ledgerHeading).toBeVisible();
    expect(page.url()).toContain('view=ledger');
  });

  test('persists ?period=monthly and decouples donut colors from #64748b', async ({ page }) => {
    await page.goto('/dashboard?period=monthly');

    const bulananTab = page.getByRole('tab', { name: /Bulanan/i });
    await expect(bulananTab).toBeVisible();
    await expect(bulananTab).toHaveAttribute('aria-selected', 'true');

    // Assert donut circles stroke does not equal #64748b
    const donutCircles = page.locator('svg[viewBox="0 0 160 160"] circle[stroke-dasharray]');
    await expect(donutCircles).toHaveCount(2);

    const count = await donutCircles.count();
    for (let i = 0; i < count; i++) {
      const stroke = await donutCircles.nth(i).getAttribute('stroke');
      expect(stroke).toBeTruthy();
      expect(stroke?.toLowerCase()).not.toBe('#64748b');
      expect(stroke?.toLowerCase()).not.toBe('rgb(100, 116, 139)');
    }

    await page.reload();

    await expect(bulananTab).toBeVisible();
    await expect(bulananTab).toHaveAttribute('aria-selected', 'true');
    expect(page.url()).toContain('period=monthly');
  });

  test('maintains stable card height without layout shift when toggling period', async ({ page }) => {
    await page.goto('/dashboard');

    const chartCard = page.getByTestId('expense-charts-card');
    await expect(chartCard).toBeVisible();

    // Ensure daily content is rendered
    await expect(page.getByRole('tab', { name: /Harian/i })).toHaveAttribute('aria-selected', 'true');

    const initialBox = await chartCard.boundingBox();
    expect(initialBox).not.toBeNull();

    const bulananTab = page.getByRole('tab', { name: /Bulanan/i });
    await bulananTab.click();

    await expect(bulananTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('svg[viewBox="0 0 160 160"]')).toBeVisible();

    const updatedBox = await chartCard.boundingBox();
    expect(updatedBox).not.toBeNull();

    const heightDiff = Math.abs((updatedBox?.height ?? 0) - (initialBox?.height ?? 0));
    expect(heightDiff).toBeLessThanOrEqual(4);
  });
});
