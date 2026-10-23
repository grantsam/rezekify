# Net Cashflow (Income vs Expense) & Savings Rate Widget Design

- **Date**: 2026-10-23
- **Scope**: Backend Service & Router (`rezekify`), Frontend Cockpit (`ExpenseCharts.tsx`, `types/api.ts`), E2E & Living Tests
- **Status**: Approved

---

## 1. Intent & Problem Statement

Rezekify tracks daily financial runway to answer: *"How much money can I safely spend today until my next income cycle without starving or missing fixed obligations?"*

Currently, `ExpenseCharts.tsx` provides two views via a 2-tab toggle:
1. **Harian (Daily)**: 7-day spending curve benchmarked against the `Daily Safe Runway` threshold line.
2. **Bulanan / Kategori (Monthly)**: Distribution of cycle expenses grouped by category in an SVG donut ring.

While these two views clearly answer *where money was spent*, they fail to answer the overarching financial question promised on the landing page:
> *"Berapa arus kas bersih dan rasio tabungan saya pada siklus ini?"* (Income vs Expense balance & Savings Rate).

Users face significant visibility friction:
- **Missing Net Balance Context**: Users cannot see whether their current cycle has positive cashflow (surplus) or negative cashflow (deficit) without manually calculating income minus expenses across multiple screens.
- **Unmeasured Savings Rate**: The standard personal finance benchmark (e.g. 50/30/20 rule, targetting 20%+ savings) is absent from the primary cockpit analytics card, leaving users without positive feedback when they save effectively.
- **Landing Page Disconnect**: The landing page highlights automated cashflow balancing and savings rate tracking, but the cockpit lacked a dedicated, living visual gauge for this metric.

By introducing a 3rd tab `Arus Kas (Cashflow)` into `ExpenseCharts.tsx`, Rezekify exposes:
- **Net Cashflow (Arus Kas Bersih)**: Total cycle income vs total cycle expense with deterministic subtraction.
- **Savings Rate (Rasio Tabungan)**: Clamped percentage of retained income with a visual 20% benchmark progress meter.
- **Bi-Directional Balance Gauge**: Pure SVG visualization comparing inflow and outflow.
- **Supportive Friend Status Badges**: Warm Indonesian encouragement (`'Sangat Sehat'`, `'Cukup Seimbang'`, `'Arus Kas Negatif'`).

---

## 2. Goals, Non-Goals, and Anti-Goals

### 2.1 Goals
- **Unified 3-Tab Analytics Toggle**: Expand tab toggle in `ExpenseCharts.tsx` to `[ Harian (Daily) | Kategori (Categories) | Arus Kas (Cashflow) ]` with full keyboard accessibility (`role="tablist"`), active gradient pill styling, and mobile-friendly touch targets (min 38px).
- **Pure SVG Bi-Directional Balance Gauge**: Render a lightweight, responsive SVG dual-arc / donut meter displaying proportional income vs expense and center savings rate without importing external charting libraries.
- **Deterministic Mathematical Ledger**: All calculations on the backend use Python `Decimal` with strict two-decimal quantizing (`0.01` for currency, `0.1` for percentages).
- **Supportive Friend Voice**: Friendly, non-punitive Indonesian status badges:
  - `HEALTHY`: `'Sangat Sehat'` (Savings Rate >= 20.0%, emerald badge with `CheckCircle2`).
  - `WARNING`: `'Cukup Seimbang'` (0.0% <= Savings Rate < 20.0%, amber badge with `AlertTriangle`).
  - `CRITICAL`: `'Arus Kas Negatif'` (Net cashflow < 0, rose badge with `AlertTriangle`).
- **URL Search Param Synchronization**: Bidirectional sync between tab state and URL query parameter:
  - Daily: `?period=daily` (or omitted default).
  - Categories: `?period=monthly`.
  - Cashflow: `?period=cashflow`.
- **Zero Cumulative Layout Shift (CLS)**: Strict layout height locking at `min-h-[380px]` on the outer card and `min-h-[224px]` on the inner chart container across all three tabs.

### 2.2 Non-Goals
- **Multi-Year Historical Cashflow Archives**: No multi-year macro trends; analytics remain focused on the user's active billing cycle.
- **Tax Bracket & Deduction Modeling**: No Indonesian PPh 21 tax withholding calculations or gross-to-net salary estimators.
- **Investment Portfolio Projections**: No compound interest simulation, mutual fund CAGR, or crypto asset valuation.

### 2.3 Anti-Goals
- **Floating-Point Drift**: Never perform monetary or percentage math with native IEEE 754 floats. Backend uses `Decimal`; frontend handles formatting via integer-safe helpers.
- **Layout Jumps / CLS**: No height collapsing, jumping skeletons, or layout shifts when toggling tabs or fetching async data.
- **Raw Unicode Emojis**: Zero raw emojis in source code. 100% Lucide React vector SVGs (`ArrowDownUp`, `TrendingUp`, `TrendingDown`, `CheckCircle2`, `AlertTriangle`), strictly validated by `ZeroEmojiAudit.test.ts`.

---

## 3. Backend Service & API Specification

### 3.1 Domain Models (`rezekify/services/runway.py`)

#### 3.1.1 Data Contract: `CashflowSummaryReport`
```python
class CashflowSummaryReport(NamedTuple):
    cycle_start_date: date
    cycle_end_date: date
    total_income: Decimal
    total_expense: Decimal
    net_cashflow: Decimal
    savings_rate: Decimal
    status: Literal["HEALTHY", "WARNING", "CRITICAL"]
```

#### 3.1.2 Method: `RunwayService.get_cashflow_summary`
```python
def get_cashflow_summary(
    self, user_id: UUID, today: Optional[date] = None
) -> CashflowSummaryReport:
    """Computes cycle net cashflow (Income vs Expense), savings rate, and financial health status."""
```

#### 3.1.3 Mathematical Formulas & Invariants
1. **Cycle Date Boundary**:
   Computed using `user.monthly_cycle_day`:
   - If `today.day >= cycle_day`: `cycle_start = date(today.year, today.month, min(cycle_day, max_days_current_month))`.
   - If `today.day < cycle_day`: `cycle_start = date(prev_year, prev_month, min(cycle_day, max_days_prev_month))`.
   - `cycle_end = today`.

2. **Income Aggregation (`total_income`)**:
   Sum of `LedgerEntry.amount` where:
   - `Transaction.user_id == user_id`
   - `func.date(Transaction.transaction_date) >= cycle_start.isoformat()`
   - `func.date(Transaction.transaction_date) <= cycle_end.isoformat()`
   - `LedgerEntry.entry_type == EntryType.CREDIT`
   - Either `Category.category_type == CategoryType.INCOME` or (`Category.id.is_(None)` and `LedgerEntry.account_id.is_(None)`) to exclude transfers.

3. **Expense Aggregation (`total_expense`)**:
   Sum of `LedgerEntry.amount` where:
   - `Transaction.user_id == user_id`
   - `func.date(Transaction.transaction_date) >= cycle_start.isoformat()`
   - `func.date(Transaction.transaction_date) <= cycle_end.isoformat()`
   - `LedgerEntry.entry_type == EntryType.DEBIT`
   - Either `Category.category_type == CategoryType.EXPENSE` or (`Category.id.is_(None)` and `LedgerEntry.account_id.is_(None)`) to exclude transfers.

4. **Net Cashflow**:
   $$\text{net\_cashflow} = \text{total\_income} - \text{total\_expense}$$

5. **Savings Rate**:
   - If $\text{total\_income} > 0$ and $\text{net\_cashflow} > 0$:
     $$\text{savings\_rate} = \left(\frac{\text{net\_cashflow}}{\text{total\_income}} \times 100\right)\text{.quantize(Decimal("0.1"))}$$
   - If $\text{net\_cashflow} \le 0$ or $\text{total\_income} == 0$:
     $$\text{savings\_rate} = \text{Decimal("0.0")}$$

6. **Status Mapping**:
   - `CRITICAL`: $\text{net\_cashflow} < 0$ (or $\text{total\_expense} > \text{total\_income}$)
   - `WARNING`: $\text{net\_cashflow} \ge 0$ and $\text{savings\_rate} < 20.0$
   - `HEALTHY`: $\text{savings\_rate} \ge 20.0$ (meets or exceeds the 20% savings rule)

---

### 3.2 API Schemas & Router (`rezekify/api/v1/dashboard_router.py`)

#### 3.2.1 Response Schema: `CashflowSummaryResponse`
```python
class CashflowSummaryResponse(BaseModel):
    period: Literal["cashflow"] = "cashflow"
    cycle_start_date: date
    cycle_end_date: date
    total_income: Decimal
    total_expense: Decimal
    net_cashflow: Decimal
    savings_rate: Decimal
    status: Literal["HEALTHY", "WARNING", "CRITICAL"]
```

#### 3.2.2 Unified Union: `SpendingBreakdownResponse`
```python
SpendingBreakdownResponse = Union[
    DailySpendingResponse,
    MonthlySpendingResponse,
    CashflowSummaryResponse,
]
```

#### 3.2.3 Endpoints
1. **Unified Analytics Route**:
   ```python
   @analytics_router.get("/spending-breakdown", response_model=SpendingBreakdownResponse)
   def get_spending_breakdown(
       period: str = Query("daily", pattern="^(daily|monthly|cashflow)$"),
       current_user: User = Depends(get_current_user),
       db: Session = Depends(get_db),
   ):
       service = RunwayService(db)
       if period == "cashflow":
           report = service.get_cashflow_summary(user_id=current_user.id)
           return CashflowSummaryResponse(
               period="cashflow",
               cycle_start_date=report.cycle_start_date,
               cycle_end_date=report.cycle_end_date,
               total_income=report.total_income,
               total_expense=report.total_expense,
               net_cashflow=report.net_cashflow,
               savings_rate=report.savings_rate,
               status=report.status,
           )
       ...
   ```
2. **Dedicated Route**:
   ```python
   @analytics_router.get("/cashflow-summary", response_model=CashflowSummaryResponse)
   def get_cashflow_summary(
       current_user: User = Depends(get_current_user),
       db: Session = Depends(get_db),
   ):
       service = RunwayService(db)
       report = service.get_cashflow_summary(user_id=current_user.id)
       return CashflowSummaryResponse(...)
   ```

---

## 4. Frontend UI/UX Design & Impeccable Craft

### 4.1 TypeScript API Contracts (`frontend/src/types/api.ts`)

```typescript
export interface CashflowSummaryResponse {
  period: 'cashflow';
  cycle_start_date: string;
  cycle_end_date: string;
  total_income: number;
  total_expense: number;
  net_cashflow: number;
  savings_rate: number;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
}

export type SpendingBreakdownResponse =
  | DailySpendingResponse
  | MonthlySpendingResponse
  | CashflowSummaryResponse;
```

---

### 4.2 Component Architecture (`frontend/src/components/ExpenseCharts.tsx`)

#### 4.2.1 State & Routing
- `period: 'daily' | 'monthly' | 'cashflow'`
- Synced with URL search params:
  ```typescript
  const period: 'daily' | 'monthly' | 'cashflow' = (() => {
    const p = searchParams.get('period');
    if (p === 'cashflow') return 'cashflow';
    if (p === 'monthly') return 'monthly';
    return 'daily';
  })();
  ```

#### 4.2.2 3-Tab Segmented Controller
```tsx
<div
  role="tablist"
  aria-label="Pilih rentang waktu analitik"
  className="flex bg-slate-100 dark:bg-zinc-900/60 p-1 rounded-2xl text-xs border border-slate-200/80 dark:border-zinc-800/80 shrink-0 w-full sm:w-auto"
>
  <Button
    size="sm"
    variant="light"
    role="tab"
    aria-selected={period === 'daily'}
    onPress={() => handlePeriodChange('daily')}
    className={`flex-1 min-h-[38px] px-3 py-1 rounded-xl font-extrabold transition-all text-xs ${...}`}
  >
    Harian (Daily)
  </Button>
  <Button
    size="sm"
    variant="light"
    role="tab"
    aria-selected={period === 'monthly'}
    onPress={() => handlePeriodChange('monthly')}
    className={`flex-1 min-h-[38px] px-3 py-1 rounded-xl font-extrabold transition-all text-xs ${...}`}
  >
    Kategori (Categories)
  </Button>
  <Button
    size="sm"
    variant="light"
    role="tab"
    aria-selected={period === 'cashflow'}
    onPress={() => handlePeriodChange('cashflow')}
    className={`flex-1 min-h-[38px] px-3 py-1 rounded-xl font-extrabold transition-all text-xs ${...}`}
  >
    <ArrowDownUp className="w-3.5 h-3.5 mr-1" />
    Arus Kas (Cashflow)
  </Button>
</div>
```

#### 4.2.3 Subtitle Dynamic Context
- **Harian**: *"Tren belanja 7 hari terakhir vs ambang batas Daily Safe Runway"*
- **Kategori**: *"Distribusi pengeluaran per kategori pada siklus berjalan"*
- **Arus Kas**: *"Perbandingan pemasukan vs pengeluaran dan rasio tabungan siklus berjalan"*

#### 4.2.4 Cashflow Visualization Layout (`min-h-[224px]`)
The cashflow tab presents a 2-column responsive layout (stacking gracefully on mobile screens):
1. **Left: SVG Bi-Directional Balance Gauge**:
   - Pure SVG dual-arc donut (`viewBox="0 0 160 160"`).
   - Inflow arc in Emerald (`#10B981`), Outflow arc in Rose (`#F43F5E`).
   - Center text: Large savings rate percentage (`42.5%`) with label `"Rasio Tabungan"`.
2. **Right: Cashflow Metrics & Friendly Badges**:
   - **Pemasukan (Income)**: Emerald pill with `TrendingUp` icon + formatted Rupiah.
   - **Pengeluaran (Expense)**: Rose pill with `TrendingDown` icon + formatted Rupiah.
   - **Arus Kas Bersih (Net Cashflow)**:
     - Positive: `+Rp X` with Emerald `'Sangat Sehat'` or Amber `'Cukup Seimbang'` badge (`CheckCircle2` / `AlertTriangle`).
     - Negative: `-Rp X` with Rose `'Arus Kas Negatif'` badge (`AlertTriangle`).
   - **Savings Progress Bar**: Visual progress indicator with a dashed marker at the 20% healthy threshold.

#### 4.2.5 Iconography & Zero-Emoji Rule
Only Lucide React icons are utilized:
- `ArrowDownUp`: Tab icon for Arus Kas.
- `TrendingUp`: Income metric indicator.
- `TrendingDown`: Expense metric indicator.
- `CheckCircle2`: Healthy status icon.
- `AlertTriangle`: Warning / Critical status icon.

---

## 5. Testing Strategy

### 5.1 Backend Tests (`tests/test_runway_service.py` & `tests/test_api_endpoints.py`)
- `test_get_cashflow_summary_healthy`: User with Rp 10.000.000 income and Rp 4.000.000 expense -> Net cashflow: Rp 6.000.000, Savings rate: 60.0%, Status: `HEALTHY`.
- `test_get_cashflow_summary_warning`: User with Rp 10.000.000 income and Rp 9.000.000 expense -> Net cashflow: Rp 1.000.000, Savings rate: 10.0%, Status: `WARNING`.
- `test_get_cashflow_summary_negative_deficit`: User with Rp 5.000.000 income and Rp 7.000.000 expense -> Net cashflow: -Rp 2.000.000, Savings rate: 0.0%, Status: `CRITICAL`.
- `test_get_cashflow_summary_cycle_isolation`: Transactions before the cycle start date are strictly excluded.
- `test_api_spending_breakdown_cashflow_endpoint`: Verify `/analytics/spending-breakdown?period=cashflow` returns 200 with `CashflowSummaryResponse` schema.
- `test_api_cashflow_summary_endpoint`: Verify `/analytics/cashflow-summary` returns 200 with valid payload.

### 5.2 Frontend Tests (`frontend/src/__tests__/ExpenseChartsLiving.test.tsx` & `ZeroEmojiAudit.test.ts`)
- **3-Tab Navigation**: Clicking `"Arus Kas (Cashflow)"` invokes API with `?period=cashflow` and updates the view.
- **Zero CLS Height Locking**: Verify `min-h-[380px]` card container and `min-h-[224px]` inner body container when viewing cashflow.
- **SVG Gauge Elements**: Verify SVG arcs, center savings rate, and metrics render correctly.
- **URL Param Sync**: Verify clicking tabs updates search params and reading search params mounts the active tab.
- **Zero Emoji Audit**: `ZeroEmojiAudit.test.ts` passes with zero raw unicode emojis.

### 5.3 Playwright E2E Tests (`frontend/e2e/cashflow-widget.spec.ts`)
- Automated browser test asserting:
  1. Cockpit dashboard loads with `ExpenseCharts`.
  2. Tab list contains all 3 tabs: Harian, Kategori, Arus Kas.
  3. Clicking "Arus Kas (Cashflow)" updates URL to `?period=cashflow`.
  4. Balance gauge, income, expense, and status badge are rendered.
  5. Layout does not produce horizontal scroll or layout shift.
