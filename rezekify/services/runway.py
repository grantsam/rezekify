"""Dynamic Runway Calculator & Spending Simulation Engine."""

from calendar import monthrange
from datetime import date
from decimal import Decimal
from typing import List, NamedTuple, Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from rezekify.db.models import Account, AccountType, User, Vault, VaultType


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


class RunwayService:
    """Computes deterministic daily safe runway and simulates purchase impact."""

    def __init__(self, db: Session):
        self.db = db

    def calculate_runway(self, user_id: UUID, today: Optional[date] = None) -> RunwayReport:
        """Calculates liquid cash, locked reserves, operational free cash, days remaining,
        and safe daily spending threshold for a user."""
        if today is None:
            today = date.today()

        user = self.db.query(User).filter_by(id=user_id).one()

        # Total liquid cash from CASH, BANK, EWALLET
        liquid_sum = (
            self.db.query(func.coalesce(func.sum(Account.current_balance), Decimal("0.00")))
            .filter(
                Account.user_id == user_id,
                Account.account_type.in_([AccountType.CASH, AccountType.BANK, AccountType.EWALLET]),
            )
            .scalar()
        )

        # Total locked vault reserves
        vault_sum = (
            self.db.query(func.coalesce(func.sum(Vault.allocated_amount), Decimal("0.00")))
            .filter(Vault.user_id == user_id)
            .scalar()
        )

        operational_free = max(Decimal("0.00"), liquid_sum - vault_sum)

        # Calculate days remaining until monthly cycle day
        cycle_day = user.monthly_cycle_day
        if today.day < cycle_day:
            days_remaining = cycle_day - today.day
        else:
            _, days_in_current_month = monthrange(today.year, today.month)
            days_remaining = (days_in_current_month - today.day) + cycle_day

        days_remaining = max(1, days_remaining)
        daily_safe = (operational_free / Decimal(str(days_remaining))).quantize(Decimal("0.01"))

        # Health status evaluation
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
        """Retrieves fixed commitments (FIXED_BILL) with due date within 7 days and unmet target."""
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
        """Simulates the cognitive and financial impact of a discretionary purchase on daily runway."""
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
