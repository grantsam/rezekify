from datetime import date
from decimal import Decimal
import pytest
from sqlalchemy.orm import Session

from rezekify.db.models import Account, AccountType, Category, CategoryType, EntryType, User, Vault, VaultType
from rezekify.services.ledger import LedgerService
from rezekify.services.vault_reconciliation import (
    VaultReconciliationService,
    advance_one_month,
)


@pytest.fixture
def recon_db(db_session: Session, sample_user: User):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("2000000.00"),
    )
    cat = Category(
        user_id=sample_user.id,
        name="Tagihan",
        category_type=CategoryType.EXPENSE,
    )
    v_wifi = Vault(
        user_id=sample_user.id,
        name="Wifi Indihome",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("350000.00"),
        allocated_amount=Decimal("350000.00"),
        target_date=date(2026, 10, 25),
        is_locked=True,
    )
    v_sav = Vault(
        user_id=sample_user.id,
        name="Dana Darurat",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("10000000.00"),
        allocated_amount=Decimal("2000000.00"),
        target_date=date(2026, 12, 31),
        is_locked=False,
    )
    db_session.add_all([acc, cat, v_wifi, v_sav])
    db_session.commit()
    return sample_user


def test_advance_one_month_clamping():
    assert advance_one_month(date(2026, 1, 31)) == date(2026, 2, 28)
    assert advance_one_month(date(2026, 3, 31)) == date(2026, 4, 30)
    assert advance_one_month(date(2026, 12, 15)) == date(2027, 1, 15)


def test_find_matching_vault_exact_and_substring(db_session: Session, recon_db: User):
    service = VaultReconciliationService(db_session)
    # Exact / substring match with Indonesian stop-words
    vault = service.find_matching_fixed_bill_vault(
        user_id=recon_db.id,
        description="Bayar tagihan wifi indihome bulan ini",
    )
    assert vault is not None
    assert vault.name == "Wifi Indihome"


def test_find_matching_vault_ignores_savings_vaults(db_session: Session, recon_db: User):
    # Review Focus 1: SAVINGS vault must never match
    service = VaultReconciliationService(db_session)
    vault = service.find_matching_fixed_bill_vault(
        user_id=recon_db.id,
        description="Topup tabungan Dana Darurat",
    )
    assert vault is None


def test_ambiguous_vault_matching_returns_none(db_session: Session, recon_db: User):
    # Review Focus 2: Ambiguous vendor keyword without exact amount returns None
    v2 = Vault(
        user_id=recon_db.id,
        name="Wifi Kantor",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("500000.00"),
        allocated_amount=Decimal("500000.00"),
        target_date=date(2026, 10, 20),
    )
    db_session.add(v2)
    db_session.commit()

    service = VaultReconciliationService(db_session)
    # Both "Wifi Indihome" and "Wifi Kantor" match token "wifi", ambiguous amount
    matched = service.find_matching_fixed_bill_vault(
        user_id=recon_db.id,
        description="Bayar wifi bulanan",
        amount=Decimal("100000.00"),
    )
    assert matched is None

    # Disambiguates if amount matches one vault's target_amount
    disambiguated = service.find_matching_fixed_bill_vault(
        user_id=recon_db.id,
        description="Bayar wifi bulanan",
        amount=Decimal("350000.00"),
    )
    assert disambiguated is not None
    assert disambiguated.name == "Wifi Indihome"


def test_reconcile_fixed_bill_vault_mutation(db_session: Session, recon_db: User):
    acc = db_session.query(Account).filter_by(user_id=recon_db.id).first()
    vault = db_session.query(Vault).filter_by(user_id=recon_db.id, name="Wifi Indihome").first()

    ledger = LedgerService(db_session)
    tx = ledger.record_expense(
        user_id=recon_db.id,
        account_id=acc.id,
        category_id=None,
        amount=Decimal("350000.00"),
        description="Bayar Wifi Indihome",
    )

    recon_service = VaultReconciliationService(db_session)
    res = recon_service.reconcile_fixed_bill_vault(
        user_id=recon_db.id,
        vault=vault,
        transaction=tx,
        amount=Decimal("350000.00"),
    )

    assert res.reconciled is True
    assert res.vault_name == "Wifi Indihome"
    assert res.new_due_date == date(2026, 11, 25)

    db_session.refresh(vault)
    assert vault.allocated_amount == Decimal("0.00")
    assert vault.target_date == date(2026, 11, 25)

    # Verify debit LedgerEntry.vault_id populated
    debit_entry = [e for e in tx.ledger_entries if e.entry_type == EntryType.DEBIT][0]
    assert debit_entry.vault_id == vault.id


def test_reconcile_cross_tenant_raises_error(db_session: Session, recon_db: User):
    other_user = User(
        email="intruder@test.com",
        password_hash="hash",
        full_name="Intruder",
    )
    db_session.add(other_user)
    db_session.commit()

    vault = db_session.query(Vault).filter_by(user_id=recon_db.id).first()
    acc = db_session.query(Account).filter_by(user_id=recon_db.id).first()
    ledger = LedgerService(db_session)
    tx = ledger.record_expense(
        user_id=recon_db.id,
        account_id=acc.id,
        category_id=None,
        amount=Decimal("10000.00"),
        description="Test",
    )

    service = VaultReconciliationService(db_session)
    with pytest.raises(ValueError, match="Access denied or tenant mismatch"):
        service.reconcile_fixed_bill_vault(
            user_id=other_user.id,
            vault=vault,
            transaction=tx,
            amount=Decimal("10000.00"),
        )
