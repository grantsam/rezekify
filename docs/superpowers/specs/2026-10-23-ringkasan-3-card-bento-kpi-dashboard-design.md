# Ringkasan 3-Card Bento KPI Dashboard Design Specification

- **Date**: 2026-10-23
- **Scope**: `frontend/src/components/OverviewView.tsx`, `frontend/src/pages/DashboardPage.tsx`
- **Status**: Approved

## 1. Intent & Problem Statement
The current `Ringkasan` (Overview) cockpit suffers from information overload and an unfamiliar "Frankenstein" layout:
1. Almost all financial telemetry is crammed into one giant 600px vertical card.
2. Financial math is printed as an engineering raw text equation (`Total Kas: Rp X − Terkunci: Rp Y = Bebas Pakai: Rp Z ÷ N hari = Runway/hari`), which feels like a console log rather than a modern executive dashboard.
3. Interactive CTAs are scattered in random sub-strips and banners.
4. The bottom row is visually lopsided (a thin empty strip on the left vs a tall 3-vault stack on the right).

This specification resolves these issues by transitioning to a standard, balanced Bento Grid dashboard inspired by Mercury, Linear, and Revolut:
- **Top Row (Bento 3-Card KPI Header)**: 3 equal-width cards (`grid grid-cols-1 md:grid-cols-3 gap-5`):
  1. **Card 1 (Jatah Belanja Hari Ini)**: Hero safe runway (`Rp X / hari`), spent progress track, `<Sparkles className="w-4 h-4 text-emerald-500" /> Cek Dampak Belanja` button.
  2. **Card 2 (Kas Bebas Operasional)**: Available operating buffer (`Rp Y`), total liquid cash sub-label, days left in cycle, `<PlusCircle className="w-4 h-4 text-emerald-500" /> Catat Manual` button.
  3. **Card 3 (Dana Terkunci di Pos)**: Committed funds in fixed bills & savings (`Rp Z`), active vaults count, H-7 status, `<Layers className="w-4 h-4 text-emerald-500" /> Alokasikan Dana (Lump-Sum)` button.
- **In-Place What-If Simulation Accordion**: Mounts directly beneath the 3 KPI cards with Framer Motion `AnimatePresence` (`height: 0 -> auto`).
- **Contextual Survival Guidance**: Sits cleanly as a non-intrusive alert strip above the analytics charts when in warning/critical status.
- **Strict Invariant**: 100% Lucide React SVG icons — zero emojis / emoticons.

## 2. Invariants & Craft Guardrails
- **Zero Raw Emojis**: 100% Lucide React vector icons.
- **Zero Raw Math String Equations**: No `A − B = C ÷ N = D`. Discrete KPI tiles convey the relationships visually.
- **Touch Targets**: All buttons, chips, and controls $\ge 38\text{px}$.
- **Performance**: Zero Cumulative Layout Shift (CLS) during simulation drawer expansion.
- **Deterministic Math**: Double-entry accounting balances and Python `decimal.Decimal` runway logic preserved 100%.

## 3. Component Architecture (`OverviewView.tsx`)
- Props extended with `onOpenManualModal?: () => void` and `onOpenLumpSumModal?: () => void` (wired in `DashboardPage.tsx`).
- Top KPI Row renders the 3 cards.
- Simulation panel expands smoothly below the KPI row.
- Analytics charts & Recent Transactions remain in mid-row (7:5 split).
- Upcoming bills & Priority vaults remain in bottom row (50:50 symmetrical bento).
