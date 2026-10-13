"""Universal Faceted Ledger Query Engine with deterministic arithmetic and tenant isolation."""

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Union
from uuid import UUID

from sqlalchemy import String, func, or_
from sqlalchemy.orm import Session, aliased

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


# Compatibility alias
GroupedMetricRow = FacetedGroupItem


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
        if params.start_date is not None:
            start = params.start_date
        elif params.group_by == "none":
            start = today - timedelta(days=90)
        else:
            start = date(today.year, today.month, 1)
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

    def execute_query(
        self,
        user_id_or_db: Union[UUID, Session],
        params_or_user_id: Union[FacetedQueryParams, UUID],
        params: Optional[FacetedQueryParams] = None,
    ) -> FacetedQueryResult:
        """Alias supporting both engine.execute_query(user_id, params) and engine.execute_query(db, user_id, params)."""
        if isinstance(user_id_or_db, Session):
            db = user_id_or_db
            user_id = params_or_user_id  # type: ignore[assignment]
            target_params = params  # type: ignore[assignment]
            return FacetedQueryEngine(db).execute(user_id, target_params)
        user_id = user_id_or_db
        target_params = params_or_user_id  # type: ignore[assignment]
        return self.execute(user_id, target_params)

    def compare_periods(
        self,
        user_id: UUID,
        current_params: FacetedQueryParams,
        previous_params: FacetedQueryParams,
    ) -> PeriodComparisonResult:
        """Compares two arbitrary periods deterministically."""
        cur_result = self.execute(user_id, current_params)
        prev_result = self.execute(user_id, previous_params)

        cur_total = cur_result.summary.get("total_amount", Decimal("0.00"))
        prev_total = prev_result.summary.get("total_amount", Decimal("0.00"))
        delta_amount = cur_total - prev_total

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

        return PeriodComparisonResult(
            previous_total_amount=prev_total,
            delta_amount=delta_amount,
            delta_percentage=delta_pct,
            trend=trend,
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
            filters.append(
                or_(
                    LedgerEntry.category_id.isnot(None),
                    LedgerEntry.account_id.is_(None),
                )
            )
        elif flow == "INCOME":
            filters.append(LedgerEntry.entry_type == EntryType.CREDIT)
            filters.append(LedgerEntry.category_id.isnot(None))
        elif flow == "TRANSFER":
            filters.append(LedgerEntry.entry_type == EntryType.DEBIT)
            filters.append(LedgerEntry.account_id.isnot(None))
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

    _build_base_query = _build_base_filters

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
            "total_amount": Decimal(str(row.total or 0)).quantize(Decimal("0.01")),
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
        elif params.group_by == "account":
            group_expr = func.coalesce(Account.name, "Akun Utama")
        elif params.group_by == "month":
            # Substring YYYY-MM ANSI compatible across PostgreSQL and SQLite
            group_expr = func.substr(func.cast(Transaction.transaction_date, String), 1, 7)
        elif params.group_by == "day":
            group_expr = func.substr(func.cast(Transaction.transaction_date, String), 1, 10)
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
        )

        if params.group_by == "account":
            account_leg = aliased(LedgerEntry)
            query = query.outerjoin(
                account_leg,
                LedgerEntry.account_id.is_(None)
                & (account_leg.transaction_id == Transaction.id)
                & (account_leg.account_id.isnot(None)),
            ).outerjoin(
                Account,
                Account.id == func.coalesce(LedgerEntry.account_id, account_leg.account_id),
            )

        query = (
            query.filter(*filters)
            .group_by(group_expr)
            .order_by(func.sum(LedgerEntry.amount).desc())
            .limit(limit)
        )

        rows = query.all()
        result: List[FacetedGroupItem] = []
        for r in rows:
            amt = Decimal(str(r.grp_total or 0)).quantize(Decimal("0.01"))
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

        if params.order_by == "date_desc":
            order_clause = Transaction.transaction_date.desc()
        elif params.order_by == "date_asc":
            order_clause = Transaction.transaction_date.asc()
        elif params.order_by == "amount_asc":
            order_clause = LedgerEntry.amount.asc()
        elif params.order_by == "amount_desc":
            order_clause = LedgerEntry.amount.desc()
        else:
            order_clause = Transaction.transaction_date.desc()

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
            .order_by(order_clause)
            .limit(limit)
        )

        rows = query.all()
        items = []
        for r in rows:
            items.append({
                "id": str(r.tx_id),
                "date": r.tx_date.isoformat() if r.tx_date else None,
                "description": r.tx_desc,
                "amount": Decimal(str(r.tx_amount or 0)).quantize(Decimal("0.01")),
                "category": r.cat_name or "Uncategorized",
            })
        return items
