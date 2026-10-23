# Frontend Full Loop Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement full frontend interaction loop stabilization by decoupling DataViz categories from backend default gray (`#64748b`), persisting cockpit view and analytics period across browser reloads via `useSearchParams`, locking zero-CLS container geometry, and verifying end-to-end with Playwright.

**Architecture:**
1. In `ExpenseCharts.tsx`, implement `resolveCategoryColor` to decouple default slate (`#64748b`) from category slices into vibrant semantic palette hues (`PALETTE`), sanitize SVG coordinates against division-by-zero, and sync active period with URL search params (`?period=daily|monthly`).
2. In `DashboardPage.tsx`, synchronize `activeView` with URL search params (`?view=overview|ledger|vaults|chat`) using `useSearchParams` from `react-router-dom`, preserving parameter coexistence across view changes and browser reloads (F5).
3. In `ExpenseCharts.tsx` and `OverviewView.tsx`, enforce locked container min-heights (`min-h-[380px]` card level, `min-h-[224px]` inner canvas) across daily, monthly, skeleton, and empty states to eliminate layout shifts.
4. In `playwright.config.ts` and `e2e/dashboard-persistence.spec.ts`, establish a real-browser end-to-end verification suite verifying URL persistence on F5 reload, category color decoupling, and zero layout shift.

**Tech Stack:** React 18, TypeScript, React Router DOM v7 (`useSearchParams`), Tailwind CSS, HeroUI, Lucide React, Framer Motion, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-frontend-full-loop-eval-stabilization-design.md`

## Global Constraints

- Strictly ZERO raw unicode emojis / emoticons — all icons use Lucide React vector SVGs.
- All monetary values must use integer Indonesian Rupiah formatting (`formatRupiah`, `formatCompactRupiah`); zero floating-point math.
- Deep-linked URL query parameters must remain clean and coexistent (`/dashboard?view=overview&period=monthly`).
- All SVG paths must be sanitized against `NaN` and `Infinity` coordinates.
- Strict TypeScript build with 0 errors (`npx tsc --noEmit && npm run build`).
- Single-pass non-interactive test commands; never launch hanging dev servers or watch-mode processes.

## Review Focus

1. **Backend Gray Fallback Ingestion**: When backend sends category items with `color: "#64748b"` or `color: null`, slices and legend dots must render distinct colors from `PALETTE`, not monochromatic gray.
2. **Compound URL Parameter Preservation**: Navigating to a new view (e.g. from `overview` to `ledger`) must not erase the existing `period` parameter, and toggling `period` must not erase `view`.
3. **Invalid URL Parameter Defense**: If a user enters an unlisted query parameter (e.g. `?view=hacked&period=yearly`), `DashboardPage` must safely fallback to `overview` and `ExpenseCharts` must fallback to `daily` without throwing exceptions.
4. **Single-Data-Point Coordinate Safety**: When daily analytics returns 0 items or exactly 1 item, SVG curve rendering must not produce `NaN` in bezier control points (`C NaN NaN, NaN NaN`).
5. **Zero-Height Oscillation Across Toggles**: Switching back and forth between `Harian (Daily)` and `Bulanan (Monthly)` must maintain constant card height without vertical jump (+-2px max tolerance).

---

### Task 1: DataViz Color Decoupling & Semantic Palette in `ExpenseCharts.tsx`

**Files:**
- Modify: `frontend/src/components/ExpenseCharts.tsx`
- Modify: `frontend/src/__tests__/ExpenseChartsLiving.test.tsx`

**Interfaces:**
- Consumes: `SpendingBreakdownResponse`, `MonthlySpendingResponse.items[].color`.
- Produces: `resolveCategoryColor(backendColor: string | null | undefined, index: number): string` and sanitized SVG coordinates.

- [ ] **Step 1: Write failing tests in `ExpenseChartsLiving.test.tsx` for color decoupling and coordinate sanitization**

Add test cases asserting:
1. When monthly breakdown items contain `color: "#64748b"` (or `#64748B`), the rendered circle stroke and legend color dot are decoupled to `PALETTE[idx]` and NOT `#64748b`.
2. When daily items have 0 or 1 point, no SVG path contains `NaN` or `Infinity`.

```typescript
it('decouples backend fallback #64748b to vibrant PALETTE colors in monthly donut and legend', async () => {
  const mockSlateData = {
    period: 'monthly' as const,
    cycle_start_date: '2026-09-01',
    cycle_end_date: '2026-09-19',
    total_spent: 500000,
    items: [
      { category_id: 'c1', category_name: 'Makan', amount: 300000, percentage: 60.0, color: '#64748b' },
      { category_id: 'c2', category_name: 'Transport', amount: 200000, percentage: 40.0, color: '#64748B' },
    ],
  };

  vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockSlateData);

  const { container } = render(
    <MemoryRouter initialEntries={['/dashboard?period=monthly']}>
      <ExpenseCharts />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(screen.getByText('Makan')).toBeInTheDocument();
  });

  const circles = container.querySelectorAll('svg[viewBox="0 0 160 160"] circle[stroke]');
  // Filter out background track circle
  const arcCircles = Array.from(circles).filter((c) => c.getAttribute('stroke') !== 'currentColor');
  expect(arcCircles.length).toBe(2);

  // Slices must NOT use #64748b
  expect(arcCircles[0].getAttribute('stroke')?.toLowerCase()).not.toBe('#64748b');
  expect(arcCircles[1].getAttribute('stroke')?.toLowerCase()).not.toBe('#64748b');
  expect(arcCircles[0].getAttribute('stroke')?.toLowerCase()).toBe('#10b981');
  expect(arcCircles[1].getAttribute('stroke')?.toLowerCase()).toBe('#06b6d4');
});

it('sanitizes SVG curve coordinates when daily items contain only 1 item or 0 expenses', async () => {
  const singleItemDaily = {
    period: 'daily' as const,
    daily_safe_runway: 50000,
    total_spent_in_period: 10000,
    items: [
      { date: '2026-09-19', day_label: 'Sab', amount: 10000, safe_runway_threshold: 50000, is_over_budget: false },
    ],
  };

  vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(singleItemDaily);

  const { container } = render(
    <MemoryRouter initialEntries={['/dashboard?period=daily']}>
      <ExpenseCharts />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(screen.getByText('Sab')).toBeInTheDocument();
  });

  const paths = container.querySelectorAll('svg[viewBox="0 0 560 160"] path');
  paths.forEach((p) => {
    const d = p.getAttribute('d') || '';
    expect(d).not.toContain('NaN');
    expect(d).not.toContain('Infinity');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm --prefix frontend test src/__tests__/ExpenseChartsLiving.test.tsx`
Expected: FAIL because `#64748b` is currently passed through directly.

- [ ] **Step 3: Implement `resolveCategoryColor` and coordinate sanitization in `ExpenseCharts.tsx`**

1. Define `resolveCategoryColor`:
   ```typescript
   export const PALETTE = ['#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#14B8A6'];

   export function resolveCategoryColor(color: string | null | undefined, index: number): string {
     if (!color || color.toLowerCase() === '#64748b') {
       return PALETTE[index % PALETTE.length];
     }
     return color;
   }
   ```
2. Update Donut slice strokes and legend color dots using `resolveCategoryColor(item.color, idx)`.
3. In `curvePath` calculation, sanitize single-point and multi-point coordinates:
   ```typescript
   const pts = dailyData.items.map((item, idx) => {
     const x = count > 1 ? startX + idx * stepX : (startX + endX) / 2;
     const y = 140 - (Math.max(0, item.amount) / maxDailyAmount) * 120;
     return {
       x: Number.isFinite(x) ? x : startX,
       y: Number.isFinite(y) ? y : 140,
     };
   });
   ```
4. If `pts.length === 1`, build a safe horizontal line or marker: `M ${pts[0].x - 10} ${pts[0].y} L ${pts[0].x + 10} ${pts[0].y}` with area `L ${pts[0].x + 10} 140 L ${pts[0].x - 10} 140 Z`.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm --prefix frontend test src/__tests__/ExpenseChartsLiving.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ExpenseCharts.tsx frontend/src/__tests__/ExpenseChartsLiving.test.tsx
git commit -m "feat(charts): decouple dataviz color fallback from slate and sanitize SVG coordinates"
```

---

### Task 2: URL State Persistence via `useSearchParams` in `DashboardPage.tsx` and `ExpenseCharts.tsx`

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/components/ExpenseCharts.tsx`
- Modify: `frontend/src/__tests__/DashboardPage.test.tsx`
- Modify: `frontend/src/__tests__/ExpenseChartsLiving.test.tsx`

**Interfaces:**
- Consumes: `useSearchParams` from `react-router-dom`.
- Produces: Bidirectional URL parameter persistence for `view` and `period`.

- [ ] **Step 1: Write failing tests in `DashboardPage.test.tsx` and `ExpenseChartsLiving.test.tsx`**

In `DashboardPage.test.tsx`:
```typescript
it('restores activeView from URL query parameter ?view=ledger on initial load', async () => {
  vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
    if (endpoint === '/dashboard/summary') return mockSummary;
    if (endpoint.startsWith('/transactions')) return mockTransactions;
    if (endpoint === '/accounts') return mockAccounts;
    return null;
  });

  render(
    <MemoryRouter initialEntries={['/dashboard?view=ledger']}>
      <DashboardPage />
    </MemoryRouter>
  );

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /Buku Kas & Riwayat Transaksi/i })).toBeInTheDocument();
  });
});

it('updates URL search parameters when switching views while preserving other params', async () => {
  vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockSummary);

  render(
    <MemoryRouter initialEntries={['/dashboard?view=overview&period=monthly']}>
      <DashboardPage />
    </MemoryRouter>
  );

  // Switching view updates ?view=vaults preserving period=monthly
  // Assert via UI or MemoryRouter history
});
```

In `ExpenseChartsLiving.test.tsx`:
```typescript
it('synchronizes period state with URL ?period parameter', async () => {
  vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockMonthlyData);

  render(
    <MemoryRouter initialEntries={['/dashboard?period=monthly']}>
      <ExpenseCharts />
    </MemoryRouter>
  );

  await waitFor(() => {
    const monthlyBtn = screen.getByRole('tab', { name: /Bulanan \(Monthly\)/i });
    expect(monthlyBtn).toHaveAttribute('aria-selected', 'true');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm --prefix frontend test src/__tests__/DashboardPage.test.tsx src/__tests__/ExpenseChartsLiving.test.tsx`
Expected: FAIL because `DashboardPage` and `ExpenseCharts` currently do not read from `useSearchParams`.

- [ ] **Step 3: Implement `useSearchParams` in `DashboardPage.tsx` and `ExpenseCharts.tsx`**

1. In `DashboardPage.tsx`:
   - Import `useSearchParams` from `react-router-dom`.
   - Read `viewParam = searchParams.get('view')`. Validate against `['overview', 'ledger', 'vaults', 'chat']`.
   - Update `onViewChange`:
     ```typescript
     const handleViewChange = (newView: ActiveViewType) => {
       if (newView === 'settings') {
         modals.openSettingsModal();
         return;
       }
       setSearchParams((prev) => {
         const next = new URLSearchParams(prev);
         if (newView === 'overview') {
           next.set('view', 'overview');
         } else {
           next.set('view', newView);
         }
         return next;
       }, { replace: true });
     };
     ```
   - Pass `activeView` derived from `searchParams` into `AppLayout` and view switch.
   - Wrap existing tests in `DashboardPage.test.tsx` in `<MemoryRouter>` where needed.

2. In `ExpenseCharts.tsx`:
   - Import `useSearchParams` from `react-router-dom`.
   - Read `periodParam = searchParams.get('period')`. Set `period = periodParam === 'monthly' ? 'monthly' : 'daily'`.
   - Update tab switch handler:
     ```typescript
     const handlePeriodChange = (newPeriod: 'daily' | 'monthly') => {
       if (newPeriod === period) return;
       setSearchParams((prev) => {
         const next = new URLSearchParams(prev);
         next.set('period', newPeriod);
         return next;
       }, { replace: true });
     };
     ```
   - Connect `onPress={() => handlePeriodChange('daily')}` and `onPress={() => handlePeriodChange('monthly')}`.
   - Wrap existing calls in `ExpenseCharts.test.tsx` and `ExpenseChartsLiving.test.tsx` with `<MemoryRouter>` to ensure router context is available.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm --prefix frontend test src/__tests__/DashboardPage.test.tsx src/__tests__/ExpenseChartsLiving.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/components/ExpenseCharts.tsx frontend/src/__tests__/DashboardPage.test.tsx frontend/src/__tests__/ExpenseChartsLiving.test.tsx
git commit -m "feat(navigation): synchronize cockpit view and chart period with URL search params"
```

---

### Task 3: Zero-CLS Layout Lock & Visual Polish in `ExpenseCharts.tsx` and `OverviewView.tsx`

**Files:**
- Modify: `frontend/src/components/ExpenseCharts.tsx`
- Modify: `frontend/src/components/OverviewView.tsx`
- Modify: `frontend/src/__tests__/ExpenseChartsLiving.test.tsx`
- Modify: `frontend/src/__tests__/OverviewView.test.tsx`

**Interfaces:**
- Produces: Rock-solid card and canvas dimensions (`min-h-[380px]` card, `min-h-[224px]` canvas) preventing Cumulative Layout Shift.

- [ ] **Step 1: Write test assertions for height containment**

In `ExpenseChartsLiving.test.tsx` and `OverviewView.test.tsx`:
- Assert `ExpenseCharts` card has `min-h-[380px]`.
- Assert Daily region has `min-h-[224px]`.
- Assert Monthly container has `min-h-[224px]`.
- Assert Skeleton container has `h-56` (`min-h-[224px]`).
- Assert Empty state container has `h-56` (`min-h-[224px]`).

- [ ] **Step 2: Run tests to verify current layout classes**

Run: `npm --prefix frontend test src/__tests__/ExpenseChartsLiving.test.tsx`
Expected: Note any missing inner canvas min-heights.

- [ ] **Step 3: Implement strict layout locks in `ExpenseCharts.tsx` and `OverviewView.tsx`**

1. In `ExpenseCharts.tsx`:
   - Daily region: `<div role="region" aria-label="..." className="space-y-3 min-h-[224px] flex flex-col justify-between">`.
   - Monthly region: `<div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center py-2 flex-1 min-h-[224px]">`.
   - Card root: `<Card className="min-h-[380px] flex flex-col justify-between ...">`.
2. In `OverviewView.tsx`:
   - Ensure Tier 2 Bento grid row maintains `min-h-[380px]` on both columns:
     ```tsx
     <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
       <div className="lg:col-span-7 w-full flex flex-col min-h-[380px] h-full">
         <ExpenseCharts refreshTrigger={refreshTrigger} />
       </div>
       <div className="lg:col-span-5 w-full flex flex-col min-h-[380px] h-full">
         <RecentTransactionsCard ... />
       </div>
     </div>
     ```

- [ ] **Step 4: Run tests to verify pass**

Run: `npm --prefix frontend test src/__tests__/ExpenseChartsLiving.test.tsx src/__tests__/OverviewView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ExpenseCharts.tsx frontend/src/components/OverviewView.tsx frontend/src/__tests__/ExpenseChartsLiving.test.tsx frontend/src/__tests__/OverviewView.test.tsx
git commit -m "style(layout): enforce zero-CLS min-height locks across bento rows and chart viewports"
```

---

### Task 4: Playwright Configuration (`playwright.config.ts`) and E2E Test Suite (`e2e/dashboard-persistence.spec.ts`)

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/dashboard-persistence.spec.ts`
- Modify: `package.json` / `frontend/package.json`

**Interfaces:**
- Produces: Production-ready browser automation suite covering full interaction loop, reload persistence, and zero CLS.

- [ ] **Step 1: Install Playwright test package and create `playwright.config.ts`**

Install Playwright in frontend or root:
```bash
npm --prefix frontend install -D @playwright/test
```
Create `playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm --prefix frontend run preview -- --port 5173',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
});
```

- [ ] **Step 2: Create E2E test file `e2e/dashboard-persistence.spec.ts`**

Write browser tests verifying:
1. Direct navigation to `/dashboard?view=ledger` mounts ledger view and survives browser reload (`page.reload()`).
2. Direct navigation to `/dashboard?view=overview&period=monthly` mounts monthly donut ring and survives reload.
3. Donut slice SVG elements decouple colors from `#64748b`.
4. Layout bounding box remains within 4px variance during tab toggle.

```typescript
import { test, expect } from '@playwright/test';

test.describe('Cockpit Interaction Loop & Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Mock user authentication session
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'mock-valid-e2e-token');
      localStorage.setItem('auth_user', JSON.stringify({
        id: 'usr-e2e',
        email: 'tester@rezekify.id',
        full_name: 'E2E Tester',
      }));
    });
  });

  test('restores ?view=ledger and persists across page reload', async ({ page }) => {
    await page.goto('/dashboard?view=ledger');
    await expect(page.getByText('Buku Kas & Riwayat Transaksi')).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('view=ledger');

    await page.reload();
    await expect(page.getByText('Buku Kas & Riwayat Transaksi')).toBeVisible({ timeout: 10000 });
    expect(page.url()).toContain('view=ledger');
  });

  test('restores ?period=monthly and persists across page reload', async ({ page }) => {
    await page.goto('/dashboard?view=overview&period=monthly');
    const monthlyTab = page.getByRole('tab', { name: /Bulanan \(Monthly\)/i });
    await expect(monthlyTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });

    await page.reload();
    const monthlyTabAfter = page.getByRole('tab', { name: /Bulanan \(Monthly\)/i });
    await expect(monthlyTabAfter).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
    expect(page.url()).toContain('period=monthly');
  });

  test('decouples donut slices from #64748b fallback', async ({ page }) => {
    await page.goto('/dashboard?view=overview&period=monthly');
    const donutCircles = page.locator('svg[viewBox="0 0 160 160"] circle[stroke]');
    const count = await donutCircles.count();
    for (let i = 0; i < count; i++) {
      const stroke = await donutCircles.nth(i).getAttribute('stroke');
      if (stroke && stroke !== 'currentColor') {
        expect(stroke.toLowerCase()).not.toBe('#64748b');
      }
    }
  });

  test('maintains stable card height without layout shift when toggling period', async ({ page }) => {
    await page.goto('/dashboard?view=overview&period=daily');
    const chartCard = page.locator('div:has(> div > div > h3:has-text("Analitik Pengeluaran Terarah"))').first();
    await expect(chartCard).toBeVisible();

    const boxBefore = await chartCard.boundingBox();
    expect(boxBefore).not.toBeNull();

    await page.getByRole('tab', { name: /Bulanan \(Monthly\)/i }).click();
    await page.waitForTimeout(300);

    const boxAfter = await chartCard.boundingBox();
    expect(boxAfter).not.toBeNull();

    if (boxBefore && boxAfter) {
      const heightDiff = Math.abs(boxAfter.height - boxBefore.height);
      expect(heightDiff).toBeLessThanOrEqual(4);
    }
  });
});
```

- [ ] **Step 3: Add `test:e2e` script in `frontend/package.json`**

Update scripts in `frontend/package.json` (or root `package.json`):
`"test:e2e": "playwright test"`

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts e2e/dashboard-persistence.spec.ts frontend/package.json
git commit -m "test(e2e): configure playwright suite for cockpit persistence and layout stability"
```

---

### Task 5: Full Verification (Vitest + TypeScript build + Playwright E2E run)

**Files:**
- All touched files

- [ ] **Step 1: Execute Vitest unit test suite**

Run: `npm --prefix frontend test`
Expected: 100% tests pass (exit code 0).

- [ ] **Step 2: Execute TypeScript compilation and build**

Run: `npm --prefix frontend run build`
Expected: 0 TypeScript errors, bundle generated cleanly in `frontend/dist`.

- [ ] **Step 3: Execute Playwright E2E suite**

Run: `npx playwright test`
Expected: All E2E test specs pass with exit code 0.

- [ ] **Step 4: Commit and tag completion**

```bash
git add -A
git commit -m "chore(audit): verify full frontend loop stabilization with vitest and playwright"
```
