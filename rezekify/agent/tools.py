"""Tool schemas and deterministic dispatcher for Autonomous Financial Copilot."""

from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, ValidationError, model_validator
from sqlalchemy.orm import Session

from rezekify.api.v1.vaults_router import advance_one_month
from rezekify.db.models import Account, Category, CategoryType, Vault, VaultType
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
                "order_by": {
                    "type": "string",
                    "enum": ["date_desc", "date_asc", "amount_desc", "amount_asc"],
                    "description": "Sorting order for items query. Default: date_desc.",
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
                "from_account": {
                    "type": "string",
                    "description": "Source account name (alias for account_name).",
                },
                "category_name": {
                    "type": "string",
                    "description": "Category name (required for expense/income).",
                },
                "description": {
                    "type": "string",
                    "description": "Brief description of the transaction.",
                },
                "note": {
                    "type": "string",
                    "description": "Transaction note or description (alias for description).",
                },
                "to_account_name": {
                    "type": "string",
                    "description": "Destination account name (for transfers only).",
                },
                "to_account": {
                    "type": "string",
                    "description": "Destination account name (alias for to_account_name).",
                },
            },
            "required": ["action", "amount", "account_name", "description"],
        },
    },
    {
        "name": "manage_vault",
        "description": "Kelola pos alokasi dana dan sinking fund (vault): nabung/deposit dana, bayar tagihan (dengan pembukuan otomatis), kunci/buka vault, atau periksa status vault.",
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["deposit", "pay_bill", "toggle_lock", "check_status"],
                    "description": "Aksi pada vault: 'deposit' (tambah saldo alokasi), 'pay_bill' (bayar tagihan & catat pengeluaran), 'toggle_lock' (kunci/buka kunci), atau 'check_status' (lihat progres vault).",
                },
                "vault_name": {
                    "type": "string",
                    "description": "Nama atau kata kunci nama vault/pos tabungan/tagihan (misal: 'Dana Darurat', 'Listrik PLN').",
                },
                "amount": {
                    "type": "number",
                    "description": "Nominal uang dalam Rupiah untuk deposit atau pembayaran tagihan.",
                },
                "account_name": {
                    "type": "string",
                    "description": "Nama akun sumber pembayaran atau deposit (misal: 'BCA', 'Mandiri', 'Cash').",
                },
                "lock_state": {
                    "type": "boolean",
                    "description": "Status kunci target (opsional, jika ingin mengunci/membuka eksplisit).",
                },
            },
            "required": ["action"],
        },
    },
]

FINANCIAL_TOOLS: List[Dict[str, Any]] = AGENT_TOOL_DEFINITIONS


class QueryLedgerArgs(BaseModel):
    flow_type: Optional[str] = "EXPENSE"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    categories: Optional[List[str]] = None
    accounts: Optional[List[str]] = None
    keyword: Optional[str] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None
    group_by: Optional[str] = "none"
    compare_with_previous_period: Optional[bool] = False
    limit: Optional[int] = 50
    order_by: Optional[str] = "date_desc"

    @model_validator(mode="before")
    @classmethod
    def sanitize_arguments(cls, data: Any) -> Any:
        if isinstance(data, dict):
            d = dict(data)
            raw_flow = d.get("flow_type")
            if not raw_flow:
                d["flow_type"] = "EXPENSE"
            elif isinstance(raw_flow, str):
                f_upper = raw_flow.strip().upper()
                d["flow_type"] = "ALL" if f_upper in ("ALL", "SEMUA") else f_upper
            if d.get("group_by") is None:
                d["group_by"] = "none"
            if d.get("compare_with_previous_period") is None:
                d["compare_with_previous_period"] = False
            if d.get("limit") is None:
                d["limit"] = 50
            if d.get("order_by") is None:
                d["order_by"] = "date_desc"
            return d
        return data


class SimulatePurchaseArgs(BaseModel):
    planned_amount: Decimal = Field(gt=0)
    category_name: Optional[str] = None
    account_name: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def sanitize_arguments(cls, data: Any) -> Any:
        if isinstance(data, dict):
            d = dict(data)
            amt = d.get("planned_amount")
            if isinstance(amt, str):
                cleaned = amt.strip().replace("Rp", "").replace("rp", "").replace(" ", "").replace(",", "")
                try:
                    d["planned_amount"] = Decimal(cleaned)
                except Exception:
                    pass
            elif isinstance(amt, (int, float)) and not isinstance(amt, bool):
                d["planned_amount"] = Decimal(str(amt))
            return {k: v for k, v in d.items() if v is not None}
        return data


class RecordTransactionArgs(BaseModel):
    action: str
    amount: Decimal = Field(gt=0)
    account_name: Optional[str] = None
    from_account: Optional[str] = None
    description: Optional[str] = None
    note: Optional[str] = None
    category_name: Optional[str] = None
    to_account_name: Optional[str] = None
    to_account: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def sanitize_arguments(cls, data: Any) -> Any:
        if isinstance(data, dict):
            d = dict(data)
            amt = d.get("amount")
            if isinstance(amt, str):
                cleaned = amt.strip().replace("Rp", "").replace("rp", "").replace(" ", "").replace(",", "")
                try:
                    d["amount"] = Decimal(cleaned)
                except Exception:
                    pass
            elif isinstance(amt, (int, float)) and not isinstance(amt, bool):
                d["amount"] = Decimal(str(amt))
            return {k: v for k, v in d.items() if v is not None}
        return data

    @model_validator(mode="after")
    def validate_accounts(self) -> "RecordTransactionArgs":
        if not self.account_name and not self.from_account:
            raise ValueError("account_name or from_account is required.")
        if not self.account_name:
            self.account_name = self.from_account
        if not self.from_account:
            self.from_account = self.account_name
        if not self.to_account_name and self.to_account:
            self.to_account_name = self.to_account
        if not self.to_account and self.to_account_name:
            self.to_account = self.to_account_name
        self.description = self.description or self.note or "Transaksi"
        return self


class ManageVaultArgs(BaseModel):
    action: str
    vault_name: Optional[str] = None
    amount: Optional[Decimal] = None
    account_name: Optional[str] = None
    lock_state: Optional[bool] = None

    @model_validator(mode="before")
    @classmethod
    def sanitize_arguments(cls, data: Any) -> Any:
        if isinstance(data, dict):
            d = dict(data)
            if "action" in d and isinstance(d["action"], str):
                d["action"] = d["action"].strip().lower()
            amt = d.get("amount")
            if isinstance(amt, str):
                cleaned = amt.strip().replace("Rp", "").replace("rp", "").replace(" ", "")
                if "." in cleaned and "," in cleaned:
                    if cleaned.rfind(",") > cleaned.rfind("."):
                        cleaned = cleaned.replace(".", "").replace(",", ".")
                    else:
                        cleaned = cleaned.replace(",", "")
                elif "." in cleaned:
                    parts = cleaned.split(".")
                    if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) == 3):
                        cleaned = cleaned.replace(".", "")
                elif "," in cleaned:
                    parts = cleaned.split(",")
                    if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) == 3):
                        cleaned = cleaned.replace(",", "")
                    else:
                        cleaned = cleaned.replace(",", ".")
                try:
                    d["amount"] = Decimal(cleaned)
                except Exception:
                    d["amount"] = None
            elif isinstance(amt, (int, float)) and not isinstance(amt, bool):
                d["amount"] = Decimal(str(amt))
            return d
        return data


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
            elif tool_name == "manage_vault":
                return self._dispatch_manage_vault(user_id, arguments)
            else:
                msg = f"Alat '{tool_name}' tidak dikenal atau tidak tersedia."
                return {
                    "status": "error",
                    "message": msg,
                    "error": msg,
                }
        except (ValidationError, ValueError, Exception) as exc:
            self.db.rollback()
            return {
                "status": "error",
                "message": str(exc),
                "error": str(exc),
            }

    def _dispatch_query_ledger(self, user_id: UUID, arguments: Dict[str, Any]) -> Dict[str, Any]:
        validated = QueryLedgerArgs(**arguments)
        s_date = date.fromisoformat(validated.start_date) if validated.start_date else None
        e_date = date.fromisoformat(validated.end_date) if validated.end_date else None

        params = FacetedQueryParams(
            flow_type=validated.flow_type or "EXPENSE",
            start_date=s_date,
            end_date=e_date,
            categories=validated.categories,
            accounts=validated.accounts,
            keyword=validated.keyword,
            min_amount=validated.min_amount,
            max_amount=validated.max_amount,
            group_by=validated.group_by or "none",
            compare_with_previous_period=bool(validated.compare_with_previous_period),
            limit=validated.limit or 50,
            order_by=validated.order_by or "date_desc",
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

        if validated.account_name:
            validated.account_name = validated.account_name.replace("%", "").replace("_", "").strip()
        if validated.from_account:
            validated.from_account = validated.from_account.replace("%", "").replace("_", "").strip()
        if validated.category_name:
            validated.category_name = validated.category_name.replace("%", "").replace("_", "").strip()
        if validated.to_account:
            validated.to_account = validated.to_account.replace("%", "").replace("_", "").strip()
        if validated.to_account_name:
            validated.to_account_name = validated.to_account_name.replace("%", "").replace("_", "").strip()

        acc_lookup = validated.account_name or validated.from_account
        account = None
        if acc_lookup:
            account = (
                self.db.query(Account)
                .filter(Account.user_id == user_id, Account.name.ilike(acc_lookup))
                .first()
            )
            if not account:
                account = (
                    self.db.query(Account)
                    .filter(Account.user_id == user_id, Account.name.ilike(f"%{acc_lookup}%"))
                    .first()
                )
        if not account:
            err_msg = f"Akun '{acc_lookup or ''}' tidak ditemukan."
            return {
                "status": "error",
                "message": err_msg,
                "error": err_msg,
            }

        action = validated.action.lower()
        category = None
        if action == "expense":
            cat_name = validated.category_name or "Umum"
            category = (
                self.db.query(Category)
                .filter(
                    Category.user_id == user_id,
                    Category.category_type == CategoryType.EXPENSE,
                    Category.name.ilike(f"%{cat_name}%"),
                )
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
                .filter(
                    Category.user_id == user_id,
                    Category.category_type == CategoryType.INCOME,
                    Category.name.ilike(f"%{cat_name}%"),
                )
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
            to_lookup = validated.to_account_name or validated.to_account
            if not to_lookup:
                err_msg = "to_account_name wajib untuk transfer."
                return {"status": "error", "message": err_msg, "error": err_msg}
            to_acc = (
                self.db.query(Account)
                .filter(Account.user_id == user_id, Account.name.ilike(to_lookup))
                .first()
            )
            if not to_acc:
                to_acc = (
                    self.db.query(Account)
                    .filter(Account.user_id == user_id, Account.name.ilike(f"%{to_lookup}%"))
                    .first()
                )
            if not to_acc or to_acc.id == account.id:
                err_msg = "Akun tujuan transfer tidak valid atau sama dengan sumber."
                return {"status": "error", "message": err_msg, "error": err_msg}

            tx = self.ledger_service.record_transfer(
                user_id=user_id,
                from_account_id=account.id,
                to_account_id=to_acc.id,
                amount=validated.amount,
                description=validated.description,
            )
        else:
            err_msg = f"Action '{action}' tidak didukung."
            return {"status": "error", "message": err_msg, "error": err_msg}

        self.db.refresh(account)
        category_name = category.name if category else ("Transfer" if action == "transfer" else None)
        return {
            "status": "success",
            "transaction": {
                "id": str(tx.id),
                "action": action,
                "type": action.upper(),
                "amount": validated.amount,
                "account_name": account.name,
                "category_name": category_name,
                "description": validated.description,
                "account_balance_after": account.current_balance,
            },
        }

    def _dispatch_manage_vault(self, user_id: UUID, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Dispatches vault operations: deposit, pay_bill, toggle_lock, and check_status.

        ponytail: direct vault lookup by ilike name; upgrade to semantic vector search if alias resolution needed.
        """
        validated = ManageVaultArgs(**arguments)
        action = validated.action

        if action == "check_status":
            query = self.db.query(Vault).filter(Vault.user_id == user_id)
            if validated.vault_name:
                vault = query.filter(Vault.name.ilike(f"%{validated.vault_name.strip()}%")).first()
                if not vault:
                    return {"status": "error", "message": f"Vault '{validated.vault_name}' tidak ditemukan."}
                pct = int(round((vault.allocated_amount / vault.target_amount) * 100)) if vault.target_amount > 0 else 100
                return {
                    "status": "success",
                    "vault": {
                        "id": str(vault.id),
                        "name": vault.name,
                        "vault_type": vault.vault_type.value,
                        "allocated_amount": vault.allocated_amount,
                        "target_amount": vault.target_amount,
                        "percentage": pct,
                        "is_locked": vault.is_locked,
                        "target_date": vault.target_date.isoformat() if vault.target_date else None,
                    },
                }
            all_vaults = query.all()
            return {
                "status": "success",
                "vaults": [
                    {
                        "id": str(v.id),
                        "name": v.name,
                        "vault_type": v.vault_type.value,
                        "allocated_amount": v.allocated_amount,
                        "target_amount": v.target_amount,
                        "percentage": int(round((v.allocated_amount / v.target_amount) * 100)) if v.target_amount > 0 else 100,
                        "is_locked": v.is_locked,
                    }
                    for v in all_vaults
                ],
            }

        if not validated.vault_name:
            return {"status": "error", "message": "Parameter 'vault_name' wajib diisi."}

        vault = (
            self.db.query(Vault)
            .filter(Vault.user_id == user_id, Vault.name.ilike(f"%{validated.vault_name.strip()}%"))
            .first()
        )
        if not vault:
            return {"status": "error", "message": f"Vault '{validated.vault_name}' tidak ditemukan."}

        if action == "deposit":
            if not validated.amount or validated.amount <= 0:
                return {"status": "error", "message": "Nominal deposit harus lebih besar dari 0."}
            if validated.account_name:
                acc = (
                    self.db.query(Account)
                    .filter(Account.user_id == user_id, Account.name.ilike(f"%{validated.account_name.strip()}%"))
                    .first()
                )
                if not acc:
                    return {
                        "status": "error",
                        "message": f"Akun rekening '{validated.account_name}' tidak ditemukan.",
                    }
                if acc.current_balance < validated.amount:
                    return {
                        "status": "error",
                        "message": f"Saldo akun '{acc.name}' (Rp {acc.current_balance:,.0f}) tidak mencukupi untuk deposit Rp {validated.amount:,.0f}.",
                    }

            vault.allocated_amount += validated.amount
            vault.is_locked = True
            self.db.commit()
            self.db.refresh(vault)
            RunwayService.clear_cache(user_id=user_id)
            pct = int(round((vault.allocated_amount / vault.target_amount) * 100)) if vault.target_amount > 0 else 100
            return {
                "status": "success",
                "message": f"Berhasil menabung Rp {validated.amount:,.0f} ke {vault.name}. Total terkumpul: Rp {vault.allocated_amount:,.0f} ({pct}%).",
                "vault": {
                    "id": str(vault.id),
                    "name": vault.name,
                    "allocated_amount": vault.allocated_amount,
                    "target_amount": vault.target_amount,
                    "is_locked": vault.is_locked,
                    "percentage": pct,
                },
            }

        elif action == "pay_bill":
            if validated.account_name:
                acc = (
                    self.db.query(Account)
                    .filter(Account.user_id == user_id, Account.name.ilike(f"%{validated.account_name.strip()}%"))
                    .first()
                )
                if not acc:
                    return {
                        "status": "error",
                        "message": f"Akun rekening '{validated.account_name}' tidak ditemukan.",
                    }
            else:
                acc = (
                    self.db.query(Account)
                    .filter(Account.user_id == user_id, Account.is_active.is_(True))
                    .order_by(Account.current_balance.desc())
                    .first()
                )
            if not acc:
                return {"status": "error", "message": "Akun sumber dana tidak ditemukan atau tidak tersedia."}

            pay_amount = validated.amount or vault.target_amount or vault.allocated_amount
            if not pay_amount or pay_amount <= 0:
                return {"status": "error", "message": "Nominal pembayaran tidak valid."}
            if acc.current_balance < pay_amount:
                return {
                    "status": "error",
                    "message": f"Saldo akun '{acc.name}' (Rp {acc.current_balance:,.0f}) tidak mencukupi untuk bayar tagihan Rp {pay_amount:,.0f}.",
                }

            cat = (
                self.db.query(Category)
                .filter(
                    Category.user_id == user_id,
                    Category.category_type == CategoryType.EXPENSE,
                    Category.name.ilike("%Tagihan%"),
                )
                .first()
            )
            if not cat:
                cat = Category(user_id=user_id, name="Tagihan", category_type=CategoryType.EXPENSE)
                self.db.add(cat)
                self.db.flush()

            tx = self.ledger_service.record_expense(
                user_id=user_id,
                account_id=acc.id,
                category_id=cat.id,
                amount=pay_amount,
                description=f"Pembayaran tagihan: {vault.name}",
                source_channel="AI_AGENT",
            )
            vault.allocated_amount = Decimal("0.00")
            if vault.target_date:
                vault.target_date = advance_one_month(vault.target_date)

            self.db.commit()
            self.db.refresh(vault)
            RunwayService.clear_cache(user_id=user_id)
            return {
                "status": "success",
                "message": f"Tagihan '{vault.name}' sebesar Rp {pay_amount:,.0f} berhasil dibayar melalui {acc.name}. Jatuh tempo diperbarui ke {vault.target_date.isoformat() if vault.target_date else '-'}.",
                "vault": {
                    "id": str(vault.id),
                    "name": vault.name,
                    "allocated_amount": vault.allocated_amount,
                    "target_date": vault.target_date.isoformat() if vault.target_date else None,
                    "is_locked": vault.is_locked,
                },
                "transaction_id": str(tx.id),
            }

        elif action == "toggle_lock":
            if validated.lock_state is not None:
                vault.is_locked = validated.lock_state
            else:
                vault.is_locked = not vault.is_locked
            self.db.commit()
            self.db.refresh(vault)
            RunwayService.clear_cache(user_id=user_id)
            state_text = "terkunci" if vault.is_locked else "terbuka"
            return {
                "status": "success",
                "message": f"Vault '{vault.name}' sekarang {state_text}.",
                "vault": {
                    "id": str(vault.id),
                    "name": vault.name,
                    "is_locked": vault.is_locked,
                },
            }

        return {"status": "error", "message": f"Aksi '{action}' tidak dikenali."}


def execute_financial_tool(
    tool_name: str,
    arguments: Dict[str, Any],
    user_id: UUID,
    db: Session,
) -> Dict[str, Any]:
    """Execute a financial tool deterministically for the given user."""
    dispatcher = AgentToolDispatcher(db)
    return dispatcher.dispatch(user_id=user_id, tool_name=tool_name, arguments=arguments)
