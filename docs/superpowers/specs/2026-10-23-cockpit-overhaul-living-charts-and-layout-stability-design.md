# Cockpit Overhaul: Supportive Friend Voice, Account Pill Strip, Living SVG Charts & Layout Stability Design Specification

- **Date**: 2026-10-23
- **Scope**: Frontend Cockpit (`OverviewView.tsx`, `Sidebar.tsx`, `ExpenseCharts.tsx`, `RecentTransactionsCard.tsx`, `UpcomingBillsCard.tsx`, `BenefitSection.tsx`, `WorkflowSection.tsx`)
- **Status**: Approved

## 1. Intent & Problem Statement
During visual auditing of the latest dashboard and landing page, three major craft and usability issues were identified:
1. **Unnatural & Cold Vocabulary**: Words like *Likuiditas Bersih*, *Buku Besar*, *Mutasi*, and *Dana Terkunci di Pos* sound like an intimidating accounting audit rather than an encouraging, smart financial friend.
2. **Rekening Kas Misplaced in Sidebar**: Bank accounts (BCA, GoPay, Tunai) crammed into the sidebar create awkward vertical scrolling, truncate numbers, and are hidden on mobile.
3. **Unconvincing & Jumpy Analytics Charts (`ExpenseCharts.tsx`)**:
   - The Daily chart has no Y-axis or price scale, rendering hollow gray pillars that don't feel like a real financial chart.
   - The Monthly chart is merely a vertical progress bar list, not a chart.
   - Toggling between Daily and Monthly causes violent height jumping, shifting the entire dashboard up and down.
4. **Motion Layout Instability (Size Glitching & CLS)**: Across tab switching in `BenefitSection`, `WorkflowSection`, and `ExpenseCharts`, variable text lengths cause the cards to expand and shrink abruptly during transitions, producing visual jitter.

## 2. Invariants & Craft Guardrails
- **Zero Raw Emojis**: 100% Lucide React SVG vector icons throughout the application.
- **Supportive Friend Voice**: Warm, clear, human Indonesian terminology that empowers users without financial anxiety.
- **Zero Layout Shift (CLS)**: All bento grid pairs and interactive tabs enforce locked min-heights and smooth crossfades with zero height jumping.
- **Living Vector Graphics**: Daily Curved SVG Area Chart with Y-axis gridlines and glowing gradient wave; Monthly SVG Donut Ring with category ribbons. Pure SVG + Framer Motion (zero extra npm dependencies).
- **Multi-Tenant Isolation & Deterministic Math**: 100% preserved.

## 3. Detailed Component Architecture

### 3.1 Sidebar Cleanup & Account Capsule Strip
- **`Sidebar.tsx`**:
  - Remove the entire `Rekening Kas` section and account list from the sidebar.
  - The desktop sidebar becomes 100% dedicated to clean navigation (`Ringkasan`, `Al Copilot`, `Riwayat Transaksi`, `Pos Keuangan`, `Pengaturan`).
- **`OverviewView.tsx` Account Capsule Strip (Reference 1: Wise/Revolut)**:
  - Mounted directly beneath the QuickCaptureBar:
    ```tsx
    <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar text-xs">
      {accounts.map(acc => (
        <div key={acc.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/90 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 shrink-0">
          <Icon className="w-3.5 h-3.5 text-emerald-500" />
          <span className="font-semibold">{acc.name}:</span>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">Rp {formatRupiah(acc.current_balance)}</span>
        </div>
      ))}
      <button onClick={onOpenCreateAccount} className="...">+ Tambah Akun</button>
    </div>
    ```

### 3.2 Supportive Friend Vocabulary Dictionary
- Card 1: `Kondisi: Aman Terkendali` | `Jatah Belanja Hari Ini` | *"Batas belanja harianmu biar tetap aman sampai siklus baru."* | `<Sparkles /> Simulasi Belanja`
- Card 2: `Siap Digunakan` | `Uang Bebas Pakai` | *"Sisa uang yang bebas kamu pakai jajan tanpa ganggu tagihan & tabungan."* | `<PlusCircle /> Catat Manual`
- Card 3: `Tabungan & Tagihan` | `Sudah Diamankan di Pos` | *"Disisihkan untuk bayar tagihan dan tabungan impianmu."* | `<Layers /> Bagi Uang ke Pos`

### 3.3 Living SVG Charts (`ExpenseCharts.tsx`)
- Container enforced at stable `min-h-[380px]`.
- **Daily View (Curved Area Wave)**:
  - SVG viewBox with 3 dashed horizontal Y-axis gridlines (`Rp 0`, `50% max`, `100% max`).
  - Smooth cubic bezier path (`d="M... C..."`) filled with an emerald gradient wave.
  - Dashed amber threshold line for `Batas Aman Rp X/hari`.
  - Interactive cursor tracking dot with floating tooltip showing day name, date, and exact Rupiah spend.
- **Monthly View (Segmented Donut Ring + Legend)**:
  - SVG Donut ring (`strokeDasharray`, `strokeDashoffset`) showing percentage share by category with smooth initial sweep animation.
  - Center label displaying total monthly spend (`Total: Rp X`).
  - Interactive legend list with category dots, percentage, and formatted Rupiah totals.

### 3.4 Motion & Layout Height Stabilization (Zero Glitch)
- **`BenefitSection.tsx`**: Add `min-h-[380px]` to the right-hand preview card container so switching benefits never changes card height.
- **`WorkflowSection.tsx`**: Add `min-h-[220px]` to the step detail container so switching steps 1..5 maintains identical card dimensions.
- **`OverviewView.tsx`**: Middle bento row (`ExpenseCharts` + `RecentTransactionsCard`) locked to identical height (`h-[380px] sm:h-[400px]`). Bottom bento row (`UpcomingBills` + `PriorityVaults`) locked to identical height (`h-[340px]`).

## 4. Verification & Testing
- Unit tests for Area Chart path calculation and Donut slice math.
- Component tests for Account Capsule Strip and Supportive Friend labels.
- Full Vitest suite pass, production build clean, Docker container update.
