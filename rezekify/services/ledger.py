"""Deterministic Double-Entry Accounting Core & Ledger Services."""

from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from rezekify.db.models import Account, EntryType, LedgerEntry, Transaction


class LedgerService:
    """Provides deterministic financial ledger transaction operations."""

    def __init__(self, db: Session):
        self.db = db

    def record_expense(
        self,
        user_id: UUID,
        account_id: UUID,
        category_id: Optional[UUID],
        amount: Decimal,
        description: str,
        source_channel: str = "WEB_AI",
        raw_input_text: Optional[str] = None,
        receipt_image_url: Optional[str] = None,
    ) -> Transaction:
        """Records an expense transaction with balanced debit/credit entries."""
        if amount <= 0:
            raise ValueError("Amount must be positive.")

        account = (
            self.db.query(Account)
            .filter_by(id=account_id, user_id=user_id)
            .with_for_update()
            .one()
        )
        account.current_balance -= amount

        tx = Transaction(
            user_id=user_id,
            description=description,
            raw_input_text=raw_input_text,
            receipt_image_url=receipt_image_url,
            source_channel=source_channel,
        )
        self.db.add(tx)
        self.db.flush()

        debit_entry = LedgerEntry(
            transaction_id=tx.id,
            user_id=user_id,
            category_id=category_id,
            entry_type=EntryType.DEBIT,
            amount=amount,
        )
        credit_entry = LedgerEntry(
            transaction_id=tx.id,
            user_id=user_id,
            account_id=account.id,
            entry_type=EntryType.CREDIT,
            amount=amount,
        )
        self.db.add_all([debit_entry, credit_entry])
        self.db.commit()
        self.db.refresh(tx)
        return tx

    def record_income(
        self,
        user_id: UUID,
        account_id: UUID,
        category_id: Optional[UUID],
        amount: Decimal,
        description: str,
        source_channel: str = "WEB_AI",
    ) -> Transaction:
        """Records an income transaction with balanced debit/credit entries."""
        if amount <= 0:
            raise ValueError("Amount must be positive.")

        account = (
            self.db.query(Account)
            .filter_by(id=account_id, user_id=user_id)
            .with_for_update()
            .one()
        )
        account.current_balance += amount

        tx = Transaction(
            user_id=user_id,
            description=description,
            source_channel=source_channel,
        )
        self.db.add(tx)
        self.db.flush()

        debit_entry = LedgerEntry(
            transaction_id=tx.id,
            user_id=user_id,
            account_id=account.id,
            entry_type=EntryType.DEBIT,
            amount=amount,
        )
        credit_entry = LedgerEntry(
            transaction_id=tx.id,
            user_id=user_id,
            category_id=category_id,
            entry_type=EntryType.CREDIT,
            amount=amount,
        )
        self.db.add_all([debit_entry, credit_entry])
        self.db.commit()
        self.db.refresh(tx)
        return tx

    def record_transfer(
        self,
        user_id: UUID,
        from_account_id: UUID,
        to_account_id: UUID,
        amount: Decimal,
        description: str = "Transfer Antar Akun",
    ) -> Transaction:
        """Records a balance transfer between two accounts with balanced entries."""
        if amount <= 0:
            raise ValueError("Amount must be positive.")
        if from_account_id == to_account_id:
            raise ValueError("Source and destination accounts must be distinct.")

        first_id, second_id = (
            (from_account_id, to_account_id)
            if from_account_id < to_account_id
            else (to_account_id, from_account_id)
        )
        acc1 = (
            self.db.query(Account)
            .filter_by(id=first_id, user_id=user_id)
            .with_for_update()
            .one()
        )
        acc2 = (
            self.db.query(Account)
            .filter_by(id=second_id, user_id=user_id)
            .with_for_update()
            .one()
        )
        from_acc = acc1 if acc1.id == from_account_id else acc2
        to_acc = acc2 if acc2.id == to_account_id else acc1

        from_acc.current_balance -= amount
        to_acc.current_balance += amount

        tx = Transaction(
            user_id=user_id,
            description=description,
            source_channel="WEB_MANUAL",
        )
        self.db.add(tx)
        self.db.flush()

        credit_entry = LedgerEntry(
            transaction_id=tx.id,
            user_id=user_id,
            account_id=from_acc.id,
            entry_type=EntryType.CREDIT,
            amount=amount,
        )
        debit_entry = LedgerEntry(
            transaction_id=tx.id,
            user_id=user_id,
            account_id=to_acc.id,
            entry_type=EntryType.DEBIT,
            amount=amount,
        )
        self.db.add_all([credit_entry, debit_entry])
        self.db.commit()
        self.db.refresh(tx)
        return tx

    def delete_transaction(self, user_id: UUID, transaction_id: UUID) -> bool:
        """Reverses account balances and removes transaction with cascading ledger entries."""
        tx = (
            self.db.query(Transaction)
            .filter_by(id=transaction_id, user_id=user_id)
            .one()
        )

        for entry in tx.ledger_entries:
            if entry.account_id:
                acc = (
                    self.db.query(Account)
                    .filter_by(id=entry.account_id, user_id=user_id)
                    .with_for_update()
                    .one()
                )
                if entry.entry_type == EntryType.CREDIT:
                    acc.current_balance += entry.amount
                elif entry.entry_type == EntryType.DEBIT:
                    acc.current_balance -= entry.amount

        self.db.delete(tx)
        self.db.commit()
        return True
