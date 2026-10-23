# Net Cashflow (Income vs Expense) & Savings Rate Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce an intuitive Net Cashflow (Income vs Expense) and Savings Rate analytics view into Rezekify's primary cockpit chart card (`ExpenseCharts.tsx`) via a 3-tab toggle, backed by deterministic Python `Decimal` aggregation in `RunwayService` and an accessible SVG bi-directional balance donut gauge with supportive Indonesian health badges.

**Architecture:**
1. **Backend Runway Calculation & Router**: Implement `CashflowSummaryReport` and `RunwayService.get_cashflow_summary` in `rezekify/services/runway.py` to aggregate cycle income (credit ledger entries on income categories/uncategorized without account_id) and cycle expenses (debit ledger entries on expense categories/uncategorized without account_id), deterministically compute net cashflow and quantized savings rate, and map health status (`HEALTHY`, `WARNING`, `CRITICAL`). Expose via `/analytics/spending-breakdown?period=cashflow` and dedicated `/analytics/cashflow-summary` in `rezekify/api/v1/dashboard_router.py`.
2. **Frontend Types & apiClient**: Add `CashflowSummaryResponse` to `frontend/src/types/api.ts` and export `getCashflowSummary()` in `frontend/src/services/apiClient.ts`.
3. **Cockpit Living Charts Canvas**: Expand the segmented toggle in `ExpenseCharts.tsx` from 2 tabs to 3 tabs (`[ Harian (Daily) | Kategori (Categories) | Arus Kas (Cashflow) ]`) with URL search param synchronization (`?period=cashflow`), keyboard accessibility, and zero CLS height locks (`min-h-[380px]` outer, `min-h-[224px]` inner). Render a custom SVG bi-directional donut gauge (Emerald for Income, Rose for Expense) with center savings rate, alongside telemetry cards for Pemasukan, Pengeluaran, Net Cashflow, visual progress benchmark (20% target), and Indonesian badges (`'Sangat Sehat'`, `'Cukup Seimbang'`, `'Arus Kas Negatif'`).
4. **E2E Playwright Suite**: Add comprehensive browser-level tests in `frontend/e2e/cashflow-widget.spec.ts` validating tab navigation, gauge rendering, reload persistence, deficit mode, and zero-shift bounding box stability in real Chromium.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Python `Decimal`, React 18, TypeScript, Tailwind CSS, Lucide React, HeroUI, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-net-cashflow-and-savings-rate-widget-design.md`

## Global Constraints

- Strictly ZERO raw unicode emojis / emoticons — all visual icons use Lucide React vector SVGs (`ArrowDownUp`, `TrendingUp`, `TrendingDown`, `CheckCircle2`, `AlertTriangle`), strictly validated by `ZeroEmojiAudit.test.ts`.
- Deterministic decimal math: all spending, income, cashflow, and savings rate calculations on the backend strictly use Python `Decimal` (`Decimal("0.01")` for currency, `Decimal("0.1")` for percentages); zero IEEE 754 float drift.
- Single-step non-interactive test commands: `cd "C:\Grant code\rezekify" ; pytest tests/<test_file>.py -v` (backend), `npm test -- src/__tests__/<test_file>.tsx --run` (frontend), `npx playwright test e2e/<test_file>.spec.ts` (E2E).
- Strict WCAG AA contrast: minimum 4.5:1 text/badge contrast in both light and dark modes across emerald, rose, amber, and slate accents.
- Zinc studio tokens: adhere strictly to Rezekify styling tokens (`emerald-500`, `emerald-600`, `rose-500`, `rose-600`, `amber-500`, `slate-200/80`, `zinc-800/80`, `zinc-900/60`).
- Multi-tenant data safety: row-level isolation (`user_id == current_user.id`) enforced on all database queries and mutation endpoints.
- Zero Cumulative Layout Shift (CLS): strict layout height locking at `min-h-[380px]` on the outer card and `min-h-[224px]` on the inner chart container across all three tabs.

## Review Focus

1. **Zero income and zero expense cycle:** When a user has zero income and zero expenses recorded in the cycle, `net_cashflow` is `Decimal("0.00")`, `savings_rate` is `Decimal("0.0")` without a `ZeroDivisionError`, and `status` is `WARNING`. The frontend displays `0.0% Rasio Tabungan`, Rp 0 income/expense, and center status `'Cukup Seimbang'` without throwing `NaN` or dividing by zero. (Tested in Task 1 & Task 3)
2. **Expenses exceeding income (Deficit mode):** When expenses exceed income (e.g. income Rp 5.000.000, expenses Rp 7.000.000), `net_cashflow` is negative (`-Rp 2.000.000`), `savings_rate` clamps to `0.0%`, `status` evaluates to `CRITICAL`, and the UI displays the rose `'Arus Kas Negatif'` badge with `AlertTriangle`. (Tested in Task 1, Task 3 & Task 4)
3. **Cycle date boundary isolation:** Transactions timestamped prior to `cycle_start_date` or following `cycle_end_date` are strictly excluded from both income and expenses. (Tested in Task 1)
4. **Transfer exclusion:** Internal balance transfers between user accounts (which generate debit and credit entries with `account_id != None` and `category_id == None`) must be strictly excluded from both `total_income` and `total_expense`. (Tested in Task 1)
5. **URL search param sync and F5 reload persistence:** Direct navigation to `?period=cashflow` activates the Cashflow tab immediately; clicking tabs updates URL query parameter bidirectionally; and browser reload (F5) preserves `?period=cashflow` without collapsing or reverting to daily view. (Tested in Task 3 & Task 4)

---

### Task 1: Backend Cashflow Calculation in `rezekify/services/runway.py` & API Endpoints in `rezekify/api/v1/dashboard_router.py`

**Files:**
- Modify: `rezekify/services/runway.py:101-118`, `rezekify/services/runway.py:515-540`
- Modify: `rezekify/api/v1/dashboard_router.py:134-145`, `rezekify/api/v1/dashboard_router.py:575-625`
- Test: `tests/test_runway_service.py`
- Test: `tests/test_api_endpoints.py`

**Interfaces:**
- Consumes:
  - `User.monthly_cycle_day: int` from `rezekify.db.models`
  - `Transaction(user_id=UUID, transaction_date=datetime)` from `rezekify.db.models`
  - `LedgerEntry(amount=Decimal, entry_type=EntryType, category_id=UUID, account_id=UUID)` from `rezekify.db.models`
- Produces:
  - `CashflowSummaryReport(NamedTuple)`:
    - `cycle_start_date: date`
    - `cycle_end_date: date`
    - `total_income: Decimal`
    - `total_expense: Decimal`
    - `net_cashflow: Decimal`
    - `savings_rate: Decimal`
    - `status: Literal["HEALTHY", "WARNING", "CRITICAL"]`
  - `RunwayService.get_cashflow_summary(user_id: UUID, today: Optional[date] = None) -> CashflowSummaryReport`
  - `CashflowSummaryResponse(BaseModel)` in `rezekify.api.v1.dashboard_router`
  - `GET /api/v1/analytics/spending-breakdown?period=cashflow -> CashflowSummaryResponse`
  - `GET /api/v1/analytics/cashflow-summary -> CashflowSummaryResponse`

- [ ] **Step 1: Write the failing tests in `tests/test_runway_service.py` and `tests/test_api_endpoints.py`**

Add to `tests/test_runway_service.py`:
```python
def test_get_cashflow_summary_healthy(db_session, sample_user):
    from rezekify.services.ledger import LedgerService
    sample_user.monthly_cycle_day = 1
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("10000000.00"),
    )
    inc_cat = Category(
        user_id=sample_user.id,
        name="Gaji",
        category_type=CategoryType.INCOME,
    )
    exp_cat = Category(
        user_id=sample_user.id,
        name="Operasional",
        category_type=CategoryType.EXPENSE,
    )
    db_session.add_all([acc, inc_cat, exp_cat])
    db_session.commit()

    ledger = LedgerService(db_session)
    # Income Rp 10.000.000
    ledger.record_income(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=inc_cat.id,
        amount=Decimal("10000000.00"),
        description="Gaji Bulanan",
        transaction_date=datetime(2026, 10, 5, 10, 0, tzinfo=timezone.utc),
    )
    # Expense Rp 4.000.000
    ledger.record_expense(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=exp_cat.id,
        amount=Decimal("4000000.00"),
        description="Belanja Pokok",
        transaction_date=datetime(2026, 10, 10, 10, 0, tzinfo=timezone.utc),
    )

    service = RunwayService(db_session)
    report = service.get_cashflow_summary(user_id=sample_user.id, today=date(2026, 10, 23))

    assert report.total_income == Decimal("10000000.00")
    assert report.total_expense == Decimal("4000000.00")
    assert report.net_cashflow == Decimal("6000000.00")
    assert report.savings_rate == Decimal("60.0")
    assert report.status == "HEALTHY"


def test_get_cashflow_summary_warning(db_session, sample_user):
    from rezekify.services.ledger import LedgerService
    sample_user.monthly_cycle_day = 1
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("10000000.00"),
    )
    inc_cat = Category(user_id=sample_user.id, name="Gaji", category_type=CategoryType.INCOME)
    exp_cat = Category(user_id=sample_user.id, name="Operasional", category_type=CategoryType.EXPENSE)
    db_session.add_all([acc, inc_cat, exp_cat])
    db_session.commit()

    ledger = LedgerService(db_session)
    ledger.record_income(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=inc_cat.id,
        amount=Decimal("10000000.00"),
        description="Gaji",
        transaction_date=datetime(2026, 10, 5, 10, 0, tzinfo=timezone.utc),
    )
    ledger.record_expense(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=exp_cat.id,
        amount=Decimal("9000000.00"),
        description="Pengeluaran Berat",
        transaction_date=datetime(2026, 10, 10, 10, 0, tzinfo=timezone.utc),
    )

    service = RunwayService(db_session)
    report = service.get_cashflow_summary(user_id=sample_user.id, today=date(2026, 10, 23))

    assert report.total_income == Decimal("10000000.00")
    assert report.total_expense == Decimal("9000000.00")
    assert report.net_cashflow == Decimal("1000000.00")
    assert report.savings_rate == Decimal("10.0")
    assert report.status == "WARNING"


def test_get_cashflow_summary_negative_deficit(db_session, sample_user):
    from rezekify.services.ledger import LedgerService
    sample_user.monthly_cycle_day = 1
    acc = Account(user_id=sample_user.id, name="BCA", account_type=AccountType.BANK, current_balance=Decimal("5000000.00"))
    inc_cat = Category(user_id=sample_user.id, name="Gaji", category_type=CategoryType.INCOME)
    exp_cat = Category(user_id=sample_user.id, name="Operasional", category_type=CategoryType.EXPENSE)
    db_session.add_all([acc, inc_cat, exp_cat])
    db_session.commit()

    ledger = LedgerService(db_session)
    ledger.record_income(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=inc_cat.id,
        amount=Decimal("5000000.00"),
        description="Gaji",
        transaction_date=datetime(2026, 10, 5, 10, 0, tzinfo=timezone.utc),
    )
    ledger.record_expense(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=exp_cat.id,
        amount=Decimal("7000000.00"),
        description="Overspending",
        transaction_date=datetime(2026, 10, 10, 10, 0, tzinfo=timezone.utc),
    )

    service = RunwayService(db_session)
    report = service.get_cashflow_summary(user_id=sample_user.id, today=date(2026, 10, 23))

    assert report.total_income == Decimal("5000000.00")
    assert report.total_expense == Decimal("7000000.00")
    assert report.net_cashflow == Decimal("-2000000.00")
    assert report.savings_rate == Decimal("0.0")
    assert report.status == "CRITICAL"


def test_get_cashflow_summary_zero_income_zero_expense(db_session, sample_user):
    sample_user.monthly_cycle_day = 1
    service = RunwayService(db_session)
    report = service.get_cashflow_summary(user_id=sample_user.id, today=date(2026, 10, 23))

    assert report.total_income == Decimal("0.00")
    assert report.total_expense == Decimal("0.00")
    assert report.net_cashflow == Decimal("0.00")
    assert report.savings_rate == Decimal("0.0")
    assert report.status == "WARNING"


def test_get_cashflow_summary_cycle_isolation(db_session, sample_user):
    from rezekify.services.ledger import LedgerService
    sample_user.monthly_cycle_day = 15
    acc = Account(user_id=sample_user.id, name="BCA", account_type=AccountType.BANK, current_balance=Decimal("10000000.00"))
    exp_cat = Category(user_id=sample_user.id, name="Operasional", category_type=CategoryType.EXPENSE)
    db_session.add_all([acc, exp_cat])
    db_session.commit()

    ledger = LedgerService(db_session)
    # Transaction before cycle (October 10 is before cycle starting October 15)
    ledger.record_expense(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=exp_cat.id,
        amount=Decimal("1500000.00"),
        description="Belanja Bulan Lalu",
        transaction_date=datetime(2026, 10, 10, 10, 0, tzinfo=timezone.utc),
    )
    # Transaction inside cycle (October 18)
    ledger.record_expense(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=exp_cat.id,
        amount=Decimal("500000.00"),
        description="Belanja Siklus Ini",
        transaction_date=datetime(2026, 10, 18, 10, 0, tzinfo=timezone.utc),
    )

    service = RunwayService(db_session)
    report = service.get_cashflow_summary(user_id=sample_user.id, today=date(2026, 10, 23))

    assert report.cycle_start_date == date(2026, 10, 15)
    assert report.total_expense == Decimal("500000.00")


def test_get_cashflow_summary_transfer_exclusion(db_session, sample_user):
    from rezekify.services.ledger import LedgerService
    sample_user.monthly_cycle_day = 1
    acc1 = Account(user_id=sample_user.id, name="BCA", account_type=AccountType.BANK, current_balance=Decimal("10000000.00"))
    acc2 = Account(user_id=sample_user.id, name="Jago", account_type=AccountType.BANK, current_balance=Decimal("2000000.00"))
    db_session.add_all([acc1, acc2])
    db_session.commit()

    ledger = LedgerService(db_session)
    # Transfer between user accounts
    ledger.record_transfer(
        user_id=sample_user.id,
        from_account_id=acc1.id,
        to_account_id=acc2.id,
        amount=Decimal("3000000.00"),
        description="Pindah Dana",
        transaction_date=datetime(2026, 10, 10, 10, 0, tzinfo=timezone.utc),
    )

    service = RunwayService(db_session)
    report = service.get_cashflow_summary(user_id=sample_user.id, today=date(2026, 10, 23))

    # Transfers must NOT be counted as income or expense
    assert report.total_income == Decimal("0.00")
    assert report.total_expense == Decimal("0.00")
    assert report.net_cashflow == Decimal("0.00")
```

Add to `tests/test_api_endpoints.py`:
```python
def test_api_spending_breakdown_cashflow_and_dedicated_endpoint(sample_user, db_session):
    from rezekify.core.security import create_access_token
    from rezekify.services.ledger import LedgerService

    with db_override(db_session):
        token = create_access_token({"sub": str(sample_user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        acc = Account(
            user_id=sample_user.id,
            name="Bank Mandiri",
            account_type=AccountType.BANK,
            current_balance=Decimal("10000000.00"),
        )
        inc_cat = Category(user_id=sample_user.id, name="Gaji", category_type=CategoryType.INCOME)
        exp_cat = Category(user_id=sample_user.id, name="Makan", category_type=CategoryType.EXPENSE)
        db_session.add_all([acc, inc_cat, exp_cat])
        db_session.commit()

        ledger = LedgerService(db_session)
        ledger.record_income(
            user_id=sample_user.id,
            account_id=acc.id,
            category_id=inc_cat.id,
            amount=Decimal("10000000.00"),
            description="Payroll",
        )
        ledger.record_expense(
            user_id=sample_user.id,
            account_id=acc.id,
            category_id=exp_cat.id,
            amount=Decimal("3000000.00"),
            description="Restoran",
        )

        # 1. Test /analytics/spending-breakdown?period=cashflow
        res = client.get("/api/v1/analytics/spending-breakdown?period=cashflow", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["period"] == "cashflow"
        assert Decimal(str(data["total_income"])) == Decimal("10000000.00")
        assert Decimal(str(data["total_expense"])) == Decimal("3000000.00")
        assert Decimal(str(data["net_cashflow"])) == Decimal("7000000.00")
        assert Decimal(str(data["savings_rate"])) == Decimal("70.0")
        assert data["status"] == "HEALTHY"

        # 2. Test /analytics/cashflow-summary
        res_ded = client.get("/api/v1/analytics/cashflow-summary", headers=headers)
        assert res_ded.status_code == 200
        data_ded = res_ded.json()
        assert data_ded["period"] == "cashflow"
        assert Decimal(str(data_ded["net_cashflow"])) == Decimal("7000000.00")
        assert data_ded["status"] == "HEALTHY"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:\Grant code\rezekify" ; pytest tests/test_runway_service.py -k "test_get_cashflow_summary" -v`
Expected: FAIL with `AttributeError: 'RunwayService' object has no attribute 'get_cashflow_summary'`

Run: `cd "C:\Grant code\rezekify" ; pytest tests/test_api_endpoints.py -k "test_api_spending_breakdown_cashflow_and_dedicated_endpoint" -v`
Expected: FAIL with 422 or 404

- [ ] **Step 3: Implement `CashflowSummaryReport` & `get_cashflow_summary` in `rezekify/services/runway.py` and router endpoints in `rezekify/api/v1/dashboard_router.py`**

In `rezekify/services/runway.py`:
1. Add `and_` to imports from `sqlalchemy` alongside `func, or_`.
2. Define `CashflowSummaryReport`:
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
3. Implement `RunwayService.get_cashflow_summary(self, user_id: UUID, today: Optional[date] = None) -> CashflowSummaryReport`:
```python
    def get_cashflow_summary(
        self, user_id: UUID, today: Optional[date] = None
    ) -> CashflowSummaryReport:
        """Computes cycle net cashflow (Income vs Expense), savings rate, and financial health status."""
        if today is None:
            today = date.today()

        user = self.db.query(User).filter_by(id=user_id).one()
        cycle_day = user.monthly_cycle_day

        if today.day >= cycle_day:
            _, max_days = monthrange(today.year, today.month)
            effective_day = min(cycle_day, max_days)
            cycle_start = date(today.year, today.month, effective_day)
        else:
            if today.month == 1:
                prev_year = today.year - 1
                prev_month = 12
            else:
                prev_year = today.year
                prev_month = today.month - 1
            _, max_days = monthrange(prev_year, prev_month)
            effective_day = min(cycle_day, max_days)
            cycle_start = date(prev_year, prev_month, effective_day)

        cycle_end = today

        income_val = (
            self.db.query(func.coalesce(func.sum(LedgerEntry.amount), Decimal("0.00")))
            .select_from(LedgerEntry)
            .join(Transaction, LedgerEntry.transaction_id == Transaction.id)
            .outerjoin(Category, LedgerEntry.category_id == Category.id)
            .filter(
                Transaction.user_id == user_id,
                LedgerEntry.entry_type == EntryType.CREDIT,
                or_(
                    Category.category_type == CategoryType.INCOME,
                    and_(Category.id.is_(None), LedgerEntry.account_id.is_(None)),
                ),
                func.date(Transaction.transaction_date) >= cycle_start.isoformat(),
                func.date(Transaction.transaction_date) <= cycle_end.isoformat(),
            )
            .scalar()
        )
        total_income = Decimal(str(income_val or "0.00")).quantize(Decimal("0.01"))

        expense_val = (
            self.db.query(func.coalesce(func.sum(LedgerEntry.amount), Decimal("0.00")))
            .select_from(LedgerEntry)
            .join(Transaction, LedgerEntry.transaction_id == Transaction.id)
            .outerjoin(Category, LedgerEntry.category_id == Category.id)
            .filter(
                Transaction.user_id == user_id,
                LedgerEntry.entry_type == EntryType.DEBIT,
                or_(
                    Category.category_type == CategoryType.EXPENSE,
                    and_(Category.id.is_(None), LedgerEntry.account_id.is_(None)),
                ),
                func.date(Transaction.transaction_date) >= cycle_start.isoformat(),
                func.date(Transaction.transaction_date) <= cycle_end.isoformat(),
            )
            .scalar()
        )
        total_expense = Decimal(str(expense_val or "0.00")).quantize(Decimal("0.01"))

        net_cashflow = (total_income - total_expense).quantize(Decimal("0.01"))

        if total_income > Decimal("0.00") and net_cashflow > Decimal("0.00"):
            savings_rate = ((net_cashflow / total_income) * Decimal("100")).quantize(Decimal("0.1"))
        else:
            savings_rate = Decimal("0.0")

        if net_cashflow < Decimal("0.00"):
            status: Literal["HEALTHY", "WARNING", "CRITICAL"] = "CRITICAL"
        elif savings_rate >= Decimal("20.0"):
            status = "HEALTHY"
        else:
            status = "WARNING"

        return CashflowSummaryReport(
            cycle_start_date=cycle_start,
            cycle_end_date=cycle_end,
            total_income=total_income,
            total_expense=total_expense,
            net_cashflow=net_cashflow,
            savings_rate=savings_rate,
            status=status,
        )
```

In `rezekify/api/v1/dashboard_router.py`:
1. Add `CashflowSummaryReport` to imports from `rezekify.services.runway`.
2. Define `CashflowSummaryResponse`:
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
3. Update `SpendingBreakdownResponse`:
```python
SpendingBreakdownResponse = Union[DailySpendingResponse, MonthlySpendingResponse, CashflowSummaryResponse]
```
4. Update `get_spending_breakdown` route:
Change Query parameter pattern to `pattern="^(daily|monthly|cashflow)$"`.
When `period == "cashflow"`:
```python
    if period == "cashflow":
        cashflow_report = service.get_cashflow_summary(user_id=current_user.id)
        return CashflowSummaryResponse(
            period="cashflow",
            cycle_start_date=cashflow_report.cycle_start_date,
            cycle_end_date=cashflow_report.cycle_end_date,
            total_income=cashflow_report.total_income,
            total_expense=cashflow_report.total_expense,
            net_cashflow=cashflow_report.net_cashflow,
            savings_rate=cashflow_report.savings_rate,
            status=cashflow_report.status,
        )
```
5. Add dedicated endpoint:
```python
@analytics_router.get("/cashflow-summary", response_model=CashflowSummaryResponse)
def get_cashflow_summary_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns net cashflow (Income vs Expense), savings rate, and financial health status for current cycle."""
    service = RunwayService(db)
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "C:\Grant code\rezekify" ; pytest tests/test_runway_service.py -k "test_get_cashflow_summary" -v`
Expected: PASS (all 6 tests)

Run: `cd "C:\Grant code\rezekify" ; pytest tests/test_api_endpoints.py -k "test_api_spending_breakdown_cashflow_and_dedicated_endpoint" -v`
Expected: PASS

Run whole backend suite: `cd "C:\Grant code\rezekify" ; pytest tests/test_runway_service.py tests/test_api_endpoints.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/services/runway.py rezekify/api/v1/dashboard_router.py tests/test_runway_service.py tests/test_api_endpoints.py
git commit -m "feat(backend): implement net cashflow aggregation and savings rate analytics endpoint"
```

---

### Task 2: Frontend Types & apiClient Integration in `frontend/src/types/api.ts` & `frontend/src/services/apiClient.ts`

**Files:**
- Modify: `frontend/src/types/api.ts:237-246`
- Modify: `frontend/src/services/apiClient.ts:33-35`, `frontend/src/services/apiClient.ts:325-335`
- Test: `frontend/src/__tests__/apiClient.test.ts`

**Interfaces:**
- Consumes:
  - `CashflowSummaryResponse` data model from Task 1
- Produces:
  - `CashflowSummaryResponse` interface in `frontend/src/types/api.ts`
  - `SpendingBreakdownResponse` union with `CashflowSummaryResponse`
  - `getCashflowSummary(): Promise<CashflowSummaryResponse>` in `frontend/src/services/apiClient.ts`

- [ ] **Step 1: Write the failing test in `frontend/src/__tests__/apiClient.test.ts`**

Add to `frontend/src/__tests__/apiClient.test.ts`:
```typescript
  it('getCashflowSummary calls /analytics/cashflow-summary and returns CashflowSummaryResponse', async () => {
    const mockCashflow: CashflowSummaryResponse = {
      period: 'cashflow',
      cycle_start_date: '2026-10-01',
      cycle_end_date: '2026-10-23',
      total_income: 10000000,
      total_expense: 4000000,
      net_cashflow: 6000000,
      savings_rate: 60.0,
      status: 'HEALTHY',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCashflow,
    });

    const result = await getCashflowSummary();

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/analytics/cashflow-summary',
      expect.objectContaining({
        headers: expect.any(Object),
      })
    );
    expect(result).toEqual(mockCashflow);
    expect(result.period).toBe('cashflow');
    expect(result.status).toBe('HEALTHY');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/apiClient.test.ts -t "getCashflowSummary" --run`
Expected: FAIL with `ReferenceError: getCashflowSummary is not defined`

- [ ] **Step 3: Implement `CashflowSummaryResponse` in `types/api.ts` and `getCashflowSummary()` in `apiClient.ts`**

In `frontend/src/types/api.ts`:
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

In `frontend/src/services/apiClient.ts`:
Import `CashflowSummaryResponse` from `../types/api`.
Export function:
```typescript
export async function getCashflowSummary(): Promise<CashflowSummaryResponse> {
  return apiFetch<CashflowSummaryResponse>('/analytics/cashflow-summary');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/apiClient.test.ts -t "getCashflowSummary" --run`
Expected: PASS

Run all apiClient tests: `npm test -- src/__tests__/apiClient.test.ts --run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/services/apiClient.ts frontend/src/__tests__/apiClient.test.ts
git commit -m "feat(frontend): add cashflow summary types and apiClient integration"
```

---

### Task 3: ExpenseCharts 3-Tab Toggle & Living Cashflow SVG Canvas in `frontend/src/components/ExpenseCharts.tsx`

**Files:**
- Modify: `frontend/src/components/ExpenseCharts.tsx:1-8`, `frontend/src/components/ExpenseCharts.tsx:36-75`, `frontend/src/components/ExpenseCharts.tsx:145-185`, `frontend/src/components/ExpenseCharts.tsx:425-600`
- Test: `frontend/src/__tests__/ExpenseChartsLiving.test.tsx`
- Test: `frontend/src/__tests__/ZeroEmojiAudit.test.ts`

**Interfaces:**
- Consumes:
  - `CashflowSummaryResponse` from `frontend/src/types/api.ts`
  - `apiFetch<SpendingBreakdownResponse>('/analytics/spending-breakdown?period=' + period)` from `frontend/src/services/apiClient.ts`
  - Icons `ArrowDownUp`, `TrendingUp`, `TrendingDown`, `CheckCircle2`, `AlertTriangle` from `lucide-react`
- Produces:
  - Interactive 3-Tab Controller: `Harian (Daily)`, `Bulanan (Monthly)` (or `Kategori`), `Arus Kas (Cashflow)`
  - URL Query Param Sync (`?period=daily | monthly | cashflow`)
  - Living SVG Bi-Directional Donut Gauge with center Rasio Tabungan
  - Telemetry Cards: Pemasukan, Pengeluaran, Arus Kas Bersih with badges `'Sangat Sehat'`, `'Cukup Seimbang'`, `'Arus Kas Negatif'`
  - Progress meter benchmarking against 20% savings rule
  - Zero CLS layout stability (`min-h-[380px]` card, `min-h-[224px]` canvas)

- [ ] **Step 1: Write the failing tests in `frontend/src/__tests__/ExpenseChartsLiving.test.tsx`**

Add to `frontend/src/__tests__/ExpenseChartsLiving.test.tsx`:
```typescript
  const mockCashflowData: CashflowSummaryResponse = {
    period: 'cashflow',
    cycle_start_date: '2026-10-01',
    cycle_end_date: '2026-10-23',
    total_income: 10000000,
    total_expense: 4000000,
    net_cashflow: 6000000,
    savings_rate: 60.0,
    status: 'HEALTHY',
  };

  const mockDeficitCashflowData: CashflowSummaryResponse = {
    period: 'cashflow',
    cycle_start_date: '2026-10-01',
    cycle_end_date: '2026-10-23',
    total_income: 5000000,
    total_expense: 7000000,
    net_cashflow: -2000000,
    savings_rate: 0.0,
    status: 'CRITICAL',
  };

  const mockZeroCashflowData: CashflowSummaryResponse = {
    period: 'cashflow',
    cycle_start_date: '2026-10-01',
    cycle_end_date: '2026-10-23',
    total_income: 0,
    total_expense: 0,
    net_cashflow: 0,
    savings_rate: 0.0,
    status: 'WARNING',
  };

  it('renders 3-tab toggle including "Arus Kas (Cashflow)" and updates URL search param', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint.includes('period=cashflow')) return mockCashflowData;
      return mockDailyData;
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <ExpenseCharts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Arus Kas/i })).toBeInTheDocument();
    });

    const cashflowBtn = screen.getByRole('tab', { name: /Arus Kas/i });
    fireEvent.click(cashflowBtn);

    await waitFor(() => {
      expect(screen.getByText(/Perbandingan pemasukan vs pengeluaran/i)).toBeInTheDocument();
      expect(screen.getByText('Sangat Sehat')).toBeInTheDocument();
    });
  });

  it('renders Cashflow View with SVG bi-directional gauge, savings rate, and telemetry cards', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockCashflowData);

    const { container } = render(
      <MemoryRouter initialEntries={['/?period=cashflow']}>
        <ExpenseCharts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Sangat Sehat')).toBeInTheDocument();
    });

    // Check SVG Bi-directional Donut Gauge
    const gauge = container.querySelector('svg[data-testid="cashflow-donut-gauge"]');
    expect(gauge).toBeInTheDocument();

    // Check Center Savings Rate
    expect(screen.getByTestId('center-savings-rate')).toHaveTextContent('60.0%');
    expect(screen.getByText('Rasio Tabungan')).toBeInTheDocument();
    expect(screen.getByText('Surplus')).toBeInTheDocument();

    // Check Telemetry Cards
    expect(screen.getByText('Pemasukan')).toBeInTheDocument();
    expect(screen.getByText(/Rp 10\.000\.000/i)).toBeInTheDocument();
    expect(screen.getByText('Pengeluaran')).toBeInTheDocument();
    expect(screen.getByText(/Rp 4\.000\.000/i)).toBeInTheDocument();
    expect(screen.getByText(/Arus Kas Bersih/i)).toBeInTheDocument();
    expect(screen.getByText(/\+Rp 6\.000\.000/i)).toBeInTheDocument();

    // Check Benchmark Progress Bar
    expect(screen.getByTestId('savings-rate-progress')).toBeInTheDocument();
  });

  it('renders Deficit Mode with CRITICAL badge "Arus Kas Negatif" and negative cashflow', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockDeficitCashflowData);

    render(
      <MemoryRouter initialEntries={['/?period=cashflow']}>
        <ExpenseCharts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Arus Kas Negatif')).toBeInTheDocument();
      expect(screen.getByText(/-Rp 2\.000\.000/i)).toBeInTheDocument();
      expect(screen.getByText('Defisit')).toBeInTheDocument();
      expect(screen.getByTestId('center-savings-rate')).toHaveTextContent('0.0%');
    });
  });

  it('handles zero income and zero expense without division by zero or NaN', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockZeroCashflowData);

    render(
      <MemoryRouter initialEntries={['/?period=cashflow']}>
        <ExpenseCharts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Cukup Seimbang')).toBeInTheDocument();
      expect(screen.getByTestId('center-savings-rate')).toHaveTextContent('0.0%');
      expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
    });
  });

  it('enforces min-h-[224px] layout lock on Cashflow chart container for zero CLS', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockCashflowData);

    render(
      <MemoryRouter initialEntries={['/?period=cashflow']}>
        <ExpenseCharts />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Sangat Sehat')).toBeInTheDocument();
    });

    const cashflowContainer = screen.getByTestId('cashflow-canvas-container');
    expect(cashflowContainer.className).toContain('min-h-[224px]');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/__tests__/ExpenseChartsLiving.test.tsx -t "Arus Kas" --run`
Expected: FAIL

- [ ] **Step 3: Implement 3-Tab Toggle & Living Cashflow SVG Canvas in `frontend/src/components/ExpenseCharts.tsx`**

1. Import `ArrowDownUp`, `TrendingDown` from `lucide-react`.
2. Import `CashflowSummaryResponse` from `../types/api`.
3. Update `period` type to `'daily' | 'monthly' | 'cashflow'`:
```typescript
  const period: 'daily' | 'monthly' | 'cashflow' = (() => {
    const p = searchParams.get('period');
    if (p === 'cashflow') return 'cashflow';
    if (p === 'monthly') return 'monthly';
    return 'daily';
  })();

  const handlePeriodChange = (newPeriod: 'daily' | 'monthly' | 'cashflow') => {
    if (newPeriod === period) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newPeriod === 'daily') {
        next.delete('period');
      } else {
        next.set('period', newPeriod);
      }
      return next;
    }, { replace: true });
  };
```
4. Update `hasExpenses` check to account for `cashflow`:
```typescript
  const cashflowData = data?.period === 'cashflow' ? (data as CashflowSummaryResponse) : null;
  const hasExpenses = period === 'daily'
    ? dailyData?.items.some((i) => i.amount > 0)
    : period === 'monthly'
    ? (monthlyData?.items && monthlyData.items.length > 0)
    : true;
```
5. Update 3-tab segmented controller button UI:
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
      className={`flex-1 min-h-[38px] px-3 py-1 rounded-xl font-extrabold transition-all text-xs ${
        period === 'daily'
          ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-900/20'
          : 'text-slate-500 dark:text-slate-400 hover:text-emerald-500 bg-transparent'
      }`}
    >
      Harian (Daily)
    </Button>
    <Button
      size="sm"
      variant="light"
      role="tab"
      aria-selected={period === 'monthly'}
      onPress={() => handlePeriodChange('monthly')}
      className={`flex-1 min-h-[38px] px-3 py-1 rounded-xl font-extrabold transition-all text-xs ${
        period === 'monthly'
          ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-900/20'
          : 'text-slate-500 dark:text-slate-400 hover:text-emerald-500 bg-transparent'
      }`}
    >
      Bulanan (Monthly)
    </Button>
    <Button
      size="sm"
      variant="light"
      role="tab"
      aria-selected={period === 'cashflow'}
      onPress={() => handlePeriodChange('cashflow')}
      className={`flex-1 min-h-[38px] px-3 py-1 rounded-xl font-extrabold transition-all text-xs flex items-center justify-center gap-1 ${
        period === 'cashflow'
          ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-900/20'
          : 'text-slate-500 dark:text-slate-400 hover:text-emerald-500 bg-transparent'
      }`}
    >
      <ArrowDownUp className="w-3.5 h-3.5" />
      Arus Kas
    </Button>
  </div>
```
6. Update subtitle context:
```tsx
  <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium truncate">
    {period === 'daily'
      ? 'Tren belanja 7 hari terakhir vs ambang batas Daily Safe Runway'
      : period === 'monthly'
      ? 'Distribusi pengeluaran per kategori pada siklus berjalan'
      : 'Perbandingan pemasukan vs pengeluaran dan rasio tabungan siklus berjalan'}
  </p>
```
7. Render Cashflow Canvas (`period === 'cashflow' && cashflowData`):
```tsx
  <div
    data-testid="cashflow-canvas-container"
    className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center py-2 flex-1 min-h-[224px]"
  >
    {/* Left Column: Bi-Directional Donut Gauge */}
    <div className="md:col-span-5 flex flex-col items-center justify-center relative">
      {(() => {
        const income = Math.max(0, cashflowData.total_income);
        const expense = Math.max(0, cashflowData.total_expense);
        const totalVolume = income + expense;
        const incomePct = totalVolume > 0 ? (income / totalVolume) * 100 : 50;
        const expensePct = totalVolume > 0 ? (expense / totalVolume) * 100 : 50;
        const incomeArc = (incomePct / 100) * CIRCUMFERENCE;
        const expenseArc = (expensePct / 100) * CIRCUMFERENCE;

        return (
          <div className="relative flex items-center justify-center">
            <svg
              data-testid="cashflow-donut-gauge"
              viewBox="0 0 160 160"
              className="w-40 h-40 transform -rotate-90"
            >
              <circle
                cx="80"
                cy="80"
                r="60"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="14"
                className="text-slate-100 dark:text-zinc-800/60"
              />
              {totalVolume > 0 ? (
                <>
                  <circle
                    cx="80"
                    cy="80"
                    r="60"
                    fill="transparent"
                    stroke="#10B981"
                    strokeWidth="14"
                    strokeDasharray={`${incomeArc} ${CIRCUMFERENCE}`}
                    strokeDashoffset="0"
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="60"
                    fill="transparent"
                    stroke="#F43F5E"
                    strokeWidth="14"
                    strokeDasharray={`${expenseArc} ${CIRCUMFERENCE}`}
                    strokeDashoffset={-incomeArc}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </>
              ) : null}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                Rasio Tabungan
              </span>
              <span
                data-testid="center-savings-rate"
                className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums leading-tight"
              >
                {cashflowData.savings_rate.toFixed(1)}%
              </span>
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full mt-0.5 ${
                  cashflowData.net_cashflow >= 0
                    ? 'text-emerald-500 bg-emerald-500/10'
                    : 'text-rose-500 bg-rose-500/10'
                }`}
              >
                {cashflowData.net_cashflow >= 0 ? 'Surplus' : 'Defisit'}
              </span>
            </div>
          </div>
        );
      })()}
    </div>

    {/* Right Column: Telemetry Metrics & Status Badges */}
    <div className="md:col-span-7 flex flex-col justify-between space-y-3.5">
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-500">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Pemasukan</span>
          </div>
          <p className="text-sm font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
            {formatRupiah(cashflowData.total_income)}
          </p>
        </div>

        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="p-1 rounded-lg bg-rose-500/10 text-rose-500">
              <TrendingDown className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">Pengeluaran</span>
          </div>
          <p className="text-sm font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
            {formatRupiah(cashflowData.total_expense)}
          </p>
        </div>
      </div>

      {/* Arus Kas Bersih & Health Badge */}
      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400 block mb-0.5">
            Arus Kas Bersih
          </span>
          <p
            className={`text-base font-black font-mono tabular-nums ${
              cashflowData.net_cashflow >= 0 ? 'text-emerald-500' : 'text-rose-500'
            }`}
          >
            {cashflowData.net_cashflow >= 0 ? '+' : ''}
            {formatRupiah(cashflowData.net_cashflow)}
          </p>
        </div>
        {cashflowData.status === 'HEALTHY' ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Sangat Sehat</span>
          </span>
        ) : cashflowData.status === 'WARNING' ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Cukup Seimbang</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>Arus Kas Negatif</span>
          </span>
        )}
      </div>

      {/* Savings Rate Benchmark Meter */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 font-semibold">
          <span>Target Tabungan: 20%</span>
          <span className="font-mono">{cashflowData.savings_rate.toFixed(1)}%</span>
        </div>
        <div
          data-testid="savings-rate-progress"
          role="progressbar"
          aria-label={`Rasio tabungan: ${cashflowData.savings_rate.toFixed(1)}%`}
          aria-valuenow={Math.min(100, Math.max(0, cashflowData.savings_rate))}
          aria-valuemin={0}
          aria-valuemax={100}
          className="relative w-full h-2 bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden"
        >
          {/* 20% Target Marker */}
          <div
            aria-hidden="true"
            className="absolute top-0 bottom-0 left-[20%] w-0.5 bg-slate-400 dark:bg-zinc-600 z-10"
          />
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              cashflowData.savings_rate >= 20
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : cashflowData.savings_rate > 0
                ? 'bg-amber-500'
                : 'bg-rose-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, cashflowData.savings_rate))}%` }}
          />
        </div>
      </div>
    </div>
  </div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/__tests__/ExpenseChartsLiving.test.tsx --run`
Expected: PASS (all tests pass)

Run: `npm test -- src/__tests__/ZeroEmojiAudit.test.ts --run`
Expected: PASS (zero unicode emojis)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ExpenseCharts.tsx frontend/src/__tests__/ExpenseChartsLiving.test.tsx
git commit -m "feat(cockpit): add 3-tab toggle and living cashflow balance donut canvas"
```

---

### Task 4: Playwright E2E Browser Verification Suite in `frontend/e2e/cashflow-widget.spec.ts`

**Files:**
- Create: `frontend/e2e/cashflow-widget.spec.ts`
- Test: `frontend/e2e/cashflow-widget.spec.ts`

**Interfaces:**
- Consumes:
  - Real browser navigation via Chromium (`page.goto('/')`)
  - Route mock interception for `/api/v1/analytics/spending-breakdown?period=cashflow`
  - URL Query param `?period=cashflow`
- Produces:
  - Automated verification of tab switching, gauge rendering, reload persistence, deficit handling, and CLS bounding box stability.

- [ ] **Step 1: Write the Playwright E2E test suite in `frontend/e2e/cashflow-widget.spec.ts`**

Create `frontend/e2e/cashflow-widget.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

const mockUser = {
  id: 'usr-e2e-cashflow',
  email: 'cashflow@rezekify.id',
  full_name: 'Cashflow Tester',
  telegram_chat_id: null,
};

const mockSummary = {
  total_liquid_cash: 10000000,
  vault_locked_cash: 2000000,
  operational_free_cash: 8000000,
  days_remaining: 15,
  daily_safe_runway: 250000,
  health_status: 'HEALTHY',
  upcoming_bills: [],
};

const mockAccounts = [
  {
    id: 'acc-e2e-1',
    name: 'BCA Utama',
    account_type: 'BANK',
    current_balance: 10000000,
    is_active: true,
  },
];

const mockDailySpending = {
  period: 'daily',
  daily_safe_runway: 250000,
  total_spent_in_period: 300000,
  items: [
    { date: '2026-10-23', day_label: 'Jum', amount: 50000, safe_runway_threshold: 250000, is_over_budget: false },
  ],
};

const mockCashflowHealthy = {
  period: 'cashflow',
  cycle_start_date: '2026-10-01',
  cycle_end_date: '2026-10-23',
  total_income: 12000000,
  total_expense: 4000000,
  net_cashflow: 8000000,
  savings_rate: 66.7,
  status: 'HEALTHY',
};

const mockCashflowDeficit = {
  period: 'cashflow',
  cycle_start_date: '2026-10-01',
  cycle_end_date: '2026-10-23',
  total_income: 5000000,
  total_expense: 8000000,
  net_cashflow: -3000000,
  savings_rate: 0.0,
  status: 'CRITICAL',
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'mock-token-e2e');
    localStorage.setItem('rezekify_auth_token', 'mock-token-e2e');
    localStorage.setItem('auth_user', JSON.stringify({ id: 'usr-e2e-cashflow', email: 'cashflow@rezekify.id' }));
  });

  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({ status: 200, json: mockUser });
  });

  await page.route('**/api/v1/dashboard/summary', async (route) => {
    await route.fulfill({ status: 200, json: mockSummary });
  });

  await page.route('**/api/v1/accounts*', async (route) => {
    await route.fulfill({ status: 200, json: mockAccounts });
  });

  await page.route('**/api/v1/vaults*', async (route) => {
    await route.fulfill({ status: 200, json: [] });
  });

  await page.route('**/api/v1/categories*', async (route) => {
    await route.fulfill({ status: 200, json: [] });
  });

  await page.route('**/api/v1/transactions*', async (route) => {
    await route.fulfill({ status: 200, json: { items: [], total: 0, page: 1, page_size: 10, total_pages: 0 } });
  });

  await page.route('**/api/v1/analytics/spending-breakdown*', async (route) => {
    const url = route.request().url();
    if (url.includes('period=cashflow')) {
      await route.fulfill({ status: 200, json: mockCashflowHealthy });
    } else {
      await route.fulfill({ status: 200, json: mockDailySpending });
    }
  });

  await page.route('**/api/v1/analytics/cashflow-summary', async (route) => {
    await route.fulfill({ status: 200, json: mockCashflowHealthy });
  });
});

test.describe('Net Cashflow & Savings Rate Widget E2E Suite', () => {
  test('tab switching, gauge rendering, and URL search param sync', async ({ page }) => {
    await page.goto('/');

    const card = page.getByTestId('expense-charts-card');
    await expect(card).toBeVisible();

    // Check that all 3 tabs are present
    const dailyTab = page.getByRole('tab', { name: /Harian/i });
    const monthlyTab = page.getByRole('tab', { name: /Bulanan/i });
    const cashflowTab = page.getByRole('tab', { name: /Arus Kas/i });

    await expect(dailyTab).toBeVisible();
    await expect(monthlyTab).toBeVisible();
    await expect(cashflowTab).toBeVisible();

    // Click Arus Kas tab
    await cashflowTab.click();

    // Verify URL query param updated
    await expect(page).toHaveURL(/.*period=cashflow.*/);

    // Verify Cashflow canvas and gauge
    await expect(page.getByTestId('cashflow-donut-gauge')).toBeVisible();
    await expect(page.getByTestId('center-savings-rate')).toContainText('66.7%');
    await expect(page.getByText('Sangat Sehat')).toBeVisible();
    await expect(page.getByText('Pemasukan')).toBeVisible();
    await expect(page.getByText('Pengeluaran')).toBeVisible();
    await expect(page.getByText(/Arus Kas Bersih/i)).toBeVisible();
    await expect(page.getByText(/\+Rp 8\.000\.000/i)).toBeVisible();
  });

  test('F5 reload persistence maintains ?period=cashflow state', async ({ page }) => {
    await page.goto('/?period=cashflow');

    await expect(page.getByTestId('cashflow-donut-gauge')).toBeVisible();
    await expect(page.getByTestId('center-savings-rate')).toContainText('66.7%');

    // Reload page
    await page.reload();

    // Confirm state persisted
    await expect(page).toHaveURL(/.*period=cashflow.*/);
    await expect(page.getByTestId('cashflow-donut-gauge')).toBeVisible();
    await expect(page.getByText('Sangat Sehat')).toBeVisible();
  });

  test('deficit scenario displays CRITICAL badge and negative balance', async ({ page }) => {
    await page.route('**/api/v1/analytics/spending-breakdown*', async (route) => {
      await route.fulfill({ status: 200, json: mockCashflowDeficit });
    });

    await page.goto('/?period=cashflow');

    await expect(page.getByText('Arus Kas Negatif')).toBeVisible();
    await expect(page.getByText(/-Rp 3\.000\.000/i)).toBeVisible();
    await expect(page.getByText('Defisit')).toBeVisible();
    await expect(page.getByTestId('center-savings-rate')).toContainText('0.0%');
  });

  test('enforces zero Cumulative Layout Shift (CLS) on card container', async ({ page }) => {
    await page.goto('/');

    const card = page.getByTestId('expense-charts-card');
    await expect(card).toBeVisible();

    const boxBefore = await card.boundingBox();
    expect(boxBefore).not.toBeNull();
    expect(boxBefore!.height).toBeGreaterThanOrEqual(380);

    // Switch to Cashflow
    await page.getByRole('tab', { name: /Arus Kas/i }).click();
    await expect(page.getByTestId('cashflow-donut-gauge')).toBeVisible();

    const boxAfter = await card.boundingBox();
    expect(boxAfter).not.toBeNull();
    expect(boxAfter!.height).toBeGreaterThanOrEqual(380);
  });
});
```

- [ ] **Step 2: Run Playwright tests to verify they pass**

Run: `npx playwright test e2e/cashflow-widget.spec.ts`
Expected: PASS (all 4 tests pass in Chromium)

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/cashflow-widget.spec.ts
git commit -m "test(e2e): add playwright browser suite for net cashflow and savings rate widget"
```

---

## Plan Review & Handoff Checklist

- [x] All 5 Review Focus edge cases covered by dedicated tests
- [x] Strict non-interactive single-step test commands specified
- [x] Python `Decimal` quantization enforced across math invariants
- [x] Zero raw unicode emojis across all UI components and tests
- [x] Bidirectional URL synchronization (`?period=cashflow`) with reload persistence
- [x] Min-height locking (`min-h-[380px]` card, `min-h-[224px]` canvas) for zero CLS
