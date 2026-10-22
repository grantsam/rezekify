# Visual Polish & Analytics Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate analytics legibility, eliminate tooltip-threshold collisions in `ExpenseCharts.tsx`, harmonize fragmented raw hex gradients to Modern Zinc design tokens across navigation and hero cards, and implement a fluid responsive filter toolbar with >=38px touch targets in `TransactionsTable.tsx`.

**Architecture:** Visual and ergonomic refinement across four frontend components (`ExpenseCharts.tsx`, `Sidebar.tsx`, `AISpotlightHero.tsx`, and `TransactionsTable.tsx`). Decouples chart canvas reference baselines from floating indicators by lifting daily safe runway allowances into a dedicated header pill; replaces legacy `#0F766E`/`#10B981` hex values with semantic `emerald-600`/`teal-500` and `emerald-500` tokens; and restructures the transaction filter toolbar into a wrapping responsive flex layout with strict 38px touch targets.

**Tech Stack:** React 18, TypeScript 5, Vite 6, Tailwind CSS 3, HeroUI 2.7, Framer Motion 12, Lucide React, Vitest 3, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-22-visual-polish-analytics-refinement-design.md`

## Global Constraints

- **Zero Cumulative Layout Shift (CLS):** Chart skeleton, header badge, and container dimensions must remain fixed (`h-44`, `h-36`, `rounded-2xl`) so threshold indicator repositioning and toolbar wrapping never shift neighboring layout elements during load or render transitions.
- **WCAG AA Touch Ergonomics:** All interactive elements (tab pills, filter buttons, pagination buttons, action icons, dropdown triggers) must strictly enforce a minimum touch target size of 38px (`min-h-[38px]`, `min-w-[38px]`).
- **Modern Zinc Design Tokens:** Eliminate unmapped raw hex gradients (`#0F766E`, `#10B981`) in favor of unified Tailwind zinc/emerald tokens (`from-emerald-600 to-teal-500`, `bg-emerald-500 hover:bg-emerald-600`, `text-emerald-500 dark:text-emerald-400`, `bg-slate-50/50 dark:bg-zinc-900/40`).
- **100% Test Preservation:** Retain and update all existing unit tests in `ExpenseCharts.test.tsx`, `NavigationShell.test.tsx`, `AISpotlightHero.test.tsx`, and `TransactionsTable.test.tsx` with zero broken regression suites.
- **Financial Invariant (Zero Floating-Point Math):** All currency display values must format via integer rupiah amounts using `toLocaleString('id-ID')` or `formatRupiah()`.

## Review Focus

1. **Tooltip Hover Overlap During Threshold Collisions:** When spending on a day is equal to or within 5% of `safe_runway_threshold`, the bar's top tooltip popover must render without collision or visual conflict against the elevated header badge, while the chart canvas retains a pure non-interactive dashed baseline with `pointer-events-none` (`test_daily_bars_tooltip_no_threshold_collision` in Task 1).
2. **Small Mobile vs Tablet Toolbar Wrapping:** On intermediate tablet viewports (640px to 1024px), the filter toolbar in `TransactionsTable.tsx` must wrap cleanly without clipping selects or date pills into an unreadable horizontal overflow, retaining fluid min-widths (`min-w-[200px]` for search, `sm:min-w-[160px]` for selects) across responsive breakpoints (`test_filter_toolbar_responsive_wrapping_classes` in Task 3).
3. **Zero-Value Category Progress Bars:** When monthly category breakdown data contains items with `amount: 0` or `percentage: 0`, `<Progress>` must render gracefully with `value={0}` and the indicator gradient token without visual distortion or NaN attributes (`test_zero_value_category_progress_bar` in Task 1).
4. **Dark/Light Mode Gradient Contrast:** In both light and dark modes, active tab/nav pill gradients (`from-emerald-600 to-teal-500`) must maintain WCAG AA contrast ratio (>= 4.5:1) against white text, and secondary/hover states must use explicit light/dark background tokens (`hover:bg-zinc-800/50` dark, `hover:bg-slate-100` light) (`test_sidebar_and_hero_semantic_gradient_classes` in Task 2).
5. **Accessibility Attributes on Filter Selectors:** All filter inputs, select triggers, and date toggle buttons must have explicit `aria-label`, `aria-selected` or `aria-pressed`, and role attributes so screen readers accurately announce active filter states without ambiguity (`test_filter_selectors_accessibility_attributes` in Task 3).

---

### Task 1: Refactor `ExpenseCharts.tsx` Threshold Badge & Bar Gradients

**Files:**
- Modify: `frontend/src/components/ExpenseCharts.tsx:53-101,154-162,216-220,238-244,263-267`
- Test: `frontend/src/__tests__/ExpenseCharts.test.tsx`

**Interfaces:**
- Consumes:
  - `SpendingBreakdownResponse`, `DailySpendingResponse`, `MonthlySpendingResponse` from `../types/api`
  - HeroUI components (`Tooltip`, `Progress`, `Button`, `Card`, `CardBody`)
  - `BarChart3`, `AlertCircle` from `lucide-react`
  - `motion` from `framer-motion`
- Produces:
  - Safe Runway Header Badge with `data-testid="safe-runway-header-badge"`:
    - Text: `Batas Aman: Rp {threshold.toLocaleString('id-ID')}/hari`
    - Condition: `period === 'daily' && threshold > 0`
    - Class: `flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-mono font-extrabold shadow-xs select-none tabular-nums`
  - Clean Baseline Divider with `data-testid="safe-runway-baseline-divider"`:
    - Class: `absolute inset-x-0 pointer-events-none z-10 border-t-2 border-dashed border-amber-500/50`
    - Attribute: `aria-hidden="true"`
  - Semantic Emerald/Teal Gradients:
    - Segmented control active pill: `bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-900/20`
    - Inactive tab pill: `text-slate-500 dark:text-slate-400 hover:text-emerald-500 bg-transparent`
    - Daily bar under budget: `bg-gradient-to-t from-emerald-600 to-teal-500`
    - Legend indicator dot: `bg-emerald-500`
    - Monthly progress bar indicator: `bg-gradient-to-r from-emerald-600 to-teal-500`

- [x] **Step 1: Write the failing tests in `frontend/src/__tests__/ExpenseCharts.test.tsx`**

```tsx
  it('renders elevated Safe Runway threshold badge in card header and unobtrusive baseline divider in chart', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockDailyData);
    render(<ExpenseCharts />);

    await waitFor(() => {
      const badge = screen.getByTestId('safe-runway-header-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/Batas Aman: Rp 70\.000\/hari/i);
      expect(badge).toHaveClass('tabular-nums', 'font-mono');

      const divider = screen.getByTestId('safe-runway-baseline-divider');
      expect(divider).toBeInTheDocument();
      expect(divider).toHaveAttribute('aria-hidden', 'true');
      expect(divider).toHaveClass('border-amber-500/50', 'pointer-events-none');
      expect(divider.textContent).toBe('');
    });
  });

  it('hides safe runway header badge when period is switched to monthly or threshold is zero', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint.includes('period=monthly')) return mockMonthlyData;
      return mockDailyData;
    });

    render(<ExpenseCharts />);
    await waitFor(() => {
      expect(screen.getByTestId('safe-runway-header-badge')).toBeInTheDocument();
    });

    const monthlyBtn = screen.getByRole('tab', { name: /Bulanan \(Monthly\)/i });
    fireEvent.click(monthlyBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('safe-runway-header-badge')).not.toBeInTheDocument();
    });
  });

  it('daily bars render tooltips without threshold badge DOM collision in chart area', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockDailyData);
    render(<ExpenseCharts />);

    await waitFor(() => {
      const chartArea = screen.getByRole('region', { name: /Grafik pengeluaran 7 hari terakhir vs ambang batas aman runway/i });
      expect(chartArea).toBeInTheDocument();
      expect(chartArea.querySelector('[data-testid="safe-runway-header-badge"]')).toBeNull();

      const baseline = chartArea.querySelector('[data-testid="safe-runway-baseline-divider"]');
      expect(baseline).toHaveClass('pointer-events-none');
      expect(baseline).not.toHaveTextContent(/Batas Aman/i);
    });
  });

  it('renders monthly breakdown progress bars with emerald gradient tokens even for zero-percentage items', async () => {
    const zeroMonthlyData = {
      period: 'monthly' as const,
      cycle_start_date: '2026-09-01',
      cycle_end_date: '2026-09-19',
      total_spent: 100000,
      items: [
        { category_id: 'cat-1', category_name: 'Makanan & Minuman', amount: 100000, percentage: 100.0, color: '#6366f1' },
        { category_id: 'cat-2', category_name: 'Pendidikan', amount: 0, percentage: 0.0, color: '#0ea5e9' },
      ],
    };
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(zeroMonthlyData);

    render(<ExpenseCharts />);
    const monthlyBtn = screen.getByRole('tab', { name: /Bulanan \(Monthly\)/i });
    fireEvent.click(monthlyBtn);

    await waitFor(() => {
      const zeroProgressBar = screen.getByRole('progressbar', { name: /Pendidikan: 0%/i });
      expect(zeroProgressBar).toBeInTheDocument();
      expect(zeroProgressBar).toHaveAttribute('aria-valuenow', '0');
    });
  });
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- src/__tests__/ExpenseCharts.test.tsx`
Expected: FAIL with `Unable to find an element by: [data-testid="safe-runway-header-badge"]`

- [x] **Step 3: Implement header badge and token refactoring in `frontend/src/components/ExpenseCharts.tsx`**

1. In card header (lines 53-101), add the safe runway header badge adjacent to the tablist:
```tsx
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 shadow-xs">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">Analitik Pengeluaran Terarah</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-1">
              {period === 'daily'
                ? 'Tren belanja 7 hari terakhir vs ambang batas Daily Safe Runway'
                : 'Distribusi pengeluaran per kategori pada siklus berjalan'}
            </p>
          </div>
          <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap sm:flex-nowrap">
            {period === 'daily' && threshold > 0 && (
              <div
                data-testid="safe-runway-header-badge"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-mono font-extrabold shadow-xs select-none tabular-nums"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span>Batas Aman: Rp {threshold.toLocaleString('id-ID')}/hari</span>
              </div>
            )}
            <div
              role="tablist"
              aria-label="Pilih rentang waktu analitik"
              className="flex bg-slate-100 dark:bg-zinc-900/60 p-1 rounded-2xl text-xs border border-slate-200/80 dark:border-zinc-800/80"
            >
              <Button
                size="sm"
                variant="light"
                role="tab"
                aria-selected={period === 'daily'}
                onPress={() => setPeriod('daily')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl font-extrabold transition-all ${
                  period === 'daily'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-900/20'
                    : 'text-slate-500 dark:text-slate-400 hover:text-emerald-500 bg-transparent'
                }`}
              >
                Harian (Daily)
              </Button>
              <Button
                size="sm"
                variant="light"
                role="tab"
                aria-selected={period === 'monthly'}
                onPress={() => setPeriod('monthly')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl font-extrabold transition-all ${
                  period === 'monthly'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-900/20'
                    : 'text-slate-500 dark:text-slate-400 hover:text-emerald-500 bg-transparent'
                }`}
              >
                Bulanan (Monthly)
              </Button>
            </div>
          </div>
        </div>
```

2. In chart baseline area (lines 154-162), simplify into a pure non-colliding dashed divider:
```tsx
              {/* Safe Runway Threshold Baseline */}
              <div
                data-testid="safe-runway-baseline-divider"
                aria-hidden="true"
                className="absolute inset-x-0 pointer-events-none z-10 border-t-2 border-dashed border-amber-500/50"
                style={{ bottom: `${thresholdPct}%` }}
              />
```

3. Update daily bar gradients (line 218):
```tsx
className={`w-full rounded-t-lg transition-colors ${
  isOver
    ? 'bg-gradient-to-t from-rose-600 to-rose-500'
    : 'bg-gradient-to-t from-emerald-600 to-teal-500'
}`}
```

4. Update legend dot (line 239):
```tsx
<span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Sesuai Jatah
```

5. Update monthly progress bar indicator (line 264):
```tsx
classNames={{
  indicator: 'bg-gradient-to-r from-emerald-600 to-teal-500',
}}
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- src/__tests__/ExpenseCharts.test.tsx`
Expected: PASS with 10 passed tests.

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/ExpenseCharts.tsx frontend/src/__tests__/ExpenseCharts.test.tsx
git commit -m "refactor(frontend): elevate threshold badge to header and harmonize gradients in ExpenseCharts"
```

---

### Task 2: Harmonize Semantic Design Tokens in `Sidebar.tsx` and `AISpotlightHero.tsx`

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx:172,210,285,305`
- Modify: `frontend/src/components/AISpotlightHero.tsx:15,33`
- Test: `frontend/src/__tests__/NavigationShell.test.tsx:203-206`
- Test: `frontend/src/__tests__/AISpotlightHero.test.tsx`

**Interfaces:**
- Consumes:
  - `SidebarProps` from `../components/Sidebar`
  - `AISpotlightHeroProps` from `../components/AISpotlightHero`
  - Lucide React icons
  - HeroUI `Button`, `Card`, `CardBody`
- Produces:
  - Harmonized `Sidebar.tsx`:
    - Active nav item: `from-emerald-600 to-teal-500`
    - Add account link: `text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400`
    - Telegram status dot: `bg-emerald-500`
    - User avatar badge: `from-emerald-600 to-teal-500`
  - Harmonized `AISpotlightHero.tsx`:
    - Sparkles icon container: `from-emerald-600 to-teal-500`
    - Primary CTA button: `bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 min-h-[38px]`

- [x] **Step 1: Write the failing tests in `NavigationShell.test.tsx` and `AISpotlightHero.test.tsx`**

In `frontend/src/__tests__/NavigationShell.test.tsx`:
Update existing active styling test and add semantic token tests:
```tsx
  it('applies emerald active styling and checks collapse toggle in Sidebar', () => {
    const handleToggleCollapse = vi.fn();
    render(
      <Sidebar
        activeView="overview"
        onViewChange={vi.fn()}
        accounts={mockAccounts}
        user={mockUser}
        onLogout={vi.fn()}
        onOpenCreateAccount={vi.fn()}
        onToggleCollapse={handleToggleCollapse}
      />
    );

    const activeNavBtn = screen.getByRole('button', { name: /Ringkasan/i });
    expect(activeNavBtn).toHaveClass('bg-gradient-to-r');
    expect(activeNavBtn).toHaveClass('from-emerald-600');
    expect(activeNavBtn).toHaveClass('to-teal-500');

    const activeIcon = activeNavBtn.querySelector('svg');
    expect(activeIcon).toHaveClass('text-white');
  });

  it('renders Telegram active indicator and user avatar with semantic emerald design tokens', () => {
    render(
      <Sidebar
        activeView="overview"
        onViewChange={vi.fn()}
        accounts={mockAccounts}
        user={mockUser}
        onLogout={vi.fn()}
        onOpenCreateAccount={vi.fn()}
      />
    );

    const telegramStatus = screen.getByText('Telegram Terhubung');
    const dot = telegramStatus.previousElementSibling;
    expect(dot).toHaveClass('bg-emerald-500');

    const avatar = screen.getByText('BS');
    expect(avatar).toHaveClass('from-emerald-600', 'to-teal-500');
  });
```

In `frontend/src/__tests__/AISpotlightHero.test.tsx`:
```tsx
  it('applies semantic emerald button styling and minimum 38px touch target on Buka AI Copilot button', () => {
    render(<AISpotlightHero onOpenChat={vi.fn()} />);

    const ctaBtn = screen.getByRole('button', { name: /Buka AI Copilot/i });
    expect(ctaBtn).toHaveClass('bg-emerald-500', 'hover:bg-emerald-600', 'min-h-[38px]');
    expect(ctaBtn.className).not.toContain('#0F766E');
    expect(ctaBtn.className).not.toContain('#10B981');
  });

  it('renders sparkles icon with semantic emerald-to-teal gradient', () => {
    const { container } = render(<AISpotlightHero onOpenChat={vi.fn()} />);
    const iconContainer = container.querySelector('.rounded-2xl.bg-gradient-to-tr');
    expect(iconContainer).toHaveClass('from-emerald-600', 'to-teal-500');
  });
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- src/__tests__/NavigationShell.test.tsx src/__tests__/AISpotlightHero.test.tsx`
Expected: FAIL with class name mismatches (`from-[#0F766E]` vs `from-emerald-600`).

- [x] **Step 3: Implement semantic design token replacements in `Sidebar.tsx` and `AISpotlightHero.tsx`**

1. In `frontend/src/components/Sidebar.tsx`:
   - Line 172:
     ```tsx
     isActive
       ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-900/20 border border-emerald-500/30'
       : 'text-slate-600 dark:text-slate-300 hover:text-emerald-500 dark:hover:text-white hover:bg-zinc-800/50 bg-transparent'
     ```
   - Line 210:
     ```tsx
     className="p-1 min-h-[26px] text-[10px] font-extrabold text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 bg-transparent flex items-center gap-1"
     ```
   - Line 285:
     ```tsx
     className={`w-2 h-2 rounded-full ${
       user?.telegram_chat_id ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
     }`}
     ```
   - Line 305:
     ```tsx
     <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white text-xs font-black flex items-center justify-center shrink-0 shadow-sm">
       {getUserInitials(user?.full_name)}
     </div>
     ```

2. In `frontend/src/components/AISpotlightHero.tsx`:
   - Line 15:
     ```tsx
     <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-900/20">
       <Sparkles className="w-5 h-5" />
     </div>
     ```
   - Lines 31-37:
     ```tsx
     <Button
       onPress={() => onOpenChat()}
       className="bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-900/20 min-h-[38px] px-5 py-2.5 shrink-0 self-end md:self-center transition-colors"
     >
       Buka AI Copilot
       <ArrowUpRight className="w-4 h-4 ml-1" />
     </Button>
     ```

- [x] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- src/__tests__/NavigationShell.test.tsx src/__tests__/AISpotlightHero.test.tsx`
Expected: PASS with 11 tests in NavigationShell and 5 tests in AISpotlightHero passing.

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/Sidebar.tsx frontend/src/components/AISpotlightHero.tsx frontend/src/__tests__/NavigationShell.test.tsx frontend/src/__tests__/AISpotlightHero.test.tsx
git commit -m "feat(frontend): harmonize design tokens in Sidebar and AISpotlightHero"
```

---

### Task 3: Fluid Responsive Filter Toolbar in `TransactionsTable.tsx`

**Files:**
- Modify: `frontend/src/components/TransactionsTable.tsx:366-500,588,601,712,725,754,764`
- Test: `frontend/src/__tests__/TransactionsTable.test.tsx`

**Interfaces:**
- Consumes:
  - `TransactionsTableProps` from `../components/TransactionsTable`
  - HeroUI components (`Button`, `Select`, `SelectItem`, `Chip`, `Modal`)
  - Lucide icons (`Search`, `X`, `Pencil`, `Trash2`, `ArrowUpRight`, `ArrowDownLeft`)
- Produces:
  - Fluid wrapping filter toolbar container:
    - Root container: `p-4 sm:p-5 border-b border-slate-200/80 dark:border-zinc-800/80 flex flex-col md:flex-row md:flex-wrap lg:flex-nowrap gap-3 justify-between items-stretch md:items-center bg-slate-50/50 dark:bg-zinc-900/40`
    - Input controls container: `flex flex-1 flex-col sm:flex-row flex-wrap lg:flex-nowrap gap-2.5 items-stretch sm:items-center`
    - Search wrapper: `relative flex-1 min-w-[200px]`
    - Select dropdowns: `w-full sm:w-auto sm:min-w-[160px]`
    - Date filters pill container: `flex flex-wrap gap-1 p-1 bg-slate-200/60 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl self-start md:self-auto shrink-0`
  - Strict >=38px touch targets:
    - Date filter buttons: `min-h-[38px]`
    - Pagination buttons: `min-h-[38px]`
    - Action buttons (Edit & Delete in table and mobile card view): `min-w-[38px] min-h-[38px]`
  - Modern Zinc gradient tokens:
    - Active date filter pill: `bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-900/20`
    - Inactive date filter pill: `text-slate-600 dark:text-slate-300 hover:text-emerald-500 bg-transparent`

- [x] **Step 1: Write the failing tests in `frontend/src/__tests__/TransactionsTable.test.tsx`**

```tsx
  it('toolbar container and inputs support responsive fluid wrapping layout on tablet viewports', () => {
    render(
      <TransactionsTable
        transactions={mockTransactions}
        accounts={mockAccounts}
        categories={mockCategories}
        onDelete={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Cari transaksi atau channel/i);
    const searchWrapper = searchInput.parentElement;
    expect(searchWrapper).toHaveClass('min-w-[200px]', 'flex-1');

    const accountSelect = screen.getByTestId('filter-account-select');
    expect(accountSelect.className).toContain('sm:min-w-[160px]');

    const categorySelect = screen.getByTestId('filter-category-select');
    expect(categorySelect.className).toContain('sm:min-w-[160px]');
  });

  it('filter controls and date buttons adhere to accessibility standards and minimum 38px touch targets', () => {
    render(
      <TransactionsTable
        transactions={mockTransactions}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
        page={2}
        total={20}
        pageSize={10}
        totalPages={2}
      />
    );

    const dateButtons = screen.getAllByRole('button', { name: /Semua|Hari Ini|7 Hari Terakhir|Bulan Ini/i });
    dateButtons.forEach((btn) => {
      expect(btn).toHaveClass('min-h-[38px]');
    });

    const activeDateBtn = screen.getByRole('button', { name: 'Semua' });
    expect(activeDateBtn).toHaveAttribute('aria-pressed', 'true');
    expect(activeDateBtn).toHaveClass('from-emerald-600', 'to-teal-500');

    const prevBtn = screen.getByRole('button', { name: /Sebelumnya/i });
    const nextBtn = screen.getByRole('button', { name: /Berikutnya/i });
    expect(prevBtn).toHaveClass('min-h-[38px]');
    expect(nextBtn).toHaveClass('min-h-[38px]');

    const editBtns = screen.getAllByRole('button', { name: /Edit transaksi/i });
    const deleteBtns = screen.getAllByRole('button', { name: /Hapus transaksi/i });
    editBtns.forEach((btn) => {
      expect(btn).toHaveClass('min-w-[38px]', 'min-h-[38px]');
    });
    deleteBtns.forEach((btn) => {
      expect(btn).toHaveClass('min-w-[38px]', 'min-h-[38px]');
    });
  });
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- src/__tests__/TransactionsTable.test.tsx`
Expected: FAIL with mismatched class names (`min-h-[38px]` vs `min-h-[36px]`, `from-[#0F766E]` vs `from-emerald-600`).

- [x] **Step 3: Implement responsive toolbar and 38px touch target updates in `TransactionsTable.tsx`**

1. Replace filter toolbar outer and inner containers (lines 366-368):
```tsx
      {/* Filter and Search Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-zinc-800/80 flex flex-col md:flex-row md:flex-wrap lg:flex-nowrap gap-3 justify-between items-stretch md:items-center bg-slate-50/50 dark:bg-zinc-900/40">
        <div className="flex flex-1 flex-col sm:flex-row flex-wrap lg:flex-nowrap gap-2.5 items-stretch sm:items-center">
          <div className="relative flex-1 min-w-[200px]">
```

2. Update account and category `Select` widths (lines 403, 447):
```tsx
disallowEmptySelection
className="w-full sm:w-auto sm:min-w-[160px]"
```

3. Update date filter pill container and button classes (lines 481-497):
```tsx
        <div className="flex flex-wrap gap-1 p-1 bg-slate-200/60 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl self-start md:self-auto shrink-0">
          {DATE_FILTERS.map((filter) => (
            <Button
              key={filter.key}
              size="sm"
              variant={dateFilter === filter.key ? 'solid' : 'flat'}
              aria-pressed={dateFilter === filter.key}
              onPress={() => handleDateFilterChange(filter.key)}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-xl transition-all min-h-[38px] flex items-center justify-center ${
                dateFilter === filter.key
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-900/20'
                  : 'text-slate-600 dark:text-slate-300 hover:text-emerald-500 bg-transparent'
              }`}
            >
              {filter.label}
            </Button>
          ))}
        </div>
```

4. Update mobile card action buttons touch targets (lines 588, 601):
```tsx
className="min-w-[38px] min-h-[38px] p-2 text-slate-400 hover:text-emerald-500 rounded-xl bg-transparent"
...
className="min-w-[38px] min-h-[38px] p-2 text-slate-400 hover:text-rose-500 rounded-xl bg-transparent"
```

5. Update desktop table action buttons touch targets (lines 712, 725):
```tsx
className="min-w-[38px] min-h-[38px] p-2 text-slate-400 hover:text-emerald-500 rounded-xl bg-transparent"
...
className="min-w-[38px] min-h-[38px] p-2 text-slate-400 hover:text-rose-500 rounded-xl bg-transparent"
```

6. Update pagination buttons touch targets (lines 754, 764):
```tsx
className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold border border-emerald-500/20 min-h-[38px] px-4 rounded-xl text-xs disabled:opacity-40"
```

- [x] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- src/__tests__/TransactionsTable.test.tsx`
Expected: PASS with 16 passed tests.

- [x] **Step 5: Commit**

```bash
git add frontend/src/components/TransactionsTable.tsx frontend/src/__tests__/TransactionsTable.test.tsx
git commit -m "feat(frontend): implement fluid responsive filter toolbar and 38px touch targets in TransactionsTable"
```

---

### Task 4: Full Verification Gate

**Files:**
- Test: All frontend test suites
- Build: `frontend/src/*`

**Interfaces:**
- Consumes: Complete frontend codebase
- Produces: Clean test run, 0 compile errors, clean Impeccable design audit.

- [x] **Step 1: Run complete frontend test suite single-pass**

Run: `npm --prefix frontend test`
Expected: PASS with 0 failed tests across all suites.

- [x] **Step 2: Run production TypeScript compile and Vite build**

Run: `npm --prefix frontend run build`
Expected: Clean build (`tsc && vite build`) with exit code 0 and valid assets in `dist/`.

- [x] **Step 3: Run Impeccable design audit**

Run: `npx impeccable detect`
Expected: Exit code 0 without any design token errors or unmapped hex gradient regressions on target components.

- [x] **Step 4: Confirm git status cleanliness**

Run: `git status`
Expected: Clean working tree on branch `main` with all changes committed.
