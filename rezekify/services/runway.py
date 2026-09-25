"""Dynamic Runway Calculator & Spending Simulation Engine."""

from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal
import time
from typing import Dict, List, NamedTuple, Optional
from uuid import UUID

from sqlalchemy import func, or_
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
    category_id: Optional[UUID]
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


# In-memory TTL cache: (user_id, today) -> (RunwayReport, timestamp)
_runway_cache: dict[tuple[UUID, date], tuple[RunwayReport, float]] = {}
MAX_RUNWAY_CACHE: int = 5000
RUNWAY_CACHE_TTL_SECONDS: float = 15.0
SWEEP_INTERVAL_SECONDS: float = 60.0
_last_runway_sweep: float = 0.0



class RunwayService:
    """Computes deterministic daily safe runway and simulates purchase impact."""

    def __init__(self, db: Session):
        self.db = db

    @classmethod
    def clear_cache(cls, user_id: Optional[UUID] = None) -> None:
        """Clears in-memory runway cache for a specific user or entirely."""
        if user_id is not None:
            keys_to_delete = [k for k in list(_runway_cache.keys()) if k[0] == user_id]
            for k in keys_to_delete:
                _runway_cache.pop(k, None)
        else:
            _runway_cache.clear()

    def calculate_runway(
        self, user_id: UUID, today: Optional[date] = None, use_cache: bool = True
    ) -> RunwayReport:
        """Calculates liquid cash, locked reserves, operational free cash, days remaining,
        and safe daily spending threshold for a user."""
        global _last_runway_sweep
        if today is None:
            today = date.today()

        now = time.time()

        # Lazy cache sweep
        # ponytail: in-memory cache sweep runs amortized every 60s or when cache >= 5000; move to Redis cache at scale
        if now - _last_runway_sweep > SWEEP_INTERVAL_SECONDS or len(_runway_cache) >= MAX_RUNWAY_CACHE:
            items_snapshot = list(_runway_cache.items())
            expired_keys = [k for k, (_, ts) in items_snapshot if now - ts > RUNWAY_CACHE_TTL_SECONDS]
            for k in expired_keys:
                _runway_cache.pop(k, None)

            if len(_runway_cache) >= MAX_RUNWAY_CACHE:
                expired_set = set(expired_keys)
                remaining_items = [item for item in items_snapshot if item[0] not in expired_set]
                sorted_items = sorted(remaining_items, key=lambda item: item[1][1])
                excess = len(_runway_cache) - int(MAX_RUNWAY_CACHE * 0.8)
                for k, _ in sorted_items[:max(0, excess)]:
                    _runway_cache.pop(k, None)

            _last_runway_sweep = now

        if use_cache:
            cache_entry = _runway_cache.get((user_id, today))
            if cache_entry is not None:
                cached_report, ts = cache_entry
                if now - ts < RUNWAY_CACHE_TTL_SECONDS:
                    return cached_report

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
            .filter(Vault.user_id == user_id, Vault.is_locked == True)
            .scalar()
        )

        operational_free = max(Decimal("0.00"), liquid_sum - vault_sum)

        # Calculate days remaining until monthly cycle day
        cycle_day = int(user.monthly_cycle_day)
        # ponytail: caps monthly cycle day to month length; add dateutil.rrule if custom recurrences needed
        _, days_in_current_month = monthrange(today.year, today.month)
        effective_cycle_day: int = min(cycle_day, int(days_in_current_month))

        if today.day < effective_cycle_day:
            days_remaining = effective_cycle_day - today.day
        else:
            next_year = today.year + 1 if today.month == 12 else today.year
            next_month = 1 if today.month == 12 else today.month + 1
            _, days_in_next_month = monthrange(next_year, next_month)
            next_effective_cycle: int = min(cycle_day, int(days_in_next_month))
            days_remaining = (days_in_current_month - today.day) + next_effective_cycle

        days_remaining = max(1, days_remaining)
        daily_safe = (operational_free / Decimal(str(days_remaining))).quantize(Decimal("0.01"))

        # Health status evaluation
        threshold = (
            user.safe_runway_threshold
            if getattr(user, "safe_runway_threshold", None) is not None
            else Decimal("30000.00")
        )
        if operational_free <= Decimal("0.00"):
            status = "CRITICAL"
        elif daily_safe < threshold:
            status = "WARNING"
        else:
            status = "HEALTHY"

        upcoming_bills = self.get_upcoming_bills(user_id=user_id, today=today)

        report = RunwayReport(
            total_liquid_cash=liquid_sum,
            vault_locked_cash=vault_sum,
            operational_free_cash=operational_free,
            days_remaining=days_remaining,
            daily_safe_runway=daily_safe,
            health_status=status,
            upcoming_bills=upcoming_bills,
        )
        _runway_cache[(user_id, today)] = (report, time.time())
        return report

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
        user = self.db.query(User).filter_by(id=user_id).one()
        threshold = (
            user.safe_runway_threshold
            if getattr(user, "safe_runway_threshold", None) is not None
            else Decimal("30000.00")
        )
        current = self.calculate_runway(user_id, today)
        projected_free = max(Decimal("0.00"), current.operational_free_cash - planned_amount)
        projected_daily = (projected_free / Decimal(str(current.days_remaining))).quantize(Decimal("0.01"))
        drop = current.daily_safe_runway - projected_daily

        is_safe = projected_daily >= threshold
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
            .outerjoin(Category, LedgerEntry.category_id == Category.id)
            .filter(
                Transaction.user_id == user_id,
                LedgerEntry.entry_type == EntryType.DEBIT,
                or_(Category.category_type == CategoryType.EXPENSE, Category.id.is_(None)),
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
            .select_from(LedgerEntry)
            .join(Transaction, LedgerEntry.transaction_id == Transaction.id)
            .outerjoin(Category, LedgerEntry.category_id == Category.id)
            .filter(
                Transaction.user_id == user_id,
                LedgerEntry.entry_type == EntryType.DEBIT,
                or_(Category.category_type == CategoryType.EXPENSE, Category.id.is_(None)),
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
                cat_name = r.category_name if r.category_name is not None else "Lainnya / Tanpa Kategori"
                cat_color = r.category_color or "#64748b"
                items.append(
                    CategoryBreakdownItem(
                        category_id=r.category_id,
                        category_name=cat_name,
                        amount=amt,
                        percentage=pct,
                        color=cat_color,
                    )
                )

        return CategorySpendingBreakdownReport(
            period="monthly",
            cycle_start_date=cycle_start,
            cycle_end_date=cycle_end,
            total_spent=total_spent,
            items=items,
        )
