"""Tests for RunwayService calculation, upcoming bills, and simulation."""

from datetime import date
from decimal import Decimal
import pytest

from rezekify.db.models import Account, AccountType, Vault, VaultType
from rezekify.services.runway import RunwayService


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
    )
    bill = Vault(
        user_id=sample_user.id,
        name="Tagihan Listrik & WiFi",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("500000.00"),
        allocated_amount=Decimal("200000.00"),
        target_date=date(2026, 9, 23),
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
