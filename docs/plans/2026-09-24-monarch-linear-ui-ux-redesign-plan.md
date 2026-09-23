# Rezekify UI/UX Total Redesign Blueprint: From "AI Slop" to Linear/Monarch Financial Precision

**Goal**: Completely overhaul the Rezekify frontend from an "AI Slop" doomscroll (glowing purple gradients, button soup, 1000px single-page vertical scroll) into a professional, calm, and high-density financial terminal inspired by **Linear**, **Mercury**, and **Monarch Money**.

---

## 1. Core Principles of the Redesign

| Current "AI Slop" Anti-Pattern | New Linear / Monarch Standard |
| :--- | :--- |
| **Purple glowing gradients & star icons** (`shadow-indigo-500/20`, `Sparkles`, neon banners). | **Muted Zinc Obsidian Palette** (`#09090b` canvas, `#18181b` cards, hairline `border-zinc-800` borders, zero neon glow). |
| **Doomscroll single page**: Everything dumped into 1 vertical column (600px of scrolling before seeing transactions). | **Clean Multi-View Navigation**: Desktop Sidebar / Mobile Bottom Dock separating **Overview**, **Ledger**, and **Vaults**. |
| **Header "Button Soup"**: 7 horizontal buttons crammed together (`+ Rekening`, `+ Tagihan`, `+ Kategori`, `Simulasi`, etc.). | **Unified Quick Action (+)** and categorized sub-actions; clean top bar with only search and user avatar. |
| **Massive 300px Omni-Input Hero box**: Occupies 35% of the screen like a flashy AI wrapper demo. | **Sleek 48px Quick-Capture Command Bar**: Minimalist input bar (or `Cmd+K` drawer) with quiet mic and receipt dropzone. |
| **Visual Rainbow Noise**: Neon yellow, purple, bright green, and rose competing for attention. | **Functional Data Telemetry**: Status colors (Emerald, Amber, Rose) used strictly for data signals, never for background decoration. |

---

## 2. Information Architecture (IA) & Navigation Layout

### Desktop Layout (>= 768px):
```
┌──────────────┬────────────────────────────────────────────────────────┐
│ [R] Rezekify │ Top Bar: Breadcrumb / View Title       [Telegram] [User]│
│              ├────────────────────────────────────────────────────────┤
│ [+ Catat]    │ Main Content Area (Active View):                       │
│              │                                                        │
│ • Ringkasan  │ [Overview View] OR [Buku Besar View] OR [Vaults View]  │
│ • Buku Besar │                                                        │
│ • Komitmen   │                                                        │
│ • Pengaturan │                                                        │
│              │                                                        │
│ ──────────── │                                                        │
│ Saldo Akun   │                                                        │
│ BCA: 2jt     │                                                        │
│ GoPay: 150rb │                                                        │
└──────────────┴────────────────────────────────────────────────────────┘
```

### Mobile Layout (< 768px):
- **Top Header**: Minimalist Brand Logo + Telegram Status Chip + User Profile (height 52px).
- **Active Content Area**: Dedicated view screen with zero horizontal overflow.
- **Fixed Floating Bottom Bar (Thumb Zone)**:
  - 4 Navigation Tabs: `[Ringkasan]` `[Buku Besar]` `[(+) Quick Entry]` `[Komitmen]` `[Akun]`
  - Ergonomic 48x48px centered button for instant voice note or receipt upload without reaching to the top of the screen.

---

## 3. View Breakdown

### View 1: Overview (Ringkasan Kas & Runway)
- **Top Bar**: Sleek Quick-Capture Bar (height 48px) with casual text prompt, subtle paperclip for receipts, and mic for voice notes.
- **3 Metric Telemetry Tiles**:
  1. *Daily Safe Runway*: Rp 100.000 / hari (Status pill: Aman Terkendali).
  2. *Kas Operasional Bebas*: Rp 2.000.000 (Kas likuid di luar komitmen).
  3. *Cadangan Terkunci*: Rp 500.000 (Dana diamankan di vaults).
- **Bento Telemetry Row**:
  - *Left (Col 7)*: 7-Day Spending vs Runway Baseline (Bar chart minimalis).
  - *Right (Col 5)*: H-7 Urgent Commitments (Kartu ringkas tagihan jatuh tempo ≤ 7 hari).
- **Recent Activity**: 5 mutasi terakhir dengan tombol *"Lihat Semua Mutasi di Buku Besar →"*.

### View 2: Buku Besar (Full Transactions Ledger)
- Layar penuh dedikasi untuk pembukuan berpasangan.
- Toolbar multi-filter: Search debounced 300ms, filter akun dropdown, filter kategori dropdown, dan segmented date pills (`Hari Ini`, `7 Hari`, `Bulan Ini`).
- Desktop Table dengan sticky header + Mobile Card View responsif.
- Aksi CRUD lengkap: Tambah manual, edit, dan hapus transaksi dengan atomic reversal semantics.

### View 3: Komitmen & Vaults (Sinking Funds)
- Grid kartu brankas virtual 3-kolom dengan filter tab (`Semua`, `Tagihan Tetap`, `Tabungan`).
- Visualisasi progres target terkumpul, tanggal jatuh tempo, dan gembok lock imutabilitas.
- Form tambah dan ubah vault.

---

## 4. Execution Checklist

- [ ] **Phase 1: Shell & Navigation Architecture (`AppLayout.tsx`)**
  - [ ] 1.1 Create `frontend/src/components/AppLayout.tsx` providing the desktop sidebar (collapsible) and mobile fixed bottom dock.
  - [ ] 1.2 Implement view state management (`activeView: 'overview' | 'transactions' | 'vaults' | 'settings'`) in `AppLayout` or `DashboardPage`.
  - [ ] 1.3 Move the 7 cramped header buttons into categorized, clean navigation actions.
  - [ ] 1.4 Move account balance chips into a dedicated sidebar widget on desktop and account drawer on mobile.
  - [ ] 1.5 Verify: Unit test layout rendering and responsive breakpoint behavior.

- [ ] **Phase 2: Purify Omni-Input (Kill the Glowing AI Slop)**
  - [ ] 2.1 Redesign `OmniInputHero.tsx` into `QuickCaptureBar.tsx`:
        - Reduce height from 300px to a compact 48px input strip.
        - Eliminate purple glowing box-shadows (`shadow-indigo-500/20`), giant header banner, and `Sparkles` icon.
        - Style as a dark slate/zinc precision command bar with hairline borders (`border-zinc-800`).
        - Retain voice note recording (with compact audio bars) and receipt dropzone (subtle border highlight without cartoon gradients).
  - [ ] 2.2 Replace giant in-page AI message alert with a clean, quiet floating toast or dismissible notification chip.
  - [ ] 2.3 Verify: `OmniInputHero.test.tsx` passes with new compact ergonomics.

- [ ] **Phase 3: Overview Dashboard Refinement (Linear / Monarch Telemetry)**
  - [ ] 3.1 Refactor `RunwayMetricCard.tsx` into a 3-tile telemetry row (*Daily Safe Runway*, *Operational Free Cash*, *Locked Reserves*).
  - [ ] 3.2 Polish `UpcomingBillsCard.tsx` with compact, quiet typography and clear H-due indicators.
  - [ ] 3.3 Add "Recent 5 Transactions" preview tile on the Overview screen with a clean link to the full Buku Besar view.
  - [ ] 3.4 Verify: `RunwayMetricCard.test.tsx`, `UpcomingBillsCard.test.tsx`, and `DashboardPage.test.tsx` pass.

- [ ] **Phase 4: Dedicated Buku Besar & Vaults Views**
  - [ ] 4.1 Extract the full `TransactionsTable` into the dedicated `Buku Besar` view with maximum vertical real estate.
  - [ ] 4.2 Extract `VaultsSection` into the dedicated `Komitmen & Vaults` view with quick vault creation triggers.
  - [ ] 4.3 Verify: View switching maintains zero state loss and clean re-rendering.

- [ ] **Phase 5: Design Token Purifikasi & Quality Gate**
  - [ ] 5.1 Remove all legacy purple glowing classes, rainbow button backgrounds, and decorative fluff.
  - [ ] 5.2 Ensure consistent zinc-based dark theme (`bg-zinc-950`, `bg-zinc-900`, `border-zinc-800`).
  - [ ] 5.3 Run full test suite: `cd frontend && npm test`.
  - [ ] 5.4 Run production build: `cd frontend && npm run build`.
  - [ ] 5.5 Run blackbox integration: `pytest tests/test_frontend_blackbox.py -v`.
  - [ ] 5.6 Update `DESIGN.md` reflecting the new Linear/Monarch-grade design tokens.
