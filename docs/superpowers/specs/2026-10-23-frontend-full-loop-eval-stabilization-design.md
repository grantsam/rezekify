# Frontend Full Loop Stabilization Design Specification

- **Date**: 2026-10-23
- **Scope**: Frontend Cockpit & Analytics (`ExpenseCharts.tsx`, `DashboardPage.tsx`, `OverviewView.tsx`, `playwright.config.ts`, `e2e/dashboard-persistence.spec.ts`)
- **Status**: Approved
- **Branch**: `feat/frontend-full-loop-eval-stabilization`

---

## 1. Intent & Problem Statement

Recent cockpit and landing page overhauls brought human Indonesian copy, horizontal account pills, and living SVG curved area charts to Rezekify. However, a rigorous audit of the complete user interaction loop identified four key functional and craft deficits:

1. **Monochromatic Slate Fallback in DataViz (`ExpenseCharts.tsx`)**:
   - Backend `RunwayService.get_category_spending_breakdown` assigns `#64748b` (Slate-500) as the default category color when none is stored in the database.
   - In `ExpenseCharts.tsx`, the expression `item.color || PALETTE[idx % PALETTE.length]` treats `#64748b` as truthy, bypassing the frontend categorical palette entirely. As a result, all default expense categories render in identical gray slices, losing visual contrast and category distinction in both the SVG Donut Ring and the legend list.

2. **Volatile In-Memory UI State (Fails F5 / Browser Reload)**:
   - In `DashboardPage.tsx`, `activeView` (`overview`, `ledger`, `vaults`, `chat`) is stored solely in local component state (`useState<ActiveViewType>('overview')`).
   - In `ExpenseCharts.tsx`, `period` (`daily`, `monthly`) is stored solely in local component state (`useState<'daily' | 'monthly'>('daily')`).
   - When a user refreshes the browser (F5), navigates with the browser back/forward buttons, or bookmarks a link, the view resets unconditionally to `overview` and the chart resets to `daily`. User context is lost.

3. **Cumulative Layout Shift (CLS) on Period & Tab Toggling**:
   - Toggling between Harian (Daily Curved Area) and Bulanan (Monthly Donut Ring) switches between structurally disparate layouts. Without strict min-height locks across the chart inner canvas, legend containers, and skeleton states, the dashboard card jitters vertically by 30–80px, violating zero-CLS standards.

4. **Absence of Real-Browser E2E Loop Verification**:
   - Existing tests rely on Vitest and JSDOM. While effective for isolated DOM node assertions, JSDOM does not evaluate genuine browser URL synchronization, live page reloads (`page.reload()`), WebKit/Chromium layout geometry, or SVG arc rendering under real browser rendering engines.

---

## 2. Invariants & Craft Guardrails

- **Zero Layout Shift (CLS = 0)**: All Bento row containers and internal chart viewports must enforce fixed min-heights (`min-h-[380px]` card level, `min-h-[224px]` inner canvas) so toggling tabs or reloading never alters page height.
- **F5-Proof Deep-Linkable State**: Active cockpit view (`?view=...`) and analytics period (`?period=...`) must synchronize with URL search parameters via `useSearchParams` from `react-router-dom`, preserving parameter coexistence without clobbering other query parameters.
- **DataViz Semantic Contrast & Decoupling**: Backend default slate (`#64748b`) must be intercepted and replaced with vibrant, accessible categorical colors from `PALETTE`.
- **SVG Math & Coordinate Sanitization**: All SVG path definitions (`d="M... C..."`), circles, and stroke offsets must be guarded against `NaN`, `Infinity`, and division-by-zero, even with 0 expenses or 1 data point.
- **Zero Raw Emojis**: 100% Lucide React SVG vector icons throughout all components and error states.
- **Multi-Tenant Scoping & Currency Invariants**: Multi-tenant data safety and integer Rupiah formatting (`formatRupiah`, `formatCompactRupiah`) strictly preserved.

---

## 3. Core Architecture & Component Specifications

### 3.1 DataViz Color Decoupling & Semantic Palette (`ExpenseCharts.tsx`)

#### Color Decoupling Logic
Backend `CategoryBreakdownItem` delivers `color: "#64748b"` whenever a category has no custom hex code assigned. The frontend must decouple from this fallback:

```typescript
const PALETTE: readonly string[] = [
  '#10B981', // Emerald 500
  '#06B6D4', // Cyan 500
  '#3B82F6', // Blue 500
  '#8B5CF6', // Violet 500
  '#F59E0B', // Amber 500
  '#EC4899', // Pink 500
  '#14B8A6', // Teal 500
];

export function resolveCategoryColor(
  backendColor: string | null | undefined,
  index: number
): string {
  if (!backendColor || backendColor.toLowerCase() === '#64748b') {
    return PALETTE[index % PALETTE.length];
  }
  return backendColor;
}
```

This function is applied to:
1. Donut Ring `<circle stroke={resolveCategoryColor(item.color, idx)} ... />`
2. Category legend color pip `<span style={{ backgroundColor: resolveCategoryColor(item.color, idx) }} ... />`
3. Hover highlight glow and active ribbon indicators.

#### SVG Coordinate & Path Sanitization
1. **Daily Curved Area Wave**:
   - `maxDailyAmount`: `Math.max(1, dailyData.items.reduce(..., 1), threshold)`.
   - Data points `pts`:
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
   - Cubic Bezier curve builder: If `pts.length === 1`, render a centered node and horizontal baseline rather than broken bezier commands.
   - Area fill path: Closes cleanly at `L ${pts[pts.length - 1].x} 140 L ${pts[0].x} 140 Z`.

2. **Monthly Segmented Donut Ring**:
   - Circumference constant: `CIRCUMFERENCE = 2 * Math.PI * 60` (~`376.9911`).
   - Total calculation: `totalSpent = monthlyData.total_spent || monthlyData.items.reduce((acc, i) => acc + i.amount, 0) || 1`.
   - Arc length clamping:
     ```typescript
     const safeSpent = Math.max(1, totalSpent);
     const itemPct = item.amount > 0 ? (item.amount / safeSpent) * 100 : item.percentage;
     const arcLength = Math.max(0, (Math.min(100, itemPct) / 100) * CIRCUMFERENCE);
     ```
   - Prevent rendering circles with `arcLength <= 0` or non-finite offsets.

---

### 3.2 URL-Driven UI State Persistence (`DashboardPage.tsx` & `ExpenseCharts.tsx`)

#### URL Schema
The application supports synchronized state via search parameters on `/dashboard`:
- `?view=<overview|ledger|vaults|chat>` (defaults to `overview`)
- `?period=<daily|monthly>` (defaults to `daily`)
- Example compound URL: `http://localhost:5173/dashboard?view=overview&period=monthly`

#### Implementation in `DashboardPage.tsx`
Replace local state with `useSearchParams` synchronization:
```typescript
const VALID_VIEWS: readonly ActiveViewType[] = ['overview', 'ledger', 'vaults', 'chat'];

export const DashboardPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const viewParam = searchParams.get('view') as ActiveViewType | null;
  const activeView: ActiveViewType = (viewParam && VALID_VIEWS.includes(viewParam))
    ? viewParam
    : 'overview';

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

#### Implementation in `ExpenseCharts.tsx`
Synchronize chart period toggle with search parameter:
```typescript
export const ExpenseCharts: React.FC<Props> = ({ refreshTrigger = 0 }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const periodParam = searchParams.get('period');
  const period: 'daily' | 'monthly' = periodParam === 'monthly' ? 'monthly' : 'daily';

  const handlePeriodChange = (newPeriod: 'daily' | 'monthly') => {
    if (newPeriod === period) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('period', newPeriod);
      return next;
    }, { replace: true });
  };
```

#### F5 / Reload Guarantee
On initial render:
1. `DashboardPage` reads `viewParam` from current window location. If `view=ledger`, it immediately mounts `LedgerView`.
2. `ExpenseCharts` reads `periodParam`. If `period=monthly`, it fetches `/analytics/spending-breakdown?period=monthly` on first network cycle, mounting the Monthly Donut Ring without flash of Daily Area chart.
3. Reloading (F5) preserves the exact view and chart period.

---

### 3.3 Zero-CLS Min-Height Locks (`OverviewView.tsx` & `ExpenseCharts.tsx`)

To eradicate all layout shifts across data fetching, tab toggling, and simulation drawer expansion:

1. **Card Container Lock**:
   - `ExpenseCharts.tsx`: `<Card className="min-h-[380px] flex flex-col justify-between ...">`
   - Bento Tier 2 in `OverviewView.tsx`:
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

2. **Internal Canvas Lock**:
   - Loading Skeleton: `h-56 min-h-[224px]` flex container.
   - Daily Viewport: `min-h-[224px]` containing `svg` (h-44) + day labels row.
   - Monthly Viewport: `min-h-[224px]` containing donut ring (h-40) + legend list.
   - Empty/Error Viewport: `min-h-[224px]` centered message container.
   - Result: Height difference between views is 0px (+-2px subpixel rounding), completely eliminating visual jumping.

---

### 3.4 Playwright E2E Configuration & Test Suite

#### Configuration (`playwright.config.ts`)
- Root configuration targeting Vite frontend development server (`http://localhost:5173`).
- Single-pass non-interactive execution with bounded timeouts (`timeout: 30000`, `expect: 5000`).
- Headless Chromium and WebKit execution profiles.

#### Test Specification (`e2e/dashboard-persistence.spec.ts`)
- **Suite: Dashboard URL Persistence & Full Loop Stabilization**:
  1. `should restore view=ledger on direct URL navigation and F5 reload`:
     - Navigates to `/dashboard?view=ledger`.
     - Asserts `Buku Kas & Riwayat Transaksi` heading is visible.
     - Calls `page.reload()`.
     - Confirms `LedgerView` remains active and URL retains `?view=ledger`.
  2. `should restore period=monthly on direct URL navigation and F5 reload`:
     - Navigates to `/dashboard?view=overview&period=monthly`.
     - Asserts `Bulanan (Monthly)` tab is selected (`aria-selected="true"`).
     - Confirms Donut SVG ring (`svg[viewBox="0 0 160 160"]`) is rendered.
     - Calls `page.reload()`.
     - Confirms Donut SVG ring remains visible and URL retains `period=monthly`.
  3. `should decouple category colors from backend #64748b fallback`:
     - Intercepts `/analytics/spending-breakdown?period=monthly` with mock items containing `color: "#64748b"`.
     - Navigates to dashboard.
     - Queries rendered Donut circles and legend dot styles.
     - Asserts stroke and background colors do NOT match `#64748b`, matching dynamic palette colors (`#10b981`, `#06b6d4`, etc.).
  4. `should maintain zero layout shift when toggling between daily and monthly`:
     - Measures bounding box of `ExpenseCharts` card before and after clicking `Bulanan (Monthly)`.
     - Asserts card height variance <= 4px.

---

## 4. Verification & Testing Matrix

| Layer | Target | Command | Success Criteria |
|---|---|---|---|
| **Unit / Component** | `ExpenseChartsLiving.test.tsx` | `npm --prefix frontend test ExpenseChartsLiving` | Passes color decoupling, coordinate sanitization, and period switching. |
| **Unit / Component** | `DashboardPage.test.tsx` | `npm --prefix frontend test DashboardPage` | Passes view restoration from `?view=...` search param and search param sync. |
| **Unit / Layout** | `OverviewView.test.tsx` | `npm --prefix frontend test OverviewView` | Passes min-height lock checks (`min-h-[380px]`). |
| **Type Integrity** | TypeScript build | `npm --prefix frontend run build` | Clean `tsc` compilation with 0 errors. |
| **E2E Automation** | Playwright Test Suite | `npx playwright test e2e/dashboard-persistence.spec.ts` | 100% tests pass under headless browser. |
