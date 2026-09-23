# Rezekify UI/UX Impeccable Transformation Plan

**Goal**: Transform Rezekify into a world-class, dark-mode financial terminal ("Operate" cockpit mode) utilizing `@heroui/react` and `framer-motion` primitives. Unify duplicated modal components, elevate the multi-modal Omni-Input (voice waves & receipt dropzone), enhance the Runway Telemetry visual hierarchy, implement zero-layout-shift skeletons, and ensure responsive touch targets and WCAG contrast compliance.

**Design Philosophy**:
- **Surface Mode**: `Operate` (Utilitarian dark obsidian financial cockpit, high scanability, high contrast).
- **Core Primitives**: `@heroui/react` (Modal, Tooltip, Progress, Chip, Button), `framer-motion` (spring physics, layout transitions, pulsing waves), and Tailwind CSS tokens (`bg-slate-950`, `border-slate-800`, emerald/amber/rose telemetry).

---

## Architecture & Proposed Changes

### 1. Modal Consolidation (Deduplication)
- **Vaults**: Unify `VaultModal.tsx` and `EditVaultModal.tsx` into a single polymorphic `VaultModal.tsx` taking `initialVault?: Vault` or `mode?: 'create' | 'edit'`. Delete redundant `EditVaultModal.tsx` once verified.
- **Transactions**: Unify `ManualTransactionModal.tsx` and `EditTransactionModal.tsx` into `TransactionModal.tsx` (`mode?: 'create' | 'edit'`). Delete redundant `EditTransactionModal.tsx` once verified.
- Consolidate error handling, form resetting, and accessible ARIA attributes across unified modals.

### 2. Multi-Modal Omni-Input Elevation (`OmniInputHero.tsx`)
- Drag-and-drop visual dropzone overlay for receipt images with border-glow animation (`border-indigo-500/50`) and thumbnail chip preview with remove button.
- Voice Recording UI: Animated multi-bar frequency equalizer using `framer-motion`, recording timer badge (`00:05`), and high-contrast Rose pulse ring.
- Quick action shortcuts: `Esc` to cancel recording/image, `Ctrl+Enter` to submit.

### 3. Runway Telemetry & Bento Hierarchy (`RunwayMetricCard.tsx`, `UpcomingBillsCard.tsx`)
- Runway gauge visualizer: Enhanced visual progress track with dynamic traffic-light gradient (`emerald-500` / `amber-500` / `rose-500`) based on days remaining and burn rate.
- Replace raw loading text/spinners with structured HeroUI / Tailwind Skeleton placeholders to prevent Cumulative Layout Shift (CLS).
- Upcoming Bills: Interactive days-until-due badges (`H-1` urgent alert styling vs `H-7` calm amber).

### 4. Transactions Ledger Table (`TransactionsTable.tsx`)
- Mobile ergonomics: Auto-switch from desktop HTML table to responsive card rows on viewports `<640px`.
- Animated deletion and update transitions via `AnimatePresence`.
- Sticky table header on scroll with backdrop blur (`backdrop-blur-md bg-slate-950/80`).

---

## Execution Checklist

- [x] **Phase 1: Modal Consolidation & Form Ergonomics**
  - [x] 1.1 Refactor `VaultModal.tsx` to support both create and edit modes (`initialVault?: Vault`).
  - [x] 1.2 Update `DashboardPage.tsx` and `VaultsSection.tsx` to use the unified `VaultModal`.
  - [x] 1.3 Refactor `ManualTransactionModal.tsx` to `TransactionModal.tsx` supporting create and edit modes (`initialTransaction?: Transaction`).
  - [x] 1.4 Update `DashboardPage.tsx` and `TransactionsTable.tsx` to use the unified `TransactionModal`.
  - [x] 1.5 Update frontend unit tests (`VaultModal.test.tsx`, `ManualTransactionModal.test.tsx`, `TransactionsTable.test.tsx`).
  - [x] 1.6 Verify: `npm run build && npm run test` passes cleanly.

- [x] **Phase 2: Omni-Input Multi-Modal & Keyboard Ergonomics**
  - [x] 2.1 Add drag-and-drop file dropzone state, visual border glow, and thumbnail badge preview to `OmniInputHero.tsx`.
  - [x] 2.2 Enhance voice recording UI with animated frequency bars (`framer-motion`) and elapsed timer counter.
  - [x] 2.3 Add keyboard navigation (`Esc` cancels attachment/voice, `Ctrl+Enter` / `Enter` submits).
  - [x] 2.4 Verify: `npm run test` passes for `OmniInputHero.test.tsx`.

- [x] **Phase 3: Runway Telemetry, Skeleton Loading & Bento Flow**
  - [x] 3.1 Implement zero-layout-shift Skeleton loading placeholders for Dashboard cards (`RunwayMetricCard`, `UpcomingBillsCard`, `ExpenseCharts`).
  - [x] 3.2 Polish Runway Telemetry gauge with dynamic high-contrast gradient tracks and status glow tokens.
  - [x] 3.3 Enhance Upcoming Bills card with priority H-due badges (`H-1` to `H-3` pulse alert).
  - [x] 3.4 Verify: Component tests pass cleanly.

- [x] **Phase 4: Transactions Ledger & Mobile Viewport Ergonomics**
  - [x] 4.1 Implement responsive mobile card-view mode for transactions (`<640px`) maintaining accessible table mode for tablet/desktop.
  - [x] 4.2 Add `AnimatePresence` row exit transitions for smooth deletion feedback.
  - [x] 4.3 Add sticky header with backdrop blur to transactions container.
  - [x] 4.4 Verify: `TransactionsTable.test.tsx` and `DashboardPage.test.tsx` pass.

- [x] **Phase 5: Design Polish, Accessibility & End-to-End Verification**
  - [x] 5.1 Audit touch target sizes (minimum 44x44px for buttons, lock icons, pagination arrows).
  - [x] 5.2 Validate WCAG contrast, ARIA modal roles, and focus trap behavior.
  - [x] 5.3 Run full frontend test suite (`npm run build && npm run test`).
  - [x] 5.4 Run live Docker blackbox test (`py -3.12 -m pytest tests/test_frontend_blackbox.py -v`).
  - [x] 5.5 Update `DESIGN.md` documentation if any token or layout specification evolved.
