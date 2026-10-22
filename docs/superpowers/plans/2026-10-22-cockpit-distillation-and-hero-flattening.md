# Cockpit Distillation & Hero Flattening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Distill the Rezekify Ringkasan (Overview) cockpit by retiring redundant AI hero cards, integrating Lucide-based suggestion chips into QuickCaptureBar, correcting the Enter shortcut badge, and flattening the Hero Telemetry Card into a single-surface editorial card.

**Architecture:** Refactor `QuickCaptureBar.tsx` to host integrated quick prompt chips with professional Lucide icons and update the submission badge to `↵ Enter`. In `OverviewView.tsx`, unmount `AISpotlightHero`, eliminate 6 internal bordered boxes inside the Hero Card, replace emoji triggers (`⚡`) with `<Sparkles />`, and remove duplicate modal simulation triggers.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-22-cockpit-distillation-and-hero-flattening-design.md`

## Global Constraints
- Zero emojis / emoticons in UI elements or chips — use Lucide React icons strictly (`UtensilsCrossed`, `Fuel`, `Wifi`, `Sparkles`).
- Strict TypeScript compilation with 0 `any` or strictness violations.
- Touch targets must remain $\ge 38\text{px}$.
- Zero layout shift (CLS) during What-If simulation drawer expansion.
- All existing tests in `OverviewView.test.tsx`, `QuickCaptureBar.test.tsx`, and `AllPhasesE2EIntegration.test.tsx` must pass cleanly.

## Review Focus
1. Suggestion chip clicks must populate the input field without triggering premature form submission.
2. Form submission on `Enter` must continue to work seamlessly without regressions.
3. The What-If simulation drawer must expand and collapse smoothly within the flattened Hero Card.
4. Voice recording and file upload flows in `QuickCaptureBar` must remain completely intact.
5. Deletion of `AISpotlightHero` must not break view switching to `AIChatView` from the sidebar or explicit links.

---

### Task 1: Refactor `QuickCaptureBar.tsx` with Suggestion Chips & Enter Shortcut Badge

**Files:**
- Modify: `frontend/src/components/QuickCaptureBar.tsx`
- Test: `frontend/src/__tests__/QuickCaptureBar.test.tsx`

**Interfaces:**
- Produces: Updated `QuickCaptureBar` rendering `↵ Enter` badge and 3 suggestion chips:
  - `<UtensilsCrossed className="w-3.5 h-3.5 text-emerald-500" /> Makan siang 25rb`
  - `<Fuel className="w-3.5 h-3.5 text-emerald-500" /> Bensin 30rb`
  - `<Wifi className="w-3.5 h-3.5 text-emerald-500" /> Bayar wifi 350rb`

- [ ] **Step 1: Write the failing tests in `frontend/src/__tests__/QuickCaptureBar.test.tsx`**
Add assertions checking:
- Presence of badge with text `↵ Enter` (instead of `Ctrl ↵`).
- Presence of suggestion chips (`Makan siang 25rb`, `Bensin 30rb`, `Bayar wifi 350rb`).
- Clicking a suggestion chip sets the input value to the chip text.

- [ ] **Step 2: Run test to verify it fails**
Run: `npm --prefix frontend test src/__tests__/QuickCaptureBar.test.tsx`
Expected: FAIL due to missing chips and badge mismatch.

- [ ] **Step 3: Implement changes in `frontend/src/components/QuickCaptureBar.tsx`**
- Import `UtensilsCrossed`, `Fuel`, `Wifi` from `lucide-react`.
- Update badge text from `Ctrl ↵` to `↵ Enter`.
- Add a suggestion chips container below the input row with testid `quick-capture-suggestions`.
- Clicking a chip calls `setText(chipText)` and focuses `inputRef`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm --prefix frontend test src/__tests__/QuickCaptureBar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/QuickCaptureBar.tsx frontend/src/__tests__/QuickCaptureBar.test.tsx
git commit -m "feat(cockpit): add suggestion chips and update Enter badge in QuickCaptureBar"
```

---

### Task 2: Flatten Hero Card & Remove Redundancies in `OverviewView.tsx`

**Files:**
- Modify: `frontend/src/components/OverviewView.tsx`
- Test: `frontend/src/__tests__/OverviewView.test.tsx`
- Test: `frontend/src/__tests__/AllPhasesE2EIntegration.test.tsx`

**Interfaces:**
- Consumes: `QuickCaptureBar` with suggestion chips.
- Produces: Distilled `OverviewView` without `AISpotlightHero`, flattened single-surface Hero Card, `<Sparkles />` What-If simulation toggle, and single simulation pathway.

- [ ] **Step 1: Update tests in `frontend/src/__tests__/OverviewView.test.tsx` and `AllPhasesE2EIntegration.test.tsx`**
- Verify that `AISpotlightHero` is NOT rendered in `OverviewView`.
- Verify that the simulation drawer button uses text `Cek Dampak Belanja` / `Tutup Simulasi`.
- Verify that the redundant `Simulasi Belanja` modal button in the Vaults priority card is absent.

- [ ] **Step 2: Run tests to verify failure**
Run: `npm --prefix frontend test src/__tests__/OverviewView.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement changes in `frontend/src/components/OverviewView.tsx`**
- Remove `<AISpotlightHero />` import and JSX render.
- Flatten Hero Card: remove `bg-slate-50/90 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-4 space-y-3.5` wrapper. Use subtle vertical spacing (`space-y-5`) directly within the main card body.
- Update simulation trigger button to remove emoji `⚡`: use `<Sparkles className="w-3.5 h-3.5 text-emerald-500" />` with text `Cek Dampak Belanja` and `Tutup Simulasi`.
- Update Contextual Survival Guidance trigger button from `⚡ Buka Simulasi Belanja` to `<Sparkles className="w-3.5 h-3.5 text-emerald-500" /> Buka Simulasi Belanja`.
- Remove redundant `<Button onPress={onOpenSimulateModal}>Simulasi Belanja</Button>` from the Komitmen & Vaults card.

- [ ] **Step 4: Run tests to verify they pass**
Run: `npm --prefix frontend test src/__tests__/OverviewView.test.tsx src/__tests__/AllPhasesE2EIntegration.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/OverviewView.tsx frontend/src/__tests__/OverviewView.test.tsx frontend/src/__tests__/AllPhasesE2EIntegration.test.tsx
git commit -m "refactor(cockpit): distill OverviewView and flatten Hero Telemetry Card"
```

---

### Task 3: Full Test Suite, TypeCheck & Design Static Audit

**Files:**
- Entire frontend & backend test matrices.

- [ ] **Step 1: Run full frontend Vitest test suite**
Run: `npm --prefix frontend test`
Expected: All suites PASS.

- [ ] **Step 2: Run TypeScript strict check and production build**
Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: Clean build with 0 errors.

- [ ] **Step 3: Run Impeccable static detector check**
Run: `"C:/Users/grant/.claude/plugins/cache/impeccable/impeccable/4.3.1/skills/impeccable/scripts/impeccable.cmd" detect --json frontend/src`
Expected: 0 findings.

- [ ] **Step 4: Run backend pytest suite**
Run: `pytest`
Expected: 493/493 tests pass.

- [ ] **Step 5: Commit final verification**
```bash
git commit --allow-empty -m "chore(audit): verify cockpit distillation and hero flattening test matrix"
```
