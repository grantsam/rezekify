# Landing Page Calm Motion & Icon Harmonization Design Specification

- **Date**: 2026-10-23
- **Scope**: `frontend/src/pages/LandingPage.tsx` and all landing components in `frontend/src/components/landing/` + `frontend/src/components/common/ScrollReveal.tsx`
- **Status**: Approved

## 1. Intent & Context
The Rezekify landing page features a strong obsidian and emerald visual identity designed by the user's team. However, an audit identified two areas for refinement:
1. **Raw Emoticons/Emojis**: 23 raw unicode emojis are scattered across cards, badges, and CTAs (e.g. `💰`, `⚡`, `🤖`, `📷`, `➔`, `💸`), which render inconsistently across operating systems and detract from professional fintech credibility.
2. **Aggressive Section Slide-Ins**: Full-screen sections are animated with `direction="left"` and `direction="right"` in `ScrollReveal`, causing horizontal layout shifts and jarring transitions.
3. **Mismatched Micro-Animations**: `animate-ping` and conflicting `animate-pulse` stars produce visual distraction in the hero card.

The goal is to elevate the craft to a calm, silky smooth experience inspired by Linear and Vercel while **strictly preserving** the existing layout, typography, copy, and dark obsidian aesthetic.

## 2. Goals & Non-Goals

### Goals
- **Complete Emoticon Eradication**: Replace all 23 emojis across 8 components with crisp, monochrome-accented Lucide React SVG icons.
- **Calm, Unified Motion Architecture**:
  - Replace horizontal section slide-ins with subtle vertical drift (`y: 16 -> 0`, `opacity: 0 -> 1`).
  - Upgrade `ScrollReveal` with calm cubic-bezier easing (`[0.16, 1, 0.3, 1]`) and 0.5s duration.
  - Implement gentle card stagger delays (`0.06s`) within card grids.
  - Replace `animate-ping` with a calm, glowing ambient beacon.
  - Replace arbitrary `animate-pulse` stars with quiet ambient gradients.
- **Design Token Harmonization**:
  - Harmonize legacy raw hexes (`#10B981`, `#0F766E`) to semantic Tailwind tokens (`emerald-500`, `teal-600`, `zinc-800`).
- **Preservation Invariant**:
  - Zero changes to copy, layout sections, or structural hierarchy created by the user's team.

### Non-Goals
- Do not redesign or alter the product narrative or marketing copy.
- Do not introduce heavy 3D WebGL or CPU-intensive canvas shaders.

## 3. Concrete Icon Replacements (All 23 Instances)

1. `HeroSection.tsx`:
   - Line 149: `💰` -> `<Wallet className="w-4 h-4 text-emerald-400" />`
   - Line 176: `↑` -> `<ArrowUpRight className="w-4 h-4" />`
   - Line 189: `↓` -> `<ArrowDownRight className="w-4 h-4" />`
   - Line 211: `✨` -> `<Sparkles className="w-3.5 h-3.5 text-emerald-400" />`
2. `AboutSection.tsx`:
   - Line 100: `⚡` -> `<Zap className="w-5 h-5 text-emerald-400" />`
   - Line 110: `🤖` -> `<Bot className="w-5 h-5 text-emerald-400" />`
3. `BenefitSection.tsx`:
   - Metric icons: `⚡` -> `<Zap />`, `🛡️` -> `<ShieldCheck />`, `📈` -> `<TrendingUp />`, `🎯` -> `<Target />`
4. `FeatureSection.tsx`:
   - Line 137: `📷` -> `<Camera className="w-4 h-4 text-emerald-400" />`
5. `WorkflowSection.tsx`:
   - Line 153: `➔` -> `<ArrowRight className="w-4 h-4 ml-1.5" />`
   - Line 192: `💻` -> `<Laptop className="w-4 h-4 text-emerald-400" />`
6. `FaqSection.tsx`:
   - Line 55: `💬` -> `<MessageCircle className="w-4 h-4 text-emerald-400" />`
   - Line 64: `➔` -> `<ArrowRight className="w-4 h-4 ml-1.5" />`
7. `CtaSection.tsx`:
   - Line 39, 124: `➔` -> `<ArrowRight className="w-4 h-4 ml-2" />`
   - Line 55: `✨` -> `<Sparkles className="w-4 h-4 text-emerald-400" />`
   - Line 67: `🤖` -> `<Bot className="w-4 h-4 text-emerald-400" />`
   - Line 84: `💸` -> `<Banknote className="w-4 h-4 text-emerald-400" />`
   - Line 93: `✅` -> `<CheckCircle2 className="w-4 h-4 text-emerald-400" />`
8. `FooterSection.tsx`:
   - Lines 149, 153, 159: `📍` -> `<MapPin />`, `✉️` -> `<Mail />`, `📞` -> `<Phone />`
   - Line 195: `✓` -> `<CheckCircle2 className="w-4 h-4 text-emerald-400 mr-1.5 inline" />`

## 4. Calm Motion Implementation

- `ScrollReveal.tsx`:
  - Default direction: `up` with `y: 16` (reduced from `y: 50`).
  - Cubic-bezier ease: `[0.16, 1, 0.3, 1]`.
  - Duration: `0.55s`.
  - Viewport margin: `-40px`.
- `LandingPage.tsx`:
  - Unify all section reveals to calm vertical or fade transitions. Remove `direction="left"` and `direction="right"`.

## 5. Verification
- Component render tests for `LandingPage` and sections.
- Verification that emoji regex scan yields 0 instances.
- Vitest suites pass, production build clean, `impeccable detect` 0 findings.
