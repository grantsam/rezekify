"""Tests for AI Agent ReAct manage_vault tool."""

from datetime import date
from decimal import Decimal
import uuid
import pytest
from sqlalchemy.orm import Session

from rezekify.agent.runtime import build_cognitive_system_prompt, parse_agent_turn
from rezekify.agent.tools import AGENT_TOOL_DEFINITIONS, AgentToolDispatcher, ManageVaultArgs
from rezekify.db.models import Account, AccountType, Category, CategoryType, User, Vault, VaultType
from rezekify.services.vault_distribution import (
    calculate_priority_bills_distribution,
    calculate_proportional_distribution,
)


@pytest.fixture
def seeded_agent_vault_db(db_session: Session, sample_user: User):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("5000000.00"),
    )
    cat = Category(
        user_id=sample_user.id,
        name="Tagihan",
        category_type=CategoryType.EXPENSE,
    )
    v_sav = Vault(
        user_id=sample_user.id,
        name="Dana Darurat",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("10000000.00"),
        allocated_amount=Decimal("2000000.00"),
        is_locked=False,
    )
    v_bill = Vault(
        user_id=sample_user.id,
        name="Listrik PLN",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("500000.00"),
        allocated_amount=Decimal("500000.00"),
        target_date=date(2026, 1, 31),
        is_locked=True,
    )
    db_session.add_all([acc, cat, v_sav, v_bill])
    db_session.commit()
    return sample_user


def test_manage_vault_tool_definition_registered():
    tool_names = [t["name"] for t in AGENT_TOOL_DEFINITIONS]
    assert "manage_vault" in tool_names

    tool = next(t for t in AGENT_TOOL_DEFINITIONS if t["name"] == "manage_vault")
    props = tool["parameters"]["properties"]
    assert "action" in props
    assert "vault_name" in props
    assert "amount" in props
    assert "account_name" in props
    assert "lock_state" in props
    assert "strategy" in props
    assert "distribute" in props["action"]["enum"]
    assert "action" in tool["parameters"]["required"]


def test_manage_vault_deposit_action(db_session: Session, seeded_agent_vault_db: User):
    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "deposit",
        "vault_name": "Dana Darurat",
        "amount": 500000,
        "account_name": "BCA",
    }
    result = dispatcher.dispatch(seeded_agent_vault_db.id, "manage_vault", args)

    assert result["status"] == "success"
    assert "Dana Darurat" in result["message"]
    assert float(result["vault"]["allocated_amount"]) == 2500000.0
    assert result["vault"]["is_locked"] is True


def test_manage_vault_pay_bill_action(db_session: Session, seeded_agent_vault_db: User):
    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "pay_bill",
        "vault_name": "Listrik PLN",
        "account_name": "BCA",
    }
    result = dispatcher.dispatch(seeded_agent_vault_db.id, "manage_vault", args)

    assert result["status"] == "success"
    assert float(result["vault"]["allocated_amount"]) == 0.0
    # Clamped to Feb 28
    assert str(result["vault"]["target_date"]) == "2026-02-28"

    # Verify ledger deduction
    acc = db_session.query(Account).filter_by(user_id=seeded_agent_vault_db.id, name="BCA").one()
    assert acc.current_balance == Decimal("4500000.00")

    from rezekify.db.models import EntryType, Transaction
    tx_id = uuid.UUID(result["transaction_id"])
    tx = db_session.query(Transaction).filter_by(id=tx_id).one()
    debit_entry = next(e for e in tx.ledger_entries if e.entry_type == EntryType.DEBIT)
    v_bill = db_session.query(Vault).filter_by(user_id=seeded_agent_vault_db.id, name="Listrik PLN").one()
    assert debit_entry.vault_id == v_bill.id


def test_manage_vault_toggle_lock_action(db_session: Session, seeded_agent_vault_db: User):
    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "toggle_lock",
        "vault_name": "Dana Darurat",
        "lock_state": True,
    }
    result = dispatcher.dispatch(seeded_agent_vault_db.id, "manage_vault", args)
    assert result["status"] == "success"
    assert result["vault"]["is_locked"] is True


def test_manage_vault_check_status_action(db_session: Session, seeded_agent_vault_db: User):
    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "check_status",
        "vault_name": "Dana Darurat",
    }
    result = dispatcher.dispatch(seeded_agent_vault_db.id, "manage_vault", args)
    assert result["status"] == "success"
    assert result["vault"]["name"] == "Dana Darurat"
    assert "percentage" in result["vault"]


def test_manage_vault_missing_vault_name_error(db_session: Session, seeded_agent_vault_db: User):
    """Review Focus 5: Graceful error response on missing vault name."""
    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "deposit",
        "vault_name": "Tabungan Rumah Impian 99",
        "amount": 1000000,
    }
    result = dispatcher.dispatch(seeded_agent_vault_db.id, "manage_vault", args)
    assert result["status"] == "error"
    assert "tidak ditemukan" in result["message"].lower()


def test_manage_vault_runtime_system_prompt_and_fallback():
    prompt = build_cognitive_system_prompt()
    assert "manage_vault" in prompt

    turn = parse_agent_turn("Tolong jalankan manage_vault untuk nabung 100rb")
    assert turn.thought is not None
    assert "vault" in turn.thought.lower() or "komitmen" in turn.thought.lower()


@pytest.mark.parametrize(
    "raw_amount, expected_decimal",
    [
        ("100.000", Decimal("100000")),
        ("1.500.000", Decimal("1500000")),
        ("Rp 250.000,00", Decimal("250000.00")),
    ],
)
def test_manage_vault_amount_sanitization_indonesian_format(raw_amount, expected_decimal):
    args = ManageVaultArgs(action="deposit", vault_name="Dana Darurat", amount=raw_amount)
    assert args.amount == expected_decimal


def test_manage_vault_pay_bill_unknown_account_error(db_session: Session, seeded_agent_vault_db: User):
    dispatcher = AgentToolDispatcher(db_session)
    bca_before = db_session.query(Account).filter_by(user_id=seeded_agent_vault_db.id, name="BCA").one()
    initial_balance = bca_before.current_balance

    result = dispatcher.dispatch(
        seeded_agent_vault_db.id,
        "manage_vault",
        {
            "action": "pay_bill",
            "vault_name": "Listrik PLN",
            "account_name": "Rekening Gaib",
        },
    )
    assert result["status"] == "error"
    assert "Rekening Gaib" in result["message"]
    assert "tidak ditemukan" in result["message"].lower()

    # Verify highest-balance account was NOT silently charged
    db_session.refresh(bca_before)
    assert bca_before.current_balance == initial_balance


def test_manage_vault_deposit_unknown_account_error(db_session: Session, seeded_agent_vault_db: User):
    dispatcher = AgentToolDispatcher(db_session)
    result = dispatcher.dispatch(
        seeded_agent_vault_db.id,
        "manage_vault",
        {
            "action": "deposit",
            "vault_name": "Dana Darurat",
            "amount": "100.000",
            "account_name": "Bank Tidak Ada",
        },
    )
    assert result["status"] == "error"
    assert "Bank Tidak Ada" in result["message"]
    assert "tidak ditemukan" in result["message"].lower()


def test_calculate_priority_bills_distribution_logic(sample_user: User):
    v_bill1 = Vault(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        name="Indihome",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("300000.00"),
        allocated_amount=Decimal("0.00"),
        target_date=date(2026, 11, 5),
    )
    v_bill2 = Vault(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        name="Kost",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("1500000.00"),
        allocated_amount=Decimal("500000.00"),
        target_date=date(2026, 11, 1),  # Earlier due date
    )
    v_sav = Vault(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        name="Dana Darurat",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("5000000.00"),
        allocated_amount=Decimal("1000000.00"),
    )
    vaults = [v_bill1, v_bill2, v_sav]

    # Distribute Rp 2.000.000:
    # 1) v_bill2 deficit = 1.000.000 (due Nov 1) -> gets 1.000.000 (remaining: 1.000.000)
    # 2) v_bill1 deficit = 300.000 (due Nov 5) -> gets 300.000 (remaining: 700.000)
    # 3) Remainder 700.000 goes to v_sav
    allocs = dict(calculate_priority_bills_distribution(vaults, Decimal("2000000.00")))
    assert allocs[v_bill2.id] == Decimal("1000000.00")
    assert allocs[v_bill1.id] == Decimal("300000.00")
    assert allocs[v_sav.id] == Decimal("700000.00")
    assert sum(allocs.values()) == Decimal("2000000.00")


def test_calculate_distribution_rounding_remainder_assigned_to_largest_deficit(sample_user: User):
    v1 = Vault(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        name="Goal A",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("1000000.00"),
        allocated_amount=Decimal("0.00"),
    )
    v2 = Vault(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        name="Goal B",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("2000000.00"),
        allocated_amount=Decimal("0.00"),
    )
    # Distribute Rp 100.000 across 1M deficit (33.33%) and 2M deficit (66.66%)
    # Integer floor: 33.333 and 66.666 -> diff remainder of 1 is assigned to v2 (largest deficit)
    allocs = dict(calculate_proportional_distribution([v1, v2], Decimal("100000.00")))
    assert sum(allocs.values()) == Decimal("100000.00")


def test_calculate_distribution_all_fulfilled_falls_back_equally(sample_user: User):
    v1 = Vault(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        name="Goal A",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("1000000.00"),
        allocated_amount=Decimal("1000000.00"),
    )
    v2 = Vault(
        id=uuid.uuid4(),
        user_id=sample_user.id,
        name="Goal B",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("2000000.00"),
        allocated_amount=Decimal("2000000.00"),
    )
    allocs = dict(calculate_proportional_distribution([v1, v2], Decimal("500000.00")))
    assert sum(allocs.values()) == Decimal("500000.00")
    assert allocs[v1.id] == Decimal("250000.00")
    assert allocs[v2.id] == Decimal("250000.00")


def test_agent_manage_vault_distribute_priority_bills(seeded_agent_vault_db: User, db_session: Session):
    dispatcher = AgentToolDispatcher(db_session)
    res = dispatcher.dispatch(
        "manage_vault",
        seeded_agent_vault_db.id,
        {
            "action": "distribute",
            "amount": 1000000,
            "account_name": "BCA",
            "strategy": "priority_bills",
        },
    )
    assert res["status"] == "success"
    assert res["distributed_amount"] == 1000000
    assert "Berhasil mendistribusikan" in res["message"]


def test_agent_manage_vault_distribute_insufficient_balance(seeded_agent_vault_db: User, db_session: Session):
    dispatcher = AgentToolDispatcher(db_session)
    res = dispatcher.dispatch(
        "manage_vault",
        seeded_agent_vault_db.id,
        {
            "action": "distribute",
            "amount": 999999999,  # Exceeds BCA balance of 5.000.000
            "account_name": "BCA",
        },
    )
    assert res["status"] == "error"
    assert "tidak mencukupi" in res["message"]


