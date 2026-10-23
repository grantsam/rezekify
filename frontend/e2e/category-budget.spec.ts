import { test, expect } from '@playwright/test';

// ponytail: static fixtures aligned with src/types/api.ts; upgrade to dynamic generator if spec matrix grows.
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
    category_name: 'Kuliner & Jajan',
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
    { date: '2026-10-23', day_label: 'Jum', amount: 40000, safe_runway_threshold: 150000, is_over_budget: false },
  ],
};

const mockMonthlySpending = {
  period: 'monthly',
  cycle_start_date: '2026-10-01',
  cycle_end_date: '2026-10-31',
  total_spent: 1500000,
  items: [
    {
      category_id: 'cat-1',
      category_name: 'Kuliner & Jajan',
      amount: 600000,
      percentage: 40,
      color: '#10b981',
      budget_limit: 1000000,
      budget_spent_pct: 60.0,
      budget_status: 'HEALTHY',
    },
    {
      category_id: 'cat-2',
      category_name: 'Transportasi',
      amount: 900000,
      percentage: 60,
      color: '#f59e0b',
      budget_limit: 1000000,
      budget_spent_pct: 90.0,
      budget_status: 'WARNING',
    },
  ],
};

const mockCategories = [
  {
    id: 'cat-1',
    name: 'Kuliner & Jajan',
    category_type: 'EXPENSE',
    icon: 'utensils',
    color: '#10b981',
    monthly_budget: 1000000,
  },
  {
    id: 'cat-2',
    name: 'Transportasi',
    category_type: 'EXPENSE',
    icon: 'car',
    color: '#f59e0b',
    monthly_budget: 1000000,
  },
  {
    id: 'cat-3',
    name: 'Tagihan Rumah',
    category_type: 'EXPENSE',
    icon: 'home',
    color: '#64748b',
    monthly_budget: null,
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
        body: JSON.stringify(mockCategories),
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

test.describe('Category Monthly Budget Limits E2E Suite', () => {
  test('renders category budget status and remaining balance in monthly breakdown', async ({ page }) => {
    await page.goto('/dashboard?period=monthly');

    // Assert monthly tab is active
    const bulananTab = page.getByRole('tab', { name: /Bulanan/i });
    await expect(bulananTab).toBeVisible();
    await expect(bulananTab).toHaveAttribute('aria-selected', 'true');

    const chartCard = page.getByTestId('expense-charts-card');
    await expect(chartCard).toBeVisible();

    // Asserts Kuliner & Jajan is visible with remaining budget text Sisa Rp 400.000
    await expect(chartCard.getByText('Kuliner & Jajan')).toBeVisible();
    await expect(chartCard.getByText('Sisa Rp 400.000')).toBeVisible();

    // Asserts Transportasi is visible with Sisa Rp 100.000
    await expect(chartCard.getByText('Transportasi')).toBeVisible();
    await expect(chartCard.getByText('Sisa Rp 100.000')).toBeVisible();
  });

  test('category manager modal displays budget limit badges', async ({ page }) => {
    // Navigate to ledger view where the category manager trigger is available
    await page.goto('/dashboard?view=ledger');

    const openCategoryBtn = page.getByRole('button', { name: '+ Kategori' });
    await expect(openCategoryBtn).toBeVisible();
    await openCategoryBtn.click();

    // Assert Category Manager Modal is open
    const modalHeading = page.getByRole('heading', { name: 'Kelola Kategori' });
    await expect(modalHeading).toBeVisible();

    // Category with budget limit displays the budget badge (e.g. Rp 1.000.000/bln)
    await expect(page.getByRole('dialog').getByText('Kuliner & Jajan')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Rp 1.000.000/bln').first()).toBeVisible();

    // Category without budget limit displays Tanpa limit badge
    await expect(page.getByRole('dialog').getByText('Tagihan Rumah')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Tanpa limit')).toBeVisible();
  });
});
