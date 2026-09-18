"""Agent Orchestrator translating natural language and receipts into ledger actions."""

from decimal import Decimal
from typing import Any, Dict, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from rezekify.agent.runtime import ReActAgent
from rezekify.db.models import Account, Category, CategoryType
from rezekify.services.ledger import LedgerService
from rezekify.services.runway import RunwayService


class AgentOrchestrator:
    """Coordinates between ReActAgent entity extraction and deterministic Layer 1 financial services."""

    def __init__(self, db: Session, key_pool=None, agent: Optional[ReActAgent] = None):
        self.db = db
        self.key_pool = key_pool
        self.agent = agent
        self.ledger = LedgerService(db)
        self.runway = RunwayService(db)

    def extract_entities(
        self, text: str, image_bytes: Optional[bytes] = None, user_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """Extracts structured financial transaction entities using ReActAgent runtime."""
        if self.agent:
            uid = user_id or UUID("00000000-0000-0000-0000-000000000000")
            return self.agent.process_input(user_id=uid, text=text, image_bytes=image_bytes)
        return {"action": "unknown", "text": text}

    def _resolve_account(self, user_id: UUID, account_name: Optional[str]) -> Optional[Account]:
        """Finds account by name match or falls back to the user's highest balance account."""
        account = None
        if account_name:
            account = (
                self.db.query(Account)
                .filter(Account.user_id == user_id, Account.name.ilike(f"%{account_name}%"))
                .first()
            )
        if not account:
            account = (
                self.db.query(Account)
                .filter_by(user_id=user_id)
                .order_by(Account.current_balance.desc())
                .first()
            )
        return account

    def _resolve_or_create_category(
        self, user_id: UUID, category_name: Optional[str], cat_type: CategoryType
    ) -> Category:
        """Resolves existing category or creates a new one scoped to user_id."""
        name = category_name or ("Umum" if cat_type == CategoryType.EXPENSE else "Pemasukan Lain")
        category = (
            self.db.query(Category)
            .filter(Category.user_id == user_id, Category.name.ilike(f"%{name}%"))
            .first()
        )
        if not category:
            category = Category(user_id=user_id, name=name, category_type=cat_type)
            self.db.add(category)
            self.db.flush()
        return category

    def handle_message(
        self, user_id: UUID, text: str, image_bytes: Optional[bytes] = None
    ) -> str:
        """Processes natural language input or receipts, executes ledger mutations, and returns telemetry response."""
        entities = self.extract_entities(text, image_bytes, user_id=user_id)
        action = entities.get("action")

        if action == "expense":
            amount = Decimal(str(entities.get("amount", 0)))
            account = self._resolve_account(user_id, entities.get("account_name"))
            if not account:
                return "❌ Gagal: Anda belum memiliki akun keuangan. Silakan tambahkan akun terlebih dahulu."

            category = self._resolve_or_create_category(
                user_id, entities.get("category_name"), CategoryType.EXPENSE
            )
            note = entities.get("note") or "Pengeluaran"

            self.ledger.record_expense(
                user_id=user_id,
                account_id=account.id,
                category_id=category.id,
                amount=amount,
                description=note,
                source_channel="AI_AGENT",
                raw_input_text=text,
            )

            runway = self.runway.calculate_runway(user_id)
            return (
                f"✅ **Tercatat:** Rp {amount:,.0f} ({note}) via {account.name}.\n"
                f"📊 **Sisa Jatah Belanja Hari Ini:** Rp {runway.daily_safe_runway:,.0f} "
                f"({runway.days_remaining} hari menuju siklus baru)."
            )

        elif action == "income":
            amount = Decimal(str(entities.get("amount", 0)))
            account = self._resolve_account(user_id, entities.get("account_name"))
            if not account:
                return "❌ Gagal: Tidak ada akun tujuan yang ditemukan."

            category = self._resolve_or_create_category(
                user_id, entities.get("category_name"), CategoryType.INCOME
            )
            note = entities.get("note") or "Pemasukan"

            self.ledger.record_income(
                user_id=user_id,
                account_id=account.id,
                category_id=category.id,
                amount=amount,
                description=note,
                source_channel="AI_AGENT",
            )

            runway = self.runway.calculate_runway(user_id)
            return (
                f"💰 **Pemasukan Berhasil Dicatat:** Rp {amount:,.0f} ({note}) ke {account.name}.\n"
                f"📈 Jatah aman belanja harian Anda meningkat menjadi Rp {runway.daily_safe_runway:,.0f}/hari."
            )

        elif action == "transfer":
            amount = Decimal(str(entities.get("amount", 0)))
            from_acc = self._resolve_account(user_id, entities.get("from_account"))
            to_acc = self._resolve_account(user_id, entities.get("to_account"))
            if not from_acc or not to_acc or from_acc.id == to_acc.id:
                return "❌ Gagal: Akun sumber dan tujuan transfer harus berbeda dan terdaftar."

            self.ledger.record_transfer(
                user_id=user_id,
                from_account_id=from_acc.id,
                to_account_id=to_acc.id,
                amount=amount,
                description=entities.get("note") or f"Transfer {from_acc.name} ke {to_acc.name}",
            )
            return f"🔁 **Transfer Berhasil:** Rp {amount:,.0f} dari {from_acc.name} ke {to_acc.name}."

        elif action == "query_runway":
            runway = self.runway.calculate_runway(user_id)
            return (
                f"📈 **Status Keuangan Rezekify:**\n"
                f"• Saldo Bebas Operasional: Rp {runway.operational_free_cash:,.0f}\n"
                f"• Jatah Aman Belanja Hari Ini: Rp {runway.daily_safe_runway:,.0f}/hari\n"
                f"• Sisa Hari Siklus: {runway.days_remaining} hari\n"
                f"• Status: **{runway.health_status}**"
            )

        return "Saya siap membantu mencatat pengeluaran, pemasukan, transfer, atau memeriksa status jatah belanja harian Anda."
