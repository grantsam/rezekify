# Rezekify Frontend Full Harmonization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all 16 open frontend audit issues to achieve 100% design system compliance with Modern Zinc Studio.

**Architecture:** Component-level standardization across HeroUI buttons, ARIA radio groups, CTA colors, motion restraint, HeroUI cards, and HeroUI selects. Preserves all business logic, deterministic math, and API interfaces.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS, HeroUI (@heroui/react), Framer Motion, Lucide React.

**Spec:** docs/superpowers/specs/2026-09-25-frontend-full-harmonization-design.md

## Global Constraints

- Do not alter deterministic math, financial calculation formulas, or API contract signatures.
- Retain all existing test coverage and pass `npm test --prefix frontend -- --run` with exit code 0.
- Ensure production build (`npm run build --prefix frontend`) passes with zero TypeScript compile errors.
- Keep CSS bundle size bounded below 85KB.
- Ensure minimum 38px touch target on all interactive buttons.

## Review Focus

1. **Button Event Handling**: Every `<Button>` must use `onPress` rather than `onClick`.
2. **Modal Form Submission**: All modal submit buttons must consistently use `bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl`.
3. **Motion Duration Compliance**: No animations exceed 250ms; decorative `animate-pulse` removed from static elements.
4. **HeroUI Card Foundations**: Metric cards wrapped in `<Card>` and `<CardBody>` with `bg-[#141417]` and `border-zinc-800/80`.
5. **Form Dropdown Reliability**: HeroUI `<Select>` components must cleanly bind values and propagate change events to existing form state hooks without breaking form resets.

---

### Task 1: Tailwind Configuration & Utility Polish

**Files:**
- Modify: `frontend/tailwind.config.js`
- Modify: `frontend/src/components/VaultsView.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/components/OverviewView.tsx`

**Interfaces:**
- Produces: Clean Tailwind theme with select component styles, no dead shadows, and valid padding/tabular-nums classes.

- [ ] **Step 1: Update `frontend/tailwind.config.js`**
  - Add `select`, `popover`, and `listbox` to HeroUI content glob:
    ```javascript
    "./node_modules/@heroui/theme/dist/components/(button|modal|chip|progress|tooltip|card|select|popover|listbox).js",
    ```
  - Remove unused `boxShadow: { 'glow-*': ... }` block from `theme.extend`.

- [ ] **Step 2: Fix `py-0.2` typo and add `tabular-nums`**
  - In `frontend/src/components/VaultsView.tsx:57`: change `py-0.2` to `py-0.5 px-2`.
  - In `frontend/src/components/Sidebar.tsx:129`: change `py-0.2` to `py-0.5 px-2`.
  - In `frontend/src/components/OverviewView.tsx:227`: add `tabular-nums` to `className="flex items-center justify-between text-[11px] text-zinc-400 font-mono tabular-nums"`.

- [ ] **Step 3: Verify build**
  Run: `npm run build --prefix frontend`
  Expected: Clean build.

- [ ] **Step 4: Commit**
  ```bash
  git add frontend/tailwind.config.js frontend/src/components/VaultsView.tsx frontend/src/components/Sidebar.tsx frontend/src/components/OverviewView.tsx
  git commit -m "style(frontend): update tailwind heroui components, remove unused shadows, and fix utility typos"
  ```

---

### Task 2: Motion Restraint & Calm Terminal Polish

**Files:**
- Modify: `frontend/src/components/QuickCaptureBar.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/components/SettingsModal.tsx`

**Interfaces:**
- Produces: Calm terminal aesthetic with transition durations <= 250ms and static status pills.

- [ ] **Step 1: Cap QuickCaptureBar equalizer duration to 250ms**
  - In `frontend/src/components/QuickCaptureBar.tsx:250`:
    Change `duration: 0.4 + idx * 0.1` to `duration: 0.25`.

- [ ] **Step 2: Remove continuous `animate-pulse` from logo and Telegram status**
  - In `frontend/src/components/Sidebar.tsx:73`:
    Change `className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse"` to:
    `className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400"`
  - In `frontend/src/components/SettingsModal.tsx:301`:
    Remove `animate-pulse` from Telegram connected indicator dot.

- [ ] **Step 3: Run tests & verify**
  Run: `npm test --prefix frontend -- src/__tests__/QuickCaptureBar.test.tsx src/__tests__/SettingsModal.test.tsx --run`
  Expected: All pass.

- [ ] **Step 4: Commit**
  ```bash
  git add frontend/src/components/QuickCaptureBar.tsx frontend/src/components/Sidebar.tsx frontend/src/components/SettingsModal.tsx
  git commit -m "perf(motion): enforce 250ms equalizer limit and remove continuous decorative pulse"
  ```

---

### Task 3: View Entry Transitions & HeroUI Card Foundations

**Files:**
- Modify: `frontend/src/components/OverviewView.tsx`
- Modify: `frontend/src/components/ExpenseCharts.tsx`
- Modify: `frontend/src/components/RunwayMetricCard.tsx`
- Modify: `frontend/src/components/LedgerView.tsx`
- Modify: `frontend/src/components/VaultsView.tsx`
- Modify: `frontend/src/pages/AuthPage.tsx`

**Interfaces:**
- Produces: Official HeroUI Card containers and smooth 200ms entry transitions across views.

- [ ] **Step 1: Wrap metric containers in HeroUI `<Card>` and `<CardBody>`**
  - Import `{ Card, CardBody }` from `@heroui/react` in `OverviewView.tsx`, `ExpenseCharts.tsx`, and `RunwayMetricCard.tsx`.
  - Replace raw outer container `<div>` with `<Card className="bg-[#141417] border border-zinc-800/80 rounded-2xl shadow-none">` and `<CardBody className="p-5">`.

- [ ] **Step 2: Add 200ms entry transition to views**
  - In `LedgerView.tsx`, `VaultsView.tsx`, and `AuthPage.tsx`:
    Wrap top container with `<motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>`.

- [ ] **Step 3: Run tests & verify**
  Run: `npm test --prefix frontend -- --run`
  Expected: All pass.

- [ ] **Step 4: Commit**
  ```bash
  git add frontend/src/components/OverviewView.tsx frontend/src/components/ExpenseCharts.tsx frontend/src/components/RunwayMetricCard.tsx frontend/src/components/LedgerView.tsx frontend/src/components/VaultsView.tsx frontend/src/pages/AuthPage.tsx
  git commit -m "feat(ui): use HeroUI Card foundations and add smooth view entry transitions"
  ```

---

### Task 4: Modal Form Submit CTA Standardization

**Files:**
- Modify: `frontend/src/components/AccountModal.tsx`
- Modify: `frontend/src/components/VaultModal.tsx`
- Modify: `frontend/src/components/CategoryManagerModal.tsx`

**Interfaces:**
- Produces: Unified `bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl` CTA across all modal forms.

- [ ] **Step 1: Update modal submit buttons from `bg-emerald-500` to `bg-indigo-600`**
  - In `AccountModal.tsx`: update submit button class to `bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl shadow-sm`.
  - In `VaultModal.tsx`: update submit button class to `bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl shadow-sm`.
  - In `CategoryManagerModal.tsx`: update submit button class to `bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl shadow-sm`.

- [ ] **Step 2: Run modal tests**
  Run: `npm test --prefix frontend -- src/__tests__/AccountModal.test.tsx src/__tests__/VaultModal.test.tsx src/__tests__/CategoryManagerModal.test.tsx --run`
  Expected: All pass.

- [ ] **Step 3: Commit**
  ```bash
  git add frontend/src/components/AccountModal.tsx frontend/src/components/VaultModal.tsx frontend/src/components/CategoryManagerModal.tsx
  git commit -m "style(modals): standardize modal submit action CTA to indigo across all forms"
  ```

---

### Task 5: Button & Event Standardization (Shell, Views & Pages)

**Files:**
- Modify: `frontend/src/pages/AuthPage.tsx`
- Modify: `frontend/src/components/BottomDock.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/components/VaultsView.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/components/QuickCaptureBar.tsx`
- Modify: `frontend/src/components/RunwayMetricCard.tsx`

**Interfaces:**
- Produces: Native `<button onClick>` elimination across navigation shell and views.

- [ ] **Step 1: Convert native `<button>` to HeroUI `<Button onPress>` in shell & views**
  - In `AuthPage.tsx`: convert tab switchers and submit buttons to `<Button onPress>`.
  - In `BottomDock.tsx`: convert 5 navigation buttons to `<Button onPress>`.
  - In `Sidebar.tsx`: convert nav item button to `<Button onPress>`.
  - In `VaultsView.tsx`: convert 3 filter tab buttons to `<Button onPress>`.
  - In `DashboardPage.tsx`: convert error dismiss button to `<Button onPress>`.
  - In `QuickCaptureBar.tsx`: convert file remove and toast dismiss buttons to `<Button onPress>`.
  - In `RunwayMetricCard.tsx`: convert onOpenAuth button to `<Button onPress>`.

- [ ] **Step 2: Run shell & page tests**
  Run: `npm test --prefix frontend -- src/__tests__/AuthPage.test.tsx src/__tests__/NavigationShell.test.tsx src/__tests__/DashboardPage.test.tsx --run`
  Expected: All pass.

- [ ] **Step 3: Commit**
  ```bash
  git add frontend/src/pages/AuthPage.tsx frontend/src/components/BottomDock.tsx frontend/src/components/Sidebar.tsx frontend/src/components/VaultsView.tsx frontend/src/pages/DashboardPage.tsx frontend/src/components/QuickCaptureBar.tsx frontend/src/components/RunwayMetricCard.tsx
  git commit -m "refactor(buttons): migrate native button onClick to HeroUI Button onPress across shell and views"
  ```

---

### Task 6: Button & Event Standardization (Modals & Tables) + ARIA Radio

**Files:**
- Modify: `frontend/src/components/SettingsModal.tsx`
- Modify: `frontend/src/components/CategoryManagerModal.tsx`
- Modify: `frontend/src/components/ManualTransactionModal.tsx`
- Modify: `frontend/src/components/VaultModal.tsx`
- Modify: `frontend/src/components/AccountModal.tsx`
- Modify: `frontend/src/components/TransactionsTable.tsx`
- Modify: `frontend/src/components/VaultCard.tsx`

**Interfaces:**
- Produces: HeroUI `<Button onPress>` across all modals and tables, with `role="radiogroup"` and `role="radio"` attributes.

- [ ] **Step 1: Convert native buttons to `<Button onPress>` in modals and tables**
  - In `SettingsModal.tsx`: convert 7 tab, radio selection, and toggle buttons.
  - In `CategoryManagerModal.tsx`: convert 4 tab and color/icon selector buttons.
  - In `ManualTransactionModal.tsx`: convert transaction type pill buttons.
  - In `VaultModal.tsx`: convert vault type selector buttons.
  - In `AccountModal.tsx`: convert account type selector buttons.
  - In `TransactionsTable.tsx`: convert clear search button.
  - Clean up redundant `disabled` / `type="button"` attributes across buttons.

- [ ] **Step 2: Add ARIA `role="radiogroup"` and `role="radio"` attributes**
  - Add `role="radiogroup"` to transaction type, vault type, and AI provider button groups.
  - Add `role="radio"` and `aria-checked={isSelected}` to each option button.

- [ ] **Step 3: Run modal & table tests**
  Run: `npm test --prefix frontend -- src/__tests__/TransactionsTable.test.tsx src/__tests__/SettingsModal.test.tsx src/__tests__/ManualTransactionModal.test.tsx --run`
  Expected: All pass.

- [ ] **Step 4: Commit**
  ```bash
  git add frontend/src/components/SettingsModal.tsx frontend/src/components/CategoryManagerModal.tsx frontend/src/components/ManualTransactionModal.tsx frontend/src/components/VaultModal.tsx frontend/src/components/AccountModal.tsx frontend/src/components/TransactionsTable.tsx frontend/src/components/VaultCard.tsx
  git commit -m "refactor(buttons): migrate modal buttons to HeroUI Button onPress and add ARIA radio semantics"
  ```

---

### Task 7: Form Dropdowns: HeroUI `<Select>` Migration

**Files:**
- Modify: `frontend/src/components/ManualTransactionModal.tsx`
- Modify: `frontend/src/components/TransactionsTable.tsx`
- Modify: `frontend/src/components/SettingsModal.tsx`

**Interfaces:**
- Produces: Consistent HeroUI `<Select>` and `<SelectItem>` dropdowns with Modern Zinc styling.

- [ ] **Step 1: Replace native `<select>` in `ManualTransactionModal.tsx`**
  - Replace account and category dropdowns with HeroUI `<Select>` and `<SelectItem>`.

- [ ] **Step 2: Replace native `<select>` in `TransactionsTable.tsx`**
  - Replace account and category filter dropdowns with HeroUI `<Select>` and `<SelectItem>`.

- [ ] **Step 3: Replace native `<select>` in `SettingsModal.tsx`**
  - Replace model selector dropdown with HeroUI `<Select>` and `<SelectItem>`.

- [ ] **Step 4: Run tests & verify build**
  Run: `npm test --prefix frontend -- --run`
  Run: `npm run build --prefix frontend`
  Expected: All pass, exit code 0.

- [ ] **Step 5: Commit**
  ```bash
  git add frontend/src/components/ManualTransactionModal.tsx frontend/src/components/TransactionsTable.tsx frontend/src/components/SettingsModal.tsx
  git commit -m "feat(forms): migrate raw select elements to HeroUI Select and SelectItem"
  ```

---

### Task 8: Verification & Audit Report Resolution

**Files:**
- Modify: `docs/audit/FRONTEND_AUDIT_2026-09-25.md`

**Interfaces:**
- Produces: 100% resolved audit report with verified test evidence.

- [ ] **Step 1: Execute full test verification**
  - Run `pytest`
  - Run `npm test --prefix frontend -- --run`
  - Run `npm run build --prefix frontend`
  - Ensure 100% exit code 0 across all suites.

- [ ] **Step 2: Update `docs/audit/FRONTEND_AUDIT_2026-09-25.md`**
  - Update status summary to 23 of 23 resolved (100% compliance).
  - Mark P0-2, P1-1, P1-3, P1-4, P1-5, P1-6, P1-7, P1-8, P2-1, P2-3, P2-6, P3-1, P3-2, P3-3, P3-4, P3-5 as `🟢 RESOLVED`.

- [ ] **Step 3: Commit**
  ```bash
  git add docs/audit/FRONTEND_AUDIT_2026-09-25.md
  git commit -m "docs(audit): mark all 23 frontend audit issues as fully resolved"
  ```
