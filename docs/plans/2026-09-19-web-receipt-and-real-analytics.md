# Multipart Web Receipt Ingestion & Real Analytics Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement authenticated multipart web receipt ingestion (`POST /api/v1/dashboard/ai-receipt`) with Gemini 2.5 Flash Vision OCR, deterministic historical spending analytics in `RunwayService`, dynamic analytical REST endpoints (`GET /api/v1/analytics/spending-breakdown`), and an interactive React 18 + Tailwind + Framer Motion dashboard featuring drag-and-drop receipt ingestion and reactive telemetry charts.

**Architecture:** Decoupled client-server architecture where Gemini 2.5 Flash Vision OCR extracts structured financial entities from multipart receipt uploads into deterministic double-entry ledger mutations, `RunwayService` aggregates ledger entries into daily safe runway benchmarks and billing cycle category percentages, and the frontend reacts to receipt ingestion by re-querying telemetry and animating charts via Framer Motion.

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy 2.0, Pydantic v2, PostgreSQL / SQLite in-memory, google-genai, React 18, Vite, TypeScript, Tailwind CSS, Lucide React, Framer Motion (`framer-motion`), Vitest, `@testing-library/react`.

**Spec:** `docs/specs/2026-09-19-web-receipt-and-real-analytics-design.md`

## Global Constraints
* **Deterministic Accounting:** Zero LLM calculation of balances, runway thresholds, or category percentages; all money arithmetic runs in Python `decimal.Decimal` and PostgreSQL `NUMERIC(15, 2)`.
* **Double-Entry Invariant:** Every expense transaction posted from receipt ingestion must create balanced entries ($\sum \text{Debit} = \sum \text{Credit}$).
* **Tenant Isolation:** Every query, aggregation, and mutation enforces `WHERE user_id = current_user.id`.
* **Rotary Key Resilience:** Vision OCR calls utilize `RotaryKeyPool.from_env("GEMINI_API_KEYS")` with automatic HTTP 429 key failover.
* **Zero-Bloat Scope:** Focus strictly on Daily Safe Runway and current billing cycle; requests specifying `period=yearly` are rejected with HTTP 422 Unprocessable Entity.
* **Multipart Boundaries:** Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`; maximum payload size: 10MB ($10 \times 1024 \times 1024 = 10,485,760\text{ bytes}$); empty streams (0 bytes) rejected with HTTP 400.
* **Typography:** `tabular-nums` applied across all Rupiah amounts, percentages, and dates in the frontend.

---

### Task 1: RunwayService Analytics Methods (`rezekify/services/runway.py`)

**Files:**
- Modify: `rezekify/services/runway.py`
- Test: `tests/test_runway_service.py`

**Interfaces:**
- Consumes: `Session` from `sqlalchemy.orm`, `User`, `Transaction`, `LedgerEntry`, `Category`, `CategoryType`, `EntryType` from `rezekify.db.models`.
- Produces:
  ```python
  class DailyBreakdownItem(NamedTuple):
      date: date
      day_label: str  # 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'
      amount: Decimal
      safe_runway_threshold: Decimal
      is_over_budget: bool

  class DailySpendingBreakdownReport(NamedTuple):
      period: str  # 'daily'
      daily_safe_runway: Decimal
      total_spent_in_period: Decimal
      items: List[DailyBreakdownItem]

  class CategoryBreakdownItem(NamedTuple):
      category_id: UUID
      category_name: str
      amount: Decimal
      percentage: Decimal
      color: str

  class CategorySpendingBreakdownReport(NamedTuple):
      period: str  # 'monthly'
      cycle_start_date: date
      cycle_end_date: date
      total_spent: Decimal
      items: List[CategoryBreakdownItem]

  RunwayService.get_daily_spending_breakdown(self, user_id: UUID, days: int = 7, today: Optional[date] = None) -> DailySpendingBreakdownReport
  RunwayService.get_category_spending_breakdown(self, user_id: UUID, today: Optional[date] = None) -> CategorySpendingBreakdownReport
  ```

- [ ] **Step 1: Write the failing tests for RunwayService analytics methods**

Append the following test functions to `tests/test_runway_service.py`:

```python
from datetime import datetime, timezone, timedelta
from rezekify.db.models import (
    Category,
    CategoryType,
    EntryType,
    LedgerEntry,
    Transaction,
    User,
)
from rezekify.services.runway import (
    DailySpendingBreakdownReport,
    CategorySpendingBreakdownReport,
)


def test_get_daily_spending_breakdown_continuous_seven_days(db_session, sample_user):
    """Verifies continuous 7-day date sequence, zero-fill on quiet days, and safe runway benchmarking."""
    sample_user.monthly_cycle_day = 25
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("700000.00"),
    )
    cat_food = Category(
        user_id=sample_user.id,
        name="Makanan",
        category_type=CategoryType.EXPENSE,
    )
    db_session.add_all([acc, cat_food])
    db_session.commit()

    ref_date = date(2026, 9, 19)  # Saturday ('Sab')
    # Transactions on:
    # 2026-09-17 (Day -2): Rp 85.000 (Over budget vs 70.000)
    # 2026-09-19 (Today): Rp 45.000 (Under budget vs 70.000)
    # Remaining 5 days: 0
    t1 = Transaction(
        user_id=sample_user.id,
        description="Jajan Kamis",
        transaction_date=datetime(2026, 9, 17, 12, 0, tzinfo=timezone.utc),
    )
    t2 = Transaction(
        user_id=sample_user.id,
        description="Makan Sabtu",
        transaction_date=datetime(2026, 9, 19, 14, 30, tzinfo=timezone.utc),
    )
    db_session.add_all([t1, t2])
    db_session.flush()

    e1 = LedgerEntry(
        transaction_id=t1.id,
        user_id=sample_user.id,
        category_id=cat_food.id,
        account_id=acc.id,
        entry_type=EntryType.DEBIT,
        amount=Decimal("85000.00"),
    )
    e2 = LedgerEntry(
        transaction_id=t2.id,
        user_id=sample_user.id,
        category_id=cat_food.id,
        account_id=acc.id,
        entry_type=EntryType.DEBIT,
        amount=Decimal("45000.00"),
    )
    db_session.add_all([e1, e2])
    db_session.commit()

    service = RunwayService(db_session)
    report = service.get_daily_spending_breakdown(user_id=sample_user.id, days=7, today=ref_date)

    assert isinstance(report, DailySpendingBreakdownReport)
    assert report.period == "daily"
    assert len(report.items) == 7
    assert report.total_spent_in_period == Decimal("130000.00")

    # Day labels for 2026-09-13 (Min) to 2026-09-19 (Sab)
    expected_labels = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]
    for idx, item in enumerate(report.items):
        assert item.day_label == expected_labels[idx]
        assert item.date == ref_date - timedelta(days=6 - idx)

    # Check Day -2 (Kamis, 2026-09-17)
    item_kamis = report.items[4]
    assert item_kamis.amount == Decimal("85000.00")
    assert item_kamis.is_over_budget is True

    # Check Day -1 (Jumat, 2026-09-18) zero fill
    item_jumat = report.items[5]
    assert item_jumat.amount == Decimal("0.00")
    assert item_jumat.is_over_budget is False

    # Check Today (Sabtu, 2026-09-19)
    item_sabtu = report.items[6]
    assert item_sabtu.amount == Decimal("45000.00")
    assert item_sabtu.is_over_budget is False


def test_get_category_spending_breakdown_current_billing_cycle(db_session, sample_user):
    """Verifies monthly category aggregation, cycle boundary filtering, and percentage calculations."""
    sample_user.monthly_cycle_day = 1
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("2000000.00"),
    )
    cat_food = Category(
        user_id=sample_user.id,
        name="Makanan & Minuman",
        category_type=CategoryType.EXPENSE,
        color="#6366f1",
    )
    cat_transport = Category(
        user_id=sample_user.id,
        name="Transportasi",
        category_type=CategoryType.EXPENSE,
        color="#0ea5e9",
    )
    db_session.add_all([acc, cat_food, cat_transport])
    db_session.commit()

    ref_date = date(2026, 9, 19)

    # Current cycle transactions:
    # Food: Rp 300.000 (75.0%)
    # Transport: Rp 100.000 (25.0%)
    # Total: Rp 400.000
    t1 = Transaction(
        user_id=sample_user.id,
        description="Makan",
        transaction_date=datetime(2026, 9, 5, 10, 0, tzinfo=timezone.utc),
    )
    t2 = Transaction(
        user_id=sample_user.id,
        description="Bensin",
        transaction_date=datetime(2026, 9, 10, 8, 0, tzinfo=timezone.utc),
    )
    # Past cycle transaction (should be excluded):
    t_old = Transaction(
        user_id=sample_user.id,
        description="Makan Bulan Lalu",
        transaction_date=datetime(2026, 8, 25, 12, 0, tzinfo=timezone.utc),
    )
    db_session.add_all([t1, t2, t_old])
    db_session.flush()

    e1 = LedgerEntry(
        transaction_id=t1.id,
        user_id=sample_user.id,
        category_id=cat_food.id,
        account_id=acc.id,
        entry_type=EntryType.DEBIT,
        amount=Decimal("300000.00"),
    )
    e2 = LedgerEntry(
        transaction_id=t2.id,
        user_id=sample_user.id,
        category_id=cat_transport.id,
        account_id=acc.id,
        entry_type=EntryType.DEBIT,
        amount=Decimal("100000.00"),
    )
    e_old = LedgerEntry(
        transaction_id=t_old.id,
        user_id=sample_user.id,
        category_id=cat_food.id,
        account_id=acc.id,
        entry_type=EntryType.DEBIT,
        amount=Decimal("500000.00"),
    )
    db_session.add_all([e1, e2, e_old])
    db_session.commit()

    service = RunwayService(db_session)
    report = service.get_category_spending_breakdown(user_id=sample_user.id, today=ref_date)

    assert isinstance(report, CategorySpendingBreakdownReport)
    assert report.period == "monthly"
    assert report.cycle_start_date == date(2026, 9, 1)
    assert report.cycle_end_date == date(2026, 9, 19)
    assert report.total_spent == Decimal("400000.00")
    assert len(report.items) == 2

    # Sorted descending by amount: Food first, then Transport
    assert report.items[0].category_name == "Makanan & Minuman"
    assert report.items[0].amount == Decimal("300000.00")
    assert report.items[0].percentage == Decimal("75.0")
    assert report.items[0].color == "#6366f1"

    assert report.items[1].category_name == "Transportasi"
    assert report.items[1].amount == Decimal("100000.00")
    assert report.items[1].percentage == Decimal("25.0")
    assert report.items[1].color == "#0ea5e9"


def test_get_category_spending_breakdown_zero_expenses(db_session, sample_user):
    """Verifies that empty transaction history returns 0 total and empty list without division by zero."""
    service = RunwayService(db_session)
    report = service.get_category_spending_breakdown(user_id=sample_user.id, today=date(2026, 9, 19))

    assert report.total_spent == Decimal("0.00")
    assert report.items == []


def test_analytics_tenant_isolation(db_session, sample_user):
    """Verifies that other users' transactions are never leaked into daily or category reports."""
    other_user = User(
        email="stranger@rezekify.local",
        password_hash="hash_xyz",
        full_name="User Asing",
        monthly_cycle_day=1,
    )
    db_session.add(other_user)
    db_session.commit()

    cat_other = Category(
        user_id=other_user.id,
        name="Belanja Rahasia",
        category_type=CategoryType.EXPENSE,
    )
    acc_other = Account(
        user_id=other_user.id,
        name="Cash Asing",
        account_type=AccountType.CASH,
        current_balance=Decimal("999999.00"),
    )
    db_session.add_all([cat_other, acc_other])
    db_session.commit()

    t_other = Transaction(
        user_id=other_user.id,
        description="Transaksi Asing",
        transaction_date=datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc),
    )
    db_session.add(t_other)
    db_session.flush()

    e_other = LedgerEntry(
        transaction_id=t_other.id,
        user_id=other_user.id,
        category_id=cat_other.id,
        account_id=acc_other.id,
        entry_type=EntryType.DEBIT,
        amount=Decimal("500000.00"),
    )
    db_session.add(e_other)
    db_session.commit()

    service = RunwayService(db_session)
    daily_report = service.get_daily_spending_breakdown(user_id=sample_user.id, days=7, today=date(2026, 9, 19))
    category_report = service.get_category_spending_breakdown(user_id=sample_user.id, today=date(2026, 9, 19))

    assert daily_report.total_spent_in_period == Decimal("0.00")
    assert category_report.total_spent == Decimal("0.00")
    assert category_report.items == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_runway_service.py -k breakdown -v`
Expected: FAIL with `AttributeError: 'RunwayService' object has no attribute 'get_daily_spending_breakdown'`

- [ ] **Step 3: Implement analytics methods in `rezekify/services/runway.py`**

Modify `rezekify/services/runway.py` to add `DailyBreakdownItem`, `DailySpendingBreakdownReport`, `CategoryBreakdownItem`, `CategorySpendingBreakdownReport`, `INDONESIAN_DAY_LABELS`, and implement `get_daily_spending_breakdown` and `get_category_spending_breakdown`:

```python
"""Dynamic Runway Calculator & Spending Simulation Engine."""

from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal
from typing import Dict, List, NamedTuple, Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from rezekify.db.models import (
    Account,
    AccountType,
    Category,
    CategoryType,
    EntryType,
    LedgerEntry,
    Transaction,
    User,
    Vault,
    VaultType,
)

INDONESIAN_DAY_LABELS: Dict[int, str] = {
    0: "Sen",
    1: "Sel",
    2: "Rab",
    3: "Kam",
    4: "Jum",
    5: "Sab",
    6: "Min",
}


class UpcomingBill(NamedTuple):
    name: str
    target_amount: Decimal
    allocated_amount: Decimal
    target_date: date
    days_until_due: int


class RunwayReport(NamedTuple):
    total_liquid_cash: Decimal
    vault_locked_cash: Decimal
    operational_free_cash: Decimal
    days_remaining: int
    daily_safe_runway: Decimal
    health_status: str
    upcoming_bills: List[UpcomingBill]


class SimulationReport(NamedTuple):
    current_daily_runway: Decimal
    projected_daily_runway: Decimal
    daily_drop_amount: Decimal
    is_safe: bool
    advice: str


class DailyBreakdownItem(NamedTuple):
    date: date
    day_label: str
    amount: Decimal
    safe_runway_threshold: Decimal
    is_over_budget: bool


class DailySpendingBreakdownReport(NamedTuple):
    period: str
    daily_safe_runway: Decimal
    total_spent_in_period: Decimal
    items: List[DailyBreakdownItem]


class CategoryBreakdownItem(NamedTuple):
    category_id: UUID
    category_name: str
    amount: Decimal
    percentage: Decimal
    color: str


class CategorySpendingBreakdownReport(NamedTuple):
    period: str
    cycle_start_date: date
    cycle_end_date: date
    total_spent: Decimal
    items: List[CategoryBreakdownItem]


class RunwayService:
    """Computes deterministic daily safe runway and simulates purchase impact."""

    def __init__(self, db: Session):
        self.db = db

    def calculate_runway(self, user_id: UUID, today: Optional[date] = None) -> RunwayReport:
        if today is None:
            today = date.today()

        user = self.db.query(User).filter_by(id=user_id).one()

        liquid_sum = (
            self.db.query(func.coalesce(func.sum(Account.current_balance), Decimal("0.00")))
            .filter(
                Account.user_id == user_id,
                Account.account_type.in_([AccountType.CASH, AccountType.BANK, AccountType.EWALLET]),
            )
            .scalar()
        )

        vault_sum = (
            self.db.query(func.coalesce(func.sum(Vault.allocated_amount), Decimal("0.00")))
            .filter(Vault.user_id == user_id)
            .scalar()
        )

        operational_free = max(Decimal("0.00"), liquid_sum - vault_sum)

        cycle_day = user.monthly_cycle_day
        if today.day < cycle_day:
            days_remaining = cycle_day - today.day
        else:
            _, days_in_current_month = monthrange(today.year, today.month)
            days_remaining = (days_in_current_month - today.day) + cycle_day

        days_remaining = max(1, days_remaining)
        daily_safe = (operational_free / Decimal(str(days_remaining))).quantize(Decimal("0.01"))

        if operational_free <= Decimal("0.00"):
            status = "CRITICAL"
        elif daily_safe < Decimal("30000.00"):
            status = "WARNING"
        else:
            status = "HEALTHY"

        upcoming_bills = self.get_upcoming_bills(user_id=user_id, today=today)

        return RunwayReport(
            total_liquid_cash=liquid_sum,
            vault_locked_cash=vault_sum,
            operational_free_cash=operational_free,
            days_remaining=days_remaining,
            daily_safe_runway=daily_safe,
            health_status=status,
            upcoming_bills=upcoming_bills,
        )

    def get_upcoming_bills(self, user_id: UUID, today: Optional[date] = None) -> List[UpcomingBill]:
        if today is None:
            today = date.today()

        fixed_bills = (
            self.db.query(Vault)
            .filter(
                Vault.user_id == user_id,
                Vault.vault_type == VaultType.FIXED_BILL,
                Vault.allocated_amount < Vault.target_amount,
                Vault.target_date.isnot(None),
                Vault.target_date >= today,
            )
            .order_by(Vault.target_date.asc())
            .all()
        )

        upcoming_bills = []
        for bill in fixed_bills:
            days_due = (bill.target_date - today).days
            if 0 <= days_due <= 7:
                upcoming_bills.append(
                    UpcomingBill(
                        name=bill.name,
                        target_amount=bill.target_amount,
                        allocated_amount=bill.allocated_amount,
                        target_date=bill.target_date,
                        days_until_due=days_due,
                    )
                )

        return upcoming_bills

    def simulate_purchase(
        self, user_id: UUID, planned_amount: Decimal, today: Optional[date] = None
    ) -> SimulationReport:
        current = self.calculate_runway(user_id, today)
        projected_free = max(Decimal("0.00"), current.operational_free_cash - planned_amount)
        projected_daily = (projected_free / Decimal(str(current.days_remaining))).quantize(Decimal("0.01"))
        drop = current.daily_safe_runway - projected_daily

        is_safe = projected_daily >= Decimal("30000.00")
        advice = (
            f"Pembelian sebesar Rp {planned_amount:,.0f} aman dilakukan. "
            f"Jatah harian Anda tersisa Rp {projected_daily:,.0f}/hari."
            if is_safe
            else f"Peringatan: Transaksi ini memangkas jatah belanja harian Anda menjadi Rp {projected_daily:,.0f}/hari "
            f"(turun Rp {drop:,.0f}/hari) selama {current.days_remaining} hari ke depan."
        )

        return SimulationReport(
            current_daily_runway=current.daily_safe_runway,
            projected_daily_runway=projected_daily,
            daily_drop_amount=drop,
            is_safe=is_safe,
            advice=advice,
        )

    def get_daily_spending_breakdown(
        self, user_id: UUID, days: int = 7, today: Optional[date] = None
    ) -> DailySpendingBreakdownReport:
        """Computes continuous daily spending over the last N days benchmarked against safe runway."""
        if today is None:
            today = date.today()

        start_date = today - timedelta(days=days - 1)
        end_date = today

        rows = (
            self.db.query(
                func.date(Transaction.transaction_date).label("tx_date"),
                func.coalesce(func.sum(LedgerEntry.amount), Decimal("0.00")).label("total_amount"),
            )
            .join(LedgerEntry, LedgerEntry.transaction_id == Transaction.id)
            .join(Category, LedgerEntry.category_id == Category.id)
            .filter(
                Transaction.user_id == user_id,
                LedgerEntry.entry_type == EntryType.DEBIT,
                Category.category_type == CategoryType.EXPENSE,
                func.date(Transaction.transaction_date) >= start_date.isoformat(),
                func.date(Transaction.transaction_date) <= end_date.isoformat(),
            )
            .group_by(func.date(Transaction.transaction_date))
            .all()
        )

        date_totals: Dict[date, Decimal] = {}
        for row in rows:
            d = date.fromisoformat(row.tx_date) if isinstance(row.tx_date, str) else row.tx_date
            date_totals[d] = Decimal(str(row.total_amount))

        current_runway = self.calculate_runway(user_id=user_id, today=today)
        safe_threshold = current_runway.daily_safe_runway

        items: List[DailyBreakdownItem] = []
        total_spent = Decimal("0.00")

        for i in range(days):
            cur_date = start_date + timedelta(days=i)
            day_amount = date_totals.get(cur_date, Decimal("0.00"))
            total_spent += day_amount
            is_over = day_amount > safe_threshold
            items.append(
                DailyBreakdownItem(
                    date=cur_date,
                    day_label=INDONESIAN_DAY_LABELS[cur_date.weekday()],
                    amount=day_amount,
                    safe_runway_threshold=safe_threshold,
                    is_over_budget=is_over,
                )
            )

        return DailySpendingBreakdownReport(
            period="daily",
            daily_safe_runway=safe_threshold,
            total_spent_in_period=total_spent,
            items=items,
        )

    def get_category_spending_breakdown(
        self, user_id: UUID, today: Optional[date] = None
    ) -> CategorySpendingBreakdownReport:
        """Computes spending distribution grouped by category for the current billing cycle."""
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

        rows = (
            self.db.query(
                Category.id.label("category_id"),
                Category.name.label("category_name"),
                Category.color.label("category_color"),
                func.coalesce(func.sum(LedgerEntry.amount), Decimal("0.00")).label("total_amount"),
            )
            .join(LedgerEntry, LedgerEntry.category_id == Category.id)
            .join(Transaction, LedgerEntry.transaction_id == Transaction.id)
            .filter(
                Transaction.user_id == user_id,
                LedgerEntry.entry_type == EntryType.DEBIT,
                Category.category_type == CategoryType.EXPENSE,
                func.date(Transaction.transaction_date) >= cycle_start.isoformat(),
                func.date(Transaction.transaction_date) <= cycle_end.isoformat(),
            )
            .group_by(Category.id, Category.name, Category.color)
            .order_by(func.sum(LedgerEntry.amount).desc())
            .all()
        )

        total_spent = sum((Decimal(str(r.total_amount)) for r in rows), Decimal("0.00"))
        items: List[CategoryBreakdownItem] = []

        if total_spent > Decimal("0.00"):
            for r in rows:
                amt = Decimal(str(r.total_amount))
                pct = ((amt / total_spent) * Decimal("100")).quantize(Decimal("0.1"))
                items.append(
                    CategoryBreakdownItem(
                        category_id=r.category_id,
                        category_name=r.category_name,
                        amount=amt,
                        percentage=pct,
                        color=r.category_color or "#6366f1",
                    )
                )

        return CategorySpendingBreakdownReport(
            period="monthly",
            cycle_start_date=cycle_start,
            cycle_end_date=cycle_end,
            total_spent=total_spent,
            items=items,
        )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_runway_service.py -v`
Expected: PASS (all tests pass)

- [ ] **Step 5: Commit**

```bash
git add rezekify/services/runway.py tests/test_runway_service.py
git commit -m "feat(analytics): implement deterministic daily and category spending breakdowns in RunwayService"
```

---

### Task 2: Backend Analytics REST Router (`rezekify/api/v1/dashboard_router.py`)

**Files:**
- Modify: `rezekify/api/v1/dashboard_router.py`
- Test: `tests/test_api_endpoints.py`

**Interfaces:**
- Consumes: `RunwayService.get_daily_spending_breakdown`, `RunwayService.get_category_spending_breakdown`, `get_current_user`, `get_db`.
- Produces:
  ```python
  class DailySpendingItemModel(BaseModel):
      date: date
      day_label: str
      amount: Decimal
      safe_runway_threshold: Decimal
      is_over_budget: bool

  class DailySpendingResponse(BaseModel):
      period: Literal["daily"]
      daily_safe_runway: Decimal
      total_spent_in_period: Decimal
      items: List[DailySpendingItemModel]

  class CategorySpendingItemModel(BaseModel):
      category_id: UUID
      category_name: str
      amount: Decimal
      percentage: Decimal
      color: str

  class MonthlySpendingResponse(BaseModel):
      period: Literal["monthly"]
      cycle_start_date: date
      cycle_end_date: date
      total_spent: Decimal
      items: List[CategorySpendingItemModel]

  GET /api/v1/analytics/spending-breakdown?period=(daily|monthly)
  ```

- [ ] **Step 1: Write the failing tests for spending breakdown endpoint**

Append the following test functions to `tests/test_api_endpoints.py`:

```python
def test_analytics_spending_breakdown_full_payload(sample_user, db_session):
    """Tests that GET /api/v1/analytics/spending-breakdown returns valid Daily and Monthly schemas."""
    from rezekify.core.security import create_access_token
    from rezekify.db.models import Category, CategoryType, EntryType, LedgerEntry, Transaction
    from datetime import datetime, timezone

    token = create_access_token({"sub": str(sample_user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Seed an account, category, and an expense
    acc = Account(
        user_id=sample_user.id,
        name="Bank Mandiri",
        account_type=AccountType.BANK,
        current_balance=Decimal("1500000.00"),
    )
    cat = Category(
        user_id=sample_user.id,
        name="Kebutuhan Rumah",
        category_type=CategoryType.EXPENSE,
        color="#10b981",
    )
    db_session.add_all([acc, cat])
    db_session.commit()

    tx = Transaction(
        user_id=sample_user.id,
        description="Belanja Sabun",
        transaction_date=datetime.now(timezone.utc),
    )
    db_session.add(tx)
    db_session.flush()

    le = LedgerEntry(
        transaction_id=tx.id,
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=cat.id,
        entry_type=EntryType.DEBIT,
        amount=Decimal("50000.00"),
    )
    db_session.add(le)
    db_session.commit()

    # 1. Test Daily Breakdown
    res_daily = client.get("/api/v1/analytics/spending-breakdown?period=daily", headers=headers)
    assert res_daily.status_code == 200
    data_daily = res_daily.json()
    assert data_daily["period"] == "daily"
    assert "daily_safe_runway" in data_daily
    assert "total_spent_in_period" in data_daily
    assert len(data_daily["items"]) == 7
    # Verify item schema
    item = data_daily["items"][-1]
    assert "date" in item
    assert "day_label" in item
    assert "amount" in item
    assert "safe_runway_threshold" in item
    assert "is_over_budget" in item
    assert isinstance(item["is_over_budget"], bool)

    # 2. Test Monthly Breakdown
    res_monthly = client.get("/api/v1/analytics/spending-breakdown?period=monthly", headers=headers)
    assert res_monthly.status_code == 200
    data_monthly = res_monthly.json()
    assert data_monthly["period"] == "monthly"
    assert "cycle_start_date" in data_monthly
    assert "cycle_end_date" in data_monthly
    assert Decimal(str(data_monthly["total_spent"])) >= Decimal("50000.00")
    assert len(data_monthly["items"]) >= 1
    cat_item = data_monthly["items"][0]
    assert cat_item["category_name"] == "Kebutuhan Rumah"
    assert Decimal(str(cat_item["percentage"])) == Decimal("100.0")
    assert cat_item["color"] == "#10b981"

    # 3. Test Yearly Rejection (Zero-Bloat Invariant)
    res_yearly = client.get("/api/v1/analytics/spending-breakdown?period=yearly", headers=headers)
    assert res_yearly.status_code == 422
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_api_endpoints.py -k spending_breakdown_full_payload -v`
Expected: FAIL (because current stub returns static `{"period": period, "breakdown": []}`)

- [ ] **Step 3: Update `rezekify/api/v1/dashboard_router.py` with Pydantic models and real analytics logic**

Modify `rezekify/api/v1/dashboard_router.py` to define strict schemas and query `RunwayService`:

```python
"""Dashboard and Analytics Router."""

from datetime import date
from decimal import Decimal
from typing import List, Literal, Optional, Union
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from rezekify.agent.key_pool import RotaryKeyPool
from rezekify.agent.orchestrator import AgentOrchestrator
from rezekify.api.deps import get_current_user, get_db
from rezekify.db.models import User
from rezekify.services.runway import RunwayService

dashboard_router = APIRouter()
analytics_router = APIRouter()


class UpcomingBillResponse(BaseModel):
    name: str
    target_amount: Decimal
    allocated_amount: Decimal
    target_date: date
    days_until_due: int


class DashboardSummaryResponse(BaseModel):
    total_liquid_cash: Decimal
    vault_locked_cash: Decimal
    operational_free_cash: Decimal
    days_remaining: int
    daily_safe_runway: Decimal
    health_status: str
    upcoming_bills: List[UpcomingBillResponse]


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


class DailySpendingItemModel(BaseModel):
    date: date
    day_label: str = Field(..., description="Localized Indonesian day abbreviation (e.g. Sen, Sel, Rab)")
    amount: Decimal = Field(..., description="Total expenses recorded on this day")
    safe_runway_threshold: Decimal = Field(..., description="Benchmark daily safe runway threshold")
    is_over_budget: bool = Field(..., description="True if amount exceeds safe_runway_threshold")


class DailySpendingResponse(BaseModel):
    period: Literal["daily"]
    daily_safe_runway: Decimal
    total_spent_in_period: Decimal
    items: List[DailySpendingItemModel]


class CategorySpendingItemModel(BaseModel):
    category_id: UUID
    category_name: str
    amount: Decimal
    percentage: Decimal = Field(..., description="Percentage of total cycle spending, e.g. 42.5")
    color: str


class MonthlySpendingResponse(BaseModel):
    period: Literal["monthly"]
    cycle_start_date: date
    cycle_end_date: date
    total_spent: Decimal
    items: List[CategorySpendingItemModel]


SpendingBreakdownResponse = Union[DailySpendingResponse, MonthlySpendingResponse]


@dashboard_router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Calculates deterministic liquid free cash and dynamic daily safe runway."""
    service = RunwayService(db)
    report = service.calculate_runway(user_id=current_user.id)
    return DashboardSummaryResponse(
        total_liquid_cash=report.total_liquid_cash,
        vault_locked_cash=report.vault_locked_cash,
        operational_free_cash=report.operational_free_cash,
        days_remaining=report.days_remaining,
        daily_safe_runway=report.daily_safe_runway,
        health_status=report.health_status,
        upcoming_bills=[
            UpcomingBillResponse(
                name=b.name,
                target_amount=b.target_amount,
                allocated_amount=b.allocated_amount,
                target_date=b.target_date,
                days_until_due=b.days_until_due,
            )
            for b in report.upcoming_bills
        ],
    )


@dashboard_router.post("/ai-chat", response_model=ChatResponse)
def ai_chat_omni_input(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Processes natural language omni-input into ledger mutations."""
    orchestrator = AgentOrchestrator(db=db, key_pool=RotaryKeyPool.from_env("GEMINI_API_KEYS"))
    reply = orchestrator.handle_message(user_id=current_user.id, text=req.message)
    return ChatResponse(reply=reply)


@analytics_router.get("/spending-breakdown", response_model=SpendingBreakdownResponse)
def get_spending_breakdown(
    period: str = Query("daily", pattern="^(daily|monthly)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns spending analytics for either 'daily' (7-day trend vs runway)
    or 'monthly' (category breakdown for active cycle). Rejects yearly queries (422) for zero-bloat efficiency."""
    service = RunwayService(db)
    if period == "daily":
        daily_report = service.get_daily_spending_breakdown(user_id=current_user.id, days=7)
        return DailySpendingResponse(
            period="daily",
            daily_safe_runway=daily_report.daily_safe_runway,
            total_spent_in_period=daily_report.total_spent_in_period,
            items=[
                DailySpendingItemModel(
                    date=item.date,
                    day_label=item.day_label,
                    amount=item.amount,
                    safe_runway_threshold=item.safe_runway_threshold,
                    is_over_budget=item.is_over_budget,
                )
                for item in daily_report.items
            ],
        )

    monthly_report = service.get_category_spending_breakdown(user_id=current_user.id)
    return MonthlySpendingResponse(
        period="monthly",
        cycle_start_date=monthly_report.cycle_start_date,
        cycle_end_date=monthly_report.cycle_end_date,
        total_spent=monthly_report.total_spent,
        items=[
            CategorySpendingItemModel(
                category_id=item.category_id,
                category_name=item.category_name,
                amount=item.amount,
                percentage=item.percentage,
                color=item.color,
            )
            for item in monthly_report.items
        ],
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_api_endpoints.py -k spending_breakdown -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/api/v1/dashboard_router.py tests/test_api_endpoints.py
git commit -m "feat(api): expose deterministic spending breakdown endpoints for daily and monthly periods"
```

---

### Task 3: Backend Multipart Web Receipt Endpoint (`POST /api/v1/dashboard/ai-receipt`)

**Files:**
- Modify: `rezekify/agent/runtime.py`
- Modify: `rezekify/agent/orchestrator.py`
- Modify: `rezekify/api/v1/dashboard_router.py`
- Test: `tests/test_api_endpoints.py`

**Interfaces:**
- Consumes: `UploadFile`, `File`, `Form` from `fastapi`, `AgentOrchestrator`, `RotaryKeyPool`.
- Produces:
  ```python
  class ReceiptExtractedData(BaseModel):
      action: str
      amount: Decimal
      account_name: Optional[str] = None
      category_name: Optional[str] = None
      note: Optional[str] = None

  class ReceiptUploadResponse(BaseModel):
      reply: str
      transaction_id: Optional[UUID] = None
      extracted_data: ReceiptExtractedData

  POST /api/v1/dashboard/ai-receipt
  ```

- [ ] **Step 1: Write the failing tests for `POST /api/v1/dashboard/ai-receipt`**

Append the following test functions to `tests/test_api_endpoints.py`:

```python
from unittest.mock import patch
import io


def test_ai_receipt_upload_success(sample_user, db_session):
    """Tests successful multipart upload with mocked vision OCR returning balanced transaction."""
    from rezekify.core.security import create_access_token

    token = create_access_token({"sub": str(sample_user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # Add default account
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("500000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    mock_entities = {
        "action": "expense",
        "amount": 48500,
        "account_name": "BCA",
        "category_name": "Makanan & Minuman",
        "note": "Kopi Kenangan & Roti",
    }

    # Mock ReActAgent.process_input
    with patch("rezekify.agent.runtime.ReActAgent.process_input", return_value=mock_entities):
        file_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF" + b"fake_jpeg_data"
        files = {"file": ("receipt.jpg", io.BytesIO(file_bytes), "image/jpeg")}
        data = {"message": "beli kopi pagi"}

        res = client.post("/api/v1/dashboard/ai-receipt", headers=headers, files=files, data=data)

    assert res.status_code == 200
    res_data = res.json()
    assert "reply" in res_data
    assert "Tercatat" in res_data["reply"]
    assert res_data["transaction_id"] is not None
    assert res_data["extracted_data"]["action"] == "expense"
    assert Decimal(str(res_data["extracted_data"]["amount"])) == Decimal("48500.00")
    assert res_data["extracted_data"]["account_name"] == "BCA"
    assert res_data["extracted_data"]["category_name"] == "Makanan & Minuman"


def test_ai_receipt_upload_invalid_mime(sample_user):
    """Tests that non-image MIME types (e.g. PDF) are rejected with HTTP 400."""
    from rezekify.core.security import create_access_token

    token = create_access_token({"sub": str(sample_user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    files = {"file": ("statement.pdf", io.BytesIO(b"%PDF-1.4..."), "application/pdf")}
    res = client.post("/api/v1/dashboard/ai-receipt", headers=headers, files=files)
    assert res.status_code == 400
    assert "Format file tidak didukung" in res.json()["detail"]


def test_ai_receipt_upload_size_limit_exceeded(sample_user):
    """Tests that payloads exceeding 10MB are rejected with HTTP 413."""
    from rezekify.core.security import create_access_token

    token = create_access_token({"sub": str(sample_user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # 10.5 MB payload
    large_bytes = b"0" * (11 * 1024 * 1024)
    files = {"file": ("huge_receipt.png", io.BytesIO(large_bytes), "image/png")}
    res = client.post("/api/v1/dashboard/ai-receipt", headers=headers, files=files)
    assert res.status_code == 413
    assert "melebihi batas maksimal 10MB" in res.json()["detail"]


def test_ai_receipt_upload_empty_file(sample_user):
    """Tests that empty 0-byte file uploads are rejected with HTTP 400."""
    from rezekify.core.security import create_access_token

    token = create_access_token({"sub": str(sample_user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    files = {"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")}
    res = client.post("/api/v1/dashboard/ai-receipt", headers=headers, files=files)
    assert res.status_code == 400
    assert "File yang diunggah kosong" in res.json()["detail"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_api_endpoints.py -k ai_receipt -v`
Expected: FAIL with 404 Not Found (endpoint not yet registered)

- [ ] **Step 3: Update `rezekify/agent/runtime.py` to support dynamic MIME types**

Modify `process_input` in `rezekify/agent/runtime.py` to accept `mime_type: str = "image/jpeg"`:

```python
    def process_input(
        self,
        user_id: UUID,
        text: str,
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/jpeg",
    ) -> Dict[str, Any]:
        """Processes natural language text or receipt image into structured transaction entities."""
        for _ in range(len(self.gemini_pool.keys)):
            key = self.gemini_pool.get_current_key()
            try:
                client = self.gemini_pool.get_gemini_client(api_key=key)
                contents = [SYSTEM_PROMPT, f"Input pengguna: {text}"]
                if image_bytes:
                    from google.genai import types
                    contents.append(
                        types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
                    )

                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=contents,
                )
                return self._clean_json_response(response.text)
            except Exception as e:
                err_str = str(e).lower()
                if "429" in err_str or "resource_exhausted" in err_str or "rate limit" in err_str:
                    self.gemini_pool.report_rate_limit(key)
                    continue
                break

        if self.groq_pool and self.groq_pool.keys and not image_bytes:
            return self._fallback_groq(text)

        return {"action": "unknown", "text": text}
```

- [ ] **Step 4: Update `rezekify/agent/orchestrator.py` to add `handle_receipt`**

Add `handle_receipt` method to `AgentOrchestrator` in `rezekify/agent/orchestrator.py`:

```python
    def handle_receipt(
        self,
        user_id: UUID,
        image_bytes: bytes,
        mime_type: str = "image/jpeg",
        user_note: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Processes receipt image via vision OCR, records double-entry transaction, and returns structured result."""
        prompt_text = user_note or "Struk belanja"
        if self.agent:
            entities = self.agent.process_input(
                user_id=user_id,
                text=prompt_text,
                image_bytes=image_bytes,
                mime_type=mime_type,
            )
        else:
            entities = {"action": "unknown", "text": prompt_text}

        action = entities.get("action")
        if action == "expense":
            amount = Decimal(str(entities.get("amount", 0)))
            account = self._resolve_account(user_id, entities.get("account_name"))
            if not account:
                return {
                    "reply": "❌ Gagal: Anda belum memiliki akun keuangan. Silakan tambahkan akun terlebih dahulu.",
                    "transaction_id": None,
                    "extracted_data": {
                        "action": "expense",
                        "amount": amount,
                        "account_name": None,
                        "category_name": None,
                        "note": prompt_text,
                    },
                }

            category = self._resolve_or_create_category(
                user_id, entities.get("category_name"), CategoryType.EXPENSE
            )
            note = entities.get("note") or prompt_text

            tx = self.ledger.record_expense(
                user_id=user_id,
                account_id=account.id,
                category_id=category.id,
                amount=amount,
                description=note,
                source_channel="WEB_AI",
                raw_input_text=prompt_text,
            )

            runway = self.runway.calculate_runway(user_id)
            reply = (
                f"✅ **Tercatat dari Struk:** Rp {amount:,.0f} ({note}) via {account.name}.\n"
                f"📊 **Sisa Jatah Belanja Hari Ini:** Rp {runway.daily_safe_runway:,.0f} "
                f"({runway.days_remaining} hari menuju siklus baru)."
            )

            return {
                "reply": reply,
                "transaction_id": tx.id,
                "extracted_data": {
                    "action": "expense",
                    "amount": amount,
                    "account_name": account.name,
                    "category_name": category.name,
                    "note": note,
                },
            }

        return {
            "reply": "⚠️ Struk tidak terbaca jelas. Pastikan foto terang dan menampilkan total belanja.",
            "transaction_id": None,
            "extracted_data": {
                "action": "unknown",
                "amount": Decimal("0.00"),
                "account_name": None,
                "category_name": None,
                "note": prompt_text,
            },
        }
```

- [ ] **Step 5: Register `POST /api/v1/dashboard/ai-receipt` in `rezekify/api/v1/dashboard_router.py`**

Add endpoint implementation and models in `rezekify/api/v1/dashboard_router.py`:

```python
from fastapi import File, Form, UploadFile

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


class ReceiptExtractedData(BaseModel):
    action: str
    amount: Decimal
    account_name: Optional[str] = None
    category_name: Optional[str] = None
    note: Optional[str] = None


class ReceiptUploadResponse(BaseModel):
    reply: str
    transaction_id: Optional[UUID] = None
    extracted_data: ReceiptExtractedData


@dashboard_router.post("/ai-receipt", response_model=ReceiptUploadResponse)
async def ai_receipt_upload(
    file: UploadFile = File(...),
    message: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Processes uploaded receipt image (JPEG, PNG, WebP up to 10MB) through Gemini 2.5 Flash Vision."""
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Format file tidak didukung. Harap unggah struk berformat JPEG, PNG, atau WebP.",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(
            status_code=400,
            detail="File yang diunggah kosong.",
        )
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Ukuran file melebihi batas maksimal 10MB.",
        )

    orchestrator = AgentOrchestrator(db=db, key_pool=RotaryKeyPool.from_env("GEMINI_API_KEYS"))
    result = orchestrator.handle_receipt(
        user_id=current_user.id,
        image_bytes=content,
        mime_type=file.content_type,
        user_note=message,
    )

    return ReceiptUploadResponse(
        reply=result["reply"],
        transaction_id=result["transaction_id"],
        extracted_data=ReceiptExtractedData(
            action=result["extracted_data"]["action"],
            amount=Decimal(str(result["extracted_data"]["amount"])),
            account_name=result["extracted_data"]["account_name"],
            category_name=result["extracted_data"]["category_name"],
            note=result["extracted_data"]["note"],
        ),
    )
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pytest tests/test_api_endpoints.py -k ai_receipt -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add rezekify/agent/runtime.py rezekify/agent/orchestrator.py rezekify/api/v1/dashboard_router.py tests/test_api_endpoints.py
git commit -m "feat(api): add multipart receipt ingestion endpoint with MIME and size boundary enforcement"
```

---

### Task 4: Frontend UI Library & Motion Primitives Integration (`frontend/`)

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/tailwind.config.js`
- Modify: `frontend/src/test/setup.ts`

**Interfaces:**
- Consumes: `@heroui/react@^2.8.10`, `@heroui/theme@^2.4.15`, `framer-motion@^12.4.7`.
- Produces: Tailwind configuration supporting HeroUI tokens and custom styling, verified build without React 18 peer dependency conflicts.

- [ ] **Step 1: Update `frontend/src/test/setup.ts` to mock URL.createObjectURL and URL.revokeObjectURL**

Modify `frontend/src/test/setup.ts` to safely mock object URLs in jsdom:

```typescript
import '@testing-library/jest-dom';
import { vi } from 'vitest';

if (typeof window !== 'undefined') {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = vi.fn((file: File | Blob) => `blob:mock-url-${file.name || 'file'}`);
  }
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = vi.fn();
  }
}
```

- [ ] **Step 2: Update `frontend/package.json` dependencies**

In `frontend/package.json`, add `@heroui/react` and `@heroui/theme` under `"dependencies"`:

```json
    "@heroui/react": "^2.8.10",
    "@heroui/theme": "^2.4.15",
```

Install via PowerShell:
```powershell
cd frontend; npm install --save @heroui/react@^2.8.10 @heroui/theme@^2.4.15
```

- [ ] **Step 3: Update `frontend/tailwind.config.js`**

Modify `frontend/tailwind.config.js` to include the HeroUI theme content path and plugin:

```javascript
import { heroui } from "@heroui/react";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          900: '#312e81',
          950: '#1e1b4b',
        },
        runway: {
          healthy: '#10b981',
          warning: '#f59e0b',
          critical: '#f43f5e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow-indigo': '0 0 25px -5px rgba(99, 102, 241, 0.15)',
        'glow-emerald': '0 0 25px -5px rgba(16, 185, 129, 0.15)',
        'glow-amber': '0 0 25px -5px rgba(245, 158, 11, 0.15)',
        'glow-rose': '0 0 25px -5px rgba(244, 63, 94, 0.15)',
      },
    },
  },
  plugins: [heroui()],
};
```

- [ ] **Step 4: Verify TypeScript compilation and test execution**

Run in PowerShell:
```powershell
cd frontend; npx tsc --noEmit; npm run test
```
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/tailwind.config.js frontend/src/test/setup.ts
git commit -m "feat(frontend): integrate HeroUI components and motion primitives with React 18 compatibility"
```

---

### Task 5: Frontend OmniInputHero Enhancement (`frontend/src/components/OmniInputHero.tsx`)

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/components/OmniInputHero.tsx`
- Test: `frontend/src/__tests__/OmniInputHero.test.tsx`

**Interfaces:**
- Consumes:
  ```typescript
  interface OmniInputHeroProps {
    onSubmit: (payload: { text: string; file: File | null }) => Promise<void> | void;
    isLoading: boolean;
  }
  ```
- Produces:
  - Drag-and-drop file dropzone with active visual feedback (`isDraggingOver`).
  - Staged file thumbnail pill with file size and "Hapus" control.
  - Safe memory cleanup via `URL.revokeObjectURL`.

- [ ] **Step 1: Update `frontend/src/types/api.ts` with receipt and analytics contracts**

Append the following contracts to `frontend/src/types/api.ts`:

```typescript
export interface ReceiptExtractedData {
  action: string;
  amount: number;
  account_name?: string | null;
  category_name?: string | null;
  note?: string | null;
}

export interface ReceiptUploadResponse {
  reply: string;
  transaction_id?: string | null;
  extracted_data: ReceiptExtractedData;
}

export interface DailySpendingItemModel {
  date: string;
  day_label: string;
  amount: number;
  safe_runway_threshold: number;
  is_over_budget: boolean;
}

export interface DailySpendingResponse {
  period: 'daily';
  daily_safe_runway: number;
  total_spent_in_period: number;
  items: DailySpendingItemModel[];
}

export interface CategorySpendingItemModel {
  category_id: string;
  category_name: string;
  amount: number;
  percentage: number;
  color: string;
}

export interface MonthlySpendingResponse {
  period: 'monthly';
  cycle_start_date: string;
  cycle_end_date: string;
  total_spent: number;
  items: CategorySpendingItemModel[];
}

export type SpendingBreakdownResponse = DailySpendingResponse | MonthlySpendingResponse;
```

- [ ] **Step 2: Write tests in `frontend/src/__tests__/OmniInputHero.test.tsx`**

Replace `frontend/src/__tests__/OmniInputHero.test.tsx` with:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OmniInputHero } from '../components/OmniInputHero';

describe('OmniInputHero Component', () => {
  it('calls onSubmit with user natural language input when submitted', () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const input = screen.getByPlaceholderText(/Ketik pengeluaran santai/i);
    fireEvent.change(input, { target: { value: 'beli bensin 35rb bca' } });
    fireEvent.submit(input);

    expect(handleSubmit).toHaveBeenCalledWith({ text: 'beli bensin 35rb bca', file: null });
  });

  it('stages file and renders thumbnail pill on file input selection', () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const file = new File(['mock_image_data'], 'struk_kopi.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByText(/struk_kopi.jpg/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hapus lampiran struk/i })).toBeInTheDocument();
  });

  it('removes staged file when Hapus button is clicked', () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const file = new File(['mock_image_data'], 'struk_kopi.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(screen.getByText(/struk_kopi.jpg/i)).toBeInTheDocument();

    const removeBtn = screen.getByRole('button', { name: /Hapus lampiran struk/i });
    fireEvent.click(removeBtn);

    expect(screen.queryByText(/struk_kopi.jpg/i)).not.toBeInTheDocument();
  });

  it('handles drag-over and dropzone file staging', () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const dropzone = screen.getByTestId('omni-dropzone');
    const file = new File(['mock_bytes'], 'struk_makan.png', { type: 'image/png' });

    fireEvent.dragOver(dropzone);
    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(screen.getByText(/struk_makan.png/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd frontend; npm run test -- src/__tests__/OmniInputHero.test.tsx`
Expected: FAIL (missing `data-testid="omni-dropzone"`, signature mismatch on `onSubmit`)

- [ ] **Step 4: Implement enhanced `OmniInputHero.tsx`**

Modify `frontend/src/components/OmniInputHero.tsx`:

```tsx
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Sparkles, Camera, ArrowRight, Loader2, X, UploadCloud } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  onSubmit: (payload: { text: string; file: File | null }) => Promise<void> | void;
  isLoading: boolean;
}

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const OmniInputHero: React.FC<Props> = ({ onSubmit, isLoading }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    try {
      return URL.createObjectURL(file);
    } catch {
      return null;
    }
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelection = (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (!ALLOWED_MIME_TYPES.includes(selectedFile.type)) {
      alert('Format file tidak didukung. Harap pilih gambar JPEG, PNG, atau WebP.');
      return;
    }
    setFile(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !file) return;
    onSubmit({ text: text.trim(), file });
    setText('');
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      data-testid="omni-dropzone"
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`p-6 md:p-8 rounded-3xl shadow-2xl transition-all mb-8 relative overflow-hidden text-white ${
        isDraggingOver
          ? 'bg-indigo-950/80 border-2 border-dashed border-indigo-400 shadow-indigo-500/20 scale-[1.01]'
          : 'bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-950 border border-indigo-500/25'
      }`}
    >
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

      <div className="flex items-center justify-between gap-2 mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
          <span className="text-xs md:text-sm font-semibold tracking-wider uppercase text-indigo-300">
            Rezekify AI Omni-Input (Pencatatan Otomatis)
          </span>
        </div>
        <span className="text-[11px] text-slate-400 hidden sm:inline">
          Teks Bebas &middot; Drag-and-Drop Struk &middot; Multimodal Vision OCR
        </span>
      </div>

      <form onSubmit={handleFormSubmit} className="relative flex items-center z-10">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='Ketik pengeluaran santai, misal: "tadi jajan bakso 25rb pake gopay"...'
          disabled={isLoading}
          className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl px-5 py-4 text-sm md:text-base placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/80 shadow-inner pr-32 transition-all"
        />
        <div className="absolute right-2.5 flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileSelection(e.target.files?.[0] || null)}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`p-2.5 rounded-xl transition-all ${
              file
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'hover:bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Unggah Foto Struk Kasir"
          >
            <Camera className="w-5 h-5" />
          </button>
          <button
            type="submit"
            disabled={isLoading || (!text.trim() && !file)}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 active:scale-95"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
          </button>
        </div>
      </form>

      <AnimatePresence>
        {file && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="mt-3 flex items-center gap-3 bg-indigo-950/70 border border-indigo-500/40 px-3 py-2 rounded-xl w-fit relative z-10 shadow-lg"
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Pratinjau Struk"
                className="w-10 h-10 object-cover rounded-lg border border-indigo-400/40 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 bg-indigo-900/60 rounded-lg flex items-center justify-center shrink-0">
                <UploadCloud className="w-5 h-5 text-indigo-300" />
              </div>
            )}
            <div className="text-xs">
              <p className="font-semibold text-white max-w-[200px] truncate">{file.name}</p>
              <p className="text-[11px] text-indigo-300">{(file.size / 1024).toFixed(0)} KB &middot; Siap diproses</p>
            </div>
            <button
              type="button"
              onClick={removeFile}
              aria-label="Hapus lampiran struk"
              className="p-1 rounded-lg hover:bg-indigo-900/80 text-slate-300 hover:text-rose-400 transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend; npm run test -- src/__tests__/OmniInputHero.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/components/OmniInputHero.tsx frontend/src/__tests__/OmniInputHero.test.tsx
git commit -m "feat(frontend): add drag-and-drop dropzone and thumbnail preview to OmniInputHero"
```

---

### Task 6: Frontend ExpenseCharts Dynamic Integration (`frontend/src/components/ExpenseCharts.tsx`)

**Files:**
- Modify: `frontend/src/components/ExpenseCharts.tsx`
- Test: `frontend/src/__tests__/ExpenseCharts.test.tsx`

**Interfaces:**
- Consumes:
  ```typescript
  interface ExpenseChartsProps {
    refreshTrigger?: number;
  }
  ```
- Produces:
  - Dynamic fetching from `/analytics/spending-breakdown?period=${period}`.
  - Animated Daily bar chart with Framer Motion springs and threshold reference line.
  - Animated Monthly category progress bars.
  - Accessible zero-data empty states.

- [ ] **Step 1: Write tests in `frontend/src/__tests__/ExpenseCharts.test.tsx`**

Create `frontend/src/__tests__/ExpenseCharts.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpenseCharts } from '../components/ExpenseCharts';
import * as apiClient from '../services/apiClient';

describe('ExpenseCharts Component', () => {
  const mockDailyData = {
    period: 'daily' as const,
    daily_safe_runway: 70000,
    total_spent_in_period: 215000,
    items: [
      { date: '2026-09-13', day_label: 'Min', amount: 35000, safe_runway_threshold: 70000, is_over_budget: false },
      { date: '2026-09-14', day_label: 'Sen', amount: 45000, safe_runway_threshold: 70000, is_over_budget: false },
      { date: '2026-09-15', day_label: 'Sel', amount: 0, safe_runway_threshold: 70000, is_over_budget: false },
      { date: '2026-09-16', day_label: 'Rab', amount: 25000, safe_runway_threshold: 70000, is_over_budget: false },
      { date: '2026-09-17', day_label: 'Kam', amount: 85000, safe_runway_threshold: 70000, is_over_budget: true },
      { date: '2026-09-18', day_label: 'Jum', amount: 0, safe_runway_threshold: 70000, is_over_budget: false },
      { date: '2026-09-19', day_label: 'Sab', amount: 25000, safe_runway_threshold: 70000, is_over_budget: false },
    ],
  };

  const mockMonthlyData = {
    period: 'monthly' as const,
    cycle_start_date: '2026-09-01',
    cycle_end_date: '2026-09-19',
    total_spent: 400000,
    items: [
      { category_id: 'cat-1', category_name: 'Makanan & Minuman', amount: 300000, percentage: 75.0, color: '#6366f1' },
      { category_id: 'cat-2', category_name: 'Transportasi', amount: 100000, percentage: 25.0, color: '#0ea5e9' },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and renders daily spending breakdown with animated bars', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockDailyData);

    render(<ExpenseCharts />);

    await waitFor(() => {
      expect(screen.getByText('Min')).toBeInTheDocument();
      expect(screen.getByText('Kam')).toBeInTheDocument();
      expect(screen.getByText('Sab')).toBeInTheDocument();
    });
  });

  it('switches to monthly breakdown when period button is clicked', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint.includes('period=monthly')) return mockMonthlyData;
      return mockDailyData;
    });

    render(<ExpenseCharts />);

    const monthlyBtn = screen.getByRole('button', { name: /Bulanan \(Monthly\)/i });
    fireEvent.click(monthlyBtn);

    await waitFor(() => {
      expect(screen.getByText('Makanan & Minuman')).toBeInTheDocument();
      expect(screen.getByText(/Rp 300\.000/i)).toBeInTheDocument();
      expect(screen.getByText(/75%/i)).toBeInTheDocument();
      expect(screen.getByText('Transportasi')).toBeInTheDocument();
    });
  });

  it('renders accessible empty state when items list is empty', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
      period: 'monthly' as const,
      cycle_start_date: '2026-09-01',
      cycle_end_date: '2026-09-19',
      total_spent: 0,
      items: [],
    });

    render(<ExpenseCharts />);
    const monthlyBtn = screen.getByRole('button', { name: /Bulanan \(Monthly\)/i });
    fireEvent.click(monthlyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Belum Ada Pengeluaran Tercatat/i)).toBeInTheDocument();
    });
  });

  it('re-fetches analytics data when refreshTrigger prop updates', async () => {
    const fetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockDailyData);

    const { rerender } = render(<ExpenseCharts refreshTrigger={0} />);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    rerender(<ExpenseCharts refreshTrigger={1} />);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test -- src/__tests__/ExpenseCharts.test.tsx`
Expected: FAIL (static component does not call `apiFetch`)

- [ ] **Step 3: Implement dynamic `ExpenseCharts.tsx`**

Modify `frontend/src/components/ExpenseCharts.tsx`:

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiFetch } from '../services/apiClient';
import { SpendingBreakdownResponse, DailySpendingResponse, MonthlySpendingResponse } from '../types/api';

interface Props {
  refreshTrigger?: number;
}

export const ExpenseCharts: React.FC<Props> = ({ refreshTrigger = 0 }) => {
  const [period, setPeriod] = useState<'daily' | 'monthly'>('daily');
  const [data, setData] = useState<SpendingBreakdownResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await apiFetch<SpendingBreakdownResponse>(`/analytics/spending-breakdown?period=${period}`);
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat analitik.');
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics, refreshTrigger]);

  const dailyData = data?.period === 'daily' ? (data as DailySpendingResponse) : null;
  const monthlyData = data?.period === 'monthly' ? (data as MonthlySpendingResponse) : null;

  const maxDailyAmount = dailyData?.items.reduce(
    (max, item) => Math.max(max, item.amount, item.safe_runway_threshold),
    1
  ) || 1;

  const hasExpenses = period === 'daily'
    ? dailyData?.items.some((i) => i.amount > 0)
    : (monthlyData?.items && monthlyData.items.length > 0);

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-6 text-white shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-base">Analitik Pengeluaran Terarah</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {period === 'daily'
              ? 'Tren belanja 7 hari terakhir vs ambang batas Daily Safe Runway'
              : 'Distribusi pengeluaran per kategori pada siklus berjalan'}
          </p>
        </div>
        <div className="flex bg-slate-800/90 p-1 rounded-xl text-xs self-start sm:self-auto border border-slate-700/60">
          <button
            type="button"
            onClick={() => setPeriod('daily')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              period === 'daily'
                ? 'bg-indigo-600 text-white font-medium shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Harian (Daily)
          </button>
          <button
            type="button"
            onClick={() => setPeriod('monthly')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              period === 'monthly'
                ? 'bg-indigo-600 text-white font-medium shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Bulanan (Monthly)
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-44 flex items-center justify-center text-slate-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
          <span className="text-xs">Memuat analitik...</span>
        </div>
      ) : error ? (
        <div className="h-44 flex items-center justify-center text-rose-400 gap-2 text-xs">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      ) : !hasExpenses ? (
        <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-800 rounded-xl">
          <BarChart3 className="w-8 h-8 text-slate-600 mb-2" />
          <p className="font-semibold text-xs text-slate-300">Belum Ada Pengeluaran Tercatat</p>
          <p className="text-[11px] text-slate-500 max-w-xs mt-0.5">
            Unggah struk atau ketik transaksi pada Omni-Input di atas untuk melihat analitik langsung.
          </p>
        </div>
      ) : period === 'daily' && dailyData ? (
        <div className="space-y-4">
          <div className="h-44 flex items-end justify-between gap-2 pt-6 px-2 border-b border-slate-800 pb-2 relative">
            {dailyData.items.map((item, idx) => {
              const heightPct = item.amount > 0 ? Math.max(8, (item.amount / maxDailyAmount) * 100) : 0;
              return (
                <div key={item.date} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                  <div className="w-full bg-slate-800/80 rounded-t-lg h-32 relative flex items-end overflow-hidden">
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${heightPct}%` }}
                      transition={{ type: 'spring', stiffness: 220, damping: 20, delay: idx * 0.04 }}
                      className={`w-full rounded-t-md transition-colors ${
                        item.is_over_budget ? 'bg-rose-500' : 'bg-indigo-500'
                      }`}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400">{item.day_label}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 px-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Sesuai Jatah
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Melebihi Jatah
            </span>
          </div>
        </div>
      ) : period === 'monthly' && monthlyData ? (
        <div className="space-y-3 py-2">
          {monthlyData.items.map((item, idx) => (
            <div key={item.category_id} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300 font-medium">{item.category_name}</span>
                <span className="text-slate-400 tabular-nums">
                  Rp {item.amount.toLocaleString('id-ID')} ({item.percentage}%)
                </span>
              </div>
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.percentage}%` }}
                  transition={{ type: 'spring', stiffness: 180, damping: 22, delay: idx * 0.05 }}
                  style={{ backgroundColor: item.color || '#6366f1' }}
                  className="h-full rounded-full"
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend; npm run test -- src/__tests__/ExpenseCharts.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ExpenseCharts.tsx frontend/src/__tests__/ExpenseCharts.test.tsx
git commit -m "feat(frontend): integrate dynamic analytics fetching and Framer Motion charts into ExpenseCharts"
```

---

### Task 7: Frontend DashboardPage Reactive Sync & Integration (`frontend/src/pages/DashboardPage.tsx`)

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Test: `frontend/src/__tests__/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `OmniInputHero`, `ExpenseCharts`, `apiFetch`, `ReceiptUploadResponse`, `ChatResponse`.
- Produces:
  - FormData posting to `/dashboard/ai-receipt` when `file !== null`.
  - JSON posting to `/dashboard/ai-chat` when `file === null`.
  - Reactive sync incrementing `refreshTrigger` to re-fetch telemetry, transactions, and charts.

- [ ] **Step 1: Write the updated tests in `frontend/src/__tests__/DashboardPage.test.tsx`**

Modify `frontend/src/__tests__/DashboardPage.test.tsx` to include receipt upload and reactive refresh tests:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardPage } from '../pages/DashboardPage';
import * as apiClient from '../services/apiClient';

describe('DashboardPage Component', () => {
  const mockSummary = {
    total_liquid_cash: 2500000,
    vault_locked_cash: 500000,
    operational_free_cash: 2000000,
    days_remaining: 20,
    daily_safe_runway: 100000,
    health_status: 'HEALTHY' as const,
    upcoming_bills: [
      {
        name: 'Internet & WiFi',
        target_amount: 350000,
        allocated_amount: 150000,
        target_date: '2026-09-22',
        days_until_due: 4,
      },
    ],
  };

  const mockTransactions = [
    {
      id: 'tx-101',
      description: 'Makan Siang Soto Ayam',
      source_channel: 'WEB_MANUAL',
      transaction_date: '2026-09-18T13:00:00Z',
      ledger_entries: [
        { id: 'le-1', entry_type: 'DEBIT' as const, amount: 25000 },
        { id: 'le-2', entry_type: 'CREDIT' as const, amount: 25000 },
      ],
    },
  ];

  const mockAccounts = [
    { id: 'acc-1', name: 'BCA Utama', account_type: 'BANK' as const, current_balance: 2000000, is_active: true },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders dashboard with summary, bills banner, and transactions', async () => {
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint === '/transactions') return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 25000, items: [] };
      }
      return null;
    });

    render(<DashboardPage />);

    expect(screen.getAllByText(/Rezekify/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/Deterministic Runway/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Rp 100.000/i)).toBeInTheDocument();
      expect(screen.getByText(/Internet & WiFi/i)).toBeInTheDocument();
      expect(screen.getByText(/Makan Siang Soto Ayam/i)).toBeInTheDocument();
    });
  });

  it('handles text-only submission to /dashboard/ai-chat and refreshes data', async () => {
    const apiSpy = vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string, options?: any) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint === '/transactions') return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 35000, items: [] };
      }
      if (endpoint === '/dashboard/ai-chat' && options?.method === 'POST') {
        return { reply: 'Berhasil mencatat pengeluaran bensin Rp 35.000 dari BCA.' };
      }
      return null;
    });

    render(<DashboardPage />);

    const input = screen.getByPlaceholderText(/Ketik pengeluaran santai/i);
    fireEvent.change(input, { target: { value: 'beli bensin 35rb bca' } });
    fireEvent.submit(input);

    await waitFor(() => {
      expect(screen.getByText(/Hasil Konfirmasi AI/i)).toBeInTheDocument();
      expect(screen.getByText(/Berhasil mencatat pengeluaran bensin Rp 35.000/i)).toBeInTheDocument();
    });
  });

  it('handles receipt file submission via FormData to /dashboard/ai-receipt and triggers reactive refresh', async () => {
    let calledWithFormData = false;
    vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (endpoint: string, options?: any) => {
      if (endpoint === '/dashboard/summary') return mockSummary;
      if (endpoint === '/transactions') return mockTransactions;
      if (endpoint === '/accounts') return mockAccounts;
      if (endpoint.includes('/analytics/spending-breakdown')) {
        return { period: 'daily', daily_safe_runway: 100000, total_spent_in_period: 48500, items: [] };
      }
      if (endpoint === '/dashboard/ai-receipt' && options?.method === 'POST') {
        if (options?.body instanceof FormData) {
          calledWithFormData = true;
        }
        return {
          reply: 'Tercatat dari Struk: Rp 48.500 (Kopi Kenangan) via BCA.',
          transaction_id: 'tx-202',
          extracted_data: { action: 'expense', amount: 48500, account_name: 'BCA', note: 'Kopi Kenangan' },
        };
      }
      return null;
    });

    render(<DashboardPage />);

    const file = new File(['dummy_jpeg_bytes'], 'kopi_struk.jpg', { type: 'image/jpeg' });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    const input = screen.getByPlaceholderText(/Ketik pengeluaran santai/i);
    fireEvent.change(input, { target: { value: 'kopi sore' } });
    fireEvent.submit(input);

    await waitFor(() => {
      expect(calledWithFormData).toBe(true);
      expect(screen.getByText(/Tercatat dari Struk: Rp 48\.500/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test -- src/__tests__/DashboardPage.test.tsx`
Expected: FAIL (receipt submission doesn't use `/dashboard/ai-receipt` yet)

- [ ] **Step 3: Update `frontend/src/pages/DashboardPage.tsx`**

Modify `frontend/src/pages/DashboardPage.tsx`:

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { PlusCircle, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../services/apiClient';
import {
  DashboardSummaryResponse,
  Transaction,
  Account,
  ChatResponse,
  ReceiptUploadResponse,
} from '../types/api';
import { OmniInputHero } from '../components/OmniInputHero';
import { UpcomingBillsCard } from '../components/UpcomingBillsCard';
import { RunwayMetricCard } from '../components/RunwayMetricCard';
import { ExpenseCharts } from '../components/ExpenseCharts';
import { TransactionsTable } from '../components/TransactionsTable';
import { ManualTransactionModal } from '../components/ManualTransactionModal';

export const DashboardPage: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [aiMessage, setAiMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [sumData, txData, accData] = await Promise.all([
        apiFetch<DashboardSummaryResponse>('/dashboard/summary').catch(() => null),
        apiFetch<Transaction[]>('/transactions').catch(() => []),
        apiFetch<Account[]>('/accounts').catch(() => []),
      ]);

      if (sumData) setSummary(sumData);
      setTransactions(txData || []);
      setAccounts(accData || []);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAiSubmit = async (payload: { text: string; file: File | null }) => {
    setIsAiLoading(true);
    setAiMessage(null);
    try {
      if (payload.file) {
        const formData = new FormData();
        formData.append('file', payload.file);
        if (payload.text.trim()) {
          formData.append('message', payload.text.trim());
        }
        const res = await apiFetch<ReceiptUploadResponse>('/dashboard/ai-receipt', {
          method: 'POST',
          body: formData,
        });
        setAiMessage({ text: res.reply || 'Struk berhasil dicatat ke dalam ledger!' });
      } else {
        const res = await apiFetch<ChatResponse>('/dashboard/ai-chat', {
          method: 'POST',
          body: JSON.stringify({ message: payload.text.trim() }),
        });
        setAiMessage({ text: res.reply || 'Berhasil dicatat ke dalam ledger!' });
      }

      await loadData();
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      setAiMessage({
        text: err?.message || 'Gagal memproses input AI. Silakan coba lagi.',
        isError: true,
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    try {
      setIsDeleting(true);
      await apiFetch(`/transactions/${id}`, { method: 'DELETE' });
      await loadData();
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: any) {
      alert(err?.message || 'Gagal menghapus transaksi.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-600 shadow-lg shadow-indigo-600/30">
              <span className="font-extrabold text-white text-base">R</span>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-950" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-white">Rezekify</span>
              <span className="hidden sm:inline-block ml-2 text-[11px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 font-medium">
                Deterministic Runway
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                loadData();
                setRefreshTrigger((prev) => prev + 1);
              }}
              disabled={isLoading}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/60 transition-colors disabled:opacity-40"
              title="Perbarui Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/80 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
            >
              <PlusCircle className="w-4 h-4 text-indigo-400" />
              <span>Catat Manual</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <OmniInputHero onSubmit={handleAiSubmit} isLoading={isAiLoading} />

        {aiMessage && (
          <div
            className={`p-4 rounded-2xl border flex items-start justify-between gap-3 text-sm transition-all ${
              aiMessage.isError
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {aiMessage.isError ? (
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold text-xs uppercase tracking-wider mb-0.5 text-slate-400">
                  {aiMessage.isError ? 'Gagal Memproses' : 'Hasil Konfirmasi AI'}
                </p>
                <p className="text-slate-200 whitespace-pre-line text-xs md:text-sm">{aiMessage.text}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAiMessage(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-slate-800/40"
            >
              Tutup
            </button>
          </div>
        )}

        {summary?.upcoming_bills && <UpcomingBillsCard bills={summary.upcoming_bills} />}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <RunwayMetricCard summary={summary} />
          </div>
          <div className="lg:col-span-7">
            <ExpenseCharts refreshTrigger={refreshTrigger} />
          </div>
        </div>

        <TransactionsTable
          transactions={transactions}
          onDelete={handleDeleteTransaction}
          isLoading={isDeleting}
        />
      </main>

      <ManualTransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        accounts={accounts}
        onSuccess={() => {
          loadData();
          setRefreshTrigger((prev) => prev + 1);
        }}
      />
    </div>
  );
};
```

- [ ] **Step 4: Run frontend tests and verify typecheck**

Run in PowerShell:
```powershell
cd frontend; npx tsc --noEmit; npm run test
```
Expected: PASS across all test suites.

- [ ] **Step 5: Run backend test suite to ensure full regression health**

Run in PowerShell:
```powershell
pytest
```
Expected: PASS (all tests pass).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx frontend/src/__tests__/DashboardPage.test.tsx
git commit -m "feat(frontend): wire reactive synchronization between receipt ingestion, runway telemetry, and charts"
```
