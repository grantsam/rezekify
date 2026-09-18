# Rezekify — Design System Specification

## Visual World & Identity
- **Surface Mode:** `Operate` (Clarity, rapid scanning, confident reassurance, zero visual noise).
- **Theme:** Dark-mode native financial terminal with deep slate surfaces and high-contrast status telemetry.

## Color Tokens
- **Background Root:** `bg-slate-950` (`#020617`)
- **Surface Card:** `bg-slate-900/90` (`#0f172a`), border `border-slate-800` (`#1e293b`)
- **Hero Center of Gravity:** Gradient `from-indigo-950 via-slate-900 to-slate-950`, border `border-indigo-500/30`, glow `shadow-indigo-500/10`
- **Telemetry Indicators (Traffic Light):**
  - **Healthy:** Emerald (`text-emerald-400`, `bg-emerald-500/10`, `border-emerald-500/30`)
  - **Warning:** Amber (`text-amber-400`, `bg-amber-500/10`, `border-amber-500/30`)
  - **Critical:** Rose (`text-rose-400`, `bg-rose-500/10`, `border-rose-500/30`)
- **Impending Bills Banner (H-7):** `bg-amber-950/40`, `border-amber-500/30`, badge `text-amber-300`

## Typography & Hierarchy
- **Font Families:** System Sans / Inter / Plus Jakarta Sans.
- **Numbers & Monetary Values:** Always use `tabular-nums` with explicit currency symbol (`Rp`) and locale formatting.
- **Hierarchy:**
  - Giant Runway Gauge: `text-3xl` to `text-4xl font-extrabold tracking-tight`
  - Card Titles: `text-sm font-semibold uppercase tracking-wider text-slate-400`
  - Transaction Notes: `text-sm font-medium text-slate-100`

## Layout & Responsive Craft
- **Grid:** Mobile-first single column on `<768px`, 12-column bento grid on desktop (`md:` and `lg:`).
- **Top Bar:** Brand logo with glowing green dot, user profile badge, and Telegram link status.
- **Hero Top Row:** Omni-input action bar + H-7 upcoming commitments alert banner.
- **Second Row:** Runway telemetry card (left) + Focused spending charts (right with Daily vs Monthly toggle).
- **Third Row:** Recent transaction ledger table with manual CRUD fallback modal button.
