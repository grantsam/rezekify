"""Tests for RunwayService calculation, upcoming bills, and simulation."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

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
from rezekify.services.runway import (
    CategorySpendingBreakdownReport,
    DailySpendingBreakdownReport,
    RunwayService,
)


def test_calculate_runway_days_and_daily_budget(db_session, sample_user):
    sample_user.monthly_cycle_day = 25
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("1000000.00"),
    )
    vlt = Vault(
        user_id=sample_user.id,
        name="UKT",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("500000.00"),
        allocated_amount=Decimal("300000.00"),
        is_locked=True,
    )
    bill = Vault(
        user_id=sample_user.id,
        name="Tagihan Listrik & WiFi",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("500000.00"),
        allocated_amount=Decimal("200000.00"),
        target_date=date(2026, 9, 23),
        is_locked=True,
    )
    db_session.add_all([acc, vlt, bill])
    db_session.commit()

    service = RunwayService(db_session)
    # Today is 18th, cycle day is 25th -> 7 days remaining
    report = service.calculate_runway(user_id=sample_user.id, today=date(2026, 9, 18))

    assert report.total_liquid_cash == Decimal("1000000.00")
    assert report.vault_locked_cash == Decimal("500000.00")
    assert report.operational_free_cash == Decimal("500000.00")
    assert report.days_remaining == 7
    assert report.daily_safe_runway == Decimal("71428.57")
    assert report.health_status == "HEALTHY"
    assert len(report.upcoming_bills) == 1
    assert report.upcoming_bills[0].name == "Tagihan Listrik & WiFi"
    assert report.upcoming_bills[0].days_until_due == 5
    assert report.upcoming_bills[0].target_amount == Decimal("500000.00")
    assert report.upcoming_bills[0].allocated_amount == Decimal("200000.00")

    # Verify get_upcoming_bills helper directly
    upcoming = service.get_upcoming_bills(user_id=sample_user.id, today=date(2026, 9, 18))
    assert len(upcoming) == 1
    assert upcoming[0].name == "Tagihan Listrik & WiFi"
    assert upcoming[0].days_until_due == 5


def test_simulate_purchase_impact(db_session, sample_user):
    sample_user.monthly_cycle_day = 25
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("1000000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    service = RunwayService(db_session)
    # Liquid: 1M, Days: 7 -> Daily safe: 142857.14
    # Purchase: 200,000 -> Projected free: 800,000 -> Projected daily: 114285.71 (safe)
    safe_sim = service.simulate_purchase(
        user_id=sample_user.id, planned_amount=Decimal("200000.00"), today=date(2026, 9, 18)
    )
    assert safe_sim.is_safe is True
    assert "aman dilakukan" in safe_sim.advice
    assert safe_sim.projected_daily_runway == Decimal("114285.71")

    # Purchase: 850,000 -> Projected free: 150,000 / 7 = 21428.57 < 30000 -> WARNING / Unsafe
    risky_sim = service.simulate_purchase(
        user_id=sample_user.id, planned_amount=Decimal("850000.00"), today=date(2026, 9, 18)
    )
    assert risky_sim.is_safe is False
    assert "Peringatan" in risky_sim.advice
    assert risky_sim.projected_daily_runway == Decimal("21428.57")


def test_runway_health_status_thresholds(db_session, sample_user):
    sample_user.monthly_cycle_day = 25
    acc = Account(
        user_id=sample_user.id,
        name="Cash",
        account_type=AccountType.CASH,
        current_balance=Decimal("140000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    service = RunwayService(db_session)
    # 140,000 / 7 = 20,000/day (< 30,000) -> WARNING
    report = service.calculate_runway(user_id=sample_user.id, today=date(2026, 9, 18))
    assert report.health_status == "WARNING"
    assert report.daily_safe_runway == Decimal("20000.00")

    # Balance: 0 -> CRITICAL
    acc.current_balance = Decimal("0.00")
    db_session.commit()
    RunwayService.clear_cache(user_id=sample_user.id)
    report_critical = service.calculate_runway(user_id=sample_user.id, today=date(2026, 9, 18))
    assert report_critical.health_status == "CRITICAL"
    assert report_critical.daily_safe_runway == Decimal("0.00")

    # End of month cycle transition (e.g. today is 28th, cycle day is 25th)
    # September has 30 days. (30 - 28) + 25 = 27 days remaining.
    acc.current_balance = Decimal("2700000.00")
    db_session.commit()
    report_eom = service.calculate_runway(user_id=sample_user.id, today=date(2026, 9, 28))
    assert report_eom.days_remaining == 27
    assert report_eom.daily_safe_runway == Decimal("100000.00")
    assert report_eom.health_status == "HEALTHY"


def test_get_daily_spending_breakdown_continuous_seven_days(db_session, sample_user):
    """Verifies continuous 7-day date sequence, zero-fill on quiet days, and safe runway benchmarking."""
    sample_user.monthly_cycle_day = 29
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


def test_uncategorized_expense_included_in_daily_and_monthly_breakdowns(db_session, sample_user):
    """Verifies that expenses with no category (category_id=None) are captured in daily and monthly reports."""
    sample_user.monthly_cycle_day = 1
    acc = Account(
        user_id=sample_user.id,
        name="Cash",
        account_type=AccountType.CASH,
        current_balance=Decimal("500000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    ref_date = date(2026, 9, 19)

    tx = Transaction(
        user_id=sample_user.id,
        description="Belanja Parkir & Tips",
        transaction_date=datetime(2026, 9, 19, 10, 0, tzinfo=timezone.utc),
    )
    db_session.add(tx)
    db_session.flush()

    # Expense debit entry without category (category_id=None)
    debit_entry = LedgerEntry(
        transaction_id=tx.id,
        user_id=sample_user.id,
        category_id=None,
        account_id=None,
        entry_type=EntryType.DEBIT,
        amount=Decimal("15000.00"),
    )
    credit_entry = LedgerEntry(
        transaction_id=tx.id,
        user_id=sample_user.id,
        category_id=None,
        account_id=acc.id,
        entry_type=EntryType.CREDIT,
        amount=Decimal("15000.00"),
    )
    db_session.add_all([debit_entry, credit_entry])
    db_session.commit()

    service = RunwayService(db_session)

    # 1. Daily breakdown should include this 15.000 expense
    daily = service.get_daily_spending_breakdown(user_id=sample_user.id, days=7, today=ref_date)
    assert daily.total_spent_in_period == Decimal("15000.00")
    today_item = daily.items[-1]
    assert today_item.amount == Decimal("15000.00")

    # 2. Monthly breakdown should include it under "Lainnya / Tanpa Kategori"
    monthly = service.get_category_spending_breakdown(user_id=sample_user.id, today=ref_date)
    assert monthly.total_spent == Decimal("15000.00")
    assert len(monthly.items) == 1
    assert monthly.items[0].category_id is None
    assert monthly.items[0].category_name == "Lainnya / Tanpa Kategori"
    assert monthly.items[0].amount == Decimal("15000.00")
    assert monthly.items[0].percentage == Decimal("100.0")


def test_unlocked_vault_not_counted_in_locked_cash(db_session, sample_user):
    """Verifies that unlocked vaults (is_locked=False) do not deduct from operational free cash."""
    sample_user.monthly_cycle_day = 25
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("1000000.00"),
    )
    locked_vlt = Vault(
        user_id=sample_user.id,
        name="Tabungan Darurat",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("500000.00"),
        allocated_amount=Decimal("200000.00"),
        is_locked=True,
    )
    unlocked_vlt = Vault(
        user_id=sample_user.id,
        name="Wishlist Gadget",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("1000000.00"),
        allocated_amount=Decimal("300000.00"),
        is_locked=False,
    )
    db_session.add_all([acc, locked_vlt, unlocked_vlt])
    db_session.commit()

    service = RunwayService(db_session)
    report = service.calculate_runway(user_id=sample_user.id, today=date(2026, 9, 18))

    assert report.total_liquid_cash == Decimal("1000000.00")
    assert report.vault_locked_cash == Decimal("200000.00")
    assert report.operational_free_cash == Decimal("800000.00")


def test_runway_month_end_cycle_day_short_month(db_session, sample_user):
    """Verifies that monthly_cycle_day=31 on Feb 20 correctly caps at 28 days returning 8 days remaining."""
    sample_user.monthly_cycle_day = 31
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("1000000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    service = RunwayService(db_session)
    # February 2026 has 28 days (non-leap year). 28 - 20 = 8 days remaining.
    report = service.calculate_runway(user_id=sample_user.id, today=date(2026, 2, 20))

    assert report.days_remaining == 8


def test_runway_custom_safe_threshold_warning(db_session, sample_user):
    """When user.safe_runway_threshold = 50,000 and daily safe is 40,000, status evaluates to WARNING."""
    sample_user.monthly_cycle_day = 25
    sample_user.safe_runway_threshold = Decimal("50000.00")
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("200000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    service = RunwayService(db_session)
    report = service.calculate_runway(user_id=sample_user.id, today=date(2026, 9, 20))

    assert report.daily_safe_runway == Decimal("40000.00")
    assert report.health_status == "WARNING"


def test_runway_custom_safe_threshold_healthy(db_session, sample_user):
    """When user.safe_runway_threshold = 20,000 and daily safe is 25,000, status evaluates to HEALTHY."""
    sample_user.monthly_cycle_day = 25
    sample_user.safe_runway_threshold = Decimal("20000.00")
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("125000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    service = RunwayService(db_session)
    report = service.calculate_runway(user_id=sample_user.id, today=date(2026, 9, 20))

    assert report.daily_safe_runway == Decimal("25000.00")
    assert report.health_status == "HEALTHY"


def test_simulate_purchase_uses_custom_safe_threshold(db_session, sample_user):
    """simulate_purchase uses the user's custom threshold for determining is_safe."""
    sample_user.monthly_cycle_day = 25
    sample_user.safe_runway_threshold = Decimal("50000.00")
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("500000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    service = RunwayService(db_session)
    sim = service.simulate_purchase(
        user_id=sample_user.id,
        planned_amount=Decimal("200000.00"),
        today=date(2026, 9, 18),
    )

    assert sim.projected_daily_runway == Decimal("42857.14")
    assert sim.is_safe is False
    assert "Peringatan" in sim.advice


def test_calculate_runway_ttl_cache_and_clear_cache(db_session, sample_user):
    """Verifies that calculate_runway caches results within 15s TTL and clear_cache invalidates it."""
    from rezekify.services.ledger import LedgerService

    RunwayService.clear_cache()
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("1000000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    service = RunwayService(db_session)
    today = date(2026, 9, 18)

    t0 = 1000.0
    with patch("time.time", return_value=t0):
        report1 = service.calculate_runway(user_id=sample_user.id, today=today)
        assert report1.total_liquid_cash == Decimal("1000000.00")

    # Directly mutate balance in DB
    acc.current_balance = Decimal("2000000.00")
    db_session.commit()

    # Within 15s TTL (t0 + 10s): returns cached report
    with patch("time.time", return_value=t0 + 10.0):
        report2 = service.calculate_runway(user_id=sample_user.id, today=today)
        assert report2.total_liquid_cash == Decimal("1000000.00")

    # Bypassing cache via use_cache=False returns fresh DB data
    with patch("time.time", return_value=t0 + 10.0):
        report_nocache = service.calculate_runway(user_id=sample_user.id, today=today, use_cache=False)
        assert report_nocache.total_liquid_cash == Decimal("2000000.00")

    # Beyond 15s TTL (t0 + 26s vs last cache update at t0 + 10s): cache expires and returns fresh DB data
    acc.current_balance = Decimal("2500000.00")
    db_session.commit()
    with patch("time.time", return_value=t0 + 26.0):
        report_expired = service.calculate_runway(user_id=sample_user.id, today=today)
        assert report_expired.total_liquid_cash == Decimal("2500000.00")

    # Mutate DB again and verify clear_cache(user_id) invalidates
    acc.current_balance = Decimal("3000000.00")
    db_session.commit()
    RunwayService.clear_cache(user_id=sample_user.id)
    with patch("time.time", return_value=t0 + 27.0):
        report_after_clear = service.calculate_runway(user_id=sample_user.id, today=today)
        assert report_after_clear.total_liquid_cash == Decimal("3000000.00")

    # Ledger mutation invalidates cache immediately
    ledger = LedgerService(db_session)
    ledger.record_expense(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=None,
        amount=Decimal("500000.00"),
        description="Jajan",
    )
    with patch("time.time", return_value=t0 + 28.0):
        report_post_ledger = service.calculate_runway(user_id=sample_user.id, today=today)
        assert report_post_ledger.total_liquid_cash == Decimal("2500000.00")


def test_runway_cache_sweep_and_fifo_cap(db_session):
    import time
    from uuid import uuid4
    from rezekify.services.runway import (
        MAX_RUNWAY_CACHE,
        RunwayReport,
        RunwayService,
        _runway_cache,
    )

    user = User(
        email=f"runway-cache-{uuid4().hex[:8]}@rezekify.local",
        password_hash="dummyhash",
        full_name="Runway Cache Tester",
    )
    db_session.add(user)
    db_session.flush()

    acc = Account(
        user_id=user.id,
        name="Kas",
        account_type=AccountType.CASH,
        current_balance=Decimal("1000000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    service = RunwayService(db=db_session)
    RunwayService.clear_cache()

    # Pre-populate cache with 5,100 dummy entries
    dummy_report = RunwayReport(
        total_liquid_cash=Decimal("1000000.00"),
        vault_locked_cash=Decimal("0.00"),
        operational_free_cash=Decimal("1000000.00"),
        days_remaining=30,
        daily_safe_runway=Decimal("33333.33"),
        health_status="HEALTHY",
        upcoming_bills=[],
    )

    old_ts = time.time() - 20.0  # Expired relative to 15s TTL
    for i in range(5100):
        fake_user_id = uuid4()
        _runway_cache[(fake_user_id, date.today() - timedelta(days=i % 10))] = (dummy_report, old_ts)

    assert len(_runway_cache) == 5100

    # Calling calculate_runway should trigger lazy sweep and bounded cap
    service.calculate_runway(user_id=user.id)
    assert len(_runway_cache) <= MAX_RUNWAY_CACHE



