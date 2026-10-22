# Landing Page Living Motion & Interactive Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 3 tiers of calm motion and living visual craft on the Rezekify landing page, including silky FAQ accordion expansion, tab crossfades, a live counting numbers hook, rising telemetry bars, animated border beam, and an in-hero interactive runway sandbox.

**Architecture:** Create `frontend/src/hooks/useCountUp.ts` for viewport-triggered number interpolation. Enhance `HeroSection.tsx` with an interactive "try-it-now" daily runway simulator, 3D mouse parallax tilt, rising chart bars, and perimeter border beam. Refactor `FaqSection.tsx` with Framer Motion `AnimatePresence` for smooth height expansion. Refactor `WorkflowSection.tsx` and `BenefitSection.tsx` with smooth tab crossfades. Add tactile `whileTap` springs to CTA buttons.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Framer Motion, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-23-landing-page-living-motion-and-interactive-demo-design.md`

## Global Constraints
- Zero emojis / emoticons in code or markup — all UI markers must use Lucide React icons.
- Strict preservation of all text copy, headings, and card layouts created by the user's team.
- 60fps GPU-accelerated motion (transforms and opacity only, no layout thrashing).
- Respect `prefers-reduced-motion`.
- Strict TypeScript build with 0 errors (`npx tsc --noEmit && npm run build`).

## Review Focus
1. In-hero interactive demo must update simulated runway live on chip click or input with zero errors.
2. FAQ accordion items must animate open and close smoothly without content popping or height jumps.
3. Animated number counters must interpolate cleanly from 0 to target when scrolled into view without NaN or layout jumps.
4. Tab switching in Benefits and Workflow sections must crossfade smoothly with `AnimatePresence`.
5. All Vitest tests and production builds must pass with exit code 0.

---

### Task 1: Create `useCountUp` Hook & Animate Section Metric Numbers

**Files:**
- Create: `frontend/src/hooks/useCountUp.ts`
- Create: `frontend/src/__tests__/useCountUp.test.ts`
- Modify: `frontend/src/components/landing/AboutSection.tsx`
- Modify: `frontend/src/components/landing/BenefitSection.tsx`

**Interfaces:**
- Produces: `useCountUp(endValue: number, options?: { duration?: number; decimals?: number; suffix?: string; prefix?: string })` returning `{ count: string; ref: React.RefObject<any> }`.

- [x] **Step 1: Write failing unit test in `frontend/src/__tests__/useCountUp.test.ts`**
Test that `useCountUp` initializes at start value (e.g. 0), animates smoothly to target value, and formats with prefix/suffix.

- [x] **Step 2: Run test to verify it fails**
Run: `npm --prefix frontend test src/__tests__/useCountUp.test.ts`
Expected: FAIL (hook does not exist).

- [x] **Step 3: Implement `useCountUp.ts` in `frontend/src/hooks/useCountUp.ts`**
Implement hook using `framer-motion`'s `animate` and `useInView` to interpolate from 0 to target when visible, formatting with decimals, suffix, and prefix.

- [x] **Step 4: Integrate into `AboutSection.tsx` and `BenefitSection.tsx`**
- In `AboutSection.tsx`: animate `100%` and `24/7` using `useCountUp`.
- In `BenefitSection.tsx`: animate `85%`, `100%`, `3.5x`, `2x` using `useCountUp`.

- [x] **Step 5: Run tests to verify they pass**
Run: `npm --prefix frontend test src/__tests__/useCountUp.test.ts`
Expected: PASS.

- [x] **Step 6: Commit**
```bash
git add frontend/src/hooks/useCountUp.ts frontend/src/__tests__/useCountUp.test.ts frontend/src/components/landing/AboutSection.tsx frontend/src/components/landing/BenefitSection.tsx
git commit -m "feat(landing): implement useCountUp hook and animate metric numbers on scroll"
```

---

### Task 2: Smooth Accordion FAQ & Tab Crossfades

**Files:**
- Modify: `frontend/src/components/landing/FaqSection.tsx`
- Modify: `frontend/src/components/landing/BenefitSection.tsx`
- Modify: `frontend/src/components/landing/WorkflowSection.tsx`
- Modify: `frontend/src/components/landing/CtaSection.tsx`
- Create: `frontend/src/__tests__/LandingPageMotion.test.tsx`

**Interfaces:**
- Produces: Silky smooth accordion expansion, tab crossfades, and button springs.

- [x] **Step 1: Write failing test in `frontend/src/__tests__/LandingPageMotion.test.tsx`**
Verify that FAQ item expands with `AnimatePresence` and proper aria attributes, and button has `whileTap` springs.

- [x] **Step 2: Run test to verify it fails**
Run: `npm --prefix frontend test src/__tests__/LandingPageMotion.test.tsx`
Expected: FAIL.

- [x] **Step 3: Implement smooth motion in `FaqSection.tsx`**
- Wrap answer in `<AnimatePresence initial={false}>` with `<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">`.
- Smooth rotation on `+` icon (`transition-transform duration-200`).

- [x] **Step 4: Implement tab crossfades in `BenefitSection.tsx` and `WorkflowSection.tsx`**
- Wrap the active detail card in `<AnimatePresence mode="wait">` with `<motion.div key={activeStep} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>`.

- [x] **Step 5: Add tactile springs to `CtaSection.tsx`**
- Add `whileHover={{ scale: 1.02 }}` and `whileTap={{ scale: 0.98 }}` to primary CTA buttons.

- [x] **Step 6: Run tests to verify they pass**
Run: `npm --prefix frontend test src/__tests__/LandingPageMotion.test.tsx`
Expected: PASS.

- [x] **Step 7: Commit**
```bash
git add frontend/src/components/landing/FaqSection.tsx frontend/src/components/landing/BenefitSection.tsx frontend/src/components/landing/WorkflowSection.tsx frontend/src/components/landing/CtaSection.tsx frontend/src/__tests__/LandingPageMotion.test.tsx
git commit -m "feat(landing): implement smooth FAQ accordion expansion and tab crossfades"
```

---

### Task 3: In-Hero Interactive Runway Sandbox & Living Visual Effects

**Files:**
- Modify: `frontend/src/components/landing/HeroSection.tsx`
- Create: `frontend/src/__tests__/HeroInteractiveDemo.test.tsx`

**Interfaces:**
- Produces: Interactive "try-before-you-sign-up" runway simulator, animated border beam, rising chart bars, and 3D parallax tilt.

- [x] **Step 1: Write failing tests in `frontend/src/__tests__/HeroInteractiveDemo.test.tsx`**
- Test that default simulated runway displays `Rp 45.000`.
- Test that clicking nominal chip `+25rb Makan Siang` recalculates simulated runway to `Rp 43.611` (`(810.000 - 25.000) / 18`).
- Test that clicking Reset restores `Rp 45.000`.

- [x] **Step 2: Run test to verify it fails**
Run: `npm --prefix frontend test src/__tests__/HeroInteractiveDemo.test.tsx`
Expected: FAIL (interactive controls do not exist).

- [x] **Step 3: Implement In-Hero Interactive Simulator & Living Effects in `HeroSection.tsx`**
- Add state: `simulatedExpense: number` (default 0).
- Baseline: `totalLiquid: 810000`, `daysRemaining: 18`, `baselineRunway: 45000`.
- Display live: `simulatedRunway = Math.max(0, Math.floor((totalLiquid - simulatedExpense) / daysRemaining))`.
- Add quick nominal chips: `+25rb Makan Siang`, `+30rb Bensin`, `+50rb Belanja` with Lucide icons (`UtensilsCrossed`, `Fuel`, `ShoppingBag`).
- Add animated perimeter border beam on the card using CSS conic-gradient animation.
- Add rising telemetry bars using Framer Motion (`initial={{ height: 0 }} animate={{ height: barHeight }} transition={{ duration: 0.7, delay: i * 0.1 }}`).
- Add subtle 3D mouse tilt parallax on desktop viewports.

- [x] **Step 4: Run tests to verify they pass**
Run: `npm --prefix frontend test src/__tests__/HeroInteractiveDemo.test.tsx`
Expected: PASS.

- [x] **Step 5: Commit**
```bash
git add frontend/src/components/landing/HeroSection.tsx frontend/src/__tests__/HeroInteractiveDemo.test.tsx
git commit -m "feat(landing): implement in-hero interactive runway simulator and living effects"
```

---

### Task 4: Full Test Suite, TypeCheck & Docker Build Verification

**Files:**
- Entire frontend & backend test matrices.

- [x] **Step 1: Run full frontend Vitest test suite**
Run: `npm --prefix frontend test -- --run`
Expected: All suites PASS.

- [x] **Step 2: Run TypeScript strict check and production build**
Run: `cd frontend && npm run build`
Expected: Clean build with 0 errors.

- [x] **Step 3: Run Impeccable static detector check**
Run: `"C:/Users/grant/.claude/plugins/cache/impeccable/impeccable/4.3.1/skills/impeccable/scripts/impeccable.cmd" detect --json frontend/src`
Expected: 0 findings.

- [x] **Step 4: Rebuild and restart Docker frontend container**
Run: `docker compose build frontend && docker compose up -d frontend`
Expected: Successfully updated and healthy.

- [x] **Step 5: Run backend pytest suite**
Run: `pytest`
Expected: 493/493 tests pass.

- [x] **Step 6: Commit final verification**
```bash
git commit --allow-empty -m "chore(audit): verify landing page living motion and interactive demo test matrix"
```
