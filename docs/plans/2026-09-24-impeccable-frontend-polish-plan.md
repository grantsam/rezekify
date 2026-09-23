# Impeccable Frontend Polish & Bento Alignment Implementation Plan

**Goal**: Address all material findings from the Impeccable frontend audit to achieve 100% fidelity with `DESIGN.md` and the `Operate` terminal world. Restructure the dashboard layout into the specified Bento grid, add responsive mobile card-view mode to the ledger table, eliminate Cumulative Layout Shift (CLS) on the bills banner, replace browser alerts with in-surface error banners, enforce WCAG AA minimum 38px touch targets, and calibrate animations to the <= 250ms motion restraint ceiling.

**Architecture & Core Invariants**:
- **Design Philosophy**: `Operate` mode (Utilitarian dark obsidian financial cockpit, high scanability, high contrast, zero decorative fluff).
- **Zero CLS**: Skeletons must mirror exact layout bounds of resolved content.
- **Deterministic Math**: Monetary representations strictly formatted with `id-ID` locale, `tabular-nums`, and explicit signed indicators (`+ Rp`, `- Rp`).
- **WCAG AA Touch Targets**: Interactive targets must meet or exceed 38x38px.
- **Motion Restraint**: Maximum transition duration of <= 250ms (snappy terminal velocity).

---

## Execution Checklist

- [x] **Phase 1: Layout Stacking, 12-Column Desktop Bento Grid & Top Bar Telemetry**
  - [x] 1.1 Restructure `DashboardPage.tsx` layout stacking per DESIGN.md Section 3:
        1. Top Bar with pulsing green telemetry dot and Telegram sync status badge.
        2. Primary Hero: `OmniInputHero` directly under the active account strip.
        3. Telemetry & Analytics Bento Row: `RunwayMetricCard` (lg:col-span-5) and `ExpenseCharts` (lg:col-span-7) side-by-side in `lg:grid lg:grid-cols-12 lg:gap-6`.
        4. Commitment & Sinking Fund Vaults: `VaultsSection`.
        5. Transactions Ledger: `TransactionsTable`.
  - [x] 1.2 Add `animate-pulse` to the green status dot in the Top Bar logo.
  - [x] 1.3 Add live Telegram sync status chip in Top Bar (`user?.telegram_chat_id ? 'Telegram Terhubung' : 'Telegram Belum Terhubung'`).
  - [x] 1.4 Mount `UpcomingBillsCard` unconditionally with `isLoading={isLoading}` so `upcoming-bills-skeleton` renders during data load and eliminates CLS (DESIGN.md 4.4).
  - [x] 1.5 Update `DashboardPage.test.tsx` to verify new stacking hierarchy and Top Bar Telegram status chip.
  - [x] 1.6 Verify: `cd frontend && npm test -- src/__tests__/DashboardPage.test.tsx` passes.

- [x] **Phase 2: Transactions Ledger Mobile Card-View, Search Debounce & Category Chips**
  - [x] 2.1 Add 300ms debounce to keyword search in `TransactionsTable.tsx` to stop firing unthrottled filter changes on every keystroke.
  - [x] 2.2 Add category name chip (`bg-slate-800/80 text-slate-300 text-[10px] border border-slate-700/50`) to transaction row metadata by looking up category from `categories` prop.
  - [x] 2.3 Implement mobile responsive card-view mode for viewports `<640px` (`block sm:hidden` card rows with category chips, directional debit/credit badges, formatted amounts, and touch action buttons; `hidden sm:table` for desktop) per DESIGN.md 4.5.
  - [x] 2.4 Enforce `min-h-[38px] px-3.5` on date filter pill buttons to meet WCAG AA standards.
  - [x] 2.5 Update `TransactionsTable.test.tsx` to test search debouncing, category badge rendering, and mobile card view elements.
  - [x] 2.6 Verify: `cd frontend && npm test -- src/__tests__/TransactionsTable.test.tsx` passes.

- [x] **Phase 3: Vaults In-Surface Error Alert Banner & Motion Restraint**
  - [x] 3.1 In `VaultsSection.tsx`, add an optional `errorMessage?: string | null` and `onDismissError?: () => void` prop.
  - [x] 3.2 Render a dismissible error alert banner (`bg-rose-500/10 border-rose-500/30 text-rose-400 rounded-xl p-3 flex items-center justify-between text-xs`) when `errorMessage` is present, satisfying the 4 explicit UI states of DESIGN.md 4.1.
  - [x] 3.3 In `DashboardPage.tsx`, replace `window.alert()` in `handleToggleVaultLock` and `handleDeleteVault` with in-surface vault error state.
  - [x] 3.4 In `VaultCard.tsx`, tune progress bar motion transition from `duration: 0.5` (500ms) to `duration: 0.25` (250ms) with `easeOut` per DESIGN.md Section 5.
  - [x] 3.5 Update `VaultsSection.test.tsx` and `VaultCard.test.tsx` to verify error alert rendering and animation duration.
  - [x] 3.6 Verify: `cd frontend && npm test -- src/__tests__/VaultsSection.test.tsx src/__tests__/VaultCard.test.tsx` passes.

- [x] **Phase 4: Touch Target Compliance & Chart Motion Restraint**
  - [x] 4.1 In `ExpenseCharts.tsx`, update Daily/Monthly toggle tab buttons from `min-h-[36px]` to `min-h-[38px]`.
  - [x] 4.2 In `ExpenseCharts.tsx`, tune bar chart animation from spring physics with prolonged settling to `duration: 0.25, ease: 'easeOut', delay: idx * 0.02` (snappy terminal velocity).
  - [x] 4.3 In `ManualTransactionModal.tsx`, update transaction type buttons (`EXPENSE`, `INCOME`, `TRANSFER`) from `py-2` to `min-h-[38px]` for WCAG AA touch target compliance.
  - [x] 4.4 Update `ExpenseCharts.test.tsx` and `ManualTransactionModal.test.tsx` to verify touch target classes.
  - [x] 4.5 Verify: `cd frontend && npm test -- src/__tests__/ExpenseCharts.test.tsx src/__tests__/ManualTransactionModal.test.tsx` passes.

- [x] **Phase 5: Full Regression Testing & Production Build Verification**
  - [x] 5.1 Run full frontend test suite: `cd frontend && npm test` (19 passed, 191 passed).
  - [x] 5.2 Run production build check: `cd frontend && npm run build` (built cleanly in 7.86s).
  - [x] 5.3 Run blackbox integration tests: `pytest tests/test_frontend_blackbox.py -v` (6 passed).
  - [x] 5.4 Update `DESIGN.md` if any component token or layout specification evolved.
