# In-Cockpit Pre-Purchase Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an expandable "What-If" Pre-Purchase Simulation drawer directly inside the Tier 1 Hero Runway Card of `OverviewView.tsx` with pure client-side deterministic recalculation, dynamic safe runway threshold projection, quick nominal increment chips, and a 1-click bridge to `QuickCaptureBar`.

**Architecture:** Expose `safe_runway_threshold` in backend `DashboardSummaryResponse` and frontend TypeScript interfaces; introduce `draftText` and `onDraftConsumed` bridge props to `QuickCaptureBar`; and embed an accessible Framer Motion expandable drawer inside `OverviewView.tsx` Hero Runway Card that deterministically recalculates projected daily runway, drop delta, and financial health status (Emerald/Amber/Rose) synchronously on the client without network overhead.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Framer Motion, HeroUI, Lucide React, Vitest, Testing Library, FastAPI, SQLAlchemy 2.0, Pydantic v2, Python 3.12, Pytest.

**Spec:** `docs/superpowers/specs/2026-10-22-in-cockpit-pre-purchase-simulation-design.md`

## Global Constraints

- **Financial & Database Invariants:** Zero floating-point arithmetic for monetary calculations. All backend calculations enforce `decimal.Decimal`. Frontend calculations enforce strict integer floor arithmetic (`Math.floor`) with Rupiah formatting.
- **Client-Side Determinism & Zero Latency:** In-cockpit drawer executes 100% on the client synchronously inside React state (`useMemo`). Zero network requests, zero spinner delays, and zero abort controllers during typing or chip taps.
- **State Isolation & Invariance:** The in-cockpit simulation MUST NOT mutate database state, account balances, or ledger entries. Mutations only occur upon user submission via `QuickCaptureBar`.
- **Zero Cumulative Layout Shift (CLS):** Smooth height expansion using Framer Motion with ease-out curves (`duration: 0.22`, `ease: [0.16, 1, 0.3, 1]`) and `overflow-hidden`.
- **Mobile Ergonomics & WCAG AA Accessibility:** Minimum 38px touch targets (`min-h-[38px] min-w-[38px]`) for chips and toggle buttons. Color contrast >= 4.5:1 across light and Modern Zinc dark themes (`#141417`, `#18181b`). Full keyboard accessibility with `aria-expanded`, `aria-controls`, and `aria-live="polite"`.

## Review Focus

1. **Zero or Negative Days Remaining ($D \le 0$):** Handled by clamping $D = \max(1, \text{summary.days\_remaining})$, preventing division by zero (`NaN` / `Infinity`) at cycle boundaries (`test_simulation_zero_or_negative_days_remaining_guard` in Task 3).
2. **Planned Amount Exceeds Operational Free Cash ($P > O$):** Clamps projected free cash to 0 ($O_{\text{projected}} = \max(0, O - P)$), flags `isDeficit = true`, and sets `CRITICAL` health status (Rose telemetry and deficit warning copy) (`test_simulation_deficit_when_amount_exceeds_free_cash` in Task 3).
3. **Non-Numeric, Negative, or Formatted Input Strings:** Parsing cleanly strips non-digits (dots, commas, currency strings), treats negative numbers or invalid strings as 0 without NaN or crashes (`test_simulation_input_sanitization_and_formatting` in Task 3).
4. **Dynamic User Threshold Alignment:** Dynamic status projection relies on `summary.safe_runway_threshold` (e.g., Rp 50.000) rather than a hardcoded Rp 30.000, triggering Amber (`WARNING`) when projected runway falls below custom threshold (`test_simulation_dynamic_safe_runway_threshold_alignment` in Task 3).
5. **Quick Capture Prefill Draft Collision & Infinite Update Loops:** When `draftText` is received by `QuickCaptureBar`, it populates input, focuses the field, and immediately calls `onDraftConsumed()`, resetting the parent's draft state so typing or subsequent renders do not trigger unintended draft resets (`test_quick_capture_draft_consumption_and_reset` in Task 2 and `test_overview_bridge_to_quick_capture` in Task 3).

---

### Task 1: Backend & Frontend Schema: Expose `safe_runway_threshold` in `DashboardSummaryResponse`

**Files:**
- Modify: `rezekify/services/runway.py:45-54,196-235`
- Modify: `rezekify/api/v1/dashboard_router.py:59-68,131-158`
- Modify: `frontend/src/types/api.ts:106-116`
- Test: `tests/test_runway_service.py`
- Test: `tests/test_api_endpoints.py`

**Interfaces:**
- Consumes: `User.safe_runway_threshold: Decimal`
- Produces:
  - `RunwayReport.safe_runway_threshold: Decimal = Decimal("30000.00")`
  - `DashboardSummaryResponse.safe_runway_threshold: Decimal = Decimal("30000.00")` in FastAPI router
  - `DashboardSummaryResponse.safe_runway_threshold?: number;` in TypeScript `frontend/src/types/api.ts`

- [x] **Step 1: Write the failing tests in `tests/test_runway_service.py` and `tests/test_api_endpoints.py`**

In `tests/test_runway_service.py`:
```python
def test_runway_report_includes_safe_runway_threshold(db_session, sample_user):
    sample_user.safe_runway_threshold = Decimal("50000.00")
    db_session.commit()
    service = RunwayService(db_session)
    report = service.calculate_runway(user_id=sample_user.id, today=date(2026, 9, 18))
    assert report.safe_runway_threshold == Decimal("50000.00")
```

In `tests/test_api_endpoints.py`:
```python
def test_dashboard_summary_exposes_safe_runway_threshold():
    # Register and login
    auth_headers = _get_auth_headers("threshold_test@rezekify.id")
    res = client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "safe_runway_threshold" in data
    assert Decimal(str(data["safe_runway_threshold"])) == Decimal("30000.00")
```

- [x] **Step 2: Run tests to verify they fail**

Run: `uv run --no-project pytest tests/test_runway_service.py -k "safe_runway_threshold"`
Expected: FAIL with `AttributeError: 'RunwayReport' object has no attribute 'safe_runway_threshold'`

- [x] **Step 3: Implement `safe_runway_threshold` in `rezekify/services/runway.py`, `rezekify/api/v1/dashboard_router.py`, and `frontend/src/types/api.ts`**

In `rezekify/services/runway.py`:
```python
class RunwayReport(NamedTuple):
    total_liquid_cash: Decimal
    vault_locked_cash: Decimal
    operational_free_cash: Decimal
    days_remaining: int
    daily_safe_runway: Decimal
    health_status: str
    upcoming_bills: List[UpcomingBill]
    today_spent: Decimal = Decimal("0.00")
    safe_runway_threshold: Decimal = Decimal("30000.00")
```
Pass `safe_runway_threshold=threshold` to `RunwayReport(...)` in `calculate_runway`.

In `rezekify/api/v1/dashboard_router.py`:
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
And inside `get_dashboard_summary`:
```python
safe_runway_threshold=report.safe_runway_threshold,
```

In `frontend/src/types/api.ts`:
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

- [x] **Step 4: Run tests to verify they pass**

Run: `uv run --no-project pytest tests/test_runway_service.py tests/test_api_endpoints.py`
Expected: PASS with 100% passing tests

- [x] **Step 5: Commit changes**

```bash
git add rezekify/services/runway.py rezekify/api/v1/dashboard_router.py frontend/src/types/api.ts tests/test_runway_service.py tests/test_api_endpoints.py
git commit -m "feat(api): expose safe_runway_threshold in dashboard summary response"
```

---

### Task 2: `QuickCaptureBar` External Draft Bridge (`draftText?: string`, `onDraftConsumed?: () => void`)

**Files:**
- Modify: `frontend/src/components/QuickCaptureBar.tsx:16-35,314-323`
- Test: `frontend/src/__tests__/QuickCaptureBar.test.tsx`

**Interfaces:**
- Consumes:
  - `draftText?: string`
  - `onDraftConsumed?: () => void`
  in `QuickCaptureBarProps`
- Produces:
  - Internal `textInputRef = useRef<HTMLInputElement>(null)` bound to `<input type="text" ... />`
  - `useEffect` bridge populating `text`, invoking `textInputRef.current?.focus()`, and firing `onDraftConsumed?.()`

- [x] **Step 1: Write the failing tests in `frontend/src/__tests__/QuickCaptureBar.test.tsx`**

```tsx
it('populates text input, focuses input, and calls onDraftConsumed when draftText is provided', () => {
  const handleDraftConsumed = vi.fn();
  const { rerender } = render(
    <QuickCaptureBar
      onSubmit={vi.fn()}
      onVoiceSubmit={vi.fn()}
      draftText="Beli Rp 150.000"
      onDraftConsumed={handleDraftConsumed}
    />
  );

  const input = screen.getByPlaceholderText(/Ketik mutasi/i) as HTMLInputElement;
  expect(input.value).toBe('Beli Rp 150.000');
  expect(handleDraftConsumed).toHaveBeenCalledTimes(1);
  expect(document.activeElement).toBe(input);
});

it('does not overwrite text or call onDraftConsumed when draftText is undefined or empty (Review Focus 5)', () => {
  const handleDraftConsumed = vi.fn();
  render(
    <QuickCaptureBar
      onSubmit={vi.fn()}
      onVoiceSubmit={vi.fn()}
      draftText={undefined}
      onDraftConsumed={handleDraftConsumed}
    />
  );

  const input = screen.getByPlaceholderText(/Ketik mutasi/i) as HTMLInputElement;
  fireEvent.change(input, { target: { value: 'Manual typing text' } });
  expect(input.value).toBe('Manual typing text');
  expect(handleDraftConsumed).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd frontend; npm test -- --run src/__tests__/QuickCaptureBar.test.tsx -t "draftText"`
Expected: FAIL because `draftText` and `onDraftConsumed` are not handled on `QuickCaptureBarProps`.

- [x] **Step 3: Implement bridge in `frontend/src/components/QuickCaptureBar.tsx`**

Extend `QuickCaptureBarProps`:
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

In `QuickCaptureBar`:
1. Add `const textInputRef = useRef<HTMLInputElement>(null);`
2. Add `useEffect`:
```typescript
useEffect(() => {
  if (draftText) {
    setText(draftText);
    textInputRef.current?.focus();
    onDraftConsumed?.();
  }
}, [draftText, onDraftConsumed]);
```
3. Attach `ref={textInputRef}` to the `<input type="text" ... />` element at line 314.

- [x] **Step 4: Run tests to verify they pass**

Run: `cd frontend; npm test -- --run src/__tests__/QuickCaptureBar.test.tsx`
Expected: PASS with 100% passing tests

- [x] **Step 5: Commit changes**

```bash
git add frontend/src/components/QuickCaptureBar.tsx frontend/src/__tests__/QuickCaptureBar.test.tsx
git commit -m "feat(frontend): bridge external draftText into QuickCaptureBar"
```

---

### Task 3: Implement In-Cockpit Pre-Purchase Simulation Drawer in `OverviewView.tsx`

**Files:**
- Modify: `frontend/src/components/OverviewView.tsx:55-160,204-325`
- Test: `frontend/src/__tests__/OverviewView.test.tsx`

**Interfaces:**
- Consumes:
  - `DashboardSummaryResponse.safe_runway_threshold`
  - `DashboardSummaryResponse.operational_free_cash`
  - `DashboardSummaryResponse.days_remaining`
  - `DashboardSummaryResponse.daily_safe_runway`
  - `QuickCaptureBarProps.draftText` and `QuickCaptureBarProps.onDraftConsumed`
- Produces:
  - Expandable drawer inside Tier 1 Hero Runway Card with Framer Motion `AnimatePresence` and `motion.div`.
  - Trigger button `⚡ Cek Dampak Belanja` / `✕ Tutup Simulasi` with `aria-expanded` and `aria-controls="runway-simulation-panel"`.
  - Side-by-side comparison grid ("Realita Saat Ini" vs "Jika Jadi Beli").
  - Quick increment chips (`+50rb`, `+100rb`, `+250rb`, `+500rb`) with min 38px touch targets.
  - Bridge button "Lanjut Catat Pengeluaran ➔" passing formatted nominal to `QuickCaptureBar`.

- [x] **Step 1: Write the failing tests in `frontend/src/__tests__/OverviewView.test.tsx`**

```tsx
it('expands and collapses in-cockpit pre-purchase simulation drawer on trigger button click', () => {
  render(
    <OverviewView
      summary={mockSummary}
      vaults={mockVaults}
      accounts={mockAccounts}
      isLoading={false}
      refreshTrigger={0}
      onNavigateToVaults={vi.fn()}
      onOpenCreateAccount={vi.fn()}
      onOpenSimulateModal={vi.fn()}
    />
  );

  const toggleBtn = screen.getByRole('button', { name: /Cek Dampak Belanja/i });
  expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByTestId('runway-simulation-panel')).not.toBeInTheDocument();

  fireEvent.click(toggleBtn);
  expect(screen.getByRole('button', { name: /Tutup Simulasi/i })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByTestId('runway-simulation-panel')).toBeInTheDocument();

  // Collapse again
  fireEvent.click(screen.getByRole('button', { name: /Tutup Simulasi/i }));
  expect(screen.queryByTestId('runway-simulation-panel')).not.toBeInTheDocument();
});

it('calculates projected runway and delta deterministically on client without API calls', () => {
  render(
    <OverviewView
      summary={mockSummary} // operational_free_cash: 2,000,000, days_remaining: 15, daily_safe_runway: 133,333
      vaults={mockVaults}
      accounts={mockAccounts}
      isLoading={false}
      refreshTrigger={0}
      onNavigateToVaults={vi.fn()}
      onOpenCreateAccount={vi.fn()}
      onOpenSimulateModal={vi.fn()}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: /Cek Dampak Belanja/i }));
  const input = screen.getByPlaceholderText(/Misal: 150\.000/i);

  // Type planned amount: 500,000 -> projected free cash = 1,500,000 -> projected daily = 100,000 -> delta = 33,333
  fireEvent.change(input, { target: { value: '500000' } });

  expect(screen.getByTestId('projected-daily-runway')).toHaveTextContent('Rp 100.000');
  expect(screen.getByTestId('simulation-daily-drop')).toHaveTextContent('-Rp 33.333');
  expect(screen.getByTestId('projected-free-cash')).toHaveTextContent('Rp 1.500.000');
  expect(screen.getByText(/Belanja aman/i)).toBeInTheDocument();
});

it('increments planned nominal cumulatively when quick chips are clicked and resets nominal on reset button click', () => {
  render(
    <OverviewView
      summary={mockSummary}
      vaults={mockVaults}
      accounts={mockAccounts}
      isLoading={false}
      refreshTrigger={0}
      onNavigateToVaults={vi.fn()}
      onOpenCreateAccount={vi.fn()}
      onOpenSimulateModal={vi.fn()}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: /Cek Dampak Belanja/i }));
  const input = screen.getByPlaceholderText(/Misal: 150\.000/i) as HTMLInputElement;

  fireEvent.click(screen.getByRole('button', { name: /\+50rb/i }));
  expect(input.value).toBe('50.000');

  fireEvent.click(screen.getByRole('button', { name: /\+100rb/i }));
  expect(input.value).toBe('150.000');

  // Reset button clears nominal
  fireEvent.click(screen.getByRole('button', { name: /Reset/i }));
  expect(input.value).toBe('');
});

it('aligns status with dynamic safe_runway_threshold (50k vs default 30k) (Review Focus 4)', () => {
  const customSummary = {
    ...mockSummary,
    operational_free_cash: 600000,
    days_remaining: 15,
    daily_safe_runway: 40000,
    safe_runway_threshold: 50000,
  };

  render(
    <OverviewView
      summary={customSummary}
      vaults={mockVaults}
      accounts={mockAccounts}
      isLoading={false}
      refreshTrigger={0}
      onNavigateToVaults={vi.fn()}
      onOpenCreateAccount={vi.fn()}
      onOpenSimulateModal={vi.fn()}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: /Cek Dampak Belanja/i }));
  const input = screen.getByPlaceholderText(/Misal: 150\.000/i);

  // Projected runway: (600,000 - 150,000) / 15 = 30,000.
  // With safe_runway_threshold = 50,000, 30,000 is WARNING (Waspada)
  fireEvent.change(input, { target: { value: '150000' } });
  expect(screen.getByTestId('simulation-status-badge')).toHaveTextContent(/Waspada/i);
});

it('handles deficit when planned amount exceeds operational free cash and guards against zero days remaining (Review Focus 1, 2)', () => {
  const zeroDaysSummary = {
    ...mockSummary,
    operational_free_cash: 100000,
    days_remaining: 0,
    daily_safe_runway: 100000,
  };

  render(
    <OverviewView
      summary={zeroDaysSummary}
      vaults={mockVaults}
      accounts={mockAccounts}
      isLoading={false}
      refreshTrigger={0}
      onNavigateToVaults={vi.fn()}
      onOpenCreateAccount={vi.fn()}
      onOpenSimulateModal={vi.fn()}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: /Cek Dampak Belanja/i }));
  const input = screen.getByPlaceholderText(/Misal: 150\.000/i);

  // Amount exceeds free cash (200,000 > 100,000)
  fireEvent.change(input, { target: { value: '200000' } });

  expect(screen.getByTestId('simulation-status-badge')).toHaveTextContent(/Defisit/i);
  expect(screen.getByText(/Nominal melebihi saldo bebas pakai saat ini/i)).toBeInTheDocument();
  expect(screen.getByTestId('projected-free-cash')).toHaveTextContent('Rp 0');
});

it('sanitizes invalid or negative input strings without NaN (Review Focus 3)', () => {
  render(
    <OverviewView
      summary={mockSummary}
      vaults={mockVaults}
      accounts={mockAccounts}
      isLoading={false}
      refreshTrigger={0}
      onNavigateToVaults={vi.fn()}
      onOpenCreateAccount={vi.fn()}
      onOpenSimulateModal={vi.fn()}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: /Cek Dampak Belanja/i }));
  const input = screen.getByPlaceholderText(/Misal: 150\.000/i);

  fireEvent.change(input, { target: { value: 'abc-50.000xyz' } });
  expect(screen.getByTestId('projected-daily-runway')).not.toHaveTextContent('NaN');
});

it('bridges planned amount into QuickCaptureBar via draftText and closes simulation drawer (Review Focus 5)', () => {
  render(
    <OverviewView
      summary={mockSummary}
      vaults={mockVaults}
      accounts={mockAccounts}
      isLoading={false}
      refreshTrigger={0}
      onNavigateToVaults={vi.fn()}
      onOpenCreateAccount={vi.fn()}
      onOpenSimulateModal={vi.fn()}
    />
  );

  fireEvent.click(screen.getByRole('button', { name: /Cek Dampak Belanja/i }));
  const input = screen.getByPlaceholderText(/Misal: 150\.000/i);
  fireEvent.change(input, { target: { value: '150000' } });

  const bridgeBtn = screen.getByRole('button', { name: /Lanjut Catat Pengeluaran/i });
  fireEvent.click(bridgeBtn);

  // Drawer closed
  expect(screen.queryByTestId('runway-simulation-panel')).not.toBeInTheDocument();

  // QuickCaptureBar command input populated
  const commandInput = screen.getByPlaceholderText(/Ketik mutasi/i) as HTMLInputElement;
  expect(commandInput.value).toBe('Beli Rp 150.000');
});
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd frontend; npm test -- --run src/__tests__/OverviewView.test.tsx -t "Cek Dampak Belanja"`
Expected: FAIL because simulation trigger and drawer do not exist yet.

- [x] **Step 3: Implement In-Cockpit Pre-Purchase Simulation Drawer in `OverviewView.tsx`**

1. Add state:
```typescript
const [isSimulationOpen, setIsSimulationOpen] = React.useState<boolean>(false);
const [simulationNominal, setSimulationNominal] = React.useState<number>(0);
const [simulationInputValue, setSimulationInputValue] = React.useState<string>('');
const [quickCaptureDraft, setQuickCaptureDraft] = React.useState<string | undefined>(undefined);
```

2. Add deterministic calculation in `useMemo`:
```typescript
// ponytail: deterministic client-side simulation; upgrade to multi-cycle forecasting if cycle transitions require rolling bills
const simulationResults = React.useMemo(() => {
  const operationalFree = Math.max(0, summary?.operational_free_cash ?? 0);
  const daysRemaining = Math.max(1, summary?.days_remaining ?? 1);
  const currentDailyRunway = summary?.daily_safe_runway ?? 0;
  const safeThreshold = summary?.safe_runway_threshold ?? 30000;

  const planned = Math.max(0, simulationNominal);
  const isDeficit = planned > operationalFree;
  const projectedFree = Math.max(0, operationalFree - planned);
  const projectedDailyRunway = Math.floor(projectedFree / daysRemaining);
  const dailyDrop = Math.max(0, currentDailyRunway - projectedDailyRunway);

  let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
  let statusCopy = `Belanja aman. Jatah harian Anda masih di atas batas aman operasional (${formatRupiah(safeThreshold)}/hari).`;

  if (isDeficit || projectedDailyRunway <= 0) {
    status = 'CRITICAL';
    statusCopy = 'Peringatan Defisit: Nominal melebihi saldo bebas pakai saat ini!';
  } else if (projectedDailyRunway < safeThreshold) {
    status = 'WARNING';
    statusCopy = `Waspada: Jatah belanja harian turun di bawah batas aman (${formatRupiah(safeThreshold)}/hari).`;
  }

  return {
    operationalFree,
    daysRemaining,
    currentDailyRunway,
    safeThreshold,
    planned,
    isDeficit,
    projectedFree,
    projectedDailyRunway,
    dailyDrop,
    status,
    statusCopy,
  };
}, [summary, simulationNominal]);
```

3. Add sanitizing input helper:
```typescript
const handleNominalInputChange = (raw: string) => {
  const cleaned = raw.replace(/\D/g, '');
  if (!cleaned) {
    setSimulationNominal(0);
    setSimulationInputValue('');
    return;
  }
  const parsed = parseInt(cleaned, 10);
  setSimulationNominal(parsed);
  setSimulationInputValue(new Intl.NumberFormat('id-ID').format(parsed));
};

const handleAddPreset = (amount: number) => {
  const updated = simulationNominal + amount;
  setSimulationNominal(updated);
  setSimulationInputValue(new Intl.NumberFormat('id-ID').format(updated));
};

const handleResetSimulation = () => {
  setSimulationNominal(0);
  setSimulationInputValue('');
};
```

4. Add Trigger Bar & AnimatePresence Drawer below the Mathematical Reconciliation Strip inside Tier 1 Hero Runway Card:
- Trigger button with `⚡ Cek Dampak Belanja` / `✕ Tutup Simulasi`, `aria-expanded={isSimulationOpen}`, and `aria-controls="runway-simulation-panel"`.
- `AnimatePresence` with `motion.div`:
  ```tsx
  <AnimatePresence>
    {isSimulationOpen && (
      <motion.div
        id="runway-simulation-panel"
        data-testid="runway-simulation-panel"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden pt-4 border-t border-slate-200/60 dark:border-zinc-800/80 space-y-4"
      >
        ...
      </motion.div>
    )}
  </AnimatePresence>
  ```
- Preset increment chips: `+50rb`, `+100rb`, `+250rb`, `+500rb` with `min-h-[38px] min-w-[38px]`.
- Side-by-side cards: "Realita Saat Ini" vs "Jika Jadi Beli".
- Action bridge button:
  ```tsx
  <Button
    onPress={() => {
      setQuickCaptureDraft(`Beli Rp ${new Intl.NumberFormat('id-ID').format(simulationNominal)}`);
      setIsSimulationOpen(false);
    }}
    className="min-h-[38px] bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs px-4 rounded-xl"
  >
    Lanjut Catat Pengeluaran ➔
  </Button>
  ```
- Wire `draftText={quickCaptureDraft}` and `onDraftConsumed={() => setQuickCaptureDraft(undefined)}` into `<QuickCaptureBar>`.

- [x] **Step 4: Run tests to verify they pass**

Run: `cd frontend; npm test -- --run src/__tests__/OverviewView.test.tsx`
Expected: PASS with 100% passing tests

- [x] **Step 5: Commit changes**

```bash
git add frontend/src/components/OverviewView.tsx frontend/src/__tests__/OverviewView.test.tsx
git commit -m "feat(frontend): implement in-cockpit pre-purchase simulation drawer in OverviewView"
```

---

### Task 4: Full Verification Gate (`impeccable detect`, `tsc`, `vitest`, `pytest`)

**Files:**
- Audit & Verify: Entire codebase across backend and frontend

**Interfaces:**
- Consumes: All tests, type checking rules, and design audits.

- [x] **Step 1: Execute single-pass Vitest test suite**

Run: `cd frontend; npm test -- --run`
Expected: 100% passing test files, 0 failures, exit code 0.

- [x] **Step 2: Execute frontend TypeScript typecheck**

Run: `cd frontend; npx tsc --noEmit`
Expected: Exit code 0, 0 compiler errors.

- [x] **Step 3: Execute backend pytest test suite**

Run: `uv run --no-project pytest tests/test_runway_service.py tests/test_api_endpoints.py`
Expected: 100% passing tests, 0 failures, exit code 0.

- [x] **Step 4: Execute Impeccable design quality and anti-pattern detection**

Run: `npx impeccable detect frontend/src/components/OverviewView.tsx frontend/src/components/QuickCaptureBar.tsx`
Expected: Clean scan with zero design system or UX anti-pattern violations.

- [x] **Step 5: Final documentation tracking commit**

```bash
git add docs/superpowers/plans/2026-10-22-in-cockpit-pre-purchase-simulation.md
git commit -m "docs: finalize in-cockpit pre-purchase simulation implementation plan"
```
