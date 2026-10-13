# Autonomous Cognitive Financial Copilot & Universal Faceted Ledger Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Rezekify AI from a passive single-turn entity parser into an autonomous, tool-calling cognitive financial copilot capable of historical analytics, situational awareness, and pre-purchase what-if advisory while preserving 100% deterministic arithmetic.

**Architecture:** Neuro-symbolic ReAct loop integrating a faceted SQL query engine in Layer 1 with a dual-mode tool dispatcher in Layer 2, maintaining strict double-entry balancing and tenant isolation.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, PostgreSQL, Pydantic v2, Pytest.

**Spec:** `docs/superpowers/specs/2026-10-13-autonomous-financial-agent-design.md`

## Global Constraints

- **Core Invariant 1 (Deterministic Financial Math):** Zero LLM arithmetic computation. All aggregations (SUM, COUNT, AVG) execute in database SQL; all application arithmetic, percentages, and deltas use Python `decimal.Decimal` with explicit rounding (`ROUND_HALF_UP` / `Decimal("0.01")`). Zero floating-point arithmetic for monetary values.
- **Core Invariant 3 (Row-Level Tenant Isolation):** Every database query, aggregation, and mutation enforces `WHERE user_id = :current_user_id`. The `user_id` is context-injected from authenticated JWT and never trusted from LLM prompt parameters.
- **Zero-Bloat Architecture:** Zero vector databases, zero heavy external NLP/agent frameworks (no LangChain, no LlamaIndex, no Celery). Pure SQLAlchemy 2.0 query builder, standard Pydantic v2 validation, and native Python ReAct execution loop.
- **Strict Read-Only Execution for Analytical Tools:** `query_financial_ledger`, `get_runway_telemetry`, and `simulate_purchase` are strictly read-only and idempotent with zero database side-effects. Only `record_transaction` executes mutations under atomic transactions with row locking.
- **VPS 2GB Resource Protection:** Maximum row limit cap of 200 rows on faceted queries. In-engine SQL aggregations to prevent high memory usage.

## Review Focus

1. **Double-counting amounts on multi-entry transactions in faceted queries:** When querying expenses or incomes across joins, ensure only the debit or credit leg is aggregated so split transactions do not duplicate totals (`test_faceted_query_no_double_counting_multi_entry` in Task 1).
2. **Cross-tenant leakage when joining `transactions`, `ledger_entries`, and `accounts`:** Ensure joined tables filter `user_id == current_user_id` so User A cannot inspect or infer User B's accounts or transactions (`test_faceted_query_tenant_isolation_no_leakage` in Task 1).
3. **Malformed JSON tool calls from custom BYOK endpoints:** Ensure invalid or partial tool argument payloads from third-party LLMs return structured error observations rather than raising unhandled exceptions (`test_dispatcher_malformed_json_arguments_graceful_error` in Task 2).
4. **Negative amounts or zero-division when calculating percentage changes across periods:** When previous period total is zero or negative, return `0.00%` delta without raising `DivisionByZero` (`test_faceted_query_zero_division_period_comparison` in Task 1).
5. **Execution loop runaway (capping ReAct loop to a maximum of 3 turns per message):** Ensure recursive tool calls terminate deterministically after 3 hops even if the LLM attempts infinite tool execution (`test_autonomous_react_loop_capped_at_max_turns` in Task 4).

---

### Task 1: Layer 1 Faceted Query Engine (`rezekify/services/faceted_query.py`) & Tests (`tests/test_faceted_query.py`)

**Files:**
- Create: `rezekify/services/faceted_query.py`
- Create: `tests/test_faceted_query.py`

**Interfaces:**
- Consumes: `Session` (SQLAlchemy), `Transaction`, `LedgerEntry`, `Account`, `Category`, `EntryType`, `CategoryType` from `rezekify.db.models`.
- Produces:
  - `FacetedQueryParams`: dataclass specifying query filters (`flow_type`, `start_date`, `end_date`, `categories`, `accounts`, `keyword`, `min_amount`, `max_amount`, `group_by`, `metrics`, `order_by`, `limit`, `compare_with_previous_period`).
  - `PeriodComparisonResult`: dataclass containing `previous_total_amount`, `delta_amount`, `delta_percentage`, `trend`.
  - `FacetedGroupItem`: dataclass containing `key`, `total_amount`, `count`, `percentage_of_total`.
  - `FacetedQueryResult`: dataclass containing `status`, `query_metadata`, `summary`, `comparison`, `groups`, `items`.
  - `FacetedQueryEngine`: class with `execute(user_id: UUID, params: FacetedQueryParams) -> FacetedQueryResult`.

- [ ] **Step 1: Write the failing tests in `tests/test_faceted_query.py`**

```python
"""Tests for Layer 1 Faceted Query Engine with deterministic aggregations and tenant isolation."""

from datetime import date, datetime, timezone
from decimal import Decimal
import uuid
import pytest
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
)
from rezekify.services.faceted_query import (
    FacetedQueryEngine,
    FacetedQueryParams,
)


def _seed_sample_ledger(db_session: Session, user: User):
    """Seeds sample transactions for faceted querying."""
    acc_bca = Account(
        user_id=user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("5000000.00"),
    )
    acc_cash = Account(
        user_id=user.id,
        name="Cash",
        account_type=AccountType.CASH,
        current_balance=Decimal("500000.00"),
    )
    cat_food = Category(
        user_id=user.id,
        name="Makanan",
        category_type=CategoryType.EXPENSE,
    )
    cat_transport = Category(
        user_id=user.id,
        name="Transportasi",
        category_type=CategoryType.EXPENSE,
    )
    cat_salary = Category(
        user_id=user.id,
        name="Gaji",
        category_type=CategoryType.INCOME,
    )
    db_session.add_all([acc_bca, acc_cash, cat_food, cat_transport, cat_salary])
    db_session.commit()

    # Tx 1: Food expense Rp 50.000 (2026-10-02)
    tx1 = Transaction(
        user_id=user.id,
        description="Nasi Padang",
        transaction_date=datetime(2026, 10, 2, 12, 0, tzinfo=timezone.utc),
    )
    db_session.add(tx1)
    db_session.flush()
    e1_deb = LedgerEntry(
        transaction_id=tx1.id,
        user_id=user.id,
        category_id=cat_food.id,
        entry_type=EntryType.DEBIT,
        amount=Decimal("50000.00"),
    )
    e1_crd = LedgerEntry(
        transaction_id=tx1.id,
        user_id=user.id,
        account_id=acc_cash.id,
        entry_type=EntryType.CREDIT,
        amount=Decimal("50000.00"),
    )
    db_session.add_all([e1_deb, e1_crd])

    # Tx 2: Food expense Rp 150.000 (2026-10-05)
    tx2 = Transaction(
        user_id=user.id,
        description="Belanja Supermarket",
        transaction_date=datetime(2026, 10, 5, 14, 0, tzinfo=timezone.utc),
    )
    db_session.add(tx2)
    db_session.flush()
    e2_deb = LedgerEntry(
        transaction_id=tx2.id,
        user_id=user.id,
        category_id=cat_food.id,
        entry_type=EntryType.DEBIT,
        amount=Decimal("150000.00"),
    )
    e2_crd = LedgerEntry(
        transaction_id=tx2.id,
        user_id=user.id,
        account_id=acc_bca.id,
        entry_type=EntryType.CREDIT,
        amount=Decimal("150000.00"),
    )
    db_session.add_all([e2_deb, e2_crd])

    # Tx 3: Transport expense Rp 20.000 (2026-10-08)
    tx3 = Transaction(
        user_id=user.id,
        description="Ojek Online",
        transaction_date=datetime(2026, 10, 8, 8, 30, tzinfo=timezone.utc),
    )
    db_session.add(tx3)
    db_session.flush()
    e3_deb = LedgerEntry(
        transaction_id=tx3.id,
        user_id=user.id,
        category_id=cat_transport.id,
        entry_type=EntryType.DEBIT,
        amount=Decimal("20000.00"),
    )
    e3_crd = LedgerEntry(
        transaction_id=tx3.id,
        user_id=user.id,
        account_id=acc_cash.id,
        entry_type=EntryType.CREDIT,
        amount=Decimal("20000.00"),
    )
    db_session.add_all([e3_deb, e3_crd])

    # Tx 4: Previous period expense Rp 100.000 (2026-09-20)
    tx4 = Transaction(
        user_id=user.id,
        description="Makan Siang September",
        transaction_date=datetime(2026, 9, 20, 13, 0, tzinfo=timezone.utc),
    )
    db_session.add(tx4)
    db_session.flush()
    e4_deb = LedgerEntry(
        transaction_id=tx4.id,
        user_id=user.id,
        category_id=cat_food.id,
        entry_type=EntryType.DEBIT,
        amount=Decimal("100000.00"),
    )
    e4_crd = LedgerEntry(
        transaction_id=tx4.id,
        user_id=user.id,
        account_id=acc_bca.id,
        entry_type=EntryType.CREDIT,
        amount=Decimal("100000.00"),
    )
    db_session.add_all([e4_deb, e4_crd])

    # Tx 5: Income Rp 2.000.000 (2026-10-01)
    tx5 = Transaction(
        user_id=user.id,
        description="Gaji Bulanan",
        transaction_date=datetime(2026, 10, 1, 9, 0, tzinfo=timezone.utc),
    )
    db_session.add(tx5)
    db_session.flush()
    e5_deb = LedgerEntry(
        transaction_id=tx5.id,
        user_id=user.id,
        account_id=acc_bca.id,
        entry_type=EntryType.DEBIT,
        amount=Decimal("2000000.00"),
    )
    e5_crd = LedgerEntry(
        transaction_id=tx5.id,
        user_id=user.id,
        category_id=cat_salary.id,
        entry_type=EntryType.CREDIT,
        amount=Decimal("2000000.00"),
    )
    db_session.add_all([e5_deb, e5_crd])
    db_session.commit()


def test_faceted_query_basic_expense_aggregation(db_session: Session, sample_user: User):
    """Verifies total, count, and average calculations for expense flow."""
    _seed_sample_ledger(db_session, sample_user)
    engine = FacetedQueryEngine(db_session)
    params = FacetedQueryParams(
        flow_type="EXPENSE",
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 10),
    )
    result = engine.execute(sample_user.id, params)

    assert result.status == "success"
    # Total expense: 50.000 + 150.000 + 20.000 = 220.000
    assert result.summary["total_amount"] == Decimal("220000.00")
    assert result.summary["transaction_count"] == 3
    # 220.000 / 3 = 73.333,33
    assert result.summary["average_per_transaction"] == Decimal("73333.33")


def test_faceted_query_group_by_category(db_session: Session, sample_user: User):
    """Verifies grouping by category with percentages and descending order."""
    _seed_sample_ledger(db_session, sample_user)
    engine = FacetedQueryEngine(db_session)
    params = FacetedQueryParams(
        flow_type="EXPENSE",
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 10),
        group_by="category",
    )
    result = engine.execute(sample_user.id, params)

    assert len(result.groups) == 2
    # Food is highest: 200.000 / 220.000 = 90.91%
    assert result.groups[0].key == "Makanan"
    assert result.groups[0].total_amount == Decimal("200000.00")
    assert result.groups[0].count == 2
    assert result.groups[0].percentage_of_total == Decimal("90.91")

    # Transport: 20.000 / 220.000 = 9.09%
    assert result.groups[1].key == "Transportasi"
    assert result.groups[1].total_amount == Decimal("200000.00") or result.groups[1].total_amount == Decimal("20000.00")
    assert result.groups[1].count == 1
    assert result.groups[1].percentage_of_total == Decimal("9.09")


def test_faceted_query_no_double_counting_multi_entry(db_session: Session, sample_user: User):
    """Review Focus 1: Multi-entry transactions must not duplicate aggregated amounts."""
    _seed_sample_ledger(db_session, sample_user)
    engine = FacetedQueryEngine(db_session)
    # Filter by specific account AND category
    params = FacetedQueryParams(
        flow_type="EXPENSE",
        accounts=["Cash"],
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 10),
    )
    result = engine.execute(sample_user.id, params)

    # Cash transactions: 50.000 (Food) + 20.000 (Transport) = 70.000
    assert result.summary["total_amount"] == Decimal("70000.00")
    assert result.summary["transaction_count"] == 2


def test_faceted_query_tenant_isolation_no_leakage(db_session: Session, sample_user: User):
    """Review Focus 2: User A's faceted query must never see User B's transactions."""
    _seed_sample_ledger(db_session, sample_user)

    # Create User B with an expense of Rp 500.000
    other_user = User(
        email="other@rezekify.local",
        password_hash="hash_other",
        full_name="User Lain",
        monthly_cycle_day=1,
    )
    db_session.add(other_user)
    db_session.commit()

    other_cat = Category(
        user_id=other_user.id,
        name="Makanan",
        category_type=CategoryType.EXPENSE,
    )
    db_session.add(other_cat)
    db_session.flush()

    other_tx = Transaction(
        user_id=other_user.id,
        description="Makan Mewah",
        transaction_date=datetime(2026, 10, 3, 12, 0, tzinfo=timezone.utc),
    )
    db_session.add(other_tx)
    db_session.flush()

    other_deb = LedgerEntry(
        transaction_id=other_tx.id,
        user_id=other_user.id,
        category_id=other_cat.id,
        entry_type=EntryType.DEBIT,
        amount=Decimal("500000.00"),
    )
    db_session.add(other_deb)
    db_session.commit()

    engine = FacetedQueryEngine(db_session)
    params = FacetedQueryParams(
        flow_type="EXPENSE",
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 10),
    )
    result = engine.execute(sample_user.id, params)

    # Must strictly be 220.000, not 720.000
    assert result.summary["total_amount"] == Decimal("220000.00")


def test_faceted_query_zero_division_period_comparison(db_session: Session, sample_user: User):
    """Review Focus 4: Zero total in previous period returns 0.00% without ZeroDivisionError."""
    engine = FacetedQueryEngine(db_session)
    # Query with no previous transactions in September
    params = FacetedQueryParams(
        flow_type="EXPENSE",
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 10),
        compare_with_previous_period=True,
    )
    result = engine.execute(sample_user.id, params)

    assert result.comparison is not None
    assert result.comparison.previous_total_amount == Decimal("0.00")
    assert result.comparison.delta_percentage == Decimal("0.00")
    assert result.comparison.trend == "STABLE"


def test_faceted_query_period_comparison_delta(db_session: Session, sample_user: User):
    """Verifies period comparison delta and percentage change."""
    _seed_sample_ledger(db_session, sample_user)
    engine = FacetedQueryEngine(db_session)
    # Oct 1 - Oct 10 (10 days). Previous period: Sep 21 - Sep 30 (10 days).
    # Seed has tx on Sep 20. Let's compare window where previous total is 100.000.
    params = FacetedQueryParams(
        flow_type="EXPENSE",
        categories=["Makanan"],
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 12),
        compare_with_previous_period=True,
    )
    # Current period: Oct 1 - Oct 12 (12 days, Food = 200.000).
    # Previous period: Sep 19 - Sep 30 (12 days, includes Sep 20 Food = 100.000).
    result = engine.execute(sample_user.id, params)

    assert result.comparison is not None
    assert result.summary["total_amount"] == Decimal("200000.00")
    assert result.comparison.previous_total_amount == Decimal("100000.00")
    assert result.comparison.delta_amount == Decimal("100000.00")
    # +100%
    assert result.comparison.delta_percentage == Decimal("100.00")
    assert result.comparison.trend == "INCREASE"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --no-project pytest tests/test_faceted_query.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'rezekify.services.faceted_query'`

- [ ] **Step 3: Write implementation in `rezekify/services/faceted_query.py`**

```python
"""Universal Faceted Ledger Query Engine with deterministic arithmetic and tenant isolation."""

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from rezekify.db.models import (
    Account,
    Category,
    EntryType,
    LedgerEntry,
    Transaction,
)


@dataclass
class FacetedQueryParams:
    flow_type: str = "EXPENSE"  # "EXPENSE" | "INCOME" | "TRANSFER" | "ALL"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    categories: Optional[List[str]] = None
    accounts: Optional[List[str]] = None
    keyword: Optional[str] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None
    group_by: str = "none"  # "category" | "account" | "month" | "week" | "day" | "none"
    metrics: Optional[List[str]] = None
    order_by: str = "amount_desc"  # "amount_desc" | "amount_asc" | "date_desc" | "date_asc"
    limit: int = 50
    compare_with_previous_period: bool = False


@dataclass
class PeriodComparisonResult:
    previous_total_amount: Decimal
    delta_amount: Decimal
    delta_percentage: Decimal
    trend: str  # "INCREASE" | "DECREASE" | "STABLE"


@dataclass
class FacetedGroupItem:
    key: str
    total_amount: Decimal
    count: int
    percentage_of_total: Decimal


@dataclass
class FacetedQueryResult:
    status: str = "success"
    query_metadata: Dict[str, Any] = field(default_factory=dict)
    summary: Dict[str, Any] = field(default_factory=dict)
    comparison: Optional[PeriodComparisonResult] = None
    groups: List[FacetedGroupItem] = field(default_factory=list)
    items: List[Dict[str, Any]] = field(default_factory=list)


class FacetedQueryEngine:
    """Safe, parameter-bound faceted query engine for double-entry financial ledgers.

    ponytail: in-process aggregation via SQLAlchemy; offload to PostgreSQL materialized views if > 500k transactions.
    """

    def __init__(self, db: Session):
        self.db = db

    def execute(self, user_id: UUID, params: FacetedQueryParams) -> FacetedQueryResult:
        capped_limit = min(max(1, params.limit), 200)

        # Normalize date range defaults
        today = date.today()
        start = params.start_date or date(today.year, today.month, 1)
        end = params.end_date or today
        if start > end:
            start, end = end, start

        summary_data = self._aggregate_period(user_id, params, start, end)
        total_amount = summary_data["total_amount"]
        tx_count = summary_data["transaction_count"]
        avg_amount = (
            (total_amount / Decimal(str(tx_count))).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            if tx_count > 0
            else Decimal("0.00")
        )

        comparison_result = None
        if params.compare_with_previous_period:
            duration_days = (end - start).days + 1
            prev_end = start - timedelta(days=1)
            prev_start = prev_end - timedelta(days=duration_days - 1)

            prev_data = self._aggregate_period(user_id, params, prev_start, prev_end)
            prev_total = prev_data["total_amount"]
            delta_amount = total_amount - prev_total

            if prev_total > Decimal("0.00"):
                delta_pct = (
                    (delta_amount / prev_total) * Decimal("100.00")
                ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            else:
                delta_pct = Decimal("0.00")

            if delta_amount > Decimal("0.00"):
                trend = "INCREASE"
            elif delta_amount < Decimal("0.00"):
                trend = "DECREASE"
            else:
                trend = "STABLE"

            comparison_result = PeriodComparisonResult(
                previous_total_amount=prev_total,
                delta_amount=delta_amount,
                delta_percentage=delta_pct,
                trend=trend,
            )

        groups_list: List[FacetedGroupItem] = []
        items_list: List[Dict[str, Any]] = []

        if params.group_by in ("category", "account", "month", "day"):
            groups_list = self._execute_grouped_query(
                user_id=user_id,
                params=params,
                start=start,
                end=end,
                total_amount=total_amount,
                limit=capped_limit,
            )
        elif params.group_by == "none":
            items_list = self._execute_raw_items_query(
                user_id=user_id,
                params=params,
                start=start,
                end=end,
                limit=capped_limit,
            )

        metadata = {
            "flow_type": params.flow_type,
            "period_current": {"start": start.isoformat(), "end": end.isoformat()},
            "group_by": params.group_by,
            "limit": capped_limit,
        }

        return FacetedQueryResult(
            status="success",
            query_metadata=metadata,
            summary={
                "total_amount": total_amount,
                "transaction_count": tx_count,
                "average_per_transaction": avg_amount,
            },
            comparison=comparison_result,
            groups=groups_list,
            items=items_list,
        )

    def _build_base_filters(
        self,
        user_id: UUID,
        params: FacetedQueryParams,
        start: date,
        end: date,
    ) -> list:
        start_dt = datetime.combine(start, time.min, tzinfo=timezone.utc)
        end_dt = datetime.combine(end, time.max, tzinfo=timezone.utc)

        filters = [
            Transaction.user_id == user_id,
            LedgerEntry.user_id == user_id,
            Transaction.transaction_date >= start_dt,
            Transaction.transaction_date <= end_dt,
        ]

        # Prevent double counting: filter on specific entry type based on flow
        flow = params.flow_type.upper()
        if flow == "EXPENSE":
            filters.append(LedgerEntry.entry_type == EntryType.DEBIT)
            filters.append(LedgerEntry.category_id.isnot(None))
        elif flow == "INCOME":
            filters.append(LedgerEntry.entry_type == EntryType.CREDIT)
            filters.append(LedgerEntry.category_id.isnot(None))
        elif flow == "TRANSFER":
            filters.append(LedgerEntry.entry_type == EntryType.DEBIT)
            filters.append(LedgerEntry.category_id.is_(None))
        else:
            filters.append(LedgerEntry.entry_type == EntryType.DEBIT)

        if params.categories:
            clean_cats = [c.strip() for c in params.categories if c and c.strip()]
            if clean_cats:
                filters.append(Category.name.in_(clean_cats))

        if params.keyword:
            safe_kw = params.keyword.replace("%", "").replace("_", "").strip()[:100]
            if safe_kw:
                filters.append(Transaction.description.ilike(f"%{safe_kw}%"))

        if params.min_amount is not None:
            filters.append(LedgerEntry.amount >= params.min_amount)
        if params.max_amount is not None:
            filters.append(LedgerEntry.amount <= params.max_amount)

        if params.accounts:
            clean_accs = [a.strip() for a in params.accounts if a and a.strip()]
            if clean_accs:
                # Subquery matching transactions associated with target accounts
                account_tx_ids = (
                    self.db.query(LedgerEntry.transaction_id)
                    .join(Account, LedgerEntry.account_id == Account.id)
                    .filter(
                        LedgerEntry.user_id == user_id,
                        Account.user_id == user_id,
                        Account.name.in_(clean_accs),
                    )
                    .distinct()
                )
                filters.append(Transaction.id.in_(account_tx_ids))

        return filters

    def _aggregate_period(
        self,
        user_id: UUID,
        params: FacetedQueryParams,
        start: date,
        end: date,
    ) -> Dict[str, Any]:
        filters = self._build_base_filters(user_id, params, start, end)

        query = (
            self.db.query(
                func.coalesce(func.sum(LedgerEntry.amount), Decimal("0.00")).label("total"),
                func.count(Transaction.id.distinct()).label("cnt"),
            )
            .select_from(Transaction)
            .join(LedgerEntry, LedgerEntry.transaction_id == Transaction.id)
            .outerjoin(Category, LedgerEntry.category_id == Category.id)
            .filter(*filters)
        )
        row = query.one()
        return {
            "total_amount": Decimal(str(row.total or 0)),
            "transaction_count": int(row.cnt or 0),
        }

    def _execute_grouped_query(
        self,
        user_id: UUID,
        params: FacetedQueryParams,
        start: date,
        end: date,
        total_amount: Decimal,
        limit: int,
    ) -> List[FacetedGroupItem]:
        filters = self._build_base_filters(user_id, params, start, end)

        if params.group_by == "category":
            group_expr = func.coalesce(Category.name, "Lainnya")
        elif params.group_by == "month":
            # Substring YYYY-MM ANSI compatible across PostgreSQL and SQLite
            group_expr = func.substr(func.date(Transaction.transaction_date), 1, 7)
        elif params.group_by == "day":
            group_expr = func.date(Transaction.transaction_date)
        else:
            group_expr = func.coalesce(Category.name, "Umum")

        query = (
            self.db.query(
                group_expr.label("group_key"),
                func.sum(LedgerEntry.amount).label("grp_total"),
                func.count(Transaction.id.distinct()).label("grp_count"),
            )
            .select_from(Transaction)
            .join(LedgerEntry, LedgerEntry.transaction_id == Transaction.id)
            .outerjoin(Category, LedgerEntry.category_id == Category.id)
            .filter(*filters)
            .group_by(group_expr)
            .order_by(func.sum(LedgerEntry.amount).desc())
            .limit(limit)
        )

        rows = query.all()
        result: List[FacetedGroupItem] = []
        for r in rows:
            amt = Decimal(str(r.grp_total or 0))
            cnt = int(r.grp_count or 0)
            pct = (
                ((amt / total_amount) * Decimal("100.00")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
                if total_amount > Decimal("0.00")
                else Decimal("0.00")
            )
            result.append(
                FacetedGroupItem(
                    key=str(r.group_key),
                    total_amount=amt,
                    count=cnt,
                    percentage_of_total=pct,
                )
            )
        return result

    def _execute_raw_items_query(
        self,
        user_id: UUID,
        params: FacetedQueryParams,
        start: date,
        end: date,
        limit: int,
    ) -> List[Dict[str, Any]]:
        filters = self._build_base_filters(user_id, params, start, end)

        query = (
            self.db.query(
                Transaction.id.label("tx_id"),
                Transaction.transaction_date.label("tx_date"),
                Transaction.description.label("tx_desc"),
                LedgerEntry.amount.label("tx_amount"),
                Category.name.label("cat_name"),
            )
            .select_from(Transaction)
            .join(LedgerEntry, LedgerEntry.transaction_id == Transaction.id)
            .outerjoin(Category, LedgerEntry.category_id == Category.id)
            .filter(*filters)
            .order_by(
                Transaction.transaction_date.desc()
                if "date" in params.order_by
                else LedgerEntry.amount.desc()
            )
            .limit(limit)
        )

        rows = query.all()
        items = []
        for r in rows:
            items.append({
                "id": str(r.tx_id),
                "date": r.tx_date.isoformat() if r.tx_date else None,
                "description": r.tx_desc,
                "amount": Decimal(str(r.tx_amount or 0)),
                "category": r.cat_name or "Uncategorized",
            })
        return items
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --no-project pytest tests/test_faceted_query.py -v`
Expected: PASS (all 6 tests pass)

- [ ] **Step 5: Commit**

```bash
git add rezekify/services/faceted_query.py tests/test_faceted_query.py
git commit -m "feat(ledger): implement layer 1 faceted query engine with deterministic math"
```

---

### Task 2: Tool Registry & Dispatcher (`rezekify/agent/tools.py`) & Tests (`tests/test_agent_tools.py`)

**Files:**
- Create: `rezekify/agent/tools.py`
- Create: `tests/test_agent_tools.py`

**Interfaces:**
- Consumes: `FacetedQueryEngine`, `FacetedQueryParams` from `rezekify.services.faceted_query`, `RunwayService` from `rezekify.services.runway`, `LedgerService` from `rezekify.services.ledger`.
- Produces:
  - `AGENT_TOOL_DEFINITIONS`: list of tool specifications conforming to OpenAI/Anthropic/Gemini standard tool calling.
  - `AgentToolDispatcher`: class with `dispatch(user_id: UUID, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]`.
  - Structured error returns on validation failure (Failure Mode 3).

- [ ] **Step 1: Write the failing tests in `tests/test_agent_tools.py`**

```python
"""Tests for Agent Tool Registry and Deterministic Tool Dispatcher."""

from datetime import date
from decimal import Decimal
import uuid
import pytest
from sqlalchemy.orm import Session

from rezekify.agent.tools import AGENT_TOOL_DEFINITIONS, AgentToolDispatcher
from rezekify.db.models import Account, AccountType, Category, CategoryType, User


@pytest.fixture
def seeded_tools_db(db_session: Session, sample_user: User):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("2000000.00"),
    )
    cat = Category(
        user_id=sample_user.id,
        name="Makanan",
        category_type=CategoryType.EXPENSE,
    )
    db_session.add_all([acc, cat])
    db_session.commit()
    return sample_user


def test_agent_tool_definitions_schema_structure():
    """Verifies that all 4 tools are registered with required schemas."""
    tool_names = [t["name"] for t in AGENT_TOOL_DEFINITIONS]
    assert "query_financial_ledger" in tool_names
    assert "get_runway_telemetry" in tool_names
    assert "simulate_purchase" in tool_names
    assert "record_transaction" in tool_names


def test_dispatcher_query_financial_ledger(db_session: Session, seeded_tools_db: User):
    """Verifies query_financial_ledger dispatch to FacetedQueryEngine."""
    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "flow_type": "EXPENSE",
        "start_date": "2026-10-01",
        "end_date": "2026-10-13",
        "group_by": "category",
    }
    result = dispatcher.dispatch(seeded_tools_db.id, "query_financial_ledger", args)

    assert result["status"] == "success"
    assert "summary" in result
    assert "query_metadata" in result


def test_dispatcher_get_runway_telemetry(db_session: Session, seeded_tools_db: User):
    """Verifies get_runway_telemetry dispatch to RunwayService."""
    dispatcher = AgentToolDispatcher(db_session)
    result = dispatcher.dispatch(seeded_tools_db.id, "get_runway_telemetry", {})

    assert result["status"] == "success"
    assert "operational_free_cash" in result["telemetry"]
    assert "daily_safe_runway" in result["telemetry"]
    assert "health_status" in result["telemetry"]


def test_dispatcher_simulate_purchase(db_session: Session, seeded_tools_db: User):
    """Verifies simulate_purchase dispatch to RunwayService without side-effects."""
    dispatcher = AgentToolDispatcher(db_session)
    args = {"planned_amount": 500000, "category_name": "Elektronik"}
    result = dispatcher.dispatch(seeded_tools_db.id, "simulate_purchase", args)

    assert result["status"] == "success"
    assert "projected_daily_runway" in result["simulation"]
    assert "daily_drop_amount" in result["simulation"]
    assert "is_safe" in result["simulation"]


def test_dispatcher_record_transaction(db_session: Session, seeded_tools_db: User):
    """Verifies record_transaction executes atomic double-entry mutation."""
    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "expense",
        "amount": 50000,
        "account_name": "BCA",
        "category_name": "Makanan",
        "description": "Nasi Goreng",
    }
    result = dispatcher.dispatch(seeded_tools_db.id, "record_transaction", args)

    assert result["status"] == "success"
    assert result["transaction"]["amount"] == Decimal("50000.00")
    assert result["transaction"]["account_name"] == "BCA"

    # Verify balance was updated
    acc = db_session.query(Account).filter_by(user_id=seeded_tools_db.id, name="BCA").one()
    assert acc.current_balance == Decimal("1950000.00")


def test_dispatcher_malformed_json_arguments_graceful_error(db_session: Session, seeded_tools_db: User):
    """Review Focus 3: Malformed arguments return structured error without crashing."""
    dispatcher = AgentToolDispatcher(db_session)
    # Missing required 'planned_amount' or invalid type
    bad_args = {"planned_amount": "invalid_number"}
    result = dispatcher.dispatch(seeded_tools_db.id, "simulate_purchase", bad_args)

    assert result["status"] == "error"
    assert "validation" in result["message"].lower() or "error" in result["message"].lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --no-project pytest tests/test_agent_tools.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'rezekify.agent.tools'`

- [ ] **Step 3: Write implementation in `rezekify/agent/tools.py`**

```python
"""Tool schemas and deterministic dispatcher for Autonomous Financial Copilot."""

from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from rezekify.db.models import Account, Category, CategoryType
from rezekify.services.faceted_query import FacetedQueryEngine, FacetedQueryParams
from rezekify.services.ledger import LedgerService
from rezekify.services.runway import RunwayService


AGENT_TOOL_DEFINITIONS: List[Dict[str, Any]] = [
    {
        "name": "query_financial_ledger",
        "description": "Universal analytical query engine to aggregate, filter, and compare historical ledger transactions with deterministic DB math.",
        "parameters": {
            "type": "object",
            "properties": {
                "flow_type": {
                    "type": "string",
                    "enum": ["EXPENSE", "INCOME", "TRANSFER", "ALL"],
                    "description": "Transaction flow type to analyze. Default: EXPENSE.",
                },
                "start_date": {
                    "type": "string",
                    "description": "Start date in ISO format YYYY-MM-DD.",
                },
                "end_date": {
                    "type": "string",
                    "description": "End date in ISO format YYYY-MM-DD.",
                },
                "categories": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of category names to filter (e.g. ['Makanan', 'Transport']).",
                },
                "accounts": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of account names to filter (e.g. ['BCA', 'Cash']).",
                },
                "keyword": {
                    "type": "string",
                    "description": "Substring search on transaction description.",
                },
                "min_amount": {"type": "number", "description": "Minimum transaction amount."},
                "max_amount": {"type": "number", "description": "Maximum transaction amount."},
                "group_by": {
                    "type": "string",
                    "enum": ["category", "account", "month", "day", "none"],
                    "description": "Grouping dimension. Use 'none' for individual items.",
                },
                "compare_with_previous_period": {
                    "type": "boolean",
                    "description": "Computes delta comparison with previous time period window.",
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of items/groups to return (capped at 200).",
                },
            },
            "required": [],
        },
    },
    {
        "name": "get_runway_telemetry",
        "description": "Fetches active financial health metrics: operational free cash, daily safe runway, days remaining in cycle, health status, and upcoming bills.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "simulate_purchase",
        "description": "Simulates the financial impact of a planned discretionary purchase on daily runway without altering database records.",
        "parameters": {
            "type": "object",
            "properties": {
                "planned_amount": {
                    "type": "number",
                    "description": "Planned purchase amount in IDR (positive number).",
                },
                "category_name": {
                    "type": "string",
                    "description": "Category of the planned purchase.",
                },
                "account_name": {
                    "type": "string",
                    "description": "Account intended for payment.",
                },
            },
            "required": ["planned_amount"],
        },
    },
    {
        "name": "record_transaction",
        "description": "Executes double-entry transaction mutation (expense, income, or transfer) altering account balances persistently.",
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["expense", "income", "transfer"],
                    "description": "Transaction action type.",
                },
                "amount": {
                    "type": "number",
                    "description": "Transaction amount in Rupiah (positive number).",
                },
                "account_name": {
                    "type": "string",
                    "description": "Payment/storage account name (e.g. BCA, GoPay, Cash).",
                },
                "category_name": {
                    "type": "string",
                    "description": "Category name (required for expense/income).",
                },
                "description": {
                    "type": "string",
                    "description": "Brief description of the transaction.",
                },
                "to_account_name": {
                    "type": "string",
                    "description": "Destination account name (for transfers only).",
                },
            },
            "required": ["action", "amount", "account_name", "description"],
        },
    },
]


class QueryLedgerArgs(BaseModel):
    flow_type: str = "EXPENSE"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    categories: Optional[List[str]] = None
    accounts: Optional[List[str]] = None
    keyword: Optional[str] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None
    group_by: str = "none"
    compare_with_previous_period: bool = False
    limit: int = 50


class SimulatePurchaseArgs(BaseModel):
    planned_amount: Decimal = Field(gt=0)
    category_name: Optional[str] = None
    account_name: Optional[str] = None


class RecordTransactionArgs(BaseModel):
    action: str
    amount: Decimal = Field(gt=0)
    account_name: str
    description: str
    category_name: Optional[str] = None
    to_account_name: Optional[str] = None


class AgentToolDispatcher:
    """Dispatches tool invocations to deterministic Layer 1 services.

    ponytail: synchronous in-thread dispatch; add async worker if custom webhook tools are added.
    """

    def __init__(self, db: Session):
        self.db = db
        self.faceted_engine = FacetedQueryEngine(db)
        self.runway_service = RunwayService(db)
        self.ledger_service = LedgerService(db, auto_commit=True)

    def dispatch(self, user_id: UUID, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Dispatches tool call with strict argument validation and error containment."""
        try:
            if tool_name == "query_financial_ledger":
                return self._dispatch_query_ledger(user_id, arguments)
            elif tool_name == "get_runway_telemetry":
                return self._dispatch_get_runway(user_id)
            elif tool_name == "simulate_purchase":
                return self._dispatch_simulate_purchase(user_id, arguments)
            elif tool_name == "record_transaction":
                return self._dispatch_record_transaction(user_id, arguments)
            else:
                return {
                    "status": "error",
                    "message": f"Alat '{tool_name}' tidak dikenal atau tidak tersedia.",
                }
        except (ValidationError, InvalidOperation, ValueError) as e:
            return {
                "status": "error",
                "message": f"Validasi parameter gagal untuk '{tool_name}': {str(e)}",
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Terjadi kesalahan saat mengeksekusi '{tool_name}': {str(e)}",
            }

    def _dispatch_query_ledger(self, user_id: UUID, arguments: Dict[str, Any]) -> Dict[str, Any]:
        validated = QueryLedgerArgs(**arguments)
        s_date = date.fromisoformat(validated.start_date) if validated.start_date else None
        e_date = date.fromisoformat(validated.end_date) if validated.end_date else None

        params = FacetedQueryParams(
            flow_type=validated.flow_type,
            start_date=s_date,
            end_date=e_date,
            categories=validated.categories,
            accounts=validated.accounts,
            keyword=validated.keyword,
            min_amount=validated.min_amount,
            max_amount=validated.max_amount,
            group_by=validated.group_by,
            compare_with_previous_period=validated.compare_with_previous_period,
            limit=validated.limit,
        )
        res = self.faceted_engine.execute(user_id, params)

        comp_dict = None
        if res.comparison:
            comp_dict = {
                "previous_total_amount": res.comparison.previous_total_amount,
                "delta_amount": res.comparison.delta_amount,
                "delta_percentage": res.comparison.delta_percentage,
                "trend": res.comparison.trend,
            }

        groups_dict = [
            {
                "key": g.key,
                "total_amount": g.total_amount,
                "count": g.count,
                "percentage_of_total": g.percentage_of_total,
            }
            for g in res.groups
        ]

        return {
            "status": "success",
            "query_metadata": res.query_metadata,
            "summary": res.summary,
            "comparison": comp_dict,
            "groups": groups_dict,
            "items": res.items,
        }

    def _dispatch_get_runway(self, user_id: UUID) -> Dict[str, Any]:
        runway = self.runway_service.calculate_runway(user_id)
        bills = [
            {
                "name": b.name,
                "target_amount": b.target_amount,
                "allocated_amount": b.allocated_amount,
                "days_until_due": b.days_until_due,
            }
            for b in runway.upcoming_bills
        ]
        return {
            "status": "success",
            "telemetry": {
                "operational_free_cash": runway.operational_free_cash,
                "daily_safe_runway": runway.daily_safe_runway,
                "days_remaining": runway.days_remaining,
                "health_status": runway.health_status,
                "upcoming_bills": bills,
                "today_spent": runway.today_spent,
            },
        }

    def _dispatch_simulate_purchase(self, user_id: UUID, arguments: Dict[str, Any]) -> Dict[str, Any]:
        validated = SimulatePurchaseArgs(**arguments)
        sim = self.runway_service.simulate_purchase(user_id, planned_amount=validated.planned_amount)
        return {
            "status": "success",
            "simulation": {
                "planned_amount": validated.planned_amount,
                "category_name": validated.category_name,
                "current_daily_runway": sim.current_daily_runway,
                "projected_daily_runway": sim.projected_daily_runway,
                "daily_drop_amount": sim.daily_drop_amount,
                "is_safe": sim.is_safe,
                "advice": sim.advice,
            },
        }

    def _dispatch_record_transaction(self, user_id: UUID, arguments: Dict[str, Any]) -> Dict[str, Any]:
        validated = RecordTransactionArgs(**arguments)
        account = (
            self.db.query(Account)
            .filter(Account.user_id == user_id, Account.name.ilike(f"%{validated.account_name.strip()}%"))
            .first()
        )
        if not account:
            return {
                "status": "error",
                "message": f"Akun '{validated.account_name}' tidak ditemukan.",
            }

        action = validated.action.lower()
        if action == "expense":
            cat_name = validated.category_name or "Umum"
            category = (
                self.db.query(Category)
                .filter(Category.user_id == user_id, Category.name.ilike(f"%{cat_name.strip()}%"))
                .first()
            )
            if not category:
                category = Category(user_id=user_id, name=cat_name, category_type=CategoryType.EXPENSE)
                self.db.add(category)
                self.db.flush()

            tx = self.ledger_service.record_expense(
                user_id=user_id,
                account_id=account.id,
                category_id=category.id,
                amount=validated.amount,
                description=validated.description,
            )
        elif action == "income":
            cat_name = validated.category_name or "Pemasukan Lain"
            category = (
                self.db.query(Category)
                .filter(Category.user_id == user_id, Category.name.ilike(f"%{cat_name.strip()}%"))
                .first()
            )
            if not category:
                category = Category(user_id=user_id, name=cat_name, category_type=CategoryType.INCOME)
                self.db.add(category)
                self.db.flush()

            tx = self.ledger_service.record_income(
                user_id=user_id,
                account_id=account.id,
                category_id=category.id,
                amount=validated.amount,
                description=validated.description,
            )
        elif action == "transfer":
            if not validated.to_account_name:
                return {"status": "error", "message": "to_account_name wajib untuk transfer."}
            to_acc = (
                self.db.query(Account)
                .filter(Account.user_id == user_id, Account.name.ilike(f"%{validated.to_account_name.strip()}%"))
                .first()
            )
            if not to_acc or to_acc.id == account.id:
                return {"status": "error", "message": "Akun tujuan transfer tidak valid atau sama dengan sumber."}

            tx = self.ledger_service.record_transfer(
                user_id=user_id,
                from_account_id=account.id,
                to_account_id=to_acc.id,
                amount=validated.amount,
                description=validated.description,
            )
        else:
            return {"status": "error", "message": f"Action '{action}' tidak didukung."}

        self.db.refresh(account)
        return {
            "status": "success",
            "transaction": {
                "id": str(tx.id),
                "action": action,
                "amount": validated.amount,
                "account_name": account.name,
                "description": validated.description,
                "account_balance_after": account.current_balance,
            },
        }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --no-project pytest tests/test_agent_tools.py -v`
Expected: PASS (all 6 tests pass)

- [ ] **Step 5: Commit**

```bash
git add rezekify/agent/tools.py tests/test_agent_tools.py
git commit -m "feat(agent): implement tool registry and deterministic dispatcher"
```

---

### Task 3: Cognitive System Prompt & Layered Context Injection (`rezekify/agent/runtime.py`)

**Files:**
- Modify: `rezekify/agent/runtime.py`
- Modify: `tests/test_agent_runtime.py`

**Interfaces:**
- Consumes: `RunwayReport` from `rezekify.services.runway`, `AGENT_TOOL_DEFINITIONS` from `rezekify.agent.tools`.
- Produces:
  - `AgentTurnResult`: dataclass indicating `is_tool_call`, `tool_name`, `tool_args`, `thought`, `final_response`.
  - `build_cognitive_system_prompt(runway_report: Optional[RunwayReport], user_currency: str) -> str`.
  - `parse_agent_turn(response_text: str) -> AgentTurnResult`: parser handling both native JSON tool schemas and markdown-wrapped fallback responses.

- [ ] **Step 1: Write the failing tests in `tests/test_agent_runtime.py`**

Add tests to `tests/test_agent_runtime.py`:

```python
from decimal import Decimal
from rezekify.agent.runtime import (
    AgentTurnResult,
    build_cognitive_system_prompt,
    parse_agent_turn,
)
from rezekify.services.runway import RunwayReport, UpcomingBill


def test_build_cognitive_system_prompt_injects_telemetry():
    """Verifies that short-term telemetry memory is injected into prompt."""
    bill = UpcomingBill(
        name="WiFi Indihome",
        target_amount=Decimal("350000.00"),
        allocated_amount=Decimal("0.00"),
        target_date=None,
        days_until_due=3,
    )
    report = RunwayReport(
        total_liquid_cash=Decimal("1500000.00"),
        vault_locked_cash=Decimal("500000.00"),
        operational_free_cash=Decimal("1000000.00"),
        days_remaining=10,
        daily_safe_runway=Decimal("100000.00"),
        health_status="HEALTHY",
        upcoming_bills=[bill],
    )
    prompt = build_cognitive_system_prompt(report)

    assert "Rp 1,000,000" in prompt or "1000000" in prompt
    assert "Rp 100,000" in prompt or "100000" in prompt
    assert "10 hari" in prompt or "10" in prompt
    assert "WiFi Indihome" in prompt
    assert "query_financial_ledger" in prompt
    assert "simulate_purchase" in prompt


def test_parse_agent_turn_detects_tool_call():
    """Verifies parsing of structured tool call response."""
    raw_llm_json = """{
      "thought": "Pengguna menanyakan tren makan bulan ini, saya perlu memeriksa ledger.",
      "tool_call": {
        "name": "query_financial_ledger",
        "arguments": {
          "flow_type": "EXPENSE",
          "categories": ["Makanan"],
          "compare_with_previous_period": true
        }
      }
    }"""
    turn = parse_agent_turn(raw_llm_json)

    assert turn.is_tool_call is True
    assert turn.tool_name == "query_financial_ledger"
    assert turn.tool_args["categories"] == ["Makanan"]
    assert turn.tool_args["compare_with_previous_period"] is True
    assert "memeriksa ledger" in (turn.thought or "")


def test_parse_agent_turn_detects_final_response():
    """Verifies parsing of final conversational response."""
    raw_llm_json = """{
      "thought": "Data sudah lengkap dari observasi.",
      "final_response": "Pengeluaran makan Anda bulan ini sebesar Rp 850.000, turun 20% dibanding bulan lalu."
    }"""
    turn = parse_agent_turn(raw_llm_json)

    assert turn.is_tool_call is False
    assert turn.tool_name is None
    assert "Rp 850.000" in (turn.final_response or "")


def test_parse_agent_turn_handles_plain_conversational_text():
    """Verifies fallback when model returns unstructured plain text."""
    plain_text = "Halo! Ada yang bisa saya bantu terkait keuangan Anda hari ini?"
    turn = parse_agent_turn(plain_text)

    assert turn.is_tool_call is False
    assert turn.final_response == plain_text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --no-project pytest tests/test_agent_runtime.py::test_build_cognitive_system_prompt_injects_telemetry -v`
Expected: FAIL with `ImportError: cannot import name 'build_cognitive_system_prompt'`

- [ ] **Step 3: Update `rezekify/agent/runtime.py` with cognitive prompt and turn parser**

In `rezekify/agent/runtime.py`, add `AgentTurnResult`, `build_cognitive_system_prompt`, and `parse_agent_turn`:

```python
from dataclasses import dataclass
from typing import Any, Dict, Optional
import json
import re

from rezekify.services.runway import RunwayReport


@dataclass
class AgentTurnResult:
    is_tool_call: bool
    tool_name: Optional[str] = None
    tool_args: Optional[Dict[str, Any]] = None
    thought: Optional[str] = None
    final_response: Optional[str] = None


def build_cognitive_system_prompt(
    runway_report: Optional[RunwayReport] = None,
    user_currency: str = "IDR",
) -> str:
    """Builds ReAct system prompt with situational telemetry working memory."""
    telemetry_block = "Status Keuangan: Data belum tersedia."
    if runway_report:
        bills_summary = "Tidak ada tagihan mendesak (H-7)."
        if runway_report.upcoming_bills:
            bills_lines = [
                f"- {b.name}: Rp {b.target_amount:,.0f} (sisa {b.days_until_due} hari)"
                for b in runway_report.upcoming_bills
            ]
            bills_summary = "\n".join(bills_lines)

        telemetry_block = f"""[SITUATIONAL AWARENESS - REAL-TIME TELEMETRY]
• Saldo Bebas Operasional: Rp {runway_report.operational_free_cash:,.0f}
• Jatah Aman Belanja Hari Ini: Rp {runway_report.daily_safe_runway:,.0f}/hari
• Sisa Hari Menuju Siklus Baru: {runway_report.days_remaining} hari
• Status Kesehatan Finansial: {runway_report.health_status}
• Tagihan Mendesak Mendatang (H-7):
{bills_summary}"""

    return f"""Anda adalah Rezekify Autonomous Cognitive Financial Copilot.
Anda memiliki akses mandiri ke subsistem simbolik deterministik buku besar pengguna.

{telemetry_block}

[CORE INVARIANTS]
1. LLM DILARANG MENGHITUNG ANGKA ARITMATIKA. Semua perhitungan total, rata-rata, komparasi periode, dan dampak belanja WAJIB menggunakan tool.
2. Gunakan pendekatan Behavioral Nudge & Mental Accounting (Thaler): lindungi dana tagihan mendesak dan ingatkan depresiasi jatah belanja harian jika pembelian diskresioner berisiko.
3. Selalu bersikap empatik, ringkas, jelas, dan faktual.

[DAFTAR ALAT TERSEDIA]
1. query_financial_ledger(flow_type, start_date, end_date, categories, accounts, keyword, group_by, compare_with_previous_period)
2. get_runway_telemetry()
3. simulate_purchase(planned_amount, category_name)
4. record_transaction(action, amount, account_name, category_name, description)

[PROTOKOL KELUARAN REACT]
Jika Anda memerlukan data untuk menjawab pertanyaan pengguna, tanggapi HANYA dengan JSON:
{{
  "thought": "<alasan Anda mengapa alat ini dibutuhkan>",
  "tool_call": {{
    "name": "<nama_alat>",
    "arguments": {{ <parameter> }}
  }}
}}

Jika Anda telah memiliki data lengkap dari hasil observasi atau tidak memerlukan alat, tanggapi dengan JSON:
{{
  "thought": "<analisis kesimpulan data>",
  "final_response": "<jawaban lengkap, ramah, dan empatik untuk pengguna>"
}}"""


def parse_agent_turn(response_text: str) -> AgentTurnResult:
    """Parses model response into structured tool call or final answer."""
    text = (response_text or "").strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return AgentTurnResult(is_tool_call=False, final_response=text)

    try:
        parsed = json.loads(match.group(0))
    except Exception:
        return AgentTurnResult(is_tool_call=False, final_response=text)

    # Check for tool_call structure
    tool_call = parsed.get("tool_call") or parsed.get("call_tool")
    if tool_call and isinstance(tool_call, dict):
        name = tool_call.get("name")
        args = tool_call.get("arguments") or tool_call.get("parameters") or {}
        return AgentTurnResult(
            is_tool_call=True,
            tool_name=name,
            tool_args=args,
            thought=parsed.get("thought"),
        )
    elif "tool_name" in parsed:
        return AgentTurnResult(
            is_tool_call=True,
            tool_name=parsed["tool_name"],
            tool_args=parsed.get("arguments", {}),
            thought=parsed.get("thought"),
        )

    final_resp = parsed.get("final_response") or parsed.get("reply") or parsed.get("message")
    if final_resp:
        return AgentTurnResult(
            is_tool_call=False,
            thought=parsed.get("thought"),
            final_response=str(final_resp),
        )

    return AgentTurnResult(is_tool_call=False, final_response=text)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --no-project pytest tests/test_agent_runtime.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/agent/runtime.py tests/test_agent_runtime.py
git commit -m "feat(agent): implement cognitive system prompt and turn parser"
```

---

### Task 4: Multi-Turn ReAct Loop Orchestrator (`rezekify/agent/orchestrator.py`) & Tests (`tests/test_autonomous_agent.py`)

**Files:**
- Modify: `rezekify/agent/orchestrator.py`
- Create: `tests/test_autonomous_agent.py`

**Interfaces:**
- Consumes: `AgentToolDispatcher` from `rezekify.agent.tools`, `build_cognitive_system_prompt`, `parse_agent_turn` from `rezekify.agent.runtime`, `RunwayService`, `LedgerService`.
- Produces:
  - `run_autonomous_loop(self, user_id: UUID, prompt: str, max_turns: int = 3) -> dict[str, Any]`.
  - Upgraded `handle_message` and `handle_message_async` that execute the ReAct loop while preserving existing transaction format returns.
  - Hard limit capping ReAct loop at 3 iterations (Failure Mode 5).

- [ ] **Step 1: Write the failing tests in `tests/test_autonomous_agent.py`**

```python
"""Tests for Autonomous Multi-Turn ReAct Loop Orchestration."""

from decimal import Decimal
from unittest.mock import MagicMock
import pytest
from sqlalchemy.orm import Session

from rezekify.agent.orchestrator import AgentOrchestrator
from rezekify.agent.runtime import ReActAgent
from rezekify.db.models import Account, AccountType, Category, CategoryType, User


@pytest.fixture
def autonomous_env(db_session: Session, sample_user: User):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("3000000.00"),
    )
    cat = Category(
        user_id=sample_user.id,
        name="Makanan",
        category_type=CategoryType.EXPENSE,
    )
    db_session.add_all([acc, cat])
    db_session.commit()
    return sample_user


def test_autonomous_react_loop_retrospective_inquiry(db_session: Session, autonomous_env: User):
    """Verifies ReAct cycle: Thought -> Tool Call (query_financial_ledger) -> Final Synthesized Answer."""
    mock_agent = MagicMock(spec=ReActAgent)
    # Turn 1: Model decides to call query_financial_ledger
    # Turn 2: Model receives observation and outputs final answer
    mock_agent.process_input.side_effect = [
        {
            "raw": """{
              "thought": "Pengguna menanyakan total makan bulan ini.",
              "tool_call": {
                "name": "query_financial_ledger",
                "arguments": {"flow_type": "EXPENSE", "categories": ["Makanan"]}
              }
            }"""
        },
        {
            "raw": """{
              "thought": "Observasi menunjukkan total 0.",
              "final_response": "Total pengeluaran kategori Makanan Anda bulan ini adalah Rp 0."
            }"""
        },
    ]

    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)
    res = orchestrator.run_autonomous_loop(
        user_id=autonomous_env.id,
        prompt="Berapa pengeluaran makan saya bulan ini?",
    )

    assert "Total pengeluaran kategori Makanan" in res["reply"]
    assert res["hops"] == 2
    assert mock_agent.process_input.call_count == 2


def test_autonomous_react_loop_what_if_simulation(db_session: Session, autonomous_env: User):
    """Verifies ReAct cycle for simulate_purchase."""
    mock_agent = MagicMock(spec=ReActAgent)
    mock_agent.process_input.side_effect = [
        {
            "raw": """{
              "thought": "Pengguna berencana membeli sepatu 500rb, saya simulasikan.",
              "tool_call": {
                "name": "simulate_purchase",
                "arguments": {"planned_amount": 500000, "category_name": "Belanja"}
              }
            }"""
        },
        {
            "raw": """{
              "thought": "Simulasi aman dilakukan.",
              "final_response": "Pembelian sepatu Rp 500.000 aman dilakukan. Jatah harian Anda tetap stabil."
            }"""
        },
    ]

    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)
    res = orchestrator.run_autonomous_loop(
        user_id=autonomous_env.id,
        prompt="Boleh nggak saya beli sepatu 500rb?",
    )

    assert "aman dilakukan" in res["reply"]
    assert res["hops"] == 2


def test_autonomous_react_loop_capped_at_max_turns(db_session: Session, autonomous_env: User):
    """Review Focus 5: ReAct loop terminates safely when model exceeds max 3 hops."""
    mock_agent = MagicMock(spec=ReActAgent)
    # Infinitely calls tool
    mock_agent.process_input.return_value = {
        "raw": """{
          "thought": "Saya ingin mengecek lagi.",
          "tool_call": {
            "name": "get_runway_telemetry",
            "arguments": {}
          }
        }"""
    }

    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)
    res = orchestrator.run_autonomous_loop(
        user_id=autonomous_env.id,
        prompt="Cek data keuangan saya berulang-ulang",
        max_turns=3,
    )

    assert res["hops"] == 3
    assert "reply" in res
    assert mock_agent.process_input.call_count == 3
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --no-project pytest tests/test_autonomous_agent.py -v`
Expected: FAIL with `AttributeError: 'AgentOrchestrator' object has no attribute 'run_autonomous_loop'`

- [ ] **Step 3: Implement ReAct loop in `rezekify/agent/orchestrator.py`**

In `rezekify/agent/orchestrator.py`:
1. Import `AgentToolDispatcher` from `rezekify.agent.tools`.
2. Import `build_cognitive_system_prompt`, `parse_agent_turn` from `rezekify.agent.runtime`.
3. Add `self.dispatcher = AgentToolDispatcher(db)` to `AgentOrchestrator.__init__`.
4. Implement `run_autonomous_loop`:

```python
    def run_autonomous_loop(
        self,
        user_id: UUID,
        prompt: str,
        max_turns: int = 3,
    ) -> Dict[str, Any]:
        """Closed-loop ReAct execution: Prompt -> LLM -> Tool -> Observation -> LLM -> Final Answer.

        ponytail: max_turns hardcoded to 3 ceiling; increase if multi-goal agent workflows require 5 hops.
        """
        agent_to_use, _ = self._resolve_agent_for_user(user_id)
        if not agent_to_use:
            agent_to_use = self.agent

        if not agent_to_use:
            return {
                "reply": "Layanan AI belum terkonfigurasi.",
                "transaction_id": None,
                "transaction": None,
                "telemetry": self._safe_get_telemetry(user_id),
                "hops": 0,
            }

        # Build short-term telemetry memory
        runway_report = None
        try:
            runway_report = self.runway.calculate_runway(user_id)
        except Exception:
            pass

        system_prompt = build_cognitive_system_prompt(runway_report)
        history_context = f"{system_prompt}\n\nPENGGUNA: {prompt}"

        executed_tx_meta = None
        executed_tx_id = None
        last_observation_summary = ""

        hops = 0
        for hop in range(max_turns):
            hops += 1
            llm_res = agent_to_use.process_input(
                user_id=user_id,
                text=history_context,
            )

            raw_text = (
                llm_res.get("raw")
                or llm_res.get("message")
                or json.dumps(llm_res)
            )

            turn = parse_agent_turn(raw_text)

            if not turn.is_tool_call or not turn.tool_name:
                # LLM provided final answer or plain text
                final_text = turn.final_response or raw_text
                return {
                    "reply": final_text,
                    "transaction_id": executed_tx_id,
                    "transaction": executed_tx_meta,
                    "telemetry": self._safe_get_telemetry(user_id),
                    "hops": hops,
                }

            # Dispatch tool
            observation = self.dispatcher.dispatch(
                user_id=user_id,
                tool_name=turn.tool_name,
                arguments=turn.tool_args or {},
            )

            if turn.tool_name == "record_transaction" and observation.get("status") == "success":
                tx_info = observation.get("transaction")
                if tx_info:
                    executed_tx_meta = tx_info
                    executed_tx_id = tx_info.get("id")

            obs_str = json.dumps(observation, default=str)
            last_observation_summary = obs_str
            history_context += f"\n\n[OBSERVATION dari {turn.tool_name}]: {obs_str}\nSintesis jawaban akhir untuk pengguna:"

        # Ceiling reached without final answer: safe wrap-up
        safe_reply = (
            f"Berikut ringkasan data yang kami temukan: {last_observation_summary}"
            if last_observation_summary
            else "Permintaan Anda telah kami proses."
        )
        return {
            "reply": safe_reply,
            "transaction_id": executed_tx_id,
            "transaction": executed_tx_meta,
            "telemetry": self._safe_get_telemetry(user_id),
            "hops": hops,
        }
```

5. Connect `handle_message` and `handle_message_async`:
For conversational and analytical prompts that don't match simple fast-paths (like pure receipt image OCR or quick `/runway`), invoke `self.run_autonomous_loop(user_id, text)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --no-project pytest tests/test_autonomous_agent.py -v`
Expected: PASS (all 3 tests pass)

- [ ] **Step 5: Commit**

```bash
git add rezekify/agent/orchestrator.py tests/test_autonomous_agent.py
git commit -m "feat(agent): implement autonomous multi-turn ReAct loop with 3-hop ceiling guard"
```

---

### Task 5: End-to-End Test Suite, Multi-Turn Scenarios & Verification (`pytest`, `ruff check .`)

**Files:**
- Modify: `tests/test_autonomous_agent.py`
- Verify: Full test suite and lint checks across the codebase.

**Interfaces:**
- Consumes: All modules from Tasks 1-4.
- Produces: Complete passing test suite with zero lint errors.

- [ ] **Step 1: Write multi-turn scenario tests in `tests/test_autonomous_agent.py`**

Add comprehensive multi-turn scenarios:
1. Scenario A: Retrospective trend comparison (Food October vs September).
2. Scenario B: What-If simulation with Thaler nudge.
3. Scenario C: Operator mutation with immediate runway telemetry reflection.

```python
def test_e2e_operator_mutation_with_telemetry_reflection(db_session: Session, autonomous_env: User):
    """Verifies recording transaction via tool call mutates ledger and updates telemetry."""
    mock_agent = MagicMock(spec=ReActAgent)
    mock_agent.process_input.side_effect = [
        {
            "raw": """{
              "thought": "Pengguna meminta mencatat belanja warteg 30rb dengan BCA.",
              "tool_call": {
                "name": "record_transaction",
                "arguments": {
                  "action": "expense",
                  "amount": 30000,
                  "account_name": "BCA",
                  "category_name": "Makanan",
                  "description": "Makan Warteg"
                }
              }
            }"""
        },
        {
            "raw": """{
              "thought": "Transaksi berhasil dicatat.",
              "final_response": "✅ Berhasil mencatat pengeluaran Makan Warteg sebesar Rp 30.000 via BCA."
            }"""
        },
    ]

    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)
    res = orchestrator.run_autonomous_loop(
        user_id=autonomous_env.id,
        prompt="Catat makan warteg 30rb pakai BCA",
    )

    assert "Berhasil mencatat" in res["reply"]
    assert res["transaction"] is not None
    assert res["transaction"]["amount"] == Decimal("30000.00")

    # Verify balance was updated
    acc = db_session.query(Account).filter_by(user_id=autonomous_env.id, name="BCA").one()
    assert acc.current_balance == Decimal("2970000.00")
```

- [ ] **Step 2: Run all targeted tests**

Run: `uv run --no-project pytest tests/test_faceted_query.py tests/test_agent_tools.py tests/test_agent_runtime.py tests/test_autonomous_agent.py -v`
Expected: PASS (all tests pass)

- [ ] **Step 3: Run full backend regression test suite**

Run: `uv run --no-project pytest tests/test_agent_orchestrator.py tests/test_runway_service.py tests/test_ledger_service.py -v`
Expected: PASS (all existing tests remain green)

- [ ] **Step 4: Run linter and formatter verification**

Run: `uv run --no-project ruff check rezekify/services/faceted_query.py rezekify/agent/tools.py rezekify/agent/runtime.py rezekify/agent/orchestrator.py`
Expected: All checks passed!

- [ ] **Step 5: Commit**

```bash
git add tests/test_autonomous_agent.py
git commit -m "test(agent): add full e2e multi-turn autonomous scenarios and verify clean suite"
```
