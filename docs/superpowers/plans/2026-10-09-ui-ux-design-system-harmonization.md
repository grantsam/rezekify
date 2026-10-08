# UI/UX & Design System Harmonization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish semantic surface tokens, unify currency formatting, align interactive navigation states to Indigo (reserving Emerald exclusively for positive financial telemetry), enforce 38px touch targets, and balance Overview Tier 3 layout.

**Architecture:** Tailwind config extension adds `surface-*` tokens. A central `formatRupiah` utility in `frontend/src/utils/formatters.ts` provides consistent numeric precision and tabular alignment. Navigation components (`Sidebar`, `BottomDock`) transition from emerald to indigo active highlights. `UpcomingBillsCard` introduces a serene empty state keeping Tier 3 grid balanced.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS, Lucide React, Framer Motion, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-09-ui-ux-design-system-harmonization.md`

## Global Constraints

- Accent Separation: Indigo (`#6366f1` / `brand-500`) for navigation & UI focus; Emerald (`#10b981`) exclusively for positive financial health (income, healthy runway, positive cashflow).
- Semantic Tokens: `surface-canvas` (`#0c0c0e`), `surface-card` (`#141417`), `surface-subtle` (`#1a1a1e`), `surface-border` (`rgba(39, 39, 42, 0.8)`).
- Currency Standardization: `formatRupiah(amount)` produces consistent IDR formatting without trailing `.00` cents, paired with `.tabular-nums`.
- Touch Target Floor: Minimum 38px on all interactive icon buttons (`min-w-[38px] min-h-[38px]`).
- Zero Visual Regressions: All existing test suites pass.

## Review Focus

1. `formatRupiah` handles zero, negative amounts, and large numbers cleanly without `.00` cents (`test_format_rupiah_precision_and_prefix`).
2. `Sidebar` active state highlights with indigo accents instead of emerald (`test_sidebar_active_state_uses_indigo_styling`).
3. `Sidebar` collapse toggle meets 38px minimum touch target (`test_sidebar_collapse_toggle_touch_target`).
4. `BottomDock` active navigation highlights with indigo text and icon (`test_bottom_dock_active_state_uses_indigo`).
5. `UpcomingBillsCard` renders a calm empty reassurance card when no bills are due within 7 days, preventing layout collapse (`test_upcoming_bills_card_empty_state_renders_reassurance_card`).

---

### Task 1: Semantic Surface Tokens & Central Currency Formatter

**Files:**
- Modify: `frontend/tailwind.config.js`
- Create: `frontend/src/utils/formatters.ts`
- Create: `frontend/src/__tests__/formatters.test.ts`

**Interfaces:**
- Produces: `formatRupiah(amount: number, options?: { showPrefix?: boolean, compact?: boolean }): string`

- [ ] **Step 1: Write failing tests in `frontend/src/__tests__/formatters.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { formatRupiah } from '../utils/formatters';

describe('formatRupiah utility', () => {
  it('formats standard positive amount with Rp prefix and thousand separators without decimals', () => {
    expect(formatRupiah(1500000)).toBe('Rp 1.500.000');
    expect(formatRupiah(45000)).toBe('Rp 45.000');
  });

  it('formats zero correctly', () => {
    expect(formatRupiah(0)).toBe('Rp 0');
  });

  it('formats negative amounts with minus sign before Rp or number', () => {
    expect(formatRupiah(-250000)).toBe('-Rp 250.000');
  });

  it('allows omitting Rp prefix when showPrefix is false', () => {
    expect(formatRupiah(1500000, { showPrefix: false })).toBe('1.500.000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- src/__tests__/formatters.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Update `tailwind.config.js` and implement `formatters.ts`**

In `frontend/tailwind.config.js`:
Extend `theme.extend.colors`:
```javascript
        surface: {
          canvas: '#0c0c0e',
          card: '#141417',
          subtle: '#1a1a1e',
          border: 'rgba(39, 39, 42, 0.8)',
        },
```

In `frontend/src/utils/formatters.ts`:
```typescript
/**
 * Unified currency formatting utility for Rezekify.
 * Formats monetary amounts in Indonesian Rupiah (IDR) without trailing zero decimals.
 */
export interface FormatRupiahOptions {
  showPrefix?: boolean;
}

export function formatRupiah(amount: number, options: FormatRupiahOptions = {}): string {
  const { showPrefix = true } = options;
  const isNegative = amount < 0;
  const absoluteValue = Math.abs(amount);

  const formatted = new Intl.NumberFormat('id-ID', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(absoluteValue);

  if (showPrefix) {
    return isNegative ? `-Rp ${formatted}` : `Rp ${formatted}`;
  }
  return isNegative ? `-${formatted}` : formatted;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- src/__tests__/formatters.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/tailwind.config.js frontend/src/utils/formatters.ts frontend/src/__tests__/formatters.test.ts
git commit -m "feat(design): add semantic surface tokens and formatRupiah utility"
```

---

### Task 2: Harmonize Navigation Accents (Sidebar & BottomDock to Indigo)

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/components/BottomDock.tsx`
- Test: `frontend/src/__tests__/NavigationShell.test.tsx`

**Interfaces:**
- Consumes: `activeView`, `onViewChange`
- Produces: Indigo navigation indicators (`bg-indigo-500/10 text-indigo-300 border-indigo-500/30`, `text-indigo-400`), 38px collapse button.

- [ ] **Step 1: Write/update tests in `frontend/src/__tests__/NavigationShell.test.tsx`**

Verify that:
- Active nav item has indigo color classes instead of emerald (`text-indigo-400` / `border-indigo-500/30`).
- Sidebar collapse button has `min-w-[38px] min-h-[38px]`.
- BottomDock active item has `text-indigo-400 font-semibold`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- src/__tests__/NavigationShell.test.tsx`
Expected: FAIL on color assertions.

- [ ] **Step 3: Update `Sidebar.tsx` and `BottomDock.tsx`**

In `Sidebar.tsx`:
- Line 90: Change `min-w-[32px] min-h-[32px]` to `min-w-[38px] min-h-[38px]`.
- Lines 115-121:
  - Active button: `bg-indigo-500/10 text-white border border-indigo-500/30 font-semibold`
  - Active icon: `text-indigo-400` (instead of `text-emerald-400`).

In `BottomDock.tsx`:
- Active button classes: change `text-emerald-400` to `text-indigo-400`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- src/__tests__/NavigationShell.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Sidebar.tsx frontend/src/components/BottomDock.tsx frontend/src/__tests__/NavigationShell.test.tsx
git commit -m "feat(navigation): harmonize active navigation highlights to indigo and enforce 38px toggle"
```

---

### Task 3: Harmonize `UpcomingBillsCard.tsx` with Reassuring Empty State

**Files:**
- Modify: `frontend/src/components/UpcomingBillsCard.tsx`
- Test: `frontend/src/__tests__/UpcomingBillsCard.test.tsx`

**Interfaces:**
- Consumes: `bills?: UpcomingBill[]`, `isLoading?: boolean`
- Produces: Beautiful, reassuring calm card when `urgentBills.length === 0` instead of `null`.

- [ ] **Step 1: Write/update tests in `frontend/src/__tests__/UpcomingBillsCard.test.tsx`**

Verify that:
- When `urgentBills.length === 0`, it renders a reassurance card with text "Semua Komitmen Aman" and "Tidak ada tagihan atau komitmen jatuh tempo dalam 7 hari kedepan."

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- src/__tests__/UpcomingBillsCard.test.tsx`
Expected: FAIL (previously expected null).

- [ ] **Step 3: Implement serene empty state in `UpcomingBillsCard.tsx`**

In `frontend/src/components/UpcomingBillsCard.tsx`:
When `urgentBills.length === 0`:
```tsx
  return (
    <div
      data-testid="upcoming-bills-empty"
      className="bg-[#141417] border border-zinc-800/80 rounded-2xl p-5 mb-6 text-zinc-300 shadow-sm flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-zinc-100">Semua Komitmen Aman</h4>
          <p className="text-xs text-zinc-400 mt-0.5">Tidak ada tagihan atau komitmen jatuh tempo dalam 7 hari kedepan.</p>
        </div>
      </div>
      <Chip size="sm" variant="flat" color="success" className="text-xs font-medium shrink-0">
        H-7 Bersih
      </Chip>
    </div>
  );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- src/__tests__/UpcomingBillsCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/UpcomingBillsCard.tsx frontend/src/__tests__/UpcomingBillsCard.test.tsx
git commit -m "feat(dashboard): add serene empty state card for upcoming bills"
```

---

### Task 4: Harmonize Currency Formatting across Cards & Tables

**Files:**
- Modify: `frontend/src/components/RecentTransactionsCard.tsx`
- Modify: `frontend/src/components/VaultCard.tsx`
- Modify: `frontend/src/components/OverviewView.tsx`
- Modify: `frontend/src/components/TransactionsTable.tsx`
- Test: `frontend/src/__tests__/RecentTransactionsCard.test.tsx`
- Test: `frontend/src/__tests__/VaultCard.test.tsx`
- Test: `frontend/src/__tests__/OverviewView.test.tsx`

**Interfaces:**
- Consumes: `formatRupiah` from `../utils/formatters`
- Produces: Clean, uniform currency strings across all views.

- [ ] **Step 1: Write/update tests for formatted currency**

Verify that cards render formatted currency via `formatRupiah`.

- [ ] **Step 2: Replace localized formatting with `formatRupiah`**

In `RecentTransactionsCard.tsx`:
- Import `formatRupiah` from `../utils/formatters`.
- Use `formatRupiah(item.amount)` with `.tabular-nums`.

In `VaultCard.tsx`:
- Import `formatRupiah` from `../utils/formatters`.
- Replace local `formatCurrency` with `formatRupiah`.

In `OverviewView.tsx`:
- Import `formatRupiah` from `../utils/formatters`.
- Replace inline formatting with `formatRupiah`.

In `TransactionsTable.tsx`:
- Import `formatRupiah` from `../utils/formatters`.
- Ensure currency display uses `formatRupiah`.

- [ ] **Step 3: Run component tests**

Run: `npm --prefix frontend test -- src/__tests__/RecentTransactionsCard.test.tsx src/__tests__/VaultCard.test.tsx src/__tests__/OverviewView.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/RecentTransactionsCard.tsx frontend/src/components/VaultCard.tsx frontend/src/components/OverviewView.tsx frontend/src/components/TransactionsTable.tsx
git commit -m "refactor(ui): unify currency formatting across cards and tables using formatRupiah"
```

---

### Task 5: End-to-End Frontend Suite Verification & Quality Audit

**Files:**
- Run full frontend test suite (`vitest`)
- Run typecheck and production build (`tsc`, `vite build`)

- [ ] **Step 1: Run frontend test suite**

Run: `npm --prefix frontend test -- --run`
Expected: 33+ test files passed, 0 failures.

- [ ] **Step 2: Run typecheck and build**

Run: `npx --prefix frontend tsc --noEmit && npm --prefix frontend run build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 3: Verification commit**

```bash
git commit --allow-empty -m "chore(ui): verify full frontend test suite and build for design system harmonization"
```
