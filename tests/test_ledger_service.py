"""Tests for LedgerService deterministic double-entry accounting."""

from decimal import Decimal
import pytest

from rezekify.db.models import Account, AccountType, Category, CategoryType, EntryType
from rezekify.services.ledger import LedgerService


def test_record_expense_balanced_ledger(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="GoPay",
        account_type=AccountType.EWALLET,
        current_balance=Decimal("100000.00"),
    )
    cat = Category(
        user_id=sample_user.id,
        name="Makanan",
        category_type=CategoryType.EXPENSE,
    )
    db_session.add_all([acc, cat])
    db_session.commit()

    service = LedgerService(db_session)
    tx = service.record_expense(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=cat.id,
        amount=Decimal("25000.00"),
        description="Nasi Padang",
        source_channel="TELEGRAM",
    )

    db_session.refresh(acc)
    assert acc.current_balance == Decimal("75000.00")
    assert len(tx.ledger_entries) == 2
    debits = sum(e.amount for e in tx.ledger_entries if e.entry_type == EntryType.DEBIT)
    credits = sum(e.amount for e in tx.ledger_entries if e.entry_type == EntryType.CREDIT)
    assert debits == credits == Decimal("25000.00")


def test_record_income_balanced_ledger(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("500000.00"),
    )
    cat = Category(
        user_id=sample_user.id,
        name="Gaji",
        category_type=CategoryType.INCOME,
    )
    db_session.add_all([acc, cat])
    db_session.commit()

    service = LedgerService(db_session)
    tx = service.record_income(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=cat.id,
        amount=Decimal("1000000.00"),
        description="Gaji Bulanan",
    )

    db_session.refresh(acc)
    assert acc.current_balance == Decimal("1500000.00")
    debits = sum(e.amount for e in tx.ledger_entries if e.entry_type == EntryType.DEBIT)
    credits = sum(e.amount for e in tx.ledger_entries if e.entry_type == EntryType.CREDIT)
    assert debits == credits == Decimal("1000000.00")


def test_record_transfer_balanced_ledger(db_session, sample_user):
    acc_bca = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("500000.00"),
    )
    acc_gopay = Account(
        user_id=sample_user.id,
        name="GoPay",
        account_type=AccountType.EWALLET,
        current_balance=Decimal("50000.00"),
    )
    db_session.add_all([acc_bca, acc_gopay])
    db_session.commit()

    service = LedgerService(db_session)
    tx = service.record_transfer(
        user_id=sample_user.id,
        from_account_id=acc_bca.id,
        to_account_id=acc_gopay.id,
        amount=Decimal("100000.00"),
        description="Top up GoPay dari BCA",
    )

    db_session.refresh(acc_bca)
    db_session.refresh(acc_gopay)
    assert acc_bca.current_balance == Decimal("400000.00")
    assert acc_gopay.current_balance == Decimal("150000.00")
    debits = sum(e.amount for e in tx.ledger_entries if e.entry_type == EntryType.DEBIT)
    credits = sum(e.amount for e in tx.ledger_entries if e.entry_type == EntryType.CREDIT)
    assert debits == credits == Decimal("100000.00")


def test_delete_transaction_reverses_balance(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("500000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    service = LedgerService(db_session)
    tx = service.record_expense(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=None,
        amount=Decimal("150000.00"),
        description="Belanja",
    )
    db_session.refresh(acc)
    assert acc.current_balance == Decimal("350000.00")

    deleted = service.delete_transaction(user_id=sample_user.id, transaction_id=tx.id)
    assert deleted is True
    db_session.refresh(acc)
    assert acc.current_balance == Decimal("500000.00")


def test_negative_or_zero_amount_rejected(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="Cash",
        account_type=AccountType.CASH,
        current_balance=Decimal("10000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    service = LedgerService(db_session)
    with pytest.raises(ValueError, match="Amount must be positive"):
        service.record_expense(
            user_id=sample_user.id,
            account_id=acc.id,
            category_id=None,
            amount=Decimal("0.00"),
            description="Zero amount",
        )

    with pytest.raises(ValueError, match="Amount must be positive"):
        service.record_expense(
            user_id=sample_user.id,
            account_id=acc.id,
            category_id=None,
            amount=Decimal("-5000.00"),
            description="Negative amount",
        )


def test_delete_income_transaction_reverses_balance(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("200000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    service = LedgerService(db_session)
    tx = service.record_income(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=None,
        amount=Decimal("300000.00"),
        description="Freelance",
    )
    db_session.refresh(acc)
    assert acc.current_balance == Decimal("500000.00")

    deleted = service.delete_transaction(user_id=sample_user.id, transaction_id=tx.id)
    assert deleted is True
    db_session.refresh(acc)
    assert acc.current_balance == Decimal("200000.00")


def test_delete_transfer_transaction_reverses_balance(db_session, sample_user):
    acc1 = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("500000.00"),
    )
    acc2 = Account(
        user_id=sample_user.id,
        name="GoPay",
        account_type=AccountType.EWALLET,
        current_balance=Decimal("100000.00"),
    )
    db_session.add_all([acc1, acc2])
    db_session.commit()

    service = LedgerService(db_session)
    tx = service.record_transfer(
        user_id=sample_user.id,
        from_account_id=acc1.id,
        to_account_id=acc2.id,
        amount=Decimal("150000.00"),
    )
    db_session.refresh(acc1)
    db_session.refresh(acc2)
    assert acc1.current_balance == Decimal("350000.00")
    assert acc2.current_balance == Decimal("250000.00")

    deleted = service.delete_transaction(user_id=sample_user.id, transaction_id=tx.id)
    assert deleted is True
    db_session.refresh(acc1)
    db_session.refresh(acc2)
    assert acc1.current_balance == Decimal("500000.00")
    assert acc2.current_balance == Decimal("100000.00")


def test_transfer_same_account_rejected(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("500000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    service = LedgerService(db_session)
    with pytest.raises(ValueError, match="Source and destination accounts must be distinct"):
        service.record_transfer(
            user_id=sample_user.id,
            from_account_id=acc.id,
            to_account_id=acc.id,
            amount=Decimal("50000.00"),
        )


def test_cross_tenant_isolation_enforced(db_session, sample_user):
    from sqlalchemy.orm.exc import NoResultFound
    from rezekify.db.models import User
    import uuid

    other_user = User(
        email="other_user@rezekify.local",
        password_hash="hash_other",
        full_name="User Lain",
    )
    db_session.add(other_user)
    db_session.commit()

    other_acc = Account(
        user_id=other_user.id,
        name="Other Bank",
        account_type=AccountType.BANK,
        current_balance=Decimal("1000000.00"),
    )
    db_session.add(other_acc)
    db_session.commit()

    service = LedgerService(db_session)
    # sample_user cannot spend from other_user's account
    with pytest.raises(NoResultFound):
        service.record_expense(
            user_id=sample_user.id,
            account_id=other_acc.id,
            category_id=None,
            amount=Decimal("50000.00"),
            description="Illegal spend",
        )

    # other_user creates a transaction, sample_user cannot delete it
    other_tx = service.record_expense(
        user_id=other_user.id,
        account_id=other_acc.id,
        category_id=None,
        amount=Decimal("50000.00"),
        description="Valid other spend",
    )
    with pytest.raises(NoResultFound):
        service.delete_transaction(user_id=sample_user.id, transaction_id=other_tx.id)

