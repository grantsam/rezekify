import pytest
from uuid import uuid4
from decimal import Decimal
from rezekify.db.models import (
    User, Account, Vault, Category, Transaction, LedgerEntry,
    AccountType, CategoryType, EntryType, VaultType
)

def test_models_instantiation():
    user = User(
        email="test@rezekify.local",
        password_hash="hashed_pw",
        full_name="Mahasiswa Cerdas",
        monthly_cycle_day=25
    )
    account = Account(
        user=user,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("1500000.00")
    )
    vault = Vault(
        user=user,
        name="Sewa Kos",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("800000.00"),
        allocated_amount=Decimal("500000.00")
    )
    assert account.name == "BCA"
    assert account.current_balance == Decimal("1500000.00")
    assert vault.vault_type == VaultType.FIXED_BILL
    assert vault.allocated_amount == Decimal("500000.00")
    assert user.monthly_cycle_day == 25


def test_models_db_persistence_and_relationships(db_session, sample_user):
    account = Account(
        user_id=sample_user.id,
        name="GoPay",
        account_type=AccountType.EWALLET,
        current_balance=Decimal("250000.00")
    )
    vault = Vault(
        user_id=sample_user.id,
        name="Dana Darurat",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("5000000.00"),
        allocated_amount=Decimal("1000000.00")
    )
    category = Category(
        user_id=sample_user.id,
        name="Makanan",
        category_type=CategoryType.EXPENSE,
        icon="utensils",
        color="#f97316"
    )
    db_session.add_all([account, vault, category])
    db_session.commit()

    tx = Transaction(
        user_id=sample_user.id,
        description="Beli Makan Siang",
        raw_input_text="beli makan siang 25rb pakai gopay",
        source_channel="TELEGRAM"
    )
    db_session.add(tx)
    db_session.commit()

    entry_debit = LedgerEntry(
        transaction_id=tx.id,
        user_id=sample_user.id,
        category_id=category.id,
        entry_type=EntryType.DEBIT,
        amount=Decimal("25000.00")
    )
    entry_credit = LedgerEntry(
        transaction_id=tx.id,
        user_id=sample_user.id,
        account_id=account.id,
        entry_type=EntryType.CREDIT,
        amount=Decimal("25000.00")
    )
    db_session.add_all([entry_debit, entry_credit])
    db_session.commit()

    db_session.refresh(sample_user)
    db_session.refresh(tx)

    assert len(sample_user.accounts) == 1
    assert sample_user.accounts[0].name == "GoPay"
    assert len(sample_user.vaults) == 1
    assert sample_user.vaults[0].name == "Dana Darurat"
    assert len(sample_user.transactions) == 1
    assert len(tx.ledger_entries) == 2


def test_cascade_delete_user(db_session):
    user = User(
        email="cascade@rezekify.local",
        password_hash="hashed_pw",
        full_name="Cascade User",
        monthly_cycle_day=1
    )
    db_session.add(user)
    db_session.commit()

    account = Account(
        user_id=user.id,
        name="Cash",
        account_type=AccountType.CASH,
        current_balance=Decimal("50000.00")
    )
    db_session.add(account)
    db_session.commit()

    db_session.delete(user)
    db_session.commit()

    assert db_session.query(Account).filter_by(user_id=user.id).first() is None
