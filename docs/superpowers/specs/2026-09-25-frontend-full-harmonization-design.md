# Rezekify Frontend Full Harmonization & Design System Alignment Specification

- **Date:** 2026-09-25
- **Author:** Principal Software Engineer / Thinker Tier
- **Status:** Approved
- **SOP Reference:** DESIGN.md (Modern Zinc Studio) + docs/audit/FRONTEND_AUDIT_2026-09-25.md
- **Target Branch:** main

---

## 1. Executive Summary & Goals

This specification details the complete frontend remediation required to resolve the 16 remaining open issues identified in `docs/audit/FRONTEND_AUDIT_2026-09-25.md`. 

The overarching goal is to achieve **100% Design System Compliance** with Rezekify's **Modern Zinc Studio** design language, enforcing:
1. Complete migration from native `<button onClick>` to HeroUI `<Button onPress>` across all 13 affected files.
2. Unification of CTA button styles (Monochromatic `bg-white text-zinc-950` for top-level view actions; `bg-indigo-600 hover:bg-indigo-500 text-white` for modal form submissions).
3. Motion restraint (durations <= 250ms, removal of perpetual `animate-pulse`, and `prefers-reduced-motion` compliance).
4. Accessibility enhancements (ARIA radio groups, clean prop hygiene).
5. Replacement of native `<select>` controls with HeroUI `<Select>` and `<SelectItem>`.

---

## 2. Invariants & Scope Boundaries

1. **Deterministic Double-Entry & Logic Intact**: Zero changes to financial calculations, API endpoints, serialization schemas, or state hooks (`useDashboardData`, `useTransactionsLedger`).
2. **Zero Color Regression**: No re-introduction of legacy `slate-*` tokens. All colors must align with Modern Zinc Studio (`#0c0c0e` root canvas, `#141417` card surfaces, `zinc-800` borders, `zinc-400` muted text).
3. **Responsive & Mobile First**: Minimum touch target size of 38px retained across all button conversions.
4. **Test Suite Stability**: All Vitest component suites must pass with zero errors.

---

## 3. Detailed Component Designs

### 3.1 Button & Interactivity Standardization (`P0-2`, `P3-1`, `P3-3`)
- **Problem**: 26+ native `<button onClick>` elements bypass HeroUI's focus management, keyboard interaction (Enter + Space), and ARIA semantics.
- **Specification**:
  - Replace all native `<button>` elements with `@heroui/react` `<Button>`.
  - Replace all `onClick` props on buttons with `onPress`.
  - For tab switchers and pill buttons (`AuthPage.tsx`, `SettingsModal.tsx`, `CategoryManagerModal.tsx`, `VaultsView.tsx`), use:
    ```tsx
    <Button
      size="sm"
      variant="light"
      onPress={() => setActiveTab(tab)}
      className={activeTab === tab ? "bg-zinc-800 text-white font-medium" : "text-zinc-400 hover:text-zinc-200"}
    >
      {tabLabel}
    </Button>
    ```
  - Remove redundant `type="button"` attributes on HeroUI `<Button>`.
  - Replace dual `disabled` + `isDisabled` props with single `isDisabled`.

### 3.2 Accessibility: ARIA Radio Groups (`P2-3`)
- **Problem**: Toggle selectors (e.g. Transaction Type in `ManualTransactionModal`, Vault Type in `VaultModal`, AI Provider in `SettingsModal`) lack semantic radio attributes for screen readers.
- **Specification**:
  - Add `role="radiogroup"` and `aria-label` to selector container wrappers.
  - Add `role="radio"` and `aria-checked={isSelected}` to each selectable option button.

### 3.3 Spacing Bug Fix (`P3-2`)
- **Problem**: `VaultsView.tsx:57` and `Sidebar.tsx:129` use invalid Tailwind class `py-0.2`.
- **Specification**: Replace with valid utility `py-0.5 px-2`.

### 3.4 Modal CTA Standardization (`P1-3`, `P1-4`)
- **Problem**: Modal actions mix green emerald (`bg-emerald-500`) and purple indigo (`bg-indigo-600`), conflicting with top-level view actions.
- **Specification**:
  - **Top-Level Actions** (`LedgerView.tsx`, `VaultsView.tsx`):
    - Primary CTA: `bg-white text-zinc-950 hover:bg-zinc-200 font-medium text-xs rounded-xl shadow-sm`
  - **Modal Form Submissions** (`AccountModal`, `VaultModal`, `ManualTransactionModal`, `SimulatePurchaseModal`, `SettingsModal`, `CategoryManagerModal`):
    - Submit Button: `bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl shadow-sm`
  - Emerald tokens are reserved strictly for positive telemetry status (`HEALTHY`) and income transaction badges.

### 3.5 Tabular Numbers Enforced (`P1-7`)
- **Problem**: Mini-vault progress amounts in `OverviewView.tsx:227` lack `tabular-nums`.
- **Specification**: Add `tabular-nums` class to `font-mono` monetary figures to guarantee uniform column widths.

### 3.6 Container Structure: HeroUI `<Card>` (`P1-8`)
- **Problem**: Metric containers in `OverviewView.tsx`, `ExpenseCharts.tsx`, and `RunwayMetricCard.tsx` use raw `<div>`.
- **Specification**:
  - Wrap metric cards in `<Card className="bg-[#141417] border border-zinc-800/80 rounded-2xl shadow-none">` with `<CardBody className="p-5">`.

### 3.7 Motion Restraint & Calm Terminal (`P1-1`, `P1-6`, `P1-5`, `P2-6`, `P3-5`)
- **Specification**:
  - **QuickCaptureBar Equalizer**: Cap transition duration to `0.25s` (250ms). Add `@media (prefers-reduced-motion)` check or `motion-reduce:hidden` support.
  - **Sidebar & Settings Dots**: Remove `animate-pulse` from Rezekify logo badge (`Sidebar.tsx:73`) and Telegram status dot (`SettingsModal.tsx:301`). Keep as static solid emerald pill (`w-2 h-2 rounded-full bg-emerald-400`).
  - **View Transitions**: Add smooth 200ms entry transition `<motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>` in `LedgerView.tsx`, `VaultsView.tsx`, and `AuthPage.tsx`.
  - **Transition Specificity**: Replace `transition-all` with `transition-colors` or `transition-transform`.

### 3.8 Form Controls: HeroUI `<Select>` (`P2-1`)
- **Problem**: Raw HTML `<select>` in `ManualTransactionModal.tsx`, `TransactionsTable.tsx`, and `SettingsModal.tsx`.
- **Specification**:
  - Update `frontend/tailwind.config.js` content paths to include `select`, `popover`, and `listbox`:
    ```javascript
    "./node_modules/@heroui/theme/dist/components/(button|modal|chip|progress|tooltip|card|select|popover|listbox).js",
    ```
  - Migrate native `<select>` to `@heroui/react` `<Select>` with custom dark zinc classes (`bg-zinc-900 border-zinc-800`).

### 3.9 Zero-Bloat Tailwind Config Cleanup (`P3-4`)
- **Specification**: Remove unused `boxShadow: { 'glow-*': ... }` entries from `frontend/tailwind.config.js`.

---

## 4. Verification & Testing Plan

1. **Vitest Unit Tests**:
   - Run `npm test --prefix frontend -- --run`.
   - All 25 test files must pass with exit code 0.
2. **TypeScript & Production Build**:
   - Run `npm run build --prefix frontend`.
   - Verify 0 type errors and verify CSS bundle size remains strictly bounded below 85KB.
3. **Audit Document Update**:
   - Update `docs/audit/FRONTEND_AUDIT_2026-09-25.md` to reflect all 23 issues marked as `🟢 RESOLVED`.
