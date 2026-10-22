# Specification: In-Cockpit Pre-Purchase Simulation ("What-If" Hero Drawer)

**Date**: 2026-10-22  
**Status**: Approved (Incorporating Builder-Check Architecture Resolutions)  
**Target View**: `frontend/src/components/OverviewView.tsx`  
**API & Architecture Surface**: Pure Client-Side Deterministic Computation (`OverviewView.tsx`) + Dedicated `POST /api/v1/dashboard/simulate-purchase` (Reserved for `SimulatePurchaseModal`) + `DashboardSummaryResponse` Schema Enhancement

---

## 1. Problem Statement & User Intent

Users face impulsive or uncertain spending dilemmas in daily life (e.g., *"Boleh nggak ya aku beli sepatu seharga Rp 350.000 sekarang?"*). In the current flow:
1. Simulating purchase impact requires opening an external modal dialog (`SimulatePurchaseModal`), navigating away from context, and mentally re-mapping the modal numbers back to the hero dashboard.
2. The user experience lacks an immediate visual contrast showing before-and-after scenarios side-by-side in real time.
3. Once simulated, there is no direct bridge to capture the transaction if the user decides to proceed with the purchase.

During visual companion brainstorming (`session: 236-1792638015`), **Option C (Expandable Hero Panel: Side-by-Side Comparison)** was approved. This feature integrates a smooth, expandable "What-If" simulation drawer directly inside the Hero Runway Card of `OverviewView.tsx`. It provides instant real-time financial feedback, telemetry health status, quick nominal chips, and a 1-click bridge to `QuickCaptureBar`.

---

## 2. Goals, Non-Goals, and Anti-Goals

### 2.1 Goals
- **In-Cockpit Continuity**: Allow users to test purchase nominals directly inside the primary Hero Runway Card without opening a modal or losing screen context.
- **Pure Client-Side Reactivity (Zero Latency UX)**: Deliver 100% deterministic recalculation synchronously on the client during keystrokes or chip taps, completely eliminating network latency, spinner delays, or abort controllers.
- **Side-by-Side Mental Model**: Present a clear visual contrast between **"Realita Saat Ini"** and **"Jika Jadi Beli"**, highlighting both the daily runway drop and total liquid impact.
- **Fast Input Ergonomics**: Provide quick nominal increment chips (`+50rb`, `+100rb`, `+250rb`, `+500rb`) and a 1-tap reset action.
- **Seamless QuickCapture Bridge**: Provide a 1-click button ("Lanjut Catat Pengeluaran") that automatically closes the drawer, focuses `QuickCaptureBar`, and populates the command input via a clean component props contract (`draftText` and `onDraftConsumed`).
- **Dynamic Safe Runway Threshold Alignment**: Project health statuses (Emerald / Amber / Rose) dynamically using the user's custom `safe_runway_threshold` provided by `DashboardSummaryResponse` (falling back to Rp 30.000 if unset).
- **Accessibility & Mobile Resilience**: Full compliance with WCAG AA standards (>=4.5:1 contrast, >=38px touch targets, full keyboard accessibility, and zero horizontal overflow on mobile screens down to 360px).

### 2.2 Non-Goals
- Calling backend `/simulate-purchase` from the in-cockpit drawer (the drawer runs 100% on the client).
- Modifying or deprecating the standalone `SimulatePurchaseModal` component (it remains dedicated to `POST /api/v1/dashboard/simulate-purchase` for external modal workflows, multi-turn scenarios, and server-generated AI advice).
- Multi-cycle forecasting (the simulation evaluates solely within the active monthly runway cycle).
- Automated ledger entry creation without explicit user confirmation in `QuickCaptureBar`.

### 2.3 Anti-Goals
- **Zero Ledger State Mutation**: The simulation MUST NOT write to the database, alter account balances, modify vault locks, or mutate double-entry journal entries.
- **Zero Cumulative Layout Shift (CLS)**: Drawer expansion must smoothly animate height using Framer Motion with ease-out curves (<=250ms), preventing jarring reflows.
- **Zero Network Delay / Spinners in Drawer**: The in-cockpit simulation must NEVER display loading spinners or wait for network roundtrips during nominal calculation.
- **No Floating-Point Imprecision**: Strict integer rupiah floor arithmetic (`Math.floor`) to preserve financial invariants.

---

## 3. Architecture & Component Design

### 3.1 Placement & Hero Card Hierarchy (`OverviewView.tsx`)
The simulation drawer lives within the Tier 1 Hero Runway Card in `OverviewView.tsx`, directly below the trigger bar, with a bidirectional action bridge to `QuickCaptureBar`:

```
+-------------------------------------------------------------------------+
| [OverviewView.tsx]                                                      |
|                                                                         |
| +---------------------------------------------------------------------+ |
| | [QuickCaptureBar] (draftText, onDraftConsumed)                       | |
| |   [ Input: "Beli Rp 150.000" ]  [📷] [🎙️] [Kirim ➔]                 | |
| +---------------------------------------------------------------------+ |
|                                                                         |
| +---------------------------------------------------------------------+ |
| | Tier 1 Hero Runway Card                                             | |
| | +-----------------------------------------------------------------+ | |
| | | Top Bar: Status Keuangan Hari Ini       [Chip: Aman Terkendali] | | |
| | | Core Number: Rp 133.333 / hari                                  | | |
| | | Sub-bar: Pengeluaran Hari Ini | Sisa Jatah | Progress Bar       | | |
| | | Mathematical Reconciliation: Total Kas - Terkunci = Bebas ÷ Sisa| | |
| | +-----------------------------------------------------------------+ | |
| | | Trigger Bar:                                                    | | |
| | |   [⚡ Cek Dampak Belanja] (Toggle Active / Inactive)             | | |
| | +-----------------------------------------------------------------+ | |
| | | (Expandable Framer Motion Drawer - AnimatePresence)             | | |
| | |   - Currency Input & Quick Chips (+50rb, +100rb, +250rb, +500rb)| | |
| | |   - Side-by-Side Comparison Grid:                               | | |
| | |       [Kolom Kiri: Realita Saat Ini] vs [Kolom Kanan: Jika Jadi]| | |
| | |   - Projected Health Telemetry (Emerald / Amber / Rose)         | | |
| | |   - Action Footer: [Reset] | [Lanjut Catat Pengeluaran ➔]       | | |
| | +-----------------------------------------------------------------+ | |
| +---------------------------------------------------------------------+ |
+-------------------------------------------------------------------------+
```

### 3.2 Trigger State & Visual Affordance
- **Button Label**: `⚡ Cek Dampak Belanja` (when closed) / `✕ Tutup Simulasi` (when open).
- **Styling**:
  - Closed: Subtle secondary action (`bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200/80 dark:border-zinc-700/80`).
  - Active: Accent highlight (`bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30`).
- **Accessibility**: Contains `aria-expanded={isSimulationOpen}` and `aria-controls="runway-simulation-panel"`.

### 3.3 Framer Motion Expandable Drawer
- Built using `AnimatePresence` and `motion.div`:
  - `initial={{ opacity: 0, height: 0 }}`
  - `animate={{ opacity: 1, height: 'auto' }}`
  - `exit={{ opacity: 0, height: 0 }}`
  - `transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}`
- Wrapped in `overflow-hidden` to avoid scrollbars during animation.

### 3.4 Nominal Input & Quick Increment Chips
- **Input Field**:
  - Currency-formatted numeric field with `Rp` prefix.
  - Placeholder: `Misal: 150.000`.
  - Automatically parses formatted input string to integer nominal.
- **Quick Preset Chips**:
  - `+50rb` (+50,000)
  - `+100rb` (+100,000)
  - `+250rb` (+250,000)
  - `+500rb` (+500,000)
  - Tapping a chip adds the specified amount cumulatively to current input.
- **Clear Action**: A small reset icon/button to clear nominal back to 0.

### 3.5 Side-by-Side Comparison Grid ("Realita Saat Ini" vs "Jika Jadi Beli")
Responsive CSS grid: `grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3`:
1. **Left Card ("Realita Saat Ini")**:
   - Status badge: `STATUS SAAT INI` (Emerald / Neutral).
   - Core number: Current daily safe runway (`formatRupiah(summary.daily_safe_runway)}/hari`).
   - Secondary lines:
     - Sisa Jatah Hari Ini: `formatRupiah(remainingBudget)`
     - Saldo Bebas Operasional: `formatRupiah(summary.operational_free_cash)`
2. **Right Card ("Jika Jadi Beli")**:
   - Status badge: `JIKA JADI BELI (Rp X)` with dynamic color badge.
   - Core number: Projected daily safe runway (`formatRupiah(projectedDailyRunway)}/hari`).
   - Delta indicator: `Turun: -formatRupiah(dailyDropAmount)}/hari`.
   - Secondary lines:
     - Sisa Saldo Bebas: `formatRupiah(projectedFreeCash)`
     - Health Status projection: `Aman` (Emerald), `Waspada` (Amber), `Bahaya Defisit` (Rose).

### 3.6 Color-Coded Telemetry Health Mapping (Dynamic Safe Runway Threshold)
The status projection dynamically adheres to the user-configured safe runway threshold $T_{\text{safe}}$ obtained from `summary.safe_runway_threshold` (falling back to Rp 30.000 if unset):

- **Emerald (`HEALTHY`)**:
  - Condition: `projectedDailyRunway >= safeRunwayThreshold` and `!isDeficit`.
  - Copy: *"Belanja aman. Jatah harian Anda masih di atas batas aman operasional (" + formatRupiah(safeRunwayThreshold) + "/hari)."*
- **Amber (`WARNING`)**:
  - Condition: `0 < projectedDailyRunway < safeRunwayThreshold` and `!isDeficit`.
  - Copy: *"Waspada: Jatah belanja harian turun di bawah batas aman (" + formatRupiah(safeRunwayThreshold) + "/hari)."*
- **Rose (`CRITICAL`)**:
  - Condition: `plannedAmount > operationalFreeCash` OR `projectedDailyRunway <= 0`.
  - Copy: *"Peringatan Defisit: Nominal melebihi saldo bebas pakai saat ini!"*

### 3.7 `QuickCaptureBar` Bridge Contract
To allow users to immediately record a purchase after confirming its feasibility in the simulation drawer, `QuickCaptureBar` exposes a clean props bridge contract:

```typescript
export interface QuickCaptureBarProps {
  onSubmit: (input: string | { text: string; file: File | null }, file?: File | null) => Promise<void> | void;
  onVoiceSubmit: (blob: Blob, caption?: string) => Promise<void> | void;
  isLoading?: boolean;
  toastMessage?: { text: string; isError?: boolean } | null;
  onDismissToast?: () => void;
  draftText?: string;
  onDraftConsumed?: () => void;
}
```

#### Lifecycle & Behavior:
1. **User Action**: The user evaluates a planned nominal (e.g., Rp 150.000) and clicks `Lanjut Catat Pengeluaran ➔`.
2. **Parent State Update (`OverviewView.tsx`)**:
   - `OverviewView` maintains state `quickCaptureDraft: string | undefined`.
   - On click, it sets:
     ```typescript
     setQuickCaptureDraft(`Beli Rp ${formatRupiah(plannedAmount, { showPrefix: false })}`);
     setIsSimulationOpen(false);
     ```
3. **Draft Consumption inside `QuickCaptureBar`**:
   - Inside `QuickCaptureBar`, a `useEffect` observes changes to `draftText`:
     ```typescript
     useEffect(() => {
       if (draftText) {
         setText(draftText);
         inputRef.current?.focus();
         onDraftConsumed?.();
       }
     }, [draftText, onDraftConsumed]);
     ```
   - It populates the command input, focuses the text field, and notifies the parent to reset `quickCaptureDraft` to `undefined` (avoiding state duplication on subsequent renders).
4. **Ergonomics**: Smoothly scrolls the viewport to `QuickCaptureBar` if outside view, enabling the user to immediately press `Enter` or add receipt media.

---

## 4. Mathematical Formulas & Precision Invariants

### 4.1 Client-Side Deterministic Computation
All calculations run synchronously inside `useMemo` on input state changes to guarantee zero network latency:

Let:
- $O = \text{summary.operational\_free\_cash}$ (Current operational free cash)
- $D = \max(1, \text{summary.days\_remaining})$ (Days remaining in current monthly cycle)
- $R = \text{summary.daily\_safe\_runway}$ (Current daily safe runway)
- $P = \text{planned\_amount}$ (Planned expense simulated by user)
- $T_{\text{safe}} = \text{summary.safe\_runway\_threshold} \mathbin{??} 30000$ (Dynamic user threshold, fallback Rp 30.000)

Calculated values:
$$O_{\text{projected}} = \max(0, O - P)$$
$$R_{\text{projected}} = \lfloor \frac{O_{\text{projected}}}{D} \rfloor$$
$$\Delta R = R - R_{\text{projected}}$$

Deficit check:
$$\text{isDeficit} = P > O$$

Status determination:
$$\text{projectedStatus} = \begin{cases} \text{CRITICAL}, & \text{if } \text{isDeficit} \text{ or } R_{\text{projected}} \le 0 \\ \text{WARNING}, & \text{if } R_{\text{projected}} < T_{\text{safe}} \\ \text{HEALTHY}, & \text{otherwise} \end{cases}$$

### 4.2 Endpoint Separation & Pure Client-Side Execution
- **In-Cockpit Drawer (`OverviewView.tsx`)**:
  - Runs **100% on the client** using deterministic arithmetic.
  - Zero network latency, zero HTTP requests, zero loading spinners, and zero abort controllers.
- **Backend `POST /api/v1/dashboard/simulate-purchase`**:
  - Remains **strictly dedicated** to the standalone `SimulatePurchaseModal` component (accessed via *"Simulasi Belanja"* in the Komitmen & Vaults Prioritas card).
  - Used for deep scenario evaluation, server-side simulation reports, and conversational AI commentary.

### 4.3 Safe Runway Threshold Schema Alignment
The `safe_runway_threshold` is formally surfaced in `DashboardSummaryResponse` so the frontend dynamically aligns with user settings:

#### Backend Schema (`rezekify/api/v1/dashboard_router.py` & `rezekify/services/runway.py`):
```python
class DashboardSummaryResponse(BaseModel):
    total_liquid_cash: Decimal
    vault_locked_cash: Decimal
    operational_free_cash: Decimal
    days_remaining: int
    daily_safe_runway: Decimal
    health_status: str
    upcoming_bills: List[UpcomingBillResponse]
    today_spent: Decimal = Decimal("0.00")
    safe_runway_threshold: Decimal = Decimal("30000.00")
```

Endpoint handler mapping (`get_dashboard_summary`):
```python
safe_runway_threshold=(
    current_user.safe_runway_threshold
    if getattr(current_user, "safe_runway_threshold", None) is not None
    else Decimal("30000.00")
),
```

#### Frontend Type Definition (`frontend/src/types/api.ts`):
```typescript
export interface DashboardSummaryResponse {
  total_liquid_cash: number;
  vault_locked_cash: number;
  operational_free_cash: number;
  days_remaining: number;
  daily_safe_runway: number;
  today_spent?: number;
  safe_runway_threshold?: number;
  health_status: HealthStatus;
  upcoming_bills: UpcomingBill[];
}
```

### 4.4 Zero Ledger State Mutation Guarantee
- The simulation operates strictly in local React component state (`useState` / `useMemo`).
- No mutation endpoints (`/transactions/`, `/vaults/deposit`, etc.) are triggered.
- Mutations ONLY occur when the user submits a transaction via `QuickCaptureBar`.

---

## 5. Accessibility & Mobile Responsiveness

1. **Touch Targets**:
   - Quick preset chips and toggle buttons enforce a minimum size of $38\text{px} \times 38\text{px}$ (`min-h-[38px] min-w-[38px]`).
2. **WCAG AA Color Contrast**:
   - Text elements maintain $\ge 4.5:1$ contrast against dark (`#141417`, `#18181b`) and light background surfaces.
   - Emerald: `text-emerald-600 dark:text-emerald-400`
   - Amber: `text-amber-700 dark:text-amber-400`
   - Rose: `text-rose-600 dark:text-rose-400`
3. **Screen Readers & ARIA**:
   - `aria-expanded={isSimulationOpen}` and `aria-controls="runway-simulation-panel"` on the toggle button.
   - `aria-live="polite"` applied to projected calculation metrics container.
   - Preset chips labeled with descriptive `aria-label` (e.g., `Tambah lima puluh ribu rupiah`).
4. **Mobile Layout (<640px)**:
   - Comparison cards stack vertically (`grid-cols-1 sm:grid-cols-2`).
   - Quick chips wrap cleanly (`flex-wrap gap-2`).
   - Action buttons provide sticky ergonomics on narrow viewports without horizontal scrolling.

---

## 6. Testing & Verification Strategy

### 6.1 Unit & Integration Tests (`OverviewView.test.tsx` & `QuickCaptureBar.test.tsx`)
1. **Toggle Interaction**:
   - Verifies clicking `⚡ Cek Dampak Belanja` expands the simulation panel.
   - Verifies clicking again or pressing Close collapses the panel.
2. **Pure Client-Side Reactivity (Zero Network Requests)**:
   - Verifies nominal updates recalculate values synchronously without triggering any fetch or API call to `/simulate-purchase`.
3. **Numeric Calculations & Chips**:
   - Simulates typing `150000` into input $\to$ verifies projected daily runway matches formula: $\lfloor (O - P) / D \rfloor$.
   - Simulates clicking `+50rb` chip $\to$ input increments from `150000` to `200000` and updates delta.
4. **Dynamic Safe Runway Threshold Alignment**:
   - With `safe_runway_threshold: 50000` from `DashboardSummaryResponse`, verifies status transitions to Amber (`WARNING`) when projected runway falls below 50,000 (rather than hardcoded 30,000).
   - Verifies fallback to Rp 30.000 when `safe_runway_threshold` is undefined.
   - Verifies amount exceeding operational free cash triggers Rose (`CRITICAL`) deficit status.
5. **`QuickCaptureBar` Bridge Contract**:
   - Verifies clicking "Lanjut Catat Pengeluaran" populates `draftText` with `"Beli Rp " + formatRupiah(plannedAmount, { showPrefix: false })`.
   - Verifies `QuickCaptureBar` populates internal input, focuses text element, and invokes `onDraftConsumed`.
   - Verifies drawer collapses upon bridge trigger.
6. **Backend Schema & Serialization**:
   - Verifies `GET /api/v1/dashboard/summary` serializes `safe_runway_threshold` with default `Decimal("30000.00")` or user-configured setting.

### 6.2 Visual & Build Verification Gate
- `npm test -- --run` in `frontend/`: Single-pass execution, 0 test failures.
- `uv run --no-project pytest tests/test_runway.py`: 0 test failures.
- TypeScript compiler (`tsc --noEmit`) and Vite build clean with exit code 0.
- Impeccable verification gate: zero layout shifts, proper dark/light theme support.
