# Cockpit Overhaul: Supportive Friend Voice, Account Pill Strip, Living SVG Charts & Layout Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Transform the cockpit into a warm, supportive friend with human Indonesian vocabulary, migrate Rekening Kas from the sidebar into a sleek horizontal account pill strip, implement living pure SVG Area and Donut charts in `ExpenseCharts.tsx`, and eliminate motion layout shifts and size glitching across the application.

**Architecture:**
1. In `Sidebar.tsx`, remove the account list and balances completely, keeping the sidebar 100% focused on clean navigation.
2. In `OverviewView.tsx`, add the Account Capsule Strip (`Wise/Revolut` style) under the QuickCaptureBar, update the 3 KPI cards with warm, encouraging copy, and lock bento row heights to prevent layout jumping.
3. In `ExpenseCharts.tsx`, implement a smooth curved SVG Area Chart with Y-axis gridlines and interactive hover beacon for Daily, and a segmented SVG Donut Ring with category legends for Monthly, with locked container min-height (`min-h-[380px]`).
4. In `BenefitSection.tsx` and `WorkflowSection.tsx`, lock preview containers to stable min-heights (`min-h-[380px]` and `min-h-[220px]`) so tab switching crossfades smoothly without shrinking or expanding the card.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Framer Motion, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-23-cockpit-overhaul-living-charts-and-layout-stability-design.md`

## Global Constraints
- Strictly ZERO raw unicode emojis / emoticons — all icons use Lucide React vector SVGs.
- Pure SVG + Tailwind + Framer Motion (zero new external chart libraries).
- Stable card heights with zero Cumulative Layout Shift (CLS) during tab switches or chart period toggles.
- Strict TypeScript build with 0 errors (`npx tsc --noEmit && npm run build`).

## Review Focus
1. Account Capsule Strip must display all active accounts with formatted balances and open the create account modal on `+ Tambah Akun`.
2. Sidebar must render 100% clean navigation without squished account text or internal scrollbars.
3. Daily chart must render smooth curved area wave with Y-axis currency scale and dashed runway threshold line.
4. Monthly chart must render segmented SVG donut ring with accurate category percentages and interactive highlights.
5. Toggling between Daily and Monthly must maintain stable container height without jumping the page layout.
6. Tab transitions in Benefit and Workflow sections must remain stable in size without vertical jitter.

---

### Task 1: Sidebar Cleanup & Account Capsule Strip in OverviewView

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/components/OverviewView.tsx`
- Modify: `frontend/src/__tests__/OverviewView.test.tsx`
- Modify: `frontend/src/__tests__/NavigationShell.test.tsx`

**Interfaces:**
- Produces: Clean navigation sidebar (no accounts) + horizontal Account Capsule Strip under QuickCaptureBar with `+ Tambah Akun` CTA.

- [x] **Step 1: Write/update tests in `OverviewView.test.tsx` and `NavigationShell.test.tsx`**
- Test that Account Capsule Strip renders account names and balances under testid `account-capsule-strip`.
- Test that clicking `+ Tambah Akun` triggers `onOpenCreateAccount`.
- Test that Sidebar navigation is clean and does not contain `Rekening Kas`.

- [x] **Step 2: Run tests to verify failure**
Run: `npm --prefix frontend test src/__tests__/OverviewView.test.tsx src/__tests__/NavigationShell.test.tsx`
Expected: FAIL.

- [x] **Step 3: Remove accounts from `Sidebar.tsx`**
- Remove the `Account Balances Section` (lines 198-237) and collapsed account mini-pips (lines 240-260).
- Keep sidebar clean with navigation links, theme toggle, and user profile footer.

- [x] **Step 4: Implement Account Capsule Strip in `OverviewView.tsx`**
- Add horizontal scrollable pill strip beneath QuickCaptureBar (`data-testid="account-capsule-strip"`).
- Render each active account with Lucide icon (`Building2`, `Smartphone`, `Banknote`), name, and bold formatted balance.
- Add `+ Tambah Akun` pill button calling `onOpenCreateAccount`.

- [x] **Step 5: Run tests to verify they pass**
Run: `npm --prefix frontend test src/__tests__/OverviewView.test.tsx src/__tests__/NavigationShell.test.tsx`
Expected: PASS.

- [x] **Step 6: Commit**
```bash
git add frontend/src/components/Sidebar.tsx frontend/src/components/OverviewView.tsx frontend/src/__tests__/OverviewView.test.tsx frontend/src/__tests__/NavigationShell.test.tsx
git commit -m "feat(cockpit): migrate accounts to capsule strip and clean up sidebar"
```

---

### Task 2: Supportive Friend Voice Across Overview Cockpit

**Files:**
- Modify: `frontend/src/components/OverviewView.tsx`
- Modify: `frontend/src/__tests__/OverviewView.test.tsx`

**Interfaces:**
- Produces: Warm, encouraging Indonesian vocabulary on all 3 KPI cards and action buttons.

- [x] **Step 1: Update `OverviewView.tsx` copy**
- Card 1:
  - Header: `Kondisi: {statusConfig.label}`
  - Title: `Jatah Belanja Hari Ini`
  - Sub-copy: `Batas belanja harianmu biar tetap aman sampai siklus baru.`
  - Button: `Simulasi Belanja` (startContent `<Sparkles />`).
- Card 2:
  - Header: `UANG BEBAS PAKAI`
  - Title: `Siap Digunakan`
  - Sub-copy: `Sisa uang yang bebas kamu pakai jajan tanpa ganggu tagihan & tabungan.`
  - Button: `Catat Manual` (startContent `<PlusCircle />`).
- Card 3:
  - Header: `SUDAH DIAMANKAN DI POS`
  - Title: `Tabungan & Tagihan`
  - Sub-copy: `Disisihkan untuk bayar tagihan dan tabungan impianmu.`
  - Button: `Bagi Uang ke Pos (Lump-Sum)` (startContent `<Layers />`).

- [x] **Step 2: Update tests in `OverviewView.test.tsx`**
- Assert updated friendly labels render as expected.

- [x] **Step 3: Run tests to verify pass**
Run: `npm --prefix frontend test src/__tests__/OverviewView.test.tsx`
Expected: PASS.

- [x] **Step 4: Commit**
```bash
git add frontend/src/components/OverviewView.tsx frontend/src/__tests__/OverviewView.test.tsx
git commit -m "style(cockpit): apply supportive friend voice across Ringkasan KPI cards"
```

---

### Task 3: Living SVG Charts (Daily Curved Area Wave + Monthly Donut Ring)

**Files:**
- Modify: `frontend/src/components/ExpenseCharts.tsx`
- Create: `frontend/src/__tests__/ExpenseChartsLiving.test.tsx`

**Interfaces:**
- Produces: Pure SVG Curved Area Chart with Y-axis gridlines and hover beacon (Daily) + SVG Donut Ring with category ribbons (Monthly) with stable container height (`min-h-[380px]`).

- [x] **Step 1: Write unit tests in `frontend/src/__tests__/ExpenseChartsLiving.test.tsx`**
- Test that Daily view renders SVG area path and Y-axis scale labels.
- Test that Monthly view renders SVG donut circle and category legend.
- Test that toggling period maintains stable container height class (`min-h-[380px]`).

- [x] **Step 2: Run test to verify failure**
Run: `npm --prefix frontend test src/__tests__/ExpenseChartsLiving.test.tsx`
Expected: FAIL.

- [x] **Step 3: Implement Living SVG Area Chart for Daily in `ExpenseCharts.tsx`**
- Calculate smooth cubic bezier path `d="M x0 y0 C ..."` across 7 days with SVG linear gradient fill (`from-emerald-500/25 to-transparent`).
- Add 3 horizontal Y-axis gridlines with currency labels (`Rp 0`, `50% max`, `100% max`).
- Add dashed amber threshold line for `Batas Aman`.
- Add interactive hover tracking: mousemove over chart glides illuminated beacon circle and floating card showing day name, date, and exact spend.

- [x] **Step 4: Implement Living SVG Donut Chart for Monthly in `ExpenseCharts.tsx`**
- Render pure SVG Donut Ring using `strokeDasharray` and `strokeDashoffset` for each category arc.
- Center displays `Total: Rp X`.
- Category legend alongside donut displays colored swatch, category name, percentage, and exact Rupiah total with hover highlight sync.

- [x] **Step 5: Lock container height to eliminate jumping**
- Outer container enforces `min-h-[380px]` so toggling Daily ↔ Monthly causes zero layout shift.

- [x] **Step 6: Run tests to verify pass**
Run: `npm --prefix frontend test src/__tests__/ExpenseChartsLiving.test.tsx`
Expected: PASS.

- [x] **Step 7: Commit**
```bash
git add frontend/src/components/ExpenseCharts.tsx frontend/src/__tests__/ExpenseChartsLiving.test.tsx
git commit -m "feat(charts): implement living curved SVG area chart and interactive donut ring"
```

---

### Task 4: Layout Stability & Height Glitch Elimination

**Files:**
- Modify: `frontend/src/components/landing/BenefitSection.tsx`
- Modify: `frontend/src/components/landing/WorkflowSection.tsx`
- Modify: `frontend/src/components/OverviewView.tsx`

**Interfaces:**
- Produces: 100% stable containers with zero height snapping or layout jitter during motion.

- [x] **Step 1: Lock heights in `BenefitSection.tsx` and `WorkflowSection.tsx`**
- In `BenefitSection.tsx`: set right-hand detail preview card to `min-h-[380px]` so switching tabs never resizes the card.
- In `WorkflowSection.tsx`: set step detail card to `min-h-[220px]` so switching steps 1..5 keeps card height stable.

- [x] **Step 2: Balance bento row heights in `OverviewView.tsx`**
- Middle row (`ExpenseCharts` + `RecentTransactionsCard`) set to matching `min-h-[380px] h-full`.
- Bottom row (`UpcomingBills` + `PriorityVaults`) set to matching `min-h-[340px] h-full`.

- [x] **Step 3: Run full test suite**
Run: `npm --prefix frontend test -- --run`
Expected: All suites PASS.

- [x] **Step 4: Commit**
```bash
git add frontend/src/components/landing/BenefitSection.tsx frontend/src/components/landing/WorkflowSection.tsx frontend/src/components/OverviewView.tsx
git commit -m "style(layout): eliminate motion size glitching with locked container min-heights"
```

---

### Task 5: Full Verification Matrix & Docker Deployment

**Files:**
- Entire frontend & backend test matrices.

- [x] **Step 1: Run full frontend Vitest test suite**
Run: `npm --prefix frontend test -- --run`
Expected: 47+ test files pass.

- [x] **Step 2: Run TypeScript strict check and production build**
Run: `cd frontend && npm run build`
Expected: Clean build with 0 errors.

- [x] **Step 3: Run Impeccable static detector check**
Run: `"C:/Users/grant/.claude/plugins/cache/impeccable/impeccable/4.3.1/skills/impeccable/scripts/impeccable.cmd" detect --json frontend/src`
Expected: 0 findings.

- [x] **Step 4: Rebuild and restart Docker frontend container**
Run: `docker compose build frontend && docker compose up -d frontend`
Expected: Container rebuilt and healthy.

- [x] **Step 5: Run backend pytest suite**
Run: `pytest tests/test_all_phases_e2e_lifecycle.py`
Expected: 1/1 passed.

- [x] **Step 6: Commit final verification**
```bash
git commit --allow-empty -m "chore(audit): verify cockpit overhaul, living charts and layout stability test matrix"
```
