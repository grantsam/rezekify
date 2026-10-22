# Specification: Visual Polish & Analytics Refinement (Phase 10)

**Date**: 2026-10-22  
**Status**: Approved (Architecture Design Spec)  
**Target Surface**:  
- `frontend/src/components/ExpenseCharts.tsx` (Threshold header elevation, semantic tokens)  
- `frontend/src/components/Sidebar.tsx` (Gradient token harmonization)  
- `frontend/src/components/AISpotlightHero.tsx` (Primary button and gradient tokens)  
- `frontend/src/components/TransactionsTable.tsx` (Responsive toolbar flex wrap, 38px touch targets, gradient tokens)  
- `frontend/src/__tests__/ExpenseCharts.test.tsx` (Header badge & baseline assertions)  
- `frontend/src/__tests__/NavigationShell.test.tsx` (Updated semantic gradient class assertions)  
- `frontend/src/__tests__/TransactionsTable.test.tsx` (Filter toolbar & ergonomics regression tests)  

---

## 1. Problem Statement & User Intent

### 1.1 Critique Observations & Deficiencies
1. **Tooltip & Threshold Collision in `ExpenseCharts.tsx`**:
   - The dashed amber baseline badge (`Batas Aman: Rp X`) is currently rendered inside the chart area via an absolute container (`absolute inset-x-0 flex items-center justify-end` at `bottom: ${thresholdPct}%`).
   - When spending is near or at the threshold limit, hovering over or focusing a bar triggers the `<Tooltip placement="top">`. The tooltip popover directly collides with and obscures the floating threshold badge, causing visual clutter and illegibility.
2. **Hardcoded Hex Gradients Bypassing Semantic Tokens**:
   - `Sidebar.tsx`, `AISpotlightHero.tsx`, `ExpenseCharts.tsx`, and `TransactionsTable.tsx` use hardcoded hex gradients (`from-[#0F766E] to-[#10B981]`) and direct colors (`text-[#10B981]`, `bg-[#10B981]`).
   - This bypasses the Modern Zinc design tokens (`emerald-500`, `emerald-600`, `teal-500`, `zinc-800`), resulting in fragmented styles that resist theme harmonization.
3. **Awkward Tablet Viewport Wrapping in `TransactionsTable.tsx`**:
   - The filter toolbar uses `flex flex-col lg:flex-row justify-between items-stretch lg:items-center` containing a child `flex flex-col sm:flex-row gap-2.5` for search and two select dropdowns (`w-full sm:w-44`).
   - On tablet viewports (640px–1024px, such as 768px iPad), the search input and dropdowns force awkward horizontal overflow or squeezing before the breakpoint jumps to desktop `lg`.
   - Several filter and pagination buttons use `min-h-[36px]` or `min-w-[34px]`, violating the Impeccable minimum 38px touch target standard.

### 1.2 User Intent
- Users need to read daily spending against safe runway allowances without tooltip text collisions.
- Users expect a unified Modern Zinc financial cockpit with cohesive emerald/teal accents.
- Tablet users need a fluid, spacious filter toolbar that wraps naturally without cramped selects or horizontal scrolling.

---

## 2. Goals, Non-Goals, and Anti-Goals

### 2.1 Goals
- **Clean Separation of Threshold Line & Indicator (`ExpenseCharts.tsx`)**:
  - Keep the subtle dashed reference line (`border-t-2 border-dashed border-amber-500/50`) across the chart canvas with `pointer-events-none`.
  - Elevate the text indicator (`Batas Aman: Rp {threshold}/hari`) into the card header adjacent to the Daily / Monthly segmented pills. Tooltip overlap is eliminated completely.
- **Harmonize Gradients to Modern Zinc / Emerald Tokens**:
  - Active navigation and indicator gradients: `from-emerald-600 to-teal-500`.
  - Primary action buttons: `bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white shadow-md shadow-emerald-900/20`.
  - Accent text and indicators: `text-emerald-500 dark:text-emerald-400`, `bg-emerald-500`.
- **Responsive Tablet-Ergonomic Filter Toolbar (`TransactionsTable.tsx`)**:
  - Implement a fluid wrapping flex layout (`flex flex-wrap items-center gap-3`) with flexible child widths (`min-w-[200px]` on search, `min-w-[150px]` on selects).
  - Guarantee minimum 38px touch targets (`min-h-[38px]`, `min-w-[38px]`) on all filter pills, pagination buttons, and action icons.

### 2.2 Non-Goals
- Changing `/analytics/spending-breakdown` or `/transactions` backend API contracts.
- Altering double-entry ledger schemas, calculation formulas, or database migrations.
- Introducing third-party charting libraries (maintaining lightweight SVG/DOM + Framer Motion).

### 2.3 Anti-Goals
- Zero test regressions on existing test suites.
- Zero Impeccable design standard violations (no raw hex when semantic tokens exist, no CLS, transitions <= 250ms).
- Zero floating-point math for currency rendering.

---

## 3. Component Modifications & Visual Polish

### 3.1 `ExpenseCharts.tsx`
- **Header Badge Relocation**:
  - Move `Batas Aman: Rp {threshold.toLocaleString('id-ID')}/hari` into the card header alongside the Daily / Monthly segmented control.
  - Visible only when `period === 'daily'` and `threshold > 0`.
  - Styled as an amber indicator pill:
    ```tsx
    <div
      data-testid="safe-runway-header-badge"
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-mono font-extrabold shadow-xs select-none tabular-nums"
    >
      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
      <span>Batas Aman: Rp {threshold.toLocaleString('id-ID')}/hari</span>
    </div>
    ```
- **Unobstructed Chart Area**:
  - Chart baseline becomes a pure dashed reference line without floating text:
    ```tsx
    <div
      aria-hidden="true"
      className="absolute inset-x-0 pointer-events-none z-10 border-t-2 border-dashed border-amber-500/50"
      style={{ bottom: `${thresholdPct}%` }}
    />
    ```
- **Token Harmonization**:
  - Segmented control active pill: `bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-900/20`.
  - Daily bar fill: `bg-gradient-to-t from-emerald-600 to-teal-500`.
  - Legend dot: `bg-emerald-500`.
  - Monthly progress bar: `classNames={{ indicator: 'bg-gradient-to-r from-emerald-600 to-teal-500' }}`.

### 3.2 `Sidebar.tsx`
- Active navigation button: replace `from-[#0F766E] to-[#10B981]` with `from-emerald-600 to-teal-500`.
- Add account link: replace `text-[#10B981] hover:text-[#0F766E]` with `text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400`.
- Telegram status dot: replace `bg-[#10B981]` with `bg-emerald-500`.
- User initials avatar: replace `from-[#0F766E] to-[#10B981]` with `from-emerald-600 to-teal-500`.

### 3.3 `AISpotlightHero.tsx`
- Icon container: replace `from-[#0F766E] to-[#10B981]` with `from-emerald-600 to-teal-500`.
- Primary CTA button ("Buka AI Copilot"):
  - Replace `bg-gradient-to-r from-[#0F766E] to-[#10B981]` with:
    `bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-emerald-900/20 min-h-[38px] px-5 py-2.5`.

### 3.4 `TransactionsTable.tsx`
- **Toolbar Layout**:
  - Replace rigid `flex-col lg:flex-row` with a fluid wrapping flex container:
    ```tsx
    <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-zinc-800/80 flex flex-col md:flex-row md:flex-wrap lg:flex-nowrap gap-3 justify-between items-stretch md:items-center bg-slate-50/50 dark:bg-zinc-900/40">
      <div className="flex flex-1 flex-col sm:flex-row flex-wrap lg:flex-nowrap gap-2.5 items-stretch sm:items-center">
        <div className="relative flex-1 min-w-[200px]">
          {/* Search input with min-h-[40px] */}
        </div>
        <Select className="w-full sm:w-auto sm:min-w-[160px]" ... />
        <Select className="w-full sm:w-auto sm:min-w-[160px]" ... />
      </div>
      <div className="flex flex-wrap gap-1 p-1 bg-slate-200/60 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl self-start md:self-auto shrink-0">
        {DATE_FILTERS.map(...)}
      </div>
    </div>
    ```
- **Date Filter Pills & Touch Ergonomics**:
  - Active filter pill: `bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-900/20`.
  - Inactive filter pill: `text-slate-600 dark:text-slate-300 hover:text-emerald-500 bg-transparent`.
  - Button touch targets: update `min-h-[36px]` to `min-h-[38px]`.
- **Pagination & Action Buttons**:
  - Pagination buttons (`Sebelumnya`, `Berikutnya`): update from `min-h-[36px]` to `min-h-[38px]`.
  - Table action buttons (Edit, Delete): ensure `min-w-[38px] min-h-[38px]`.

---

## 4. Design Tokens Reference

| Element | Old Implementation | Modern Zinc Standard |
| :--- | :--- | :--- |
| **Active Nav / Tab Gradient** | `from-[#0F766E] to-[#10B981]` | `from-emerald-600 to-teal-500` |
| **Primary Buttons** | `bg-gradient-to-r from-[#0F766E] to-[#10B981]` | `bg-emerald-500 hover:bg-emerald-600` |
| **Accent Text / Links** | `text-[#10B981] hover:text-[#0F766E]` | `text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400` |
| **Status Dots** | `bg-[#10B981]` | `bg-emerald-500` |
| **Chart Baseline** | `border-amber-500/80` with floating badge | `border-amber-500/50` line + header badge |
| **Interactive Targets** | `min-h-[36px]`, `min-w-[34px]` | Strict `>= 38px` (`min-h-[38px]`, `min-w-[38px]`) |

---

## 5. Testing & Quality Gates

### 5.1 Targeted Vitest Suites
- **`ExpenseCharts.test.tsx`**:
  - Verify `Batas Aman: Rp 70.000/hari` renders in the elevated header container.
  - Verify baseline divider is present in DOM with `aria-hidden="true"`.
  - Verify daily bar hover/focus tooltips display without badge DOM collision.
  - Verify daily/monthly tab toggles continue to work.
- **`NavigationShell.test.tsx`**:
  - Update class assertions on `activeNavBtn` to verify `from-emerald-600` and `to-teal-500` instead of `#0F766E` and `#10B981`.
  - Verify sidebar collapse, account list, and Telegram status dot rendering.
- **`TransactionsTable.test.tsx`**:
  - Verify date filter buttons, account dropdowns, and search filter behavior.
  - Verify touch targets across filter buttons adhere to `min-h-[38px]`.

### 5.2 Impeccable Quality Check
- Run `npx impeccable detect --json` (or inspect changed files against Impeccable design guidelines: no unmapped hex gradients, zero CLS, >= 38px touch targets, transitions <= 250ms).

### 5.3 Production Build Gate
- Execute `npm run build` in `frontend/` (`tsc && vite build`) to confirm zero compilation errors and valid production bundle emission.
