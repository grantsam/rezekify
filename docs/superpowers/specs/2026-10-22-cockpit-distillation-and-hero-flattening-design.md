# Cockpit Distillation & Hero Flattening Design Specification

- **Date**: 2026-10-22
- **Scope**: Frontend Cockpit (`OverviewView.tsx`, `QuickCaptureBar.tsx`, removal of `AISpotlightHero.tsx` redundancy)
- **Status**: Approved

## 1. Intent & Problem Statement
During the latest Impeccable critique (Health Score 36/40), two priority architectural friction points were identified on the `Ringkasan` (Overview) page:
1. **Redundant AI Entry Points**: `QuickCaptureBar` and `AISpotlightHero` were mounted sequentially at the top of `OverviewView.tsx`. `AISpotlightHero` consumed over 220px of vertical space advertising conversational capabilities that `QuickCaptureBar` already handles in place, pushing the core telemetry number below the fold.
2. **Keyboard Shortcut Mismatch**: `QuickCaptureBar.tsx` rendered a badge reading `Ctrl ↵`, but keypress handling executed on standard single `Enter`, causing confusion and unexpected submissions.
3. **Severe Box-in-a-Box Nesting**: Inside the Hero Telemetry Card, six bordered nested sub-containers fragmented visual flow and created cognitive fatigue.
4. **Duplicate Simulation Triggers**: The *Komitmen & Vaults Prioritas* card retained an old modal button (`Simulasi Belanja`) opening `SimulatePurchaseModal`, conflicting with the in-place What-If simulation drawer in the Hero card.
5. **Emoji Clutter**: Action chips and triggers used emoticons (`⚡`, `🍜`) rather than semantic SVG icons.

## 2. Goals & Non-Goals

### Goals
- **Single Capture Center**: Make `QuickCaptureBar` the single, authoritative input bar in `OverviewView.tsx`.
- **Integrated Suggestion Chips with Lucide Icons**: Provide 3 quick pre-fill suggestion chips beneath `QuickCaptureBar` using Lucide SVG icons (`UtensilsCrossed`, `Fuel`, `Wifi`), zero emojis.
- **Accurate Keyboard Label**: Update the submission shortcut badge from `Ctrl ↵` to `↵ Enter`.
- **Flattened Editorial Hero Card**: Remove nested bordered sub-boxes (`rounded-2xl border bg-zinc-900/60`). Create a clean, single-surface dark obsidian card (`bg-[#141417]`) with subtle divider lines (`border-zinc-800/60`).
- **Single Simulation Pathway**: Remove the redundant `Simulasi Belanja` modal button from the *Komitmen & Vaults Prioritas* card. Replace `⚡` on the What-If toggle with `<Sparkles className="w-3.5 h-3.5 text-emerald-500" />`.
- **100% Test Pass**: Update existing frontend test suites to reflect the refined DOM structure.

### Non-Goals
- Do not modify backend Python services or database schemas.
- Do not remove `AIChatView.tsx` from the application; it remains accessible via the sidebar navigation for users who want dedicated conversational deep dives.

## 3. Detailed Component Architecture

### 3.1 `QuickCaptureBar.tsx`
- **Suggestion Chips**: Add an optional or integrated row of quick suggestions below the input bar:
  - `<UtensilsCrossed className="w-3.5 h-3.5 text-emerald-500" /> Makan siang 25rb`
  - `<Fuel className="w-3.5 h-3.5 text-emerald-500" /> Bensin 30rb`
  - `<Wifi className="w-3.5 h-3.5 text-emerald-500" /> Bayar wifi 350rb`
  Clicking sets `text` state and focuses the input.
- **Shortcut Badge**: Replace `Ctrl ↵` with `↵ Enter`.
- **Accessibility**: All buttons and chips adhere to $\ge 38\text{px}$ touch targets with visible focus rings.

### 3.2 `OverviewView.tsx`
- **Remove `AISpotlightHero`**: Completely unmount `<AISpotlightHero />` from `OverviewView.tsx`.
- **Hero Card Structure**:
  - Remove outer-wrapped nested container divs (`bg-slate-50/90 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-4`).
  - Keep the primary daily runway number as the visual centerpiece (`text-4xl md:text-5xl font-mono font-black`).
  - Render progress bar directly below the runway metrics.
  - Render Contextual Survival Guidance banner with clean borderless tinted background.
  - Render Mathematical Reconciliation Strip with clean divider border.
  - What-If simulation drawer toggle button uses `<Sparkles className="w-3.5 h-3.5 text-emerald-500" /> Cek Dampak Belanja` instead of `⚡`.
- **Komitmen & Vaults Card**:
  - Remove `<Button onPress={onOpenSimulateModal}>Simulasi Belanja</Button>`. Keep only the `Lihat Semua Vault` link/button.

## 4. Verification & Testing
- Vitest component tests in `OverviewView.test.tsx`, `QuickCaptureBar.test.tsx`, and `AllPhasesE2EIntegration.test.tsx`.
- TypeScript strict compilation: `npx tsc --noEmit`.
- Production build: `npm run build`.
- Impeccable detect static check: `impeccable detect`.
