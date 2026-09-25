# Rezekify Frontend Comprehensive Audit Report

**Date:** 2026-09-25
**Scope:** All 24 TSX components, 2 pages, 3 hooks, App shell
**SOP Reference:** DESIGN.md (Modern Zinc Studio) + Impeccable Critique

---

## EXECUTIVE SUMMARY

**Overall Design System Compliance: ~55%**

The frontend suffers from a critical **dual-palette schizophrenia**: the codebase is split between the old `slate-*` color system (used in 15 files) and the newer `zinc-*` Modern Zinc Studio tokens mandated by DESIGN.md Section 7 (used in 8 files). This creates visible color inconsistency throughout the app. Additionally, 31 native `<button onClick>` instances violate the HeroUI `<Button onPress>` mandate from DESIGN.md Section 6.

### Severity Distribution

- **P0 (Critical / Blocking):** 4 issues
- **P1 (High / Must-Fix):** 8 issues
- **P2 (Medium / Should-Fix):** 6 issues
- **P3 (Low / Polish):** 5 issues

---

## P0: CRITICAL ISSUES

### P0-1: Dual Color Palette Schizophrenia (slate-* vs zinc-*)

**DESIGN.md Mandate (Section 7 - Modern Zinc Studio):**

- Background Root: `#0c0c0e` (`bg-[#0c0c0e]`)
- Card Surface: `#141417` (`bg-[#141417]`)
- Borders: `border-zinc-800/80` or `border-white/[0.08]`
- Text: `text-white` / `text-zinc-400` / `text-zinc-500`

**Files using CORRECT zinc-* tokens (8 files):**

- `AppLayout.tsx`, `Sidebar.tsx`, `BottomDock.tsx`
- `QuickCaptureBar.tsx`, `OverviewView.tsx`
- `LedgerView.tsx`, `VaultsView.tsx`, `DashboardPage.tsx`

**Files using WRONG slate-* tokens (15 files):**

- `App.tsx` — `bg-slate-950`, `text-slate-100`
- `AuthPage.tsx` — `bg-slate-950`, `bg-slate-900/90`, `border-slate-800`
- `RunwayMetricCard.tsx` — `bg-slate-900/90`, `border-slate-800`, `text-slate-300`
- `ExpenseCharts.tsx` — `bg-slate-900/90`, `border-slate-800`, `text-slate-400`
- `UpcomingBillsCard.tsx` — `bg-slate-900/90`, `border-slate-800`
- `VaultCard.tsx` — `bg-slate-900/90`, `border-slate-800`, `text-slate-100`
- `VaultsSection.tsx` — `bg-slate-800`, `text-slate-100`, `border-slate-700`
- `TransactionsTable.tsx` — `bg-slate-900`, `border-slate-800`
- `OmniInputHero.tsx` — `bg-slate-900/90`, `border-slate-700`
- `AccountModal.tsx` — `bg-slate-900`, `bg-slate-950`
- `VaultModal.tsx` — `bg-slate-900`, `bg-slate-950`
- `ManualTransactionModal.tsx` — `bg-slate-900`, `bg-slate-950`
- `SimulatePurchaseModal.tsx` — `bg-slate-900`, `bg-slate-950`
- `SettingsModal.tsx` — `bg-slate-900`, `bg-slate-950`
- `CategoryManagerModal.tsx` — `bg-slate-950`, `border-slate-800`

**Impact:** Users see visually different grays between the nav shell (warm charcoal) and content area (blue-tinted slate). `slate-950 (#020617)` has a blue undertone vs `#0c0c0e` which is warm charcoal.

**Fix:** Migrate all 15 files to zinc-* tokens per DESIGN.md Section 7: `bg-[#0c0c0e]` for root, `bg-[#141417]` for cards, `border-zinc-800/80` for borders, `text-zinc-400`/`text-zinc-500` for secondary/tertiary text.

---

### P0-2: onClick vs onPress Inconsistency (31 Violations)

**DESIGN.md Mandate (Section 6):**

> All interactive buttons utilize `@heroui/react` `<Button>` with `onPress` handlers, strictly avoiding deprecated `onClick` triggers.

**31 native `<button onClick>` found across 14 files:**

| File | Count | Context |
|------|-------|---------|
| `AuthPage.tsx` | 3 | Tab switchers + submit button |
| `BottomDock.tsx` | 5 | ALL navigation buttons |
| `Sidebar.tsx` | 1 | Nav item buttons |
| `VaultsView.tsx` | 3 | Filter tabs |
| `VaultsSection.tsx` | 1 | Dismiss error |
| `SettingsModal.tsx` | 7 | Tab buttons, radio selections, eye icon |
| `CategoryManagerModal.tsx` | 4 | Tab switchers, color/icon selectors |
| `ManualTransactionModal.tsx` | 1 | Type selector |
| `VaultModal.tsx` | 1 | Vault type selector |
| `AccountModal.tsx` | 1 | Account type selector |
| `TransactionsTable.tsx` | 1 | Clear search |
| `QuickCaptureBar.tsx` | 2 | File remove, toast dismiss |
| `RunwayMetricCard.tsx` | 1 | onOpenAuth |
| `DashboardPage.tsx` | 1 | Dismiss error |

**Impact:** Inconsistent keyboard/accessibility behavior. HeroUI `<Button onPress>` handles focus management, keyboard events (Enter+Space), and screen reader semantics. Native `<button onClick>` misses these.

**Fix:** Replace all native `<button>` elements with HeroUI `<Button onPress>`.

---

### P0-3: border-radius Inconsistency (rounded-2xl vs rounded-3xl)

**DESIGN.md Mandate:** Cards use `rounded-2xl` consistently.

**Files using `rounded-3xl` (violating):**

- `AuthPage.tsx` — Main auth card container
- `RunwayMetricCard.tsx` — Both skeleton + live card states
- `OmniInputHero.tsx` — Recording overlay backdrop

**All other components correctly use `rounded-2xl`.**

**Fix:** Normalize all to `rounded-2xl`.

---

### P0-4: App.tsx Root Still Uses Old Slate Palette

`App.tsx:30` renders `bg-slate-950 text-slate-100` on the authenticated wrapper div while `AppLayout.tsx` renders `bg-[#0c0c0e] text-zinc-100`. This creates a potential flash of different background color during hydration.

Similarly, `index.css` base layer applies `bg-slate-950 text-slate-100` which conflicts with the zinc studio tokens.

**Fix:** Update `App.tsx` and `index.css` to use `bg-[#0c0c0e] text-zinc-100`.

---

## P1: HIGH PRIORITY ISSUES

### P1-1: Motion Duration Violations (DESIGN.md: <= 250ms)

**Violations in `OmniInputHero.tsx`:**

- Line 279: `duration: 1.5` (1500ms) — decorative blur blob animation
- Line 286: `duration: 1.5` (1500ms) — decorative blur blob animation
- Line 339: `duration: 1.5` (1500ms) — pulse sparkle animation
- Line 360: `duration: 0.5 + (idx % 4) * 0.15` (500-1100ms) — audio visualizer bars

**Violations in `QuickCaptureBar.tsx`:**

- Line 250: `duration: 0.4 + idx * 0.1` (400-900ms) — audio visualizer bars

**Fix:** Cap all non-decorative transitions at 250ms. For continuous audio visualizer, use CSS `@keyframes` with `prefers-reduced-motion` media query.

---

### P1-2: OmniInputHero.tsx Is Dead Code (510 lines)

`OmniInputHero.tsx` is NOT imported or rendered anywhere in the active application. The dashboard exclusively uses `QuickCaptureBar.tsx`. Yet OmniInputHero contains 510 lines of duplicated logic (file upload, voice recording, drag-and-drop) that mirror QuickCaptureBar.

**Impact:** Dead code bloat. Risk of developers accidentally importing wrong component.

**Fix:** Delete `OmniInputHero.tsx`.

---

### P1-3: CTA Button Color Inconsistency Across Modals

**DESIGN.md Mandate (Section 1):**

- Primary Submit Action: `bg-indigo-600 hover:bg-indigo-500 text-white`
- Primary Action CTA: `bg-emerald-500 hover:bg-emerald-600 text-white`

**Current inconsistency:**

| Modal | Submit Button Color | Semantic |
|-------|--------------------| ---------|
| AccountModal | `bg-emerald-500` | Entity creation |
| VaultModal | `bg-emerald-500` | Entity creation |
| ManualTransactionModal | `bg-indigo-600` | Data submission |
| SimulatePurchaseModal | `bg-indigo-600` | Analysis action |
| SettingsModal | `bg-indigo-600` | Settings save |
| CategoryManagerModal | `bg-emerald-500` | Entity creation |

**Fix:** Establish clear rule: `bg-emerald-500` = primary entity creation, `bg-indigo-600` = secondary actions/analysis. Document in DESIGN.md.

---

### P1-4: VaultsSection vs VaultsView CTA Style Mismatch

- `VaultsSection.tsx` "+ Tambah Vault" button: `bg-emerald-500 hover:bg-emerald-600 text-white`
- `VaultsView.tsx` "+ Tambah Vault" button: `bg-white text-zinc-950 hover:bg-zinc-200`
- `LedgerView.tsx` "+ Catat Manual" button: `bg-white text-zinc-950 hover:bg-zinc-200`

The newer navigation shell uses monochromatic white CTA, while the older VaultsSection uses emerald.

**Fix:** Decide on one CTA style. The white-on-dark CTA is more consistent with the zinc studio direction.

---

### P1-5: Missing framer-motion in Components That Should Animate

**Components with NO framer-motion but should have layout transitions per DESIGN.md:**

- `LedgerView.tsx` — No entry/exit animation
- `AuthPage.tsx` — No page transition
- `SettingsModal.tsx` — No tab switch animation
- `CategoryManagerModal.tsx` — No list item animation

**Components WITH framer-motion (correct):**

- `TransactionsTable.tsx` — Row animations
- `VaultsSection.tsx` — Card layout animations
- `QuickCaptureBar.tsx` — Toast animation
- `UpcomingBillsCard.tsx` — Entry animation
- `OverviewView.tsx` — Vault progress bars
- `ExpenseCharts.tsx` — Bar chart animations
- `VaultCard.tsx` — Progress bar animation

---

### P1-6: Continuous animate-pulse on Non-Loading Elements

**DESIGN.md:** Motion restraint, calm terminal. No continuous decorative pulse.
**Impeccable Critique (P1):** "Continuous pulse animation violates calm terminal principles."

**Violations:**

- `Sidebar.tsx:73` — Brand logo telemetry dot `animate-pulse` (runs forever)
- `Sidebar.tsx:186` — Telegram status dot `animate-pulse` (runs forever)
- `SettingsModal.tsx:301` — Telegram dot `animate-pulse`

**Acceptable uses:**

- `QuickCaptureBar.tsx:237` — Recording dot (active during recording only)
- `UpcomingBillsCard.tsx:76` — Urgent bill H-3 dot (alarm signal)

**Fix:** Replace brand logo pulse with static dot or respect `prefers-reduced-motion`.

---

### P1-7: Missing tabular-nums on Financial Amounts

**DESIGN.md Mandate:** Always enforce `tabular-nums` for deterministic column alignment.

**Violation:**

- `OverviewView.tsx` — Mini-vault progress amounts (line ~230) have `font-mono` but no explicit `tabular-nums` class

Most other components correctly use `tabular-nums`.

---

### P1-8: HeroUI Card / CardBody Underutilization

**DESIGN.md Mandate (Section 6):** Metric containers leverage HeroUI Card foundations.

**Components using raw `<div>` instead of HeroUI `<Card>/<CardBody>`:**

- `OverviewView.tsx` — All 3 telemetry hero tiles
- `ExpenseCharts.tsx` — Chart container
- `RunwayMetricCard.tsx` — Main metric card
- `VaultCard.tsx` — Card wrapper
- `CategoryManagerModal.tsx` — Category item rows

**Correctly using HeroUI `<Card>`:**

- `UpcomingBillsCard.tsx` — Uses `<Card>` + `<CardBody>`

---

## P2: MEDIUM PRIORITY ISSUES

### P2-1: Raw `<select>` Not Using HeroUI `<Select>`

Raw `<select>` elements in:

- `ManualTransactionModal.tsx` — Account and category selects
- `TransactionsTable.tsx` — Account and category filter selects

These lose HeroUI's dark-mode styling and focus ring consistency.

---

### P2-2: index.css Scrollbar Uses `#020617` (slate-950) Not `#0c0c0e`

`index.css` scrollbar track: `background: #020617;` (old slate)
Should be: `background: #0c0c0e;` (zinc studio root)

---

### P2-3: Missing `role="radio"` on Radio-Style Buttons

- `ManualTransactionModal.tsx` — Transaction type buttons
- `VaultModal.tsx` — Vault type buttons
- `AccountModal.tsx` — Account type buttons
- `SettingsModal.tsx` — AI provider radio buttons

---

### P2-4: OmniInputHero.tsx Decorative Blurs

Dead code, but if resurrected: three `<motion.div>` blobs with `blur-3xl` at 1500ms continuous animation violate "Zero decorative fluff" principle.

---

### P2-5: Font Token Inconsistency (slate-400 vs zinc-400)

Components mix `text-slate-400` and `text-zinc-400` for the same semantic purpose. `slate-400 (#94a3b8)` has a cooler blue tone vs `zinc-400 (#a1a1aa)` which is warmer gray.

---

### P2-6: transition-all Overuse

Multiple components use `transition-all` instead of specific `transition-colors` or `transition-transform`. This can cause unexpected layout shifts and performance overhead.

---

## P3: LOW PRIORITY / POLISH

### P3-1: Mixed disabled + isDisabled Props on HeroUI Buttons

Several components pass both `disabled` (native) and `isDisabled` (HeroUI). Only `isDisabled` is needed. Files: `VaultCard.tsx`, `TransactionsTable.tsx`, `OmniInputHero.tsx`.

---

### P3-2: py-0.2 Invalid Tailwind Class

`VaultsView.tsx` and `Sidebar.tsx` use `py-0.2` in counter pills. Tailwind does not have a `0.2` spacing value. Should be `py-0.5` or `py-px`.

---

### P3-3: Duplicate type="button" on HeroUI Button

HeroUI `<Button>` defaults to `type="button"`. Many components redundantly pass this prop. Not harmful but noisy.

---

### P3-4: Unused Shadow Tokens in tailwind.config.js

`tailwind.config.js` defines custom `shadow-glow-*` tokens (`shadow-glow-indigo`, `shadow-glow-emerald`, `shadow-glow-amber`, `shadow-glow-rose`) but they are never used in any component.

---

### P3-5: prefers-reduced-motion Not Respected

No component checks `prefers-reduced-motion` media query. All framer-motion animations run regardless of user preference.

---

## CROSS-CORRELATION MATRIX

| Component | Color System | HeroUI Usage | Motion Usage | Button Pattern |
|-----------|-------------|-------------|-------------|----------------|
| `App.tsx` | slate (WRONG) | HeroUIProvider | None | N/A |
| `AuthPage.tsx` | slate (WRONG) | None | None | onClick (WRONG) |
| `AppLayout.tsx` | zinc (correct) | None | None | N/A |
| `Sidebar.tsx` | zinc (correct) | Button onPress | None | Mixed (1 onClick) |
| `BottomDock.tsx` | zinc (correct) | None | None | onClick (WRONG 5x) |
| `QuickCaptureBar.tsx` | zinc (correct) | Button onPress | AnimatePresence | Mixed (2 onClick) |
| `OverviewView.tsx` | zinc (correct) | Button, Chip | motion.div | Correct |
| `LedgerView.tsx` | zinc (correct) | Button onPress | None | Correct |
| `VaultsView.tsx` | zinc (correct) | Button onPress | None | onClick (WRONG 3x) |
| `VaultsSection.tsx` | slate (WRONG) | Button onPress | AnimatePresence | Mixed (1 onClick) |
| `VaultCard.tsx` | slate (WRONG) | Button, Chip | motion.div | Correct |
| `RunwayMetricCard.tsx` | slate (WRONG) | Chip, Progress | None | onClick (WRONG 1x) |
| `ExpenseCharts.tsx` | slate (WRONG) | Tooltip, Button, Progress | motion.div | Correct |
| `UpcomingBillsCard.tsx` | slate (WRONG) | Card, Chip | motion.div | None |
| `TransactionsTable.tsx` | slate (WRONG) | Button, Chip, Modal | AnimatePresence | Mixed (1 onClick) |
| `OmniInputHero.tsx` | slate (WRONG) | Button onPress | EXCESSIVE | Correct |
| `AccountModal.tsx` | slate (WRONG) | Modal, Button | None | Mixed (1 onClick) |
| `VaultModal.tsx` | slate (WRONG) | Modal, Button | None | Mixed (1 onClick) |
| `ManualTransactionModal.tsx` | slate (WRONG) | Modal, Button | None | Mixed (1 onClick) |
| `SimulatePurchaseModal.tsx` | slate (WRONG) | Modal, Button | None | Correct |
| `SettingsModal.tsx` | slate (WRONG) | Modal, Button | None | onClick (WRONG 7x) |
| `CategoryManagerModal.tsx` | slate (WRONG) | Modal, Button | None | onClick (WRONG 4x) |
| `EditTransactionModal.tsx` | Delegates | Delegates | Delegates | Delegates |
| `EditVaultModal.tsx` | Delegates | Delegates | Delegates | Delegates |

---

## RECOMMENDED FIX PRIORITY ORDER

1. **P0-1 + P0-4:** Global slate-to-zinc migration (15 files + `index.css` + `App.tsx`)
2. **P0-2:** onClick-to-onPress migration (31 instances across 14 files)
3. **P0-3:** `rounded-3xl` to `rounded-2xl` normalization (3 files)
4. **P1-2:** Delete dead `OmniInputHero.tsx`
5. **P1-1:** Fix motion duration violations in `QuickCaptureBar.tsx`
6. **P1-3 + P1-4:** Normalize CTA button colors across all modals
7. **P1-6:** Remove continuous `animate-pulse` from brand elements
8. **P1-8:** Migrate card `<div>` wrappers to HeroUI `<Card>`
9. **P2-1:** Migrate raw `<select>` to HeroUI `<Select>`
10. **P2-2:** Fix scrollbar color in `index.css`

---

## APPENDIX: FILES REQUIRING CHANGES

### Must-Touch (P0 — 19 files):

- `frontend/src/App.tsx`
- `frontend/src/index.css`
- `frontend/src/pages/AuthPage.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/components/RunwayMetricCard.tsx`
- `frontend/src/components/ExpenseCharts.tsx`
- `frontend/src/components/UpcomingBillsCard.tsx`
- `frontend/src/components/VaultCard.tsx`
- `frontend/src/components/VaultsSection.tsx`
- `frontend/src/components/TransactionsTable.tsx`
- `frontend/src/components/AccountModal.tsx`
- `frontend/src/components/VaultModal.tsx`
- `frontend/src/components/ManualTransactionModal.tsx`
- `frontend/src/components/SimulatePurchaseModal.tsx`
- `frontend/src/components/SettingsModal.tsx`
- `frontend/src/components/CategoryManagerModal.tsx`
- `frontend/src/components/BottomDock.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/components/VaultsView.tsx`

### Should-Touch (P1 — additional):

- `frontend/src/components/QuickCaptureBar.tsx`
- `frontend/src/components/OverviewView.tsx`
- `frontend/src/components/LedgerView.tsx`

### Can Delete:

- `frontend/src/components/OmniInputHero.tsx` (dead code, 510 lines)
