# Landing Page Calm Motion & Icon Harmonization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the Rezekify landing page by eliminating all 23 raw unicode emojis, replacing them with Lucide React SVG icons, upgrading ScrollReveal and hero animations to calm Apple/Linear-inspired motion, and harmonizing legacy color tokens while strictly preserving the team's visual theme and copy.

**Architecture:** Update 8 landing section components in `frontend/src/components/landing/` to replace emojis with semantic Lucide SVG icons. Refactor `ScrollReveal.tsx` to use calm vertical easing (`[0.16, 1, 0.3, 1]`) and update `LandingPage.tsx` to remove jarring horizontal section slide-ins. In `HeroSection.tsx`, replace `animate-ping` with a calm ambient beacon.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Framer Motion, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-23-landing-page-calm-motion-and-icon-harmonization-design.md`

## Global Constraints
- Zero emojis / emoticons in landing page code or rendered markup — all UI markers must use Lucide React icons.
- Strict preservation of all text copy, headings, and card layouts created by the user's team.
- Motion must be calm: cubic-bezier `[0.16, 1, 0.3, 1]`, duration $\le 0.6\text{s}$, max vertical drift $\le 20\text{px}$. Zero horizontal section slide-ins.
- Strict TypeScript build with 0 errors (`npx tsc --noEmit && npm run build`).

## Review Focus
1. No raw unicode emojis must remain in `LandingPage.tsx` or any `components/landing/*.tsx` file.
2. Section transitions on scroll must feel calm, fluid, and cohesive with zero horizontal scrollbar stutter.
3. Interactive hover states on cards and buttons must feel responsive and tactile.
4. Mobile viewports ($360\text{px}$) must render all icons cleanly without clipping or layout wrapping issues.
5. All Vitest tests and production builds must pass with exit code 0.

---

### Task 1: Complete Emoticon Eradication & Icon Harmonization

**Files:**
- Modify: `frontend/src/components/landing/HeroSection.tsx`
- Modify: `frontend/src/components/landing/AboutSection.tsx`
- Modify: `frontend/src/components/landing/BenefitSection.tsx`
- Modify: `frontend/src/components/landing/FeatureSection.tsx`
- Modify: `frontend/src/components/landing/WorkflowSection.tsx`
- Modify: `frontend/src/components/landing/FaqSection.tsx`
- Modify: `frontend/src/components/landing/CtaSection.tsx`
- Modify: `frontend/src/components/landing/FooterSection.tsx`
- Create: `frontend/src/__tests__/LandingPageIcons.test.tsx`

**Interfaces:**
- Produces: 100% clean landing components using Lucide React SVG icons.

- [ ] **Step 1: Write the failing test in `frontend/src/__tests__/LandingPageIcons.test.tsx`**
Create a test that renders `LandingPage` and asserts that:
- No raw emojis exist in the rendered text content (using unicode emoji regex).
- Key Lucide icons are rendered in place (Wallet, Sparkles, Zap, Bot, ShieldCheck, Camera, ArrowRight, Laptop, MessageCircle, Banknote, CheckCircle2, MapPin, Mail, Phone).

- [ ] **Step 2: Run test to verify it fails**
Run: `npm --prefix frontend test src/__tests__/LandingPageIcons.test.tsx`
Expected: FAIL due to emoji regex matches.

- [ ] **Step 3: Replace emojis in all 8 landing components**
- `HeroSection.tsx`: `💰` -> `<Wallet />`, `↑`/`↓` -> `<ArrowUpRight />`/`<ArrowDownRight />`, `✨` -> `<Sparkles />`. Harmonize `#10B981` to `emerald-500`.
- `AboutSection.tsx`: `⚡` -> `<Zap />`, `🤖` -> `<Bot />`.
- `BenefitSection.tsx`: `⚡`, `🛡️`, `📈`, `🎯` -> `<Zap />`, `<ShieldCheck />`, `<TrendingUp />`, `<Target />`.
- `FeatureSection.tsx`: `📷` -> `<Camera />`.
- `WorkflowSection.tsx`: `➔` -> `<ArrowRight />`, `💻` -> `<Laptop />`.
- `FaqSection.tsx`: `💬` -> `<MessageCircle />`, `➔` -> `<ArrowRight />`.
- `CtaSection.tsx`: `➔`, `✨`, `🤖`, `💸`, `✅` -> `<ArrowRight />`, `<Sparkles />`, `<Bot />`, `<Banknote />`, `<CheckCircle2 />`.
- `FooterSection.tsx`: `📍`, `✉️`, `📞`, `✓` -> `<MapPin />`, `<Mail />`, `<Phone />`, `<CheckCircle2 />`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npm --prefix frontend test src/__tests__/LandingPageIcons.test.tsx`
Expected: PASS with 0 emojis detected.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/landing/ frontend/src/__tests__/LandingPageIcons.test.tsx
git commit -m "feat(landing): replace all raw emojis with semantic Lucide SVG icons"
```

---

### Task 2: Calm Motion Architecture Upgrade (`ScrollReveal.tsx`, `LandingPage.tsx`, `HeroSection.tsx`)

**Files:**
- Modify: `frontend/src/components/common/ScrollReveal.tsx`
- Modify: `frontend/src/pages/LandingPage.tsx`
- Modify: `frontend/src/components/landing/HeroSection.tsx`

**Interfaces:**
- Produces: Smooth, calm Framer Motion reveals with zero horizontal section shifting.

- [ ] **Step 1: Upgrade `ScrollReveal.tsx`**
- Set default `direction` to `'up'` with subtle `y: 16` (reduced from `y: 50`).
- Ease curve: `[0.16, 1, 0.3, 1]` with `duration: 0.55` and `viewport={{ once: true, margin: '-40px' }}`.

- [ ] **Step 2: Unify section reveals in `LandingPage.tsx`**
- Remove all `direction="left"` and `direction="right"`.
- Use clean, gentle `direction="up"` across all sections.

- [ ] **Step 3: Calming Hero Telemetry in `HeroSection.tsx`**
- Replace jarring `animate-ping` dot with a calm, glowing ambient status beacon (`relative flex h-2.5 w-2.5` with soft static glow and subtle pulse).
- Replace mismatched `animate-pulse` stars with quiet ambient gradient accents.

- [ ] **Step 4: Run Vitest tests**
Run: `npm --prefix frontend test src/__tests__/LandingPageIcons.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add frontend/src/components/common/ScrollReveal.tsx frontend/src/pages/LandingPage.tsx frontend/src/components/landing/HeroSection.tsx
git commit -m "style(landing): upgrade ScrollReveal and hero animations to calm motion"
```

---

### Task 3: Full Verification Matrix & Design Audit

**Files:**
- Entire frontend & backend suites.

- [ ] **Step 1: Run full frontend Vitest test suite**
Run: `npm --prefix frontend test -- --run`
Expected: 40/40 test files pass.

- [ ] **Step 2: Run TypeScript strict check and production build**
Run: `cd frontend && npm run build`
Expected: Clean build with 0 errors.

- [ ] **Step 3: Run Impeccable static detector check**
Run: `"C:/Users/grant/.claude/plugins/cache/impeccable/impeccable/4.3.1/skills/impeccable/scripts/impeccable.cmd" detect --json frontend/src`
Expected: 0 findings.

- [ ] **Step 4: Run backend pytest suite**
Run: `pytest`
Expected: 493/493 tests pass.

- [ ] **Step 5: Commit final verification**
```bash
git commit --allow-empty -m "chore(audit): verify landing page calm motion and icon harmonization"
```
