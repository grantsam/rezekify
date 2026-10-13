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

FINANCIAL_TOOLS: List[Dict[str, Any]] = AGENT_TOOL_DEFINITIONS


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
                "message": f"Validation error: Validasi parameter gagal untuk '{tool_name}': {str(e)}",
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


def execute_financial_tool(
    tool_name: str,
    arguments: Dict[str, Any],
    user_id: UUID,
    db: Session,
) -> Dict[str, Any]:
    """Execute a financial tool deterministically for the given user."""
    dispatcher = AgentToolDispatcher(db)
    return dispatcher.dispatch(user_id=user_id, tool_name=tool_name, arguments=arguments)
