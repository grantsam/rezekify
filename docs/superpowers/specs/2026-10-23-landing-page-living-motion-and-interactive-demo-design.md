# Landing Page Living Motion & Interactive Demo Design Specification

- **Date**: 2026-10-23
- **Scope**: Landing Page Experience (`frontend/src/pages/LandingPage.tsx`, `frontend/src/components/landing/*.tsx`, `frontend/src/hooks/useCountUp.ts`)
- **Status**: Approved

## 1. Intent & Problem Statement
The landing page has clean typography and consistent Lucide icons, but currently feels static. Prospective users read about deterministic runways and AI cashflow management, but cannot feel how it works before creating an account.

We will introduce 3 coordinated tiers of calm, high-craft animation and motion:
1. **Tier 1 (Functional Motion)**: Silky accordion FAQ with height animation and rotating plus glyphs, tab/step crossfades using Framer Motion `AnimatePresence`, and tactile button spring presses (`whileTap={{ scale: 0.98 }}`).
2. **Tier 2 (Living Visual Craft)**: Animated perimeter border beam on the Hero Card, rising telemetry bars on scroll/mount, smooth counting numbers (`100%`, `24/7`, `85%`, `3.5x`) triggered on viewport entry, and subtle 3D mouse parallax tilt on the hero card.
3. **Tier 3 (In-Hero Interactive Runway Sandbox)**: An interactive "try-it-now" mini simulator embedded right inside the Hero preview card. Visitors can tap nominal chips (`Makan Siang 25rb`, `Bensin 30rb`) or type a custom amount to watch the daily runway meter dynamically re-calculate in real time right on the landing page with zero latency.

## 2. Invariants & Craft Guardrails
- **Performance**: 60fps GPU-accelerated motion (transforms and opacity only; zero layout thrashing).
- **Calm Easing**: Apple/Linear deceleration curve `[0.16, 1, 0.3, 1]`, duration $\le 0.6\text{s}$, max 3D tilt $\le 4^\circ$. No chaotic bounces.
- **Theme Preservation**: Strictly maintain the dark obsidian `#0c0c0e` canvas, `#141417` card surfaces, and emerald/teal accents created by the user's team.
- **Accessibility**: Honor `prefers-reduced-motion` across all motion components.
- **Zero Raw Emojis**: 100% Lucide React SVG icons.

## 3. Technical Architecture & Component Breakdown

### 3.1 Reusable `useCountUp` Hook (`frontend/src/hooks/useCountUp.ts`)
- Accepts target number or formatted string (e.g. `100`, `85`, `3.5`).
- Uses Framer Motion's `useInView` and `animate` to interpolate from 0 to target over 1.2s when scrolled into view (`once: true`).
- Returns formatted output with custom suffix (`%`, `x`, etc.).

### 3.2 In-Hero Interactive Runway Demo & Living Effects (`HeroSection.tsx`)
- **Interactive State**:
  - Baseline runway: `Rp 45.000 / hari` (Sisa Siklus: 18 hari, Bebas Pakai: Rp 810.000).
  - Quick simulation chips: `Makan 25rb`, `Bensin 30rb`, `Ngopi 45rb`.
  - Immediate client-side calculation: `(810.000 - planned) / 18 = newRunway`.
  - Side-by-side indicator showing baseline vs simulated runway with dynamic tone pill.
  - Reset button to restore baseline.
- **Animated Perimeter Border Beam**:
  - A subtle emerald conic-gradient traveling smoothly along the card border.
- **Rising Telemetry Bars**:
  - The 5 spending bars animate height from `0%` to their target heights on initial view over `0.7s`.
- **Subtle 3D Parallax Tilt**:
  - Uses `useMotionValue`, `useTransform`, and `useSpring` to tilt card based on mouse coordinates ($\pm 3^\circ$). Disabled on touch viewports.

### 3.3 Silky FAQ Accordion (`FaqSection.tsx`)
- Wraps answer containers in `<AnimatePresence initial={false}>`.
- Content animates with `initial={{ height: 0, opacity: 0 }}`, `animate={{ height: 'auto', opacity: 1 }}`, `exit={{ height: 0, opacity: 0 }}`, `transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}`.
- Indicator rotates from `0deg` (`+`) to `45deg` (`×`) with smooth transform.

### 3.4 Smooth Crossfades (`WorkflowSection.tsx` & `BenefitSection.tsx`)
- Wraps step detail and benefit highlight containers in `<AnimatePresence mode="wait">`.
- Changes animate with `initial={{ opacity: 0, y: 6 }}`, `animate={{ opacity: 1, y: 0 }}`, `exit={{ opacity: 0, y: -6 }}` over `0.2s`.

### 3.5 Animated Number Counters Integration (`AboutSection.tsx` & `BenefitSection.tsx`)
- Replaces static `100%`, `24/7`, `85%`, `3.5x` with `useCountUp` animated displays that trigger as the user scrolls into view.

## 4. Verification & Testing
- Unit tests for `useCountUp` hook (`useCountUp.test.ts`).
- Component tests for interactive hero mini-demo (`HeroSection.test.tsx`).
- FAQ accordion animation tests (`FaqSection.test.tsx`).
- Full Vitest suite pass, production build clean, `impeccable detect` zero anti-patterns.
