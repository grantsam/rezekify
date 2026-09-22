"""Tests for LedgerService deterministic double-entry accounting."""

from decimal import Decimal
from unittest.mock import patch
import pytest
from sqlalchemy.orm import Query

from rezekify.db.models import Account, AccountType, Category, CategoryType, EntryType, Transaction
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


def test_update_expense_amount_adjusts_balance(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("1000000.00"),
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
        amount=Decimal("100000.00"),
        description="Makan Siang",
    )
    db_session.refresh(acc)
    assert acc.current_balance == Decimal("900000.00")

    # Increase expense from 100,000 to 150,000
    updated_tx = service.update_transaction(
        user_id=sample_user.id,
        transaction_id=tx.id,
        amount=Decimal("150000.00"),
        description="Makan Siang Mewah",
        account_id=acc.id,
        category_id=cat.id,
    )
    db_session.refresh(acc)
    assert acc.current_balance == Decimal("850000.00")
    assert updated_tx.description == "Makan Siang Mewah"
    assert len(updated_tx.ledger_entries) == 2
    debits = sum(e.amount for e in updated_tx.ledger_entries if e.entry_type == EntryType.DEBIT)
    credits = sum(e.amount for e in updated_tx.ledger_entries if e.entry_type == EntryType.CREDIT)
    assert debits == credits == Decimal("150000.00")

    # Decrease expense from 150,000 to 60,000
    service.update_transaction(
        user_id=sample_user.id,
        transaction_id=tx.id,
        amount=Decimal("60000.00"),
        description="Makan Siang Hemat",
        account_id=acc.id,
        category_id=cat.id,
    )
    db_session.refresh(acc)
    assert acc.current_balance == Decimal("940000.00")


def test_update_expense_switch_account(db_session, sample_user):
    acc_bca = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("1000000.00"),
    )
    acc_gopay = Account(
        user_id=sample_user.id,
        name="GoPay",
        account_type=AccountType.EWALLET,
        current_balance=Decimal("500000.00"),
    )
    db_session.add_all([acc_bca, acc_gopay])
    db_session.commit()

    service = LedgerService(db_session)
    tx = service.record_expense(
        user_id=sample_user.id,
        account_id=acc_bca.id,
        category_id=None,
        amount=Decimal("100000.00"),
        description="Beli Kopi",
    )
    db_session.refresh(acc_bca)
    db_session.refresh(acc_gopay)
    assert acc_bca.current_balance == Decimal("900000.00")
    assert acc_gopay.current_balance == Decimal("500000.00")

    # Switch account from BCA to GoPay and change amount to 120,000
    updated_tx = service.update_transaction(
        user_id=sample_user.id,
        transaction_id=tx.id,
        amount=Decimal("120000.00"),
        description="Beli Kopi Specialty",
        account_id=acc_gopay.id,
        category_id=None,
    )
    db_session.refresh(acc_bca)
    db_session.refresh(acc_gopay)
    # BCA is refunded original 100,000
    assert acc_bca.current_balance == Decimal("1000000.00")
    # GoPay is charged new 120,000
    assert acc_gopay.current_balance == Decimal("380000.00")
    credit_entry = next(e for e in updated_tx.ledger_entries if e.entry_type == EntryType.CREDIT)
    assert credit_entry.account_id == acc_gopay.id


def test_update_income_amount_adjusts_balance(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("500000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    service = LedgerService(db_session)
    tx = service.record_income(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=None,
        amount=Decimal("1000000.00"),
        description="Freelance",
    )
    db_session.refresh(acc)
    assert acc.current_balance == Decimal("1500000.00")

    # Increase income to 1,200,000
    updated_tx = service.update_transaction(
        user_id=sample_user.id,
        transaction_id=tx.id,
        amount=Decimal("1200000.00"),
        description="Freelance Bonus",
        account_id=acc.id,
    )
    db_session.refresh(acc)
    assert acc.current_balance == Decimal("1700000.00")
    debits = sum(e.amount for e in updated_tx.ledger_entries if e.entry_type == EntryType.DEBIT)
    credits = sum(e.amount for e in updated_tx.ledger_entries if e.entry_type == EntryType.CREDIT)
    assert debits == credits == Decimal("1200000.00")

    # Decrease income to 800,000
    service.update_transaction(
        user_id=sample_user.id,
        transaction_id=tx.id,
        amount=Decimal("800000.00"),
        description="Freelance Partial",
        account_id=acc.id,
    )
    db_session.refresh(acc)
    assert acc.current_balance == Decimal("1300000.00")


def test_update_transfer_amount_and_accounts(db_session, sample_user):
    acc_bca = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("1000000.00"),
    )
    acc_gopay = Account(
        user_id=sample_user.id,
        name="GoPay",
        account_type=AccountType.EWALLET,
        current_balance=Decimal("500000.00"),
    )
    acc_mandiri = Account(
        user_id=sample_user.id,
        name="Mandiri",
        account_type=AccountType.BANK,
        current_balance=Decimal("2000000.00"),
    )
    db_session.add_all([acc_bca, acc_gopay, acc_mandiri])
    db_session.commit()

    service = LedgerService(db_session)
    tx = service.record_transfer(
        user_id=sample_user.id,
        from_account_id=acc_bca.id,
        to_account_id=acc_gopay.id,
        amount=Decimal("200000.00"),
        description="Topup",
    )
    db_session.refresh(acc_bca)
    db_session.refresh(acc_gopay)
    db_session.refresh(acc_mandiri)
    assert acc_bca.current_balance == Decimal("800000.00")
    assert acc_gopay.current_balance == Decimal("700000.00")
    assert acc_mandiri.current_balance == Decimal("2000000.00")

    # Update transfer: change source from BCA to Mandiri, change amount from 200,000 to 300,000
    updated_tx = service.update_transaction(
        user_id=sample_user.id,
        transaction_id=tx.id,
        amount=Decimal("300000.00"),
        description="Topup Mandiri ke GoPay",
        account_id=acc_mandiri.id,
        to_account_id=acc_gopay.id,
    )
    db_session.refresh(acc_bca)
    db_session.refresh(acc_gopay)
    db_session.refresh(acc_mandiri)

    # BCA restored: 800,000 + 200,000 = 1,000,000
    assert acc_bca.current_balance == Decimal("1000000.00")
    # GoPay: 700,000 - 200,000 (reversal) + 300,000 (new) = 800,000
    assert acc_gopay.current_balance == Decimal("800000.00")
    # Mandiri: 2,000,000 - 300,000 = 1,700,000
    assert acc_mandiri.current_balance == Decimal("1700000.00")

    credit_entry = next(e for e in updated_tx.ledger_entries if e.entry_type == EntryType.CREDIT)
    debit_entry = next(e for e in updated_tx.ledger_entries if e.entry_type == EntryType.DEBIT)
    assert credit_entry.account_id == acc_mandiri.id
    assert debit_entry.account_id == acc_gopay.id
    assert credit_entry.amount == debit_entry.amount == Decimal("300000.00")


def test_update_transaction_tenant_isolation(db_session, sample_user):
    from sqlalchemy.orm.exc import NoResultFound
    from rezekify.db.models import User

    other_user = User(
        email="other_user_update@rezekify.local",
        password_hash="hash_other",
        full_name="Other User",
    )
    db_session.add(other_user)
    db_session.commit()

    user_a_acc = Account(
        user_id=sample_user.id,
        name="User A Acc",
        account_type=AccountType.BANK,
        current_balance=Decimal("500000.00"),
    )
    user_b_acc = Account(
        user_id=other_user.id,
        name="User B Acc",
        account_type=AccountType.BANK,
        current_balance=Decimal("500000.00"),
    )
    user_b_cat = Category(
        user_id=other_user.id,
        name="User B Category",
        category_type=CategoryType.EXPENSE,
    )
    db_session.add_all([user_a_acc, user_b_acc, user_b_cat])
    db_session.commit()

    service = LedgerService(db_session)
    tx_a = service.record_expense(
        user_id=sample_user.id,
        account_id=user_a_acc.id,
        category_id=None,
        amount=Decimal("50000.00"),
        description="User A Item",
    )

    # 1. User B cannot update User A's transaction
    with pytest.raises(NoResultFound):
        service.update_transaction(
            user_id=other_user.id,
            transaction_id=tx_a.id,
            amount=Decimal("60000.00"),
            description="Unauthorized Update",
            account_id=user_b_acc.id,
        )

    # 2. User A cannot use User B's account
    with pytest.raises(ValueError, match="Account not found or access denied"):
        service.update_transaction(
            user_id=sample_user.id,
            transaction_id=tx_a.id,
            amount=Decimal("60000.00"),
            description="Account Theft",
            account_id=user_b_acc.id,
        )

    # 3. User A cannot use User B's category
    with pytest.raises(ValueError, match="Category not found or access denied"):
        service.update_transaction(
            user_id=sample_user.id,
            transaction_id=tx_a.id,
            amount=Decimal("60000.00"),
            description="Category Theft",
            account_id=user_a_acc.id,
            category_id=user_b_cat.id,
        )


def test_update_transaction_negative_amount_rejected(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="Cash",
        account_type=AccountType.CASH,
        current_balance=Decimal("100000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    service = LedgerService(db_session)
    tx = service.record_expense(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=None,
        amount=Decimal("50000.00"),
        description="Belanja",
    )

    with pytest.raises(ValueError, match="Amount must be positive"):
        service.update_transaction(
            user_id=sample_user.id,
            transaction_id=tx.id,
            amount=Decimal("0.00"),
            description="Zero amount",
            account_id=acc.id,
        )

    with pytest.raises(ValueError, match="Amount must be positive"):
        service.update_transaction(
            user_id=sample_user.id,
            transaction_id=tx.id,
            amount=Decimal("-10000.00"),
            description="Negative amount",
            account_id=acc.id,
        )


def test_ledger_mutations_use_row_locking(db_session, sample_user):
    acc1 = Account(
        user_id=sample_user.id,
        name="Cash",
        account_type=AccountType.CASH,
        current_balance=Decimal("100000.00"),
    )
    acc2 = Account(
        user_id=sample_user.id,
        name="Bank",
        account_type=AccountType.BANK,
        current_balance=Decimal("50000.00"),
    )
    db_session.add_all([acc1, acc2])
    db_session.commit()

    ledger = LedgerService(db_session)

    # 1. record_expense uses with_for_update
    with patch.object(Query, "with_for_update", autospec=True, side_effect=Query.with_for_update) as spy_lock:
        tx_expense = ledger.record_expense(
            user_id=sample_user.id,
            account_id=acc1.id,
            category_id=None,
            amount=Decimal("10000.00"),
            description="Expense lock check",
        )
        assert spy_lock.call_count == 1

    # 2. record_income uses with_for_update
    with patch.object(Query, "with_for_update", autospec=True, side_effect=Query.with_for_update) as spy_lock:
        ledger.record_income(
            user_id=sample_user.id,
            account_id=acc1.id,
            category_id=None,
            amount=Decimal("20000.00"),
            description="Income lock check",
        )
        assert spy_lock.call_count == 1

    # 3. record_transfer locks both accounts with with_for_update
    with patch.object(Query, "with_for_update", autospec=True, side_effect=Query.with_for_update) as spy_lock:
        ledger.record_transfer(
            user_id=sample_user.id,
            from_account_id=acc1.id,
            to_account_id=acc2.id,
            amount=Decimal("15000.00"),
            description="Transfer lock check",
        )
        assert spy_lock.call_count == 2

    # 4. delete_transaction locks account rows with with_for_update
    with patch.object(Query, "with_for_update", autospec=True, side_effect=Query.with_for_update) as spy_lock:
        ledger.delete_transaction(user_id=sample_user.id, transaction_id=tx_expense.id)
        assert spy_lock.call_count >= 1


def test_record_transfer_deadlock_prevention_lock_ordering(db_session, sample_user):
    acc_a = Account(
        user_id=sample_user.id,
        name="Account Alpha",
        account_type=AccountType.BANK,
        current_balance=Decimal("100000.00"),
    )
    acc_b = Account(
        user_id=sample_user.id,
        name="Account Beta",
        account_type=AccountType.BANK,
        current_balance=Decimal("100000.00"),
    )
    db_session.add_all([acc_a, acc_b])
    db_session.commit()

    ledger = LedgerService(db_session)
    smaller_id, larger_id = sorted([acc_a.id, acc_b.id])

    # Case 1: from_account has larger_id, to_account has smaller_id
    ledger.record_transfer(
        user_id=sample_user.id,
        from_account_id=larger_id,
        to_account_id=smaller_id,
        amount=Decimal("10000.00"),
    )
    acc_smaller = db_session.query(Account).filter_by(id=smaller_id).one()
    acc_larger = db_session.query(Account).filter_by(id=larger_id).one()
    assert acc_smaller.current_balance == Decimal("110000.00")
    assert acc_larger.current_balance == Decimal("90000.00")

    # Case 2: from_account has smaller_id, to_account has larger_id
    ledger.record_transfer(
        user_id=sample_user.id,
        from_account_id=smaller_id,
        to_account_id=larger_id,
        amount=Decimal("5000.00"),
    )
    db_session.refresh(acc_smaller)
    db_session.refresh(acc_larger)
    assert acc_smaller.current_balance == Decimal("105000.00")
    assert acc_larger.current_balance == Decimal("95000.00")


def test_ledger_service_auto_commit_false_allows_rollback(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="GoPay",
        account_type=AccountType.EWALLET,
        current_balance=Decimal("100000.00"),
    )
    cat = Category(
        user_id=sample_user.id,
        name="Food",
        category_type=CategoryType.EXPENSE,
    )
    db_session.add_all([acc, cat])
    db_session.commit()

    service = LedgerService(db_session, auto_commit=False)
    service.record_expense(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=cat.id,
        amount=Decimal("20000.00"),
        description="Lunch",
    )
    db_session.rollback()

    db_session.refresh(acc)
    assert acc.current_balance == Decimal("100000.00")
    assert db_session.query(Transaction).filter_by(user_id=sample_user.id).count() == 0


def test_update_transaction_row_locking_invoked(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="Cash",
        account_type=AccountType.CASH,
        current_balance=Decimal("100000.00"),
    )
    cat = Category(
        user_id=sample_user.id,
        name="Food",
        category_type=CategoryType.EXPENSE,
    )
    db_session.add_all([acc, cat])
    db_session.commit()

    service = LedgerService(db_session)
    tx = service.record_expense(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=cat.id,
        amount=Decimal("20000.00"),
        description="Lunch",
    )

    with patch.object(Query, "with_for_update", autospec=True, side_effect=Query.with_for_update) as spy_lock:
        updated_tx = service.update_transaction(
            user_id=sample_user.id,
            transaction_id=tx.id,
            amount=Decimal("30000.00"),
            description="Updated Lunch",
            account_id=acc.id,
            category_id=cat.id,
        )
        assert updated_tx.description == "Updated Lunch"
        assert spy_lock.call_count >= 1



