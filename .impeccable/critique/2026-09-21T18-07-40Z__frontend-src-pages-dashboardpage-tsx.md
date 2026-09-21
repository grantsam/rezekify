---
target: frontend/src/pages/DashboardPage.tsx
total_score: 18
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 4
target_identity: "file:C:\\Grant code\\rezekify\\frontend\\src\\pages\\DashboardPage.tsx"
target_fingerprint: "sha256:eade136df4b887ea715e4151f89fca97aba6ddfdaa5be5defce7b60ae78b3d1b"
target_path: "C:\\Grant code\\rezekify\\frontend\\src\\pages\\DashboardPage.tsx"
timestamp: 2026-09-21T18-07-40Z
slug: frontend-src-pages-dashboardpage-tsx
---
### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2/4 | Expense chart lacks hover tooltips, actual values, and threshold line. Transactions table does not visually distinguish income vs expense. |
| 2 | Match System / Real World | 2/4 | Alienating developer jargon: labels users "Kritis (Insolvent)", exposes "Multimodal Vision OCR" and "Reconciliation". Users think in daily survival and wallet balance. |
| 3 | User Control and Freedom | 2/4 | Transaction deletion is irreversible without confirmation or undo toast. Upcoming bills card has no snooze or mark-as-paid action. |
| 4 | Consistency and Standards | 2/4 | Modal submit buttons switch between Indigo-600 and Emerald-500. Card border-radius jumps between rounded-2xl and rounded-3xl. |
| 5 | Error Prevention | 1/4 | No confirmation dialogue before deleting ledger mutations. AI Omni-Input commits directly to the ledger without a pre-commit verification preview. Native alert() used for invalid files. |
| 6 | Recognition Rather Than Recall | 2/4 | Account balances (BCA, GoPay) are hidden from the dashboard view. Daily spending bars have no numeric labels. |
| 7 | Flexibility and Efficiency | 2/4 | Header is cluttered with 4 modal buttons that overflow horizontally on mobile. No keyboard shortcuts (Cmd+K). |
| 8 | Aesthetic and Minimalist Design | 2/4 | OmniInputHero consumes massive vertical real estate with decorative blurs. Nested card containers create visual clutter. |
| 9 | Error Recovery | 2/4 | Native browser alert() is triggered on delete errors and file rejection. AI error messages are generic without recovery paths. |
| 10 | Help and Documentation | 1/4 | No tooltips or explanations for domain mechanics like "Brankas Terkunci" vs "Kas Operasional Bebas". No onboarding guidance. |
| **Total** | | **18/40** | **Poor (45% - Major UX overhaul required)** |

### Design Specificity Verdict

**LLM Assessment**: Category-Interchangeable AI SaaS Card Kit with Inverted Hierarchy.
The canvas (slate-950), cards (slate-900), and borders (slate-800) form an undifferentiated dark monoculture. Internal developer jargon ("Multimodal Vision OCR", "Reconciliation", "Insolvent") leaks into user-facing copy. More critically, the hierarchy is inverted: the AI input bar consumes primary attention above the fold, pushing the actual core value (Runway Telemetry & Upcoming Bills) downward.

**Deterministic Scan**:
- Automated Regex Scan: 0 syntax findings (clean Tailwind classes, no banned `from-purple` or `bg-clip-text`).
- Codebase Structural Audit: 14 verified defects across accessibility (missing `htmlFor`/`id`, missing `aria-label` on hero input and icon buttons, missing dialog semantics/Escape traps), semantics (div-soup table, unlabelled chart bars), and layout (sub-44px touch targets, continuous decorative pulse).

### Overall Impression
Rezekify's underlying mathematical engine (Runway & Double-Entry Ledger) is rock-solid, but the frontend wraps it in a cold, anxious developer dashboard. It feels like an administrative debugging interface rather than a calm, reassuring financial cockpit for students and freelancers.

### What's Working
1. **Dynamic Daily Safe Runway Concept**: Converting abstract bank balances into a single, daily spending ceiling (`daily_safe_runway`) is brilliant for combating student overspending.
2. **What-If Purchase Simulator**: `SimulatePurchaseModal` provides immediate psychological clarity on impulse purchases.
3. **Conversational Ingestion**: Natural language and receipt upload in a single endpoint dramatically lowers bookkeeping friction.

### Priority Issues

- **[P0] Inverted Visual Hierarchy: Omni-Input Dominates Over Runway Telemetry**
  - **Why it matters**: In Operate mode, situational awareness must precede data entry. Users must know if they can afford lunch *before* being prompted to record it.
  - **Fix**: Re-anchor the dashboard with a high-contrast Runway Status Command Center at the very top. Convert Omni-Input into a sleek, docked action bar or sticky bottom quick-bar.
  - **Suggested command**: `/impeccable layout`

- **[P1] Blind Expense Chart Lacks Numbers and Threshold Baseline**
  - **Why it matters**: The chart renders red bars without telling the user how much they spent or what the daily safe limit was.
  - **Fix**: Render a distinct SVG runway threshold baseline across the 7-day chart with interactive hover tooltips showing exact Rupiah amounts.
  - **Suggested command**: `/impeccable clarify`

- **[P1] Alienating & Punitive Microcopy**
  - **Why it matters**: Calling a low-balance student "Kritis (Insolvent)" and exposing "Multimodal Vision OCR" causes anxiety and confusion.
  - **Fix**: Humanize tone: "Mode Hemat Ketat", "Catat Santai / Foto Struk", "Uang Kas Siap Pakai".
  - **Suggested command**: `/impeccable clarify`

- **[P1] Zero Error Prevention on Ledger Mutations**
  - **Why it matters**: Accidental clicks on trash icons immediately delete transactions. Omni-Input records transactions without a pre-commit confirmation card.
  - **Fix**: Add a 6-second undo toast or confirmation dialog on delete, and show an inline verification preview for AI transactions.
  - **Suggested command**: `/impeccable harden`

- **[P2] Header Action Clutter & Missing Wallet Balances**
  - **Why it matters**: 6 buttons squeezed in the header cause horizontal scrolling on mobile, while actual account balances (BCA, GoPay) remain invisible on the dashboard.
  - **Fix**: Consolidate header actions into a primary "+ Catat" dropdown. Surface active wallet chips (BCA, GoPay, Tunai) directly on the dashboard.
  - **Suggested command**: `/impeccable distill`

### Persona Red Flags
- **Rizky (Mahasiswa Rantau, sisa Rp 150rb)**: Humiliated by "Kritis (Insolvent)" badge; mobile viewport forces runway below the fold; lacks guidance on surviving the month.
- **Sarah (Freelance Designer, BCA + GoPay)**: Cannot see where her money is stored; Simulasi Belanja is hidden in a scrolling header; cannot distinguish income from expense in the transaction table.

### Minor Observations & Questions
- Modals switch between Indigo and Emerald buttons arbitrarily.
- Continuous pulse animation on Sparkles violates calm terminal principles.
- Native `alert()` breaks web app flow.
- *Question*: What if individual wallet balances were interactive filter chips right below the runway?
- *Question*: What if Rezekify spoke in warm, calm Indonesian financial terms rather than accounting jargon?
