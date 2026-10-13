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
    FacetedGroupItem,
    FacetedQueryEngine,
    FacetedQueryParams,
    FacetedQueryResult,
    GroupedMetricRow,
    PeriodComparisonResult,
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
    assert result.groups[1].total_amount == Decimal("20000.00")
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
    # Oct 1 - Oct 12 (12 days, Food = 200.000).
    # Previous period: Sep 19 - Sep 30 (12 days, includes Sep 20 Food = 100.000).
    params = FacetedQueryParams(
        flow_type="EXPENSE",
        categories=["Makanan"],
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 12),
        compare_with_previous_period=True,
    )
    result = engine.execute(sample_user.id, params)

    assert result.comparison is not None
    assert result.summary["total_amount"] == Decimal("200000.00")
    assert result.comparison.previous_total_amount == Decimal("100000.00")
    assert result.comparison.delta_amount == Decimal("100000.00")
    # +100%
    assert result.comparison.delta_percentage == Decimal("100.00")
    assert result.comparison.trend == "INCREASE"


def test_faceted_query_raw_items_listing(db_session: Session, sample_user: User):
    """Verifies item-level listing when group_by is 'none'."""
    _seed_sample_ledger(db_session, sample_user)
    engine = FacetedQueryEngine(db_session)
    params = FacetedQueryParams(
        flow_type="EXPENSE",
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 10),
        group_by="none",
        order_by="amount_desc",
        limit=10,
    )
    result = engine.execute(sample_user.id, params)

    assert len(result.items) == 3
    assert result.items[0]["amount"] == Decimal("150000.00")
    assert result.items[0]["description"] == "Belanja Supermarket"
    assert result.items[0]["category"] == "Makanan"


def test_faceted_query_income_flow(db_session: Session, sample_user: User):
    """Verifies querying flow_type='INCOME' aggregates credit leg of income categories."""
    _seed_sample_ledger(db_session, sample_user)
    engine = FacetedQueryEngine(db_session)
    params = FacetedQueryParams(
        flow_type="INCOME",
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 10),
    )
    result = engine.execute(sample_user.id, params)

    assert result.summary["total_amount"] == Decimal("2000000.00")
    assert result.summary["transaction_count"] == 1


def test_faceted_query_keyword_and_amount_filters(db_session: Session, sample_user: User):
    """Verifies filtering by keyword and min/max amount thresholds."""
    _seed_sample_ledger(db_session, sample_user)
    engine = FacetedQueryEngine(db_session)

    # Keyword filter
    kw_params = FacetedQueryParams(
        flow_type="EXPENSE",
        keyword="Padang",
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 10),
    )
    kw_res = engine.execute(sample_user.id, kw_params)
    assert kw_res.summary["transaction_count"] == 1
    assert kw_res.summary["total_amount"] == Decimal("50000.00")

    # Min amount filter
    min_params = FacetedQueryParams(
        flow_type="EXPENSE",
        min_amount=Decimal("100000.00"),
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 10),
    )
    min_res = engine.execute(sample_user.id, min_params)
    assert min_res.summary["transaction_count"] == 1
    assert min_res.summary["total_amount"] == Decimal("150000.00")


def test_faceted_query_capped_limit_safety(db_session: Session, sample_user: User):
    """Verifies query limit is capped at 200 for memory safety."""
    engine = FacetedQueryEngine(db_session)
    params = FacetedQueryParams(
        flow_type="EXPENSE",
        limit=500,
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 10),
    )
    result = engine.execute(sample_user.id, params)
    assert result.query_metadata["limit"] == 200


def test_faceted_query_execute_query_aliases_and_compare_periods(db_session: Session, sample_user: User):
    """Verifies execute_query and compare_periods methods."""
    _seed_sample_ledger(db_session, sample_user)
    engine = FacetedQueryEngine(db_session)
    params = FacetedQueryParams(
        flow_type="EXPENSE",
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 10),
    )
    # 1. Instance call execute_query(user_id, params)
    res1 = engine.execute_query(sample_user.id, params)
    assert res1.summary["total_amount"] == Decimal("220000.00")

    # 2. Static/class-style call execute_query(db, user_id, params)
    res2 = engine.execute_query(db_session, sample_user.id, params)
    assert res2.summary["total_amount"] == Decimal("220000.00")

    # 3. compare_periods explicit call
    prev_params = FacetedQueryParams(
        flow_type="EXPENSE",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 30),
    )
    cmp_res = engine.compare_periods(sample_user.id, params, prev_params)
    assert cmp_res.previous_total_amount == Decimal("100000.00")
    assert cmp_res.delta_amount == Decimal("120000.00")
    assert cmp_res.trend == "INCREASE"


def test_faceted_query_group_by_account(db_session: Session, sample_user: User):
    """Verifies grouping by account with percentages and descending order."""
    _seed_sample_ledger(db_session, sample_user)
    engine = FacetedQueryEngine(db_session)
    params = FacetedQueryParams(
        flow_type="EXPENSE",
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 10),
        group_by="account",
    )
    result = engine.execute(sample_user.id, params)

    assert len(result.groups) == 2
    # BCA: 150.000 / 220.000 = 68.18%
    assert result.groups[0].key == "BCA"
    assert result.groups[0].total_amount == Decimal("150000.00")
    assert result.groups[0].count == 1
    assert result.groups[0].percentage_of_total == Decimal("68.18")

    # Cash: 70.000 / 220.000 = 31.82%
    assert result.groups[1].key == "Cash"
    assert result.groups[1].total_amount == Decimal("70000.00")
    assert result.groups[1].count == 2
    assert result.groups[1].percentage_of_total == Decimal("31.82")


def test_faceted_query_group_by_month(db_session: Session, sample_user: User):
    """Verifies grouping by month (YYYY-MM)."""
    _seed_sample_ledger(db_session, sample_user)
    engine = FacetedQueryEngine(db_session)
    params = FacetedQueryParams(
        flow_type="EXPENSE",
        start_date=date(2026, 9, 1),
        end_date=date(2026, 10, 10),
        group_by="month",
    )
    result = engine.execute(sample_user.id, params)

    assert len(result.groups) == 2
    # Oct: 220.000 / 320.000 = 68.75%
    assert result.groups[0].key == "2026-10"
    assert result.groups[0].total_amount == Decimal("220000.00")
    assert result.groups[0].count == 3
    assert result.groups[0].percentage_of_total == Decimal("68.75")

    # Sep: 100.000 / 320.000 = 31.25%
    assert result.groups[1].key == "2026-09"
    assert result.groups[1].total_amount == Decimal("100000.00")
    assert result.groups[1].count == 1
    assert result.groups[1].percentage_of_total == Decimal("31.25")


def test_faceted_query_group_by_day(db_session: Session, sample_user: User):
    """Verifies grouping by day (YYYY-MM-DD)."""
    _seed_sample_ledger(db_session, sample_user)
    engine = FacetedQueryEngine(db_session)
    params = FacetedQueryParams(
        flow_type="EXPENSE",
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 10),
        group_by="day",
    )
    result = engine.execute(sample_user.id, params)

    assert len(result.groups) == 3
    # 2026-10-05: 150.000
    assert result.groups[0].key == "2026-10-05"
    assert result.groups[0].total_amount == Decimal("150000.00")
    assert result.groups[0].count == 1
    assert result.groups[0].percentage_of_total == Decimal("68.18")

    # 2026-10-02: 50.000
    assert result.groups[1].key == "2026-10-02"
    assert result.groups[1].total_amount == Decimal("50000.00")
    assert result.groups[1].count == 1
    assert result.groups[1].percentage_of_total == Decimal("22.73")

    # 2026-10-08: 20.000
    assert result.groups[2].key == "2026-10-08"
    assert result.groups[2].total_amount == Decimal("20000.00")
    assert result.groups[2].count == 1
    assert result.groups[2].percentage_of_total == Decimal("9.09")


def test_faceted_query_uncategorized_expense_and_transfer_separation(db_session: Session, sample_user: User):
    """Verifies uncategorized expense (account_id is None) is classified under EXPENSE and transfer is classified under TRANSFER."""
    acc_source = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("2000000.00"),
    )
    acc_dest = Account(
        user_id=sample_user.id,
        name="GoPay",
        account_type=AccountType.EWALLET,
        current_balance=Decimal("500000.00"),
    )
    db_session.add_all([acc_source, acc_dest])
    db_session.commit()

    # 1. Uncategorized expense: Debit has category_id=None, account_id=None
    tx_exp = Transaction(
        user_id=sample_user.id,
        description="Pengeluaran Tanpa Kategori",
        transaction_date=datetime(2026, 10, 4, 10, 0, tzinfo=timezone.utc),
    )
    db_session.add(tx_exp)
    db_session.flush()
    e_exp_deb = LedgerEntry(
        transaction_id=tx_exp.id,
        user_id=sample_user.id,
        category_id=None,
        account_id=None,
        entry_type=EntryType.DEBIT,
        amount=Decimal("45000.00"),
    )
    e_exp_crd = LedgerEntry(
        transaction_id=tx_exp.id,
        user_id=sample_user.id,
        category_id=None,
        account_id=acc_source.id,
        entry_type=EntryType.CREDIT,
        amount=Decimal("45000.00"),
    )
    db_session.add_all([e_exp_deb, e_exp_crd])

    # 2. Transfer: Debit has account_id=acc_dest.id, category_id=None
    tx_trf = Transaction(
        user_id=sample_user.id,
        description="Transfer Antar Rekening",
        transaction_date=datetime(2026, 10, 4, 11, 0, tzinfo=timezone.utc),
    )
    db_session.add(tx_trf)
    db_session.flush()
    e_trf_crd = LedgerEntry(
        transaction_id=tx_trf.id,
        user_id=sample_user.id,
        category_id=None,
        account_id=acc_source.id,
        entry_type=EntryType.CREDIT,
        amount=Decimal("100000.00"),
    )
    e_trf_deb = LedgerEntry(
        transaction_id=tx_trf.id,
        user_id=sample_user.id,
        category_id=None,
        account_id=acc_dest.id,
        entry_type=EntryType.DEBIT,
        amount=Decimal("100000.00"),
    )
    db_session.add_all([e_trf_crd, e_trf_deb])
    db_session.commit()

    engine = FacetedQueryEngine(db_session)

    # Query EXPENSE
    res_exp = engine.execute(
        sample_user.id,
        FacetedQueryParams(
            flow_type="EXPENSE",
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 10),
            group_by="none",
        ),
    )
    assert res_exp.summary["total_amount"] == Decimal("45000.00")
    assert res_exp.summary["transaction_count"] == 1
    assert res_exp.items[0]["description"] == "Pengeluaran Tanpa Kategori"

    # Query TRANSFER
    res_trf = engine.execute(
        sample_user.id,
        FacetedQueryParams(
            flow_type="TRANSFER",
            start_date=date(2026, 10, 1),
            end_date=date(2026, 10, 10),
            group_by="none",
        ),
    )
    assert res_trf.summary["total_amount"] == Decimal("100000.00")
    assert res_trf.summary["transaction_count"] == 1
    assert res_trf.items[0]["description"] == "Transfer Antar Rekening"


