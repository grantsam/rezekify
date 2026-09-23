# Design Specification: Rezekify Modern Zinc Studio UI/UX Overhaul

## 1. Context & Executive Summary
- **Goal**: Transform the Rezekify frontend from an "AI Slop" doomscroll (neon purple gradients, 300px glowing AI hero, button soup header, 1000px single vertical scroll) into an ultra-clean, high-density financial terminal inspired by **Linear**, **Raycast**, and **Monarch Money**.
- **Aesthetic Direction**: **Modern Zinc Studio** (warm charcoal `#0c0c0e`, zinc `#141417` cards, hairline `border-zinc-800/80` borders, zero neon glow, data-driven functional status signals).
- **Core Product Invariants Maintained**:
  - Deterministic Python ledger math with `decimal.Decimal` ($\sum \text{Debit} = \sum \text{Credit}$).
  - Isolated row-level tenant security (`user_id = current_user_id`).
  - Strict atomic reversal semantics on transaction edits and deletions.
  - Multi-modal ingestion (Casual text prompt, Camera/Dropzone receipt OCR, Voice note audio).
  - Rotary Key Pool zero-cost LLM orchestration.

---

## 2. Information Architecture & Navigation

### 2.1 App Shell (`AppLayout.tsx`)
- Centralizes state for `activeView: 'overview' | 'ledger' | 'vaults' | 'settings'`.
- Replaces the 1000px single-page doomscroll with dedicated, focused views.

### 2.2 Desktop Navigation (`Sidebar.tsx`)
- Positioned on the left, 240px wide, collapsible to 64px icon bar with `framer-motion` layout transition (duration <= 250ms).
- **Top Section**: Monochromatic brand wordmark "Rezekify" + live status dot (`bg-emerald-500 animate-pulse`).
- **Main Navigation Items**:
  1. **Ringkasan (Overview)**: Icon `LayoutDashboard`
  2. **Buku Besar (Ledger)**: Icon `ReceiptText` with transaction count pill
  3. **Komitmen & Vaults**: Icon `ShieldCheck`
  4. **Pengaturan**: Icon `Settings`
- **Account Balances Section**:
  - Displays user's liquid accounts (BCA, GoPay, Cash) with current balance formatted in Indonesian Rupiah (`tabular-nums font-mono`).
  - Action trigger: `+ Rekening` button.
- **Bottom Footer**:
  - Compact Telegram sync status chip (`Terhubung` / `Belum Terhubung`).
  - User initials badge, user name, and logout button.

### 2.3 Mobile Navigation (`BottomDock.tsx`)
- Active for viewports `< 768px`.
- Fixed bottom dock with `backdrop-blur-md bg-zinc-950/90 border-t border-zinc-800` (height 64px, thumb-zone optimized).
- 4 navigation icon tabs (`Ringkasan`, `Buku Besar`, `Vaults`, `Pengaturan`).
- Prominent elevated center button **`(+) Quick-Capture`** (48x48px) for instant entry or voice note recording on mobile without reaching to the top.

---

## 3. Sleek Command Bar (`QuickCaptureBar.tsx`)
Replaces the 300px purple glowing `OmniInputHero` with a precision 44px command strip:
- **Dimensions & Style**: `h-11 (44px)`, `rounded-xl bg-[#141417] border border-zinc-800/80 focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600`.
- **Leading Element**: Subtle terminal/command icon (`Command` / `Terminal` in `text-zinc-500`).
- **Input Text**: Minimalist placeholder *"Ketik mutasi, drop foto struk kasir, atau rekam suara..."* with `Ctrl+Enter` / `Enter` submission.
- **Trailing Action Icons**:
  - Camera/File icon for receipt OCR file selection.
  - Microphone icon for instant voice note recording.
  - Shortcut badge `Ctrl ↵`.
- **Active Recording Mode**:
  - When recording, the 44px bar morphs into a compact audio telemetry visualizer: monospace duration counter (`00:04`), 5 animated audio frequency bars (`framer-motion`), Cancel button (`Esc`), and Submit button.
- **Receipt Drag-and-Drop Overlay**:
  - Full-screen subtle dark backdrop with hairline dashed border (`border-zinc-600`). Zero purple neon or cartoonish glow.
- **Confirmation Feedback**:
  - Replaces giant in-page confirmation banners with a discreet floating notification toast in the bottom-right corner that auto-dismisses after 4 seconds.

---

## 4. View Specifications

### 4.1 Overview View (`OverviewView.tsx`)
Dedicated purely to liquidity telemetry and situational awareness:
1. **3 Telemetry Hero Tiles**:
   - **Daily Safe Runway**: Large metric (`text-3xl sm:text-4xl font-mono font-bold text-white`), status badge (Emerald for `HEALTHY`, Amber for `WARNING`, Rose for `CRITICAL`), days remaining caption.
   - **Kas Bebas Operasional**: Total liquid cash minus locked vault reserves (`tabular-nums font-mono text-zinc-200`).
   - **Cadangan Terkunci (Vaults)**: Total allocated funds in vaults protected from impulsive daily spending.
2. **Bento Telemetry Row (12-Column Grid)**:
   - **Col 7 (Left)**: 7-Day Spending Trend vs Daily Safe Runway baseline (monochromatic zinc bars, rose bars only when exceeding daily quota).
   - **Col 5 (Right)**: Urgent Commitments (H-7) card with days-until-due badges (`H-1`, `H-4`) and shortage telemetry.
3. **Mini Vaults Overview**:
   - 3 highest priority commitment/savings cards with 4px animated progress bar, lock indicator, and quick link to full Vaults view.

### 4.2 Buku Besar View (`LedgerView.tsx`)
Full-screen dedicated double-entry ledger interface:
- **Header**: Title, subtitle, and primary actions (`+ Catat Manual`, `Simulasi Belanja`, `+ Kategori`).
- **Pro Multi-Filter Toolbar**:
  - 300ms debounced search input with shortcut hint (`/`).
  - Account select dropdown.
  - Category select dropdown.
  - Date filter pills (`Semua`, `Hari Ini`, `7 Hari Terakhir`, `Bulan Ini`).
- **High-Density Table (Desktop)**:
  - Sticky header (`backdrop-blur-md bg-[#0c0c0e]/90 text-zinc-400 border-b border-zinc-800`).
  - Row animations with `AnimatePresence`.
  - Monospace amounts (`+ Rp` emerald for income, `- Rp` zinc-100 for expenses).
  - Source channel chips, category badges, and edit/delete touch actions (`>= 38px`).
- **Mobile Card View (< 640px)**:
  - Touch-friendly cards preventing horizontal overflow.
- **Server-Side Pagination**:
  - Clean page indicator and previous/next buttons.

### 4.3 Komitmen & Vaults View (`VaultsView.tsx`)
Full-screen dedicated virtual envelope and sinking funds manager:
- **Header**: Title, subtitle, and `+ Tambah Vault` action.
- **Filter Tabs**: `Semua`, `Tagihan Tetap`, `Tabungan` with count badges.
- **3-Column Bento Grid**:
  - Cards with allocated vs target amounts in Indonesian Rupiah.
  - Animated progress visualizer (duration <= 250ms).
  - Padlock toggle button (`min-h-[38px] min-w-[38px]`) with optimistic backend mutation.
  - Locked vaults prevent deletion to safeguard allocated savings.

---

## 5. Design Tokens & Styling Guide
- **Background Root**: `bg-[#0c0c0e]`
- **Card Backgrounds**: `bg-[#141417]`
- **Borders**: `border-zinc-800/80` or `border-white/[0.08]`
- **Text Hierarchy**:
  - Primary text: `text-white`
  - Secondary text: `text-zinc-400`
  - Subtle captions / timestamps: `text-zinc-500`
- **Telemetry Signals**:
  - Emerald: `text-emerald-400`, `bg-emerald-500/10`, `border-emerald-500/20`
  - Amber: `text-amber-400`, `bg-amber-500/10`, `border-amber-500/20`
  - Rose: `text-rose-400`, `bg-rose-500/10`, `border-rose-500/20`
- **Interactive Elements**:
  - Standard HeroUI Button with `onPress`. Minimum 38x38px hit target.
  - Framer Motion transitions strictly capped at `<= 250ms` with `easeOut`.

---

## 6. Definition of Done & Quality Gate
1. All 22 test files continue to pass cleanly without regressions.
2. New views and shell components have dedicated unit tests.
3. TypeScript compilation (`tsc`) and Vite build succeed with zero errors.
4. Docker blackbox tests (`tests/test_frontend_blackbox.py`) pass 100%.
5. Zero console warnings (`[Hero UI] [useButton]: onClick is deprecated`).