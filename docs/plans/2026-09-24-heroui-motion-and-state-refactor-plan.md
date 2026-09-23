# HeroUI, Framer-Motion & Domain State Refactor Implementation Plan

**Goal**: Achieve 100% architectural consistency across the Rezekify frontend by:
1. Standardizing all UI primitives to `@heroui/react` (`Button` with `onPress`, `Chip`, `Card`, `Modal`) and unifying `framer-motion` micro-interactions (`AnimatePresence`, layout transitions).
2. Decomposing the `DashboardPage.tsx` monolithic state into 3 lightweight, zero-dependency domain custom hooks (`useDashboardData`, `useTransactionsLedger`, `useDashboardModals`) and eliminating the brittle numeric `refreshTrigger` hack.
3. Eliminating the last remaining native `window.alert()` on transaction deletion and all HeroUI `onClick` deprecation warnings.

**Core Invariants**:
- **Zero New Dependencies**: Pure React 18 + TypeScript + existing `@heroui/react` and `framer-motion`.
- **Zero CLS & Deterministic Math**: Preserved formatting (`id-ID`, `tabular-nums`, signed prefixes).
- **Test Integrity**: All existing 191+ tests must continue passing without regression.

---

## Execution Checklist

- [x] **Phase 1: Domain State Management Hooks (`frontend/src/hooks/`)**
  - [x] 1.1 Create `frontend/src/hooks/useDashboardModals.ts` and test `frontend/src/__tests__/useDashboardModals.test.ts` to manage all modal visibility and selected entity state (`accountModal`, `vaultModal`, `txModal`, `categoryModal`, `simulateModal`, `settingsModal`).
  - [x] 1.2 Create `frontend/src/hooks/useTransactionsLedger.ts` and test `frontend/src/__tests__/useTransactionsLedger.test.ts` to encapsulate transactions fetching, pagination, 300ms debounced search, and date filters.
  - [x] 1.3 Create `frontend/src/hooks/useDashboardData.ts` and test `frontend/src/__tests__/useDashboardData.test.ts` to encapsulate `summary`, `accounts`, `vaults`, `categories`, and `refreshAll()` data lifecycle.
  - [x] 1.4 Refactor `DashboardPage.tsx` to consume the 3 domain hooks, eliminate the 20+ state declarations and `refreshTrigger` counter, and replace the remaining native `alert()` on transaction delete with in-surface error state.
  - [x] 1.5 Verify: `npm test -- src/__tests__/DashboardPage.test.tsx src/__tests__/useDashboardModals.test.ts src/__tests__/useTransactionsLedger.test.ts src/__tests__/useDashboardData.test.ts` passes.

- [x] **Phase 2: HeroUI & Framer-Motion Standardisasi on Vaults (`VaultsSection.tsx`, `VaultCard.tsx`)**
  - [x] 2.1 In `VaultCard.tsx`:
        - Convert `Tagihan Tetap`, `Tabungan`, and `Terkunci` status badges to HeroUI `<Chip size="sm" variant="flat" ...>`.
        - Convert Lock, Edit, and Delete action buttons to HeroUI `<Button isIconOnly size="sm" variant="flat" onPress=...>`.
  - [x] 2.2 In `VaultsSection.tsx`:
        - Convert `+ Tambah Vault` and tab buttons to HeroUI `<Button onPress=...>` with dark slate styling.
        - Wrap the vault cards grid in `AnimatePresence` and `motion.div` with layout transitions so switching tabs animates smoothly.
  - [x] 2.3 Update and verify: `npm test -- src/__tests__/VaultsSection.test.tsx src/__tests__/VaultCard.test.tsx` passes.

- [x] **Phase 3: HeroUI & Framer-Motion Standardisasi on Ledger, Analytics & Bills**
  - [x] 3.1 In `TransactionsTable.tsx`:
        - Convert date filter pills and pagination buttons (`Sebelumnya`, `Berikutnya`) to HeroUI `<Button size="sm" onPress=...>`.
        - Convert row action buttons (Edit, Delete) in desktop table and mobile cards to HeroUI `<Button isIconOnly size="sm" onPress=...>`.
        - Migrate all `onClick` to `onPress` across HeroUI components to eliminate console deprecation warnings.
  - [x] 3.2 In `ExpenseCharts.tsx`:
        - Standardize Daily vs Monthly tab switcher to HeroUI `<Button size="sm" onPress=...>`.
        - Remove `refreshTrigger` prop dependency in favor of unified data refresh event or callback.
  - [x] 3.3 In `UpcomingBillsCard.tsx`:
        - Wrap card container in HeroUI `<Card>` / `<CardBody>` tokens, convert count badge to HeroUI `<Chip size="sm" color="warning" variant="flat">`.
        - Add gentle enter motion (`motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}`).
  - [x] 3.4 Update and verify: `npm test -- src/__tests__/TransactionsTable.test.tsx src/__tests__/ExpenseCharts.test.tsx src/__tests__/UpcomingBillsCard.test.tsx` passes.

- [x] **Phase 4: HeroUI Form Controls & Event Migration in Modals & Omni-Input**
  - [x] 4.1 In `OmniInputHero.tsx`:
        - Standardize microphone recorder button, stop button, upload button, and submit button to HeroUI `<Button onPress=...>` while retaining Framer Motion audio visualizer equalizer and pulse glow.
  - [x] 4.2 Across all modal components (`ManualTransactionModal`, `CategoryManagerModal`, `AccountModal`, `VaultModal`, `SettingsModal`, `SimulatePurchaseModal`):
        - Replace any remaining native buttons and `onClick` handlers on HeroUI components with `onPress`.
  - [x] 4.3 Verify modal unit tests: `npm test -- src/__tests__/ManualTransactionModal.test.tsx src/__tests__/CategoryManagerModal.test.tsx src/__tests__/SettingsModal.test.tsx` passes.

- [x] **Phase 5: Full Regression Testing, Build & Clean Console Gate**
  - [x] 5.1 Run full frontend test suite: `cd frontend && npm test`.
  - [x] 5.2 Verify production build: `cd frontend && npm run build`.
  - [x] 5.3 Run backend blackbox tests: `pytest tests/test_frontend_blackbox.py -v`.
  - [x] 5.4 Confirm elimination of all `[Hero UI] [useButton]: onClick is deprecated, please use onPress instead` warnings in test outputs.
  - [x] 5.5 Update `DESIGN.md` with the unified component token and hook architecture.
