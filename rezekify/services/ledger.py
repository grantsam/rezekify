"""Deterministic Double-Entry Accounting Core & Ledger Services."""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from rezekify.db.models import Account, Category, EntryType, LedgerEntry, Transaction


class LedgerService:
    """Provides deterministic financial ledger transaction operations."""

    def __init__(self, db: Session, auto_commit: bool = True):
        self.db = db
        self.auto_commit = auto_commit

    def _maybe_commit(self) -> None:
        # ponytail: auto-commit hook; callers disable to manage multi-service UnitOfWork transactions.
        if self.auto_commit:
            self.db.commit()

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
        self.db.flush()
        self._maybe_commit()
        if self.auto_commit:
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
        self.db.flush()
        self._maybe_commit()
        if self.auto_commit:
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
        self.db.flush()
        self._maybe_commit()
        if self.auto_commit:
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
        self.db.flush()
        self._maybe_commit()
        return True

    def update_transaction(
        self,
        user_id: UUID,
        transaction_id: UUID,
        amount: Decimal,
        description: str,
        account_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        to_account_id: Optional[UUID] = None,
        transaction_date: Optional[datetime] = None,
        transaction_type: Optional[str] = None,
        from_account_id: Optional[UUID] = None,
    ) -> Transaction:
        """Deterministically updates an existing transaction using reversal and re-post pattern.

        Reverses prior account balance modifications, validates tenant ownership of all
        target entities, applies new account mutations, purges historical ledger entries,
        and posts new balanced debit/credit entries atomically.
        """
        if amount <= 0:
            raise ValueError("Amount must be positive.")

        # Step A: Locate transaction with strict row-level tenant isolation
        tx = (
            self.db.query(Transaction)
            .filter_by(id=transaction_id, user_id=user_id)
            .one()
        )

        # Step B: Reverse previous balance mutations based on existing ledger entries
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

        # Step C: Determine transaction type
        if transaction_type:
            tt = transaction_type.upper()
        else:
            acc_entries = [e for e in tx.ledger_entries if e.account_id is not None]
            if len(acc_entries) >= 2:
                tt = "TRANSFER"
            elif len(acc_entries) == 1:
                if acc_entries[0].entry_type == EntryType.CREDIT:
                    tt = "EXPENSE"
                else:
                    tt = "INCOME"
            else:
                tt = "EXPENSE"

        # Step D: Validate target entities and apply new balance mutations
        if not account_id and tt in ("EXPENSE", "INCOME"):
            for entry in tx.ledger_entries:
                if entry.account_id:
                    account_id = entry.account_id
                    break

        if not category_id and tt in ("EXPENSE", "INCOME"):
            for entry in tx.ledger_entries:
                if entry.category_id:
                    category_id = entry.category_id
                    break

        new_entries: list[LedgerEntry] = []

        if tt == "EXPENSE":
            if not account_id:
                raise ValueError("account_id is required for expense transaction.")
            new_acc = (
                self.db.query(Account)
                .filter_by(id=account_id, user_id=user_id)
                .with_for_update()
                .one_or_none()
            )
            if not new_acc:
                raise ValueError("Account not found or access denied.")

            if category_id:
                cat = (
                    self.db.query(Category)
                    .filter_by(id=category_id, user_id=user_id)
                    .one_or_none()
                )
                if not cat:
                    raise ValueError("Category not found or access denied.")

            new_acc.current_balance -= amount

            new_entries = [
                LedgerEntry(
                    transaction_id=tx.id,
                    user_id=user_id,
                    category_id=category_id,
                    entry_type=EntryType.DEBIT,
                    amount=amount,
                ),
                LedgerEntry(
                    transaction_id=tx.id,
                    user_id=user_id,
                    account_id=new_acc.id,
                    entry_type=EntryType.CREDIT,
                    amount=amount,
                ),
            ]

        elif tt == "INCOME":
            if not account_id:
                raise ValueError("account_id is required for income transaction.")
            new_acc = (
                self.db.query(Account)
                .filter_by(id=account_id, user_id=user_id)
                .with_for_update()
                .one_or_none()
            )
            if not new_acc:
                raise ValueError("Account not found or access denied.")

            if category_id:
                cat = (
                    self.db.query(Category)
                    .filter_by(id=category_id, user_id=user_id)
                    .one_or_none()
                )
                if not cat:
                    raise ValueError("Category not found or access denied.")

            new_acc.current_balance += amount

            new_entries = [
                LedgerEntry(
                    transaction_id=tx.id,
                    user_id=user_id,
                    account_id=new_acc.id,
                    entry_type=EntryType.DEBIT,
                    amount=amount,
                ),
                LedgerEntry(
                    transaction_id=tx.id,
                    user_id=user_id,
                    category_id=category_id,
                    entry_type=EntryType.CREDIT,
                    amount=amount,
                ),
            ]

        elif tt == "TRANSFER":
            from_account_id = from_account_id or account_id
            if not from_account_id or not to_account_id:
                raise ValueError("Both source and destination accounts are required for transfer.")
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
                .one_or_none()
            )
            acc2 = (
                self.db.query(Account)
                .filter_by(id=second_id, user_id=user_id)
                .with_for_update()
                .one_or_none()
            )
            from_acc = acc1 if acc1 and acc1.id == from_account_id else acc2
            to_acc = acc2 if acc2 and acc2.id == to_account_id else acc1
            if not from_acc or not to_acc or from_acc.id != from_account_id or to_acc.id != to_account_id:
                raise ValueError("Source or destination account not found or access denied.")

            from_acc.current_balance -= amount
            to_acc.current_balance += amount

            new_entries = [
                LedgerEntry(
                    transaction_id=tx.id,
                    user_id=user_id,
                    account_id=from_acc.id,
                    entry_type=EntryType.CREDIT,
                    amount=amount,
                ),
                LedgerEntry(
                    transaction_id=tx.id,
                    user_id=user_id,
                    account_id=to_acc.id,
                    entry_type=EntryType.DEBIT,
                    amount=amount,
                ),
            ]
        else:
            raise ValueError(f"Unsupported transaction type: {transaction_type}")

        # Step E: Purge historical ledger entries and emit replacement balanced entries
        for old_entry in list(tx.ledger_entries):
            self.db.delete(old_entry)
        self.db.flush()

        self.db.add_all(new_entries)

        # Step F: Update metadata and transaction timestamp
        tx.description = description
        if transaction_date is not None:
            tx.transaction_date = transaction_date

        self.db.flush()
        self._maybe_commit()
        if self.auto_commit:
            self.db.refresh(tx)
        return tx
