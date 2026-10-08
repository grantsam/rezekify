# UI/UX & Design System Harmonization Specification

- **Feature**: Frontend Theme Consistency, Semantic Surface Tokens, & Currency Formatting
- **Author**: Thinker & Orchestrator Tier
- **Date**: 2026-10-09
- **Status**: Approved by Human Partner

---

## 1. Executive Summary & Problem Statement

An end-to-end design audit revealed visual and interaction inconsistencies across Rezekify's React frontend:
1. **Accent Duality**: Active states in navigation (`Sidebar`, `BottomDock`) used Emerald (`text-emerald-400`), blurring the boundary between interactive UI states and financial health indicators (where Emerald is reserved for `HEALTHY` runway and income).
2. **Surface Fragmentation**: Cards mixed hardcoded `#141417`, Tailwind default `bg-zinc-900`, and `#0c0c0e`.
3. **Currency Inconsistency**: Multiple disparate formats (`Rp 1.000.000,00` vs `1.000.000` vs `Rp 1.000.000`).
4. **Touch Targets & Empty States**: The sidebar collapse toggle was smaller than the 38px touch target standard (`32px`), and `UpcomingBillsCard` returned `null` when empty, disrupting tier 3 layout balance on the overview cockpit.

---

## 2. Design Invariants & Standards

1. **Role of Indigo vs. Emerald**:
   - **Indigo (`#6366f1` / `brand-500`)**: Interactive UI elements, navigation active states, modal tabs, primary action buttons, and general brand focus states.
   - **Emerald (`#10b981` / `runway.healthy`)**: Pure financial health (positive cashflow, runway safe badge, positive balances, income transactions).
   - **Amber (`#f59e0b` / `runway.warning`)**: Impending bills, warning badges, cautious runway.
   - **Rose (`#f43f5e` / `runway.critical`)**: Expense transactions, critical runway, overspent allowances, destructive actions.
2. **Semantic Surface Tokens in `tailwind.config.js`**:
   - `surface-canvas`: `#0c0c0e`
   - `surface-card`: `#141417`
   - `surface-subtle`: `#1a1a1e`
   - `surface-border`: `rgba(39, 39, 42, 0.8)` (`border-zinc-800/80`)
3. **Unified Currency Formatting**:
   - Central utility `formatRupiah(amount: number, options?: { showPrefix?: boolean, showDecimals?: boolean })` in `frontend/src/utils/formatters.ts`.
   - Default: `Rp 1.500.000` (no unnecessary `,00` cents). Tabular numbers (`.tabular-nums`) applied across all currency displays.
4. **Accessibility & Touch Targets**:
   - Minimum 38px on all interactive icon buttons (`min-w-[38px] min-h-[38px]`).
5. **Layout Equilibrium**:
   - `UpcomingBillsCard` displays a calm empty state banner when no bills are due within 7 days, maintaining two-column visual harmony on the Overview cockpit.

---

## 3. Detailed Component Harmonization Plan

### A. Tailwind Config (`frontend/tailwind.config.js`)
Extend `theme.extend.colors`:
```javascript
surface: {
  canvas: '#0c0c0e',
  card: '#141417',
  subtle: '#1a1a1e',
  border: 'rgba(39, 39, 42, 0.8)',
}
```

### B. Navigation Accents (`Sidebar.tsx`, `BottomDock.tsx`)
- Active navigation item in `Sidebar.tsx`:
  - Active background: `bg-indigo-500/10 text-white border border-indigo-500/30 font-semibold`
  - Active icon: `text-indigo-400`
  - Collapse button: `min-w-[38px] min-h-[38px]`
- Active navigation item in `BottomDock.tsx`:
  - Active label/icon: `text-indigo-400 font-semibold` (was `text-emerald-400`)

### C. Unified Currency Formatter (`frontend/src/utils/formatters.ts`)
Create formatter utility with unit tests:
- `formatRupiah(val: number, options?: { showPrefix?: boolean }): string`
- Replace ad-hoc formatting across `OverviewView.tsx`, `RecentTransactionsCard.tsx`, `VaultCard.tsx`, and `TransactionsTable.tsx`.

### D. Empty State in `UpcomingBillsCard.tsx`
When `urgentBills.length === 0`:
- Instead of returning `null`, render an elegant reassurance card matching the cockpit height:
  - Shield / CheckCircle icon in emerald-400.
  - Title: *"Semua Komitmen Aman"*.
  - Subtitle: *"Tidak ada tagihan atau komitmen jatuh tempo dalam 7 hari kedepan."*.

---

## 4. Verification Plan

1. Frontend test suite passes (`npm --prefix frontend test -- --run`).
2. Typecheck clean (`npx --prefix frontend tsc --noEmit`).
3. Production build succeeds (`npm --prefix frontend run build`).
4. Visual inspection confirms Indigo navigation accents, consistent `#141417` card surfaces, and balanced Overview cockpit tier 3.
