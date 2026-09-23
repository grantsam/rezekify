# Rezekify — Design System Specification

## Visual World & Identity
- **Surface Mode:** `Operate` (Clarity, rapid scanning, confident reassurance, zero visual noise).
- **Theme:** Dark-mode native financial terminal with deep slate surfaces and high-contrast status telemetry.
- **Design Philosophy:** Utilitarian financial cockpit engineered for speed, cognitive ease, and determinism. Zero decorative fluff; every pixel serves financial telemetry or transactional integrity.

---

## 1. Color Tokens & Surface Hierarchy

### Base Surfaces (Modern Zinc Studio)
- **Background Root:** `#0c0c0e` (warm obsidian / charcoal) — Root dark canvas establishing neutral baseline contrast.
- **Card Surface:** `#141417` (`bg-[#141417]`) — Elevated card and container background.
- **Borders:** `border-zinc-800/80` or `border-white/[0.08]` for micro-delineation with zero harsh lines.
- **Card Hover / Accent Surface:** `hover:bg-zinc-800/40`, `hover:border-zinc-700/60`.
- **Input Fields & Insets:** `bg-[#0c0c0e]` or `bg-zinc-900/60`, border `border-zinc-800`.
- **Accent & Focus States:** Subdued monochromatic focus indicator: `focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600`.
- **Monochromatic Text Hierarchy:**
  - Primary text: `text-white` (`#ffffff`)
  - Secondary text: `text-zinc-400` (`#a1a1aa`)
  - Caption / tertiary: `text-zinc-500` (`#71717a`)

### Telemetry Indicators (Traffic Light Status)
- **Healthy / Income / Balanced:** Emerald
  - Text: `text-emerald-400`, `text-emerald-300`
  - Background: `bg-emerald-500/10`, `bg-emerald-500/20`
  - Border: `border-emerald-500/20`, `border-emerald-500/30`
  - Primary Action CTA: `bg-emerald-500 hover:bg-emerald-600 text-white`
- **Warning / Impending Bills / Fixed Commitments:** Amber
  - Text: `text-amber-400`, `text-amber-300`
  - Background: `bg-amber-500/10`, `bg-amber-950/40`
  - Border: `border-amber-500/30`, `border-amber-500/40`
  - H-7 Impending Bills Banner: `bg-amber-950/40 border-amber-500/30 text-amber-300`
- **Critical / Expense / Recording Active / Destructive:** Rose
  - Text: `text-rose-400`, `text-rose-200`
  - Background: `bg-rose-500/10`, `bg-rose-950/80`
  - Border: `border-rose-500/30`, `border-rose-500/40`
  - Recording Pulse & Destructive Action: `bg-rose-600 hover:bg-rose-500 text-white`
- **Info / Brand AI / Lock State:** Indigo
  - Text: `text-indigo-300`, `text-indigo-400`
  - Background: `bg-indigo-500/10`, `bg-indigo-950/40`
  - Border: `border-indigo-500/30`
  - Primary Submit Action: `bg-indigo-600 hover:bg-indigo-500 text-white`

---

## 2. Typography & Numerical Formatting

- **Font Families:** System Sans / Inter / Plus Jakarta Sans. Monospace fallback for telemetry counters (`font-mono`).
- **Numbers & Monetary Values:**
  - Always enforce `tabular-nums` for deterministic column alignment and zero layout shifts.
  - Strict currency notation: `Rp` prefix with Indonesian thousands grouping (e.g., `Rp 1.500.000`), zero decimals for whole Rupiah amounts (`maximumFractionDigits: 0`).
  - Signed prefixes: Explicit `+ Rp` in `text-emerald-400` for credits/income, `- Rp` in `text-slate-100` for debits/expenses.
- **Scale & Hierarchy:**
  - Giant Runway Gauge: `text-3xl` to `text-4xl font-extrabold tracking-tight`
  - Section Headings: `text-lg font-bold text-slate-100`
  - Card Titles & Table Headers: `text-xs font-semibold uppercase tracking-wider text-slate-400`
  - Standard Labels & Content: `text-sm font-medium text-slate-100`
  - Metadata & Secondary Notes: `text-xs text-slate-400` or `text-[11px] text-slate-500`

---

## 3. Layout Architecture & Dashboard Bento Grid

- **Mobile Viewport (<768px):** Single vertical stack with `px-4 py-6`, zero horizontal scrollbars, responsive flex wrapping on toolbars.
- **Desktop Viewport (>=768px and >=1024px):** 12-column Bento grid with structured vertical rhythm (`gap-6` or `gap-8`).
- **Layout Stacking:**
  1. **Top Bar:** Brand logo with pulsing green telemetry dot, live Telegram sync status chip, user profile badge, and global Settings modal trigger.
  2. **Hero Row:** `OmniInputHero` (natural language text prompt, camera receipt upload, voice microphone recorder) accompanied by H-7 upcoming commitments banner.
  3. **Telemetry & Visual Analytics Row:** Runway runway metric card (left) + spending charts with Daily vs Monthly segmented toggle (right).
  4. **Vaults & Sinking Funds Section:** Dedicated 3-column bento card grid for locked commitments and goal savings.
  5. **Transactions Ledger Table:** Interactive ledger with multi-filter toolbar, debit/credit badges, manual CRUD fallback trigger, and server-side pagination.

---

## 4. Component Design Specifications

### 4.1. Vaults & Sinking Funds Section (`VaultsSection.tsx`, `VaultCard.tsx`, `VaultModal.tsx`)

- **Bento Grid Layout:**
  - Responsive layout: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`.
  - Filter tabs bar (`Semua`, `Tagihan Tetap`, `Tabungan`) with counter pills (`px-1.5 py-0.2 rounded-full bg-slate-950 font-mono text-[10px]`).
- **Card Anatomy (`VaultCard.tsx`):**
  - **Badge Tokens:**
    - `FIXED_BILL`: `bg-amber-500/10 border-amber-500/30 text-amber-300` with `Receipt` icon.
    - `SAVINGS`: `bg-emerald-500/10 border-emerald-500/30 text-emerald-300` with `PiggyBank` icon.
    - `LOCKED`: `bg-indigo-500/10 border-indigo-500/30 text-indigo-300` with `Lock` icon indicator.
  - **Progress Visualizer:**
    - Track: `h-2 w-full bg-slate-950 border border-slate-800/80 rounded-full overflow-hidden`.
    - Fill: Framer Motion animated progress bar:
      ```tsx
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
        className={`h-full rounded-full ${
          isComplete ? 'bg-emerald-400' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
        }`}
      />
      ```
    - Percentage telemetry displayed alongside target date formatted with Indonesian locale.
  - **Padlock Lock & Immutability Indicator:**
    - Lock Toggle: `min-h-[38px] min-w-[38px]` button triggering optimistic/immediate backend lock mutation.
    - Locked state prevents deletion (`disabled={vault.is_locked}`) to protect allocated funds from accidental deletion.
- **4 Explicit UI States (`VaultsSection.tsx`):**
  1. **Loading State:** Skeletons rendering 3 pulsing cards (`data-testid="vaults-loading-skeleton"`, `animate-pulse`, mock progress track and badges).
  2. **Empty State:** Illustrated empty card with `PiggyBank` icon, supportive headline *"Belum ada komitmen atau vault aktif"*, and prominent `+ Buat Vault Pertama` primary CTA button.
  3. **Error State:** Dismissible error alert (`bg-rose-500/10 border-rose-500/30 text-rose-400`) informing user of network or validation failures.
  4. **Success State:** Instant reactive render of newly created or edited vaults with animated progress bar fill.
- **Polymorphic Vault Modal (`VaultModal.tsx`):**
  - Unified create and edit handling via `mode?: 'create' | 'edit'` or `initialVault?: Vault | null`.
  - Controlled inputs for vault name, target amount, allocated balance, and target date.
  - Accessible dialog wiring via `aria-labelledby="vault-modal-title"`.

---

### 4.2. Categories Management System (`CategoryManagerModal.tsx`)

- **Tab Segmentation:**
  - EXPENSE (`PENGELUARAN`) vs INCOME (`PEMASUKAN`) segmentation pill tabs.
  - Category list filtered reactively by active tab.
- **Curated 10-Color Swatch Palette:**
  - Standardized hex tokens providing optimal dark slate readability:
    1. **Slate:** `#64748b`
    2. **Red:** `#ef4444`
    3. **Amber:** `#f59e0b`
    4. **Emerald:** `#10b981`
    5. **Cyan:** `#06b6d4`
    6. **Blue:** `#3b82f6`
    7. **Indigo:** `#6366f1`
    8. **Purple:** `#8b5cf6`
    9. **Pink:** `#ec4899`
    10. **Rose:** `#f43f5e`
  - Interactive selection state: `ring-2 ring-white scale-110 shadow-lg` with centered checkmark indicator.
- **12 Curated Lucide Icon Mappings:**
  - Curated set for universal household financial classification:
    - `tag` → `Tag` (Umum)
    - `shopping-bag` → `ShoppingBag` (Belanja)
    - `utensils` → `Utensils` (Kuliner)
    - `car` → `Car` (Kendaraan)
    - `home` → `Home` (Rumah)
    - `zap` → `Zap` (Tagihan)
    - `heart` → `Heart` (Kesehatan)
    - `film` → `Film` (Hiburan)
    - `smartphone` → `Smartphone` (Komunikasi)
    - `coffee` → `Coffee` (Kopi)
    - `briefcase` → `Briefcase` (Pekerjaan)
    - `gift` → `Gift` (Hadiah)
- **Inline Deletion Confirmation Pattern:**
  - Selecting delete on a category replaces the row action buttons with inline *"Hapus kategori ini?"* prompt containing explicit `Batal` and `Ya, Hapus` controls, eliminating jarring nested dialogs.

---

### 4.3. Voice Omni-Input & Multi-Modal Audio Waveform (`OmniInputHero.tsx`)

- **MediaRecorder Lifecycle & Audio MIME Types:**
  - Supports standard cross-browser streaming codecs evaluated at runtime:
    `audio/webm` → `audio/ogg` → `audio/mp4`.
  - Native `navigator.mediaDevices.getUserMedia({ audio: true })` lifecycle with stream cleanup on component unmount.
- **Framer Motion Equalizer Audio Frequency Bars & Waveform:**
  - Multi-bar animated frequency equalizer during active recording:
    ```tsx
    <div className="flex items-center gap-1 h-5 px-1" aria-label="Equalizer frekuensi suara">
      {[0.35, 0.75, 0.45, 1.0, 0.6, 0.85, 0.4].map((heightScale, idx) => (
        <motion.span
          key={idx}
          animate={{ scaleY: [heightScale, 1.0, 0.2, heightScale] }}
          transition={{
            repeat: Infinity,
            repeatType: 'reverse',
            duration: 0.5 + (idx % 4) * 0.15,
            ease: 'easeInOut',
            delay: idx * 0.06,
          }}
          className="w-1 h-4 bg-rose-500 rounded-full origin-center"
        />
      ))}
    </div>
    ```
  - Pulsing outer beacon ring (`scale: [1, 1.25, 1]`, `opacity: [0.5, 1, 0.5]`) on recording status indicator.
- **Drag-and-Drop Receipt Dropzone Visual Glow:**
  - Drag-over visual overlay: `bg-slate-950/90 backdrop-blur-md border-2 border-dashed border-indigo-400 rounded-3xl`.
  - Animated glowing icon container with multi-step box-shadow pulse:
    ```tsx
    animate={{
      boxShadow: [
        '0 0 15px rgba(99, 102, 241, 0.4)',
        '0 0 35px rgba(99, 102, 241, 0.8)',
        '0 0 15px rgba(99, 102, 241, 0.4)',
      ],
      y: [-3, 3, -3],
    }}
    ```
  - Image preview chip with thumbnail and dismiss button before submission.
- **Recording Telemetry & Quick Triggers:**
  - Real-time timer counter: Monospace duration formatted as `00:04` (`formatDuration`).
  - Stop & Submit Trigger: Square stop icon button (`min-w-[40px] min-h-[40px] bg-rose-600 hover:bg-rose-500 text-white`).
  - Cancel Trigger: X icon button (`min-w-[40px] min-h-[40px] bg-slate-800/80 hover:bg-slate-700 text-slate-300`) discarding chunks immediately without ledger mutation.
  - Keyboard navigation: `Esc` cancels active recording or attached receipt; `Ctrl+Enter` triggers immediate submission.
  - Accessible region announcement: `role="region" aria-label="Perekaman suara aktif"`.

---

### 4.4. Zero-Layout-Shift Skeleton Loaders (`ExpenseCharts.tsx`, `RunwayMetricCard.tsx`, `UpcomingBillsCard.tsx`)

- **Eliminating Cumulative Layout Shift (CLS):**
  - All loading skeletons enforce identical min-height and structural boundaries to prevent jumping layout when async data resolves.
- **Component Skeleton Specifications:**
  - **Expense Charts (`ExpenseCharts.tsx`):**
    - Sizing: `h-44 flex flex-col justify-between animate-pulse` (`data-testid="expense-charts-skeleton"`).
    - 7-bar chart skeleton matching standard weekly telemetry layout:
      ```tsx
      <div className="h-32 flex items-end justify-between gap-2 sm:gap-3">
        {[45, 65, 25, 90, 50, 20, 75].map((heightPct, idx) => (
          <div key={idx} className="flex-1 bg-slate-800/60 rounded-t-lg h-full flex items-end overflow-hidden">
            <div className="w-full bg-slate-700/60 rounded-t-md" style={{ height: `${heightPct}%` }} />
          </div>
        ))}
      </div>
      ```
  - **Runway Metric Card (`RunwayMetricCard.tsx`):**
    - Fixed layout: `min-h-[260px] animate-pulse` (`data-testid="runway-skeleton"`).
    - Preserves telemetry header badge, giant `h-10 sm:h-12 w-64` currency runway bar, and 2-column footer metric slots.
  - **Upcoming Bills Card (`UpcomingBillsCard.tsx`):**
    - Alert container: `bg-amber-950/20 border border-amber-500/20 rounded-2xl p-5 mb-6 animate-pulse` (`data-testid="upcoming-bills-skeleton"`).
    - Dual-column card skeleton preserving exact height of urgent bill alert blocks.

---

### 4.5. Transactions Ledger Table (`TransactionsTable.tsx`)

- **Multi-Filter Toolbar (`p-4 sm:p-5 border-b border-slate-800`):**
  - **Keyword Search:** Debounced input with leading search icon and instant clear button (`X`).
  - **Account Filter Dropdown:** Tenant-scoped select menu (`min-h-[38px]`, `bg-slate-950/60 border-slate-800`).
  - **Category Filter Dropdown:** Select menu populated with active expense and income categories.
  - **Quick Date Filter Pills:** Segmented pill buttons for `Semua`, `Hari Ini`, `7 Hari Terakhir`, and `Bulan Ini`.
- **Sticky Backdrop-Blur Table Header:**
  - Fixed scroll alignment: `<thead className="sticky top-0 z-10 backdrop-blur-md bg-slate-950/85 text-xs font-semibold text-slate-400 border-b border-slate-800">`.
  - Ensures continuous column context while scrolling through high-volume ledger records.
- **AnimatePresence Row Transitions:**
  - Smooth item insertion, deletion, and filter updates without jarring DOM reflow:
    ```tsx
    <AnimatePresence initial={false}>
      {displayTransactions.map((tx) => (
        <motion.tr
          key={tx.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className="hover:bg-slate-800/30 transition-colors"
        >
          {/* Row cells */}
        </motion.tr>
      ))}
    </AnimatePresence>
    ```
- **Mobile Responsive Card-View Mode (<640px):**
  - Auto-switches from desktop HTML table to touch-friendly card rows on mobile viewports while preserving complete transaction metadata, category chips, and action buttons.
- **Server-Side Pagination Controls:**
  - Bottom navigation bar with metadata badge (`Halaman X dari Y (N mutasi)`).
  - Explicit Previous (`Sebelumnya`) and Next (`Berikutnya`) buttons (`min-h-[38px] px-3.5 rounded-xl border border-slate-700/60`).
  - Automatic disabled state handling (`disabled={currentPage <= 1 || isLoading}`).
- **Transaction Item Telemetry:**
  - Directional Icons: `ArrowDownLeft` in `text-emerald-400 bg-emerald-500/10` for income; `ArrowUpRight` in `text-indigo-400 bg-slate-800` for expenses.
  - Source Channel Chip: HeroUI chip tags distinguishing `Telegram`, `AI Omni-Input`, and `Manual` records.

---

### 4.6. Unified Polymorphic Modal Architecture (`VaultModal.tsx`, `TransactionModal.tsx`)

- **Architectural Deduplication Pattern:**
  - Replaces separate "Create" and "Edit" modal pairs with single polymorphic components accepting an optional target entity (`initialVault`, `initialTransaction`) and explicit `mode?: 'create' | 'edit'`.
  - Consolidates form validation, error banners, accessible ARIA roles, and state resets into a single source of truth.
- **Polymorphic Vault Modal (`VaultModal.tsx`):**
  - Create mode initializes blank name, target, and category selection.
  - Edit mode populates existing vault balances, locks, and target dates; enforces locked commitment immutability.
- **Polymorphic Transaction Modal (`ManualTransactionModal.tsx` / `TransactionModal.tsx`):**
  - Create mode handles multi-type transaction recording (`EXPENSE`, `INCOME`, `TRANSFER`).
  - Edit mode loads existing transaction amounts, accounts, dates, and category tags with clean reversal semantics on mutation.
  - Supported via `EditTransactionModal.tsx` wrapper for backwards-compatible modular imports.

---

### 4.7. Account Lifecycle & Immutability (`AccountModal.tsx`)

- **Dual-Mode Architecture:**
  - Create Mode: Captures account name, account type (`BANK`, `EWALLET`, `CASH`), and non-negative initial balance.
  - Edit Mode: Allows updating account name and type; balance field is strictly read-only with explanatory caption *"Saldo dikelola otomatis secara immutable melalui mutasi transaksi."*
- **Soft-Deactivation Pattern (`is_active = False`):**
  - Deactivating an account preserves all past double-entry transactions and ledger journal entries.
  - In-modal two-step confirmation prevents accidental deactivations while explaining that transaction history remains fully intact.

---

## 5. WCAG AA Accessibility & Mobile Design Tokens

### Interactive Hit Targets
- **Minimum Target Rule:** All touchable interactive elements (buttons, inputs, select triggers, icons) must measure at least **38x38px** (standard mobile touch target) with primary action targets at **44x44px** or `min-h-[40px]`.
- **Focus Rings:** Visible keyboard focus indicators using `focus:outline-none focus:ring-2 focus:ring-indigo-500/80` or `focus:border-emerald-500`.
- **ARIA Standards:**
  - Every icon-only button must include an explicit `aria-label` and `title` attribute.
  - Modals feature robust `aria-labelledby` linkages matching header IDs.
  - Progress tracks include `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, and `aria-valuemax`.

### Contrast Ratios
- **Text on Slate Surface:** All primary and secondary copy guarantees a contrast ratio exceeding **4.5:1** against `#020617` root and `#0f172a` card backgrounds:
  - `text-slate-100` (`#f1f5f9` on `#0f172a`): 13.8:1 (Passes AAA).
  - `text-slate-300` (`#cbd5e1` on `#0f172a`): 10.4:1 (Passes AAA).
  - `text-slate-400` (`#94a3b8` on `#0f172a`): 5.8:1 (Passes AA).
  - Telemetry badges: High-contrast pairs (e.g., `text-emerald-300` on `bg-emerald-500/10`).

### Mobile Responsiveness & Viewport Invariants
- **360px Minimum Viewport Target:**
  - Strictly **zero horizontal overflow** (`overflow-x-hidden` on main shells, `overflow-x-auto` on scrollable data tables).
  - Multi-element action bars wrap dynamically (`flex-col sm:flex-row`, `flex-wrap`).
  - Table cells collapse gracefully with concise date formatting and truncated descriptions.
- **Motion Restraint:**
  - Animated transitions capped at `<= 250ms` (easeOut/easeInOut) to preserve snappy, native-like terminal speed.

---

## 6. Domain State Management & Component Standardizations

### Domain Custom Hooks Architecture (`frontend/src/hooks/`)
- **Zero External Dependencies**: Pure React 18 hooks encapsulating state and async lifecycle without introducing state management bloat.
- **`useDashboardData`**: Manages parallel retrieval of `summary`, `accounts`, `vaults`, and `categories` with unified `refreshAll()` and optimistic vault lock/delete mutations.
- **`useTransactionsLedger`**: Manages server-side pagination, 300ms debounced search, and date filters (`TODAY`, `7DAYS`, `THIS_MONTH`) with client-side fallback.
- **`useDashboardModals`**: Centralizes modal visibility and target entity tracking across all 8 modal dialogues, eliminating local boolean state fragmentation.

### HeroUI Component & Event Standards
- **Buttons (`Button`)**: All interactive buttons utilize `@heroui/react` `<Button>` with `onPress` handlers, strictly avoiding deprecated `onClick` triggers.
- **Badges (`Chip`)**: Status tags across `VaultCard`, `UpcomingBillsCard`, and `TransactionsTable` enforce HeroUI `<Chip size="sm" variant="flat">` with contextual semantic color tokens (`success`, `warning`, `danger`, `secondary`).
- **Cards (`Card`, `CardBody`)**: Metric containers leverage HeroUI Card foundations with slate-900 backdrops and slate-800 borders.
- **Micro-Motion Transitions**: `framer-motion` `AnimatePresence` and `motion.div` layout transitions are unified across vault tab filtering and table row additions/deletions with a strict `<= 250ms` motion restraint ceiling.

---

## 7. Modern Zinc Studio Design Tokens & Navigation Architecture

### Surface & Border Tokens
- **Background Root:** `#0c0c0e` (warm obsidian / charcoal) establishing neutral dark baseline.
- **Card Surface:** `#141417` (`bg-[#141417]`) paired with subtle `border-zinc-800/80` or `border-white/[0.08]`.
- **Accent & Focus States:** Subdued monochromatic highlights with `focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600`.
- **Monochromatic Text Hierarchy:**
  - Primary text: `text-white`
  - Secondary text: `text-zinc-400`
  - Caption / tertiary: `text-zinc-500`

### Navigation Shell Tokens
- **Desktop Sidebar (`DesktopSidebar.tsx`):**
  - Expanded width: `240px` (`w-60`), collapsible to `64px` (`w-16`) icon rail.
  - Sticky vertical orientation with border-r `border-zinc-800/80`.
  - Brand identity, active navigation buttons with subtle hover pills, accounts quick list with balance indicators, and account settings / user actions.
- **Mobile Fixed Bottom Dock (`MobileBottomDock.tsx`):**
  - Fixed dock height: `64px` (`h-16`) anchored at bottom of mobile viewports (`fixed bottom-0 left-0 right-0 z-40`).
  - Frosted glass backdrop blur: `backdrop-blur-xl bg-[#0c0c0e]/90 border-t border-zinc-800/80`.
  - Minimum touch target: `>= 44px` with clear active status pills and accessible ARIA navigation labels.
  - Dedicated View Routing: Effortless 1-tap switching between Overview Cockpit (`overview`), Full Ledger (`ledger`), and Commitments & Vaults (`vaults`).

### Precision Command Bar Tokens (`QuickCaptureBar.tsx`)
- **Dimensions & Visual Presence:**
  - Centered 44px high pill strip (`h-11`) positioned prominently at the top of the interface.
  - Backdrop blur with subtle border: `bg-[#141417]/85 backdrop-blur-md border border-zinc-800/80`.
  - Focus ring: `focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-600`.
- **5-Bar Live Audio Visualizer:**
  - Real-time frequency bars animating during voice recording session (`scaleY` staggered loops).
  - Monospace duration timer (`00:04`) and quick commit / cancel controls.
- **Subtle Drag-and-Drop Receipt Dropzone:**
  - Embedded camera/attachment trigger supporting image receipts with dropzone hover states.
  - Dismissible preview chip before submission.
- **Auto-Dismissing Floating Toast Notification:**
  - Floating pill alert informing user of AI parsing response or validation errors.
  - Auto-dismissing after 5000ms with manual close trigger.

