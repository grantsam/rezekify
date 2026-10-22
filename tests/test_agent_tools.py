"""Tests for Agent Tool Registry and Deterministic Tool Dispatcher."""

from datetime import date
from decimal import Decimal
import uuid
import pytest
from sqlalchemy.orm import Session

from rezekify.agent.tools import (
    AGENT_TOOL_DEFINITIONS,
    AgentToolDispatcher,
    FINANCIAL_TOOLS,
    execute_financial_tool,
)
from rezekify.db.models import Account, AccountType, Category, CategoryType, User, Vault, VaultType


@pytest.fixture
def seeded_tools_db(db_session: Session, sample_user: User):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("2000000.00"),
    )
    cat = Category(
        user_id=sample_user.id,
        name="Makanan",
        category_type=CategoryType.EXPENSE,
    )
    db_session.add_all([acc, cat])
    db_session.commit()
    return sample_user


def test_agent_tool_definitions_schema_structure():
    """Verifies that all 4 tools are registered with required schemas."""
    tool_names = [t["name"] for t in AGENT_TOOL_DEFINITIONS]
    assert "query_financial_ledger" in tool_names
    assert "get_runway_telemetry" in tool_names
    assert "simulate_purchase" in tool_names
    assert "record_transaction" in tool_names

    # Verify alias FINANCIAL_TOOLS points to definitions
    assert FINANCIAL_TOOLS == AGENT_TOOL_DEFINITIONS

    for tool in AGENT_TOOL_DEFINITIONS:
        assert "name" in tool
        assert "description" in tool
        assert "parameters" in tool
        assert tool["parameters"]["type"] == "object"
        assert "properties" in tool["parameters"]


def test_dispatcher_query_financial_ledger(db_session: Session, seeded_tools_db: User):
    """Verifies query_financial_ledger dispatch to FacetedQueryEngine."""
    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "flow_type": "EXPENSE",
        "start_date": "2026-10-01",
        "end_date": "2026-10-13",
        "group_by": "category",
    }
    result = dispatcher.dispatch(seeded_tools_db.id, "query_financial_ledger", args)

    assert result["status"] == "success"
    assert "summary" in result
    assert "query_metadata" in result


def test_dispatcher_get_runway_telemetry(db_session: Session, seeded_tools_db: User):
    """Verifies get_runway_telemetry dispatch to RunwayService."""
    dispatcher = AgentToolDispatcher(db_session)
    result = dispatcher.dispatch(seeded_tools_db.id, "get_runway_telemetry", {})

    assert result["status"] == "success"
    assert "operational_free_cash" in result["telemetry"]
    assert "daily_safe_runway" in result["telemetry"]
    assert "health_status" in result["telemetry"]


def test_dispatcher_simulate_purchase(db_session: Session, seeded_tools_db: User):
    """Verifies simulate_purchase dispatch to RunwayService without side-effects."""
    dispatcher = AgentToolDispatcher(db_session)
    args = {"planned_amount": 500000, "category_name": "Elektronik"}
    result = dispatcher.dispatch(seeded_tools_db.id, "simulate_purchase", args)

    assert result["status"] == "success"
    assert "projected_daily_runway" in result["simulation"]
    assert "daily_drop_amount" in result["simulation"]
    assert "is_safe" in result["simulation"]


def test_dispatcher_record_transaction(db_session: Session, seeded_tools_db: User):
    """Verifies record_transaction executes atomic double-entry mutation."""
    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "expense",
        "amount": 50000,
        "account_name": "BCA",
        "category_name": "Makanan",
        "description": "Nasi Goreng",
    }
    result = dispatcher.dispatch(seeded_tools_db.id, "record_transaction", args)

    assert result["status"] == "success"
    assert result["transaction"]["amount"] == Decimal("50000.00")
    assert result["transaction"]["account_name"] == "BCA"

    # Verify balance was updated
    acc = db_session.query(Account).filter_by(user_id=seeded_tools_db.id, name="BCA").one()
    assert acc.current_balance == Decimal("1950000.00")


def test_dispatcher_record_transaction_income(db_session: Session, seeded_tools_db: User):
    """Verifies record_transaction with income action."""
    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "income",
        "amount": 300000,
        "account_name": "BCA",
        "category_name": "Gaji",
        "description": "Freelance payment",
    }
    result = dispatcher.dispatch(seeded_tools_db.id, "record_transaction", args)

    assert result["status"] == "success"
    assert result["transaction"]["amount"] == Decimal("300000.00")
    acc = db_session.query(Account).filter_by(user_id=seeded_tools_db.id, name="BCA").one()
    assert acc.current_balance == Decimal("2300000.00")


def test_dispatcher_record_transaction_transfer(db_session: Session, seeded_tools_db: User):
    """Verifies record_transaction with transfer action."""
    acc_dest = Account(
        user_id=seeded_tools_db.id,
        name="GoPay",
        account_type=AccountType.EWALLET,
        current_balance=Decimal("50000.00"),
    )
    db_session.add(acc_dest)
    db_session.commit()

    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "transfer",
        "amount": 100000,
        "account_name": "BCA",
        "to_account_name": "GoPay",
        "description": "Top up GoPay",
    }
    result = dispatcher.dispatch(seeded_tools_db.id, "record_transaction", args)

    assert result["status"] == "success"
    acc_bca = db_session.query(Account).filter_by(user_id=seeded_tools_db.id, name="BCA").one()
    acc_gopay = db_session.query(Account).filter_by(user_id=seeded_tools_db.id, name="GoPay").one()
    assert acc_bca.current_balance == Decimal("1900000.00")
    assert acc_gopay.current_balance == Decimal("150000.00")


def test_dispatcher_malformed_json_arguments_graceful_error(db_session: Session, seeded_tools_db: User):
    """Review Focus 3: Malformed arguments return structured error without crashing."""
    dispatcher = AgentToolDispatcher(db_session)
    # Missing required 'planned_amount' or invalid type
    bad_args = {"planned_amount": "invalid_number"}
    result = dispatcher.dispatch(seeded_tools_db.id, "simulate_purchase", bad_args)

    assert result["status"] == "error"
    assert "validation" in result["message"].lower() or "error" in result["message"].lower()


def test_dispatcher_unknown_tool(db_session: Session, seeded_tools_db: User):
    """Verifies unknown tool name returns error."""
    dispatcher = AgentToolDispatcher(db_session)
    result = dispatcher.dispatch(seeded_tools_db.id, "nonexistent_tool", {})
    assert result["status"] == "error"
    assert "tidak dikenal" in result["message"] or "error" in result["message"].lower()


def test_dispatcher_account_not_found(db_session: Session, seeded_tools_db: User):
    """Verifies record_transaction error when account does not exist."""
    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "expense",
        "amount": 50000,
        "account_name": "NonexistentBank",
        "description": "Test",
    }
    result = dispatcher.dispatch(seeded_tools_db.id, "record_transaction", args)
    assert result["status"] == "error"
    assert "tidak ditemukan" in result["message"].lower()


def test_execute_financial_tool_wrapper(db_session: Session, seeded_tools_db: User):
    """Verifies execute_financial_tool function wrapper."""
    args = {"planned_amount": 100000}
    result = execute_financial_tool(
        tool_name="simulate_purchase",
        arguments=args,
        user_id=seeded_tools_db.id,
        db=db_session,
    )
    assert result["status"] == "success"
    assert "simulation" in result


def test_dispatcher_error_rollback_and_uniform_keys(db_session: Session, seeded_tools_db: User, monkeypatch):
    """Verifies that dispatch rollback occurs and returns both 'message' and 'error'."""
    dispatcher = AgentToolDispatcher(db_session)
    rollback_called = False

    def mock_rollback():
        nonlocal rollback_called
        rollback_called = True

    monkeypatch.setattr(db_session, "rollback", mock_rollback)

    # Trigger a dispatch exception
    bad_args = {"planned_amount": "invalid"}
    res = dispatcher.dispatch(seeded_tools_db.id, "simulate_purchase", bad_args)

    assert res["status"] == "error"
    assert rollback_called is True
    assert "error" in res
    assert "message" in res
    assert res["error"] == res["message"]


def test_dispatcher_wildcard_stripping(db_session: Session, seeded_tools_db: User):
    """Verifies % and _ wildcards are stripped from account, category, from_account, and to_account."""
    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "expense",
        "amount": 25000,
        "account_name": "%_BCA_%",
        "category_name": "%_Makanan_%",
        "description": "Wildcard test",
    }
    result = dispatcher.dispatch(seeded_tools_db.id, "record_transaction", args)
    assert result["status"] == "success"
    assert result["transaction"]["account_name"] == "BCA"

    # Also test transfer with from_account and to_account with wildcards
    acc_dest = Account(
        user_id=seeded_tools_db.id,
        name="GoPay",
        account_type=AccountType.EWALLET,
        current_balance=Decimal("50000.00"),
    )
    db_session.add(acc_dest)
    db_session.commit()

    transfer_args = {
        "action": "transfer",
        "amount": 10000,
        "from_account": "%_BCA_%",
        "to_account": "%_GoPay_%",
        "description": "Transfer wildcard test",
    }
    res_transfer = dispatcher.dispatch(seeded_tools_db.id, "record_transaction", transfer_args)
    assert res_transfer["status"] == "success"


def test_dispatcher_category_type_constraint(db_session: Session, seeded_tools_db: User):
    """Verifies expense/income lookups constrain category_type matching."""
    # Seed an income category with name "Bonus"
    income_cat = Category(
        user_id=seeded_tools_db.id,
        name="Bonus",
        category_type=CategoryType.INCOME,
    )
    db_session.add(income_cat)
    db_session.commit()

    dispatcher = AgentToolDispatcher(db_session)
    # Record expense under "Bonus" - must not bind to income_cat
    args = {
        "action": "expense",
        "amount": 10000,
        "account_name": "BCA",
        "category_name": "Bonus",
        "description": "Expense Bonus test",
    }
    result = dispatcher.dispatch(seeded_tools_db.id, "record_transaction", args)
    assert result["status"] == "success"

    # Query all categories named Bonus for this user
    cats = db_session.query(Category).filter_by(user_id=seeded_tools_db.id, name="Bonus").all()
    types = {c.category_type for c in cats}
    assert CategoryType.EXPENSE in types
    assert CategoryType.INCOME in types


def test_record_transaction_args_note_and_description_fallback():
    """Verifies note fallback logic when description is omitted or note is provided."""
    from rezekify.agent.tools import RecordTransactionArgs

    # 1. With note only, description falls back to note
    args1 = RecordTransactionArgs(action="expense", amount=Decimal("15000"), account_name="BCA", note="Kopi kenangan")
    assert args1.description == "Kopi kenangan"
    assert args1.note == "Kopi kenangan"

    # 2. With description and note, description takes precedence
    args2 = RecordTransactionArgs(action="expense", amount=Decimal("15000"), account_name="BCA", description="Makan siang", note="Catatan tambahan")
    assert args2.description == "Makan siang"

    # 3. With neither description nor note, description defaults to 'Transaksi'
    args3 = RecordTransactionArgs(action="expense", amount=Decimal("15000"), account_name="BCA")
    assert args3.description == "Transaksi"


def test_dispatcher_record_transaction_exact_account_name_match(db_session: Session, seeded_tools_db: User):
    """Verifies exact case-insensitive account match priority before falling back to substring."""
    acc_prioritas = Account(
        user_id=seeded_tools_db.id,
        name="BCA Prioritas",
        account_type=AccountType.BANK,
        current_balance=Decimal("10000000.00"),
    )
    db_session.add(acc_prioritas)
    db_session.commit()

    dispatcher = AgentToolDispatcher(db_session)

    # Looking up "bca" should match "BCA" exactly, not "BCA Prioritas"
    args = {
        "action": "expense",
        "amount": 50000,
        "account_name": "bca",
        "note": "Tes match eksak",
    }
    result = dispatcher.dispatch(seeded_tools_db.id, "record_transaction", args)
    assert result["status"] == "success"
    assert result["transaction"]["account_name"] == "BCA"

    # Looking up "prioritas" has no exact match, falls back to substring and matches "BCA Prioritas"
    args_sub = {
        "action": "expense",
        "amount": 20000,
        "account_name": "prioritas",
        "note": "Tes match substring",
    }
    res_sub = dispatcher.dispatch(seeded_tools_db.id, "record_transaction", args_sub)
    assert res_sub["status"] == "success"
    assert res_sub["transaction"]["account_name"] == "BCA Prioritas"


def test_query_ledger_args_with_null_fields(db_session: Session, seeded_tools_db: User):
    """Verifies QueryLedgerArgs accepts null fields without validation errors and dispatches successfully."""
    from rezekify.agent.tools import QueryLedgerArgs

    payload = {
        "flow_type": "all",
        "start_date": None,
        "end_date": None,
        "categories": None,
        "accounts": None,
        "keyword": None,
        "group_by": None,
        "compare_with_previous_period": None,
    }
    args = QueryLedgerArgs(**payload)
    assert args.flow_type == "ALL"
    assert args.group_by == "none"
    assert args.compare_with_previous_period is False
    assert args.limit == 50
    assert args.order_by == "date_desc"

    dispatcher = AgentToolDispatcher(db_session)
    result = dispatcher.dispatch(seeded_tools_db.id, "query_financial_ledger", payload)
    assert result["status"] == "success"
    assert "summary" in result


def test_string_amount_and_null_stripping_validation(db_session: Session, seeded_tools_db: User):
    """Verifies SimulatePurchaseArgs and RecordTransactionArgs convert string amounts and strip null fields."""
    from rezekify.agent.tools import RecordTransactionArgs, SimulatePurchaseArgs

    # SimulatePurchaseArgs with string amount and null optional fields
    sim_args = SimulatePurchaseArgs(**{"planned_amount": "50,000", "category_name": None, "account_name": None})
    assert sim_args.planned_amount == Decimal("50000")
    assert sim_args.category_name is None
    assert sim_args.account_name is None

    # RecordTransactionArgs with string amount and null optional fields
    rec_args = RecordTransactionArgs(
        **{
            "action": "expense",
            "amount": "50,000",
            "account_name": "BCA",
            "category_name": None,
            "to_account": None,
            "to_account_name": None,
            "note": None,
            "description": None,
        }
    )
    assert rec_args.amount == Decimal("50000")
    assert rec_args.description == "Transaksi"

    dispatcher = AgentToolDispatcher(db_session)
    sim_res = dispatcher.dispatch(seeded_tools_db.id, "simulate_purchase", {"planned_amount": "50,000"})
    assert sim_res["status"] == "success"

    rec_res = dispatcher.dispatch(
        seeded_tools_db.id,
        "record_transaction",
        {"action": "expense", "amount": "25,000", "account_name": "BCA", "category_name": None},
    )
    assert rec_res["status"] == "success"
    assert rec_res["transaction"]["amount"] == Decimal("25000.00")


def test_agent_expense_auto_reconciles_fixed_bill(db_session: Session, sample_user: User):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("2000000.00"),
    )
    v_bill = Vault(
        user_id=sample_user.id,
        name="Wifi Indihome",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("350000.00"),
        allocated_amount=Decimal("350000.00"),
        target_date=date(2026, 10, 20),
        is_locked=True,
    )
    db_session.add_all([acc, v_bill])
    db_session.commit()

    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "expense",
        "amount": 350000,
        "account_name": "BCA",
        "description": "Bayar tagihan wifi indihome",
    }
    result = dispatcher.dispatch(sample_user.id, "record_transaction", args)

    assert result["status"] == "success"
    assert "reconciled_vault" in result["transaction"]
    assert result["transaction"]["reconciled_vault"]["name"] == "Wifi Indihome"
    assert "Wifi Indihome" in result["message"]

    db_session.refresh(v_bill)
    assert v_bill.allocated_amount == Decimal("0.00")
    assert v_bill.target_date == date(2026, 11, 20)


def test_agent_expense_does_not_match_savings_vault(db_session: Session, sample_user: User):
    # Review Focus 1
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("2000000.00"),
    )
    v_sav = Vault(
        user_id=sample_user.id,
        name="Dana Liburan",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("5000000.00"),
        allocated_amount=Decimal("1000000.00"),
        target_date=date(2026, 12, 1),
    )
    db_session.add_all([acc, v_sav])
    db_session.commit()

    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "expense",
        "amount": 500000,
        "account_name": "BCA",
        "description": "Beli tiket dana liburan",
    }
    result = dispatcher.dispatch(sample_user.id, "record_transaction", args)

    assert result["status"] == "success"
    assert "reconciled_vault" not in result["transaction"]
    db_session.refresh(v_sav)
    assert v_sav.allocated_amount == Decimal("1000000.00")
    assert v_sav.target_date == date(2026, 12, 1)


def test_agent_ambiguous_bill_falls_back_to_unlinked_expense(db_session: Session, sample_user: User):
    # Review Focus 2
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("2000000.00"),
    )
    v1 = Vault(
        user_id=sample_user.id,
        name="Listrik Rumah",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("500000.00"),
        allocated_amount=Decimal("500000.00"),
        target_date=date(2026, 10, 15),
    )
    v2 = Vault(
        user_id=sample_user.id,
        name="Listrik Toko",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("500000.00"),
        allocated_amount=Decimal("500000.00"),
        target_date=date(2026, 10, 15),
    )
    db_session.add_all([acc, v1, v2])
    db_session.commit()

    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "expense",
        "amount": 250000,  # does not match either target_amount
        "account_name": "BCA",
        "description": "Bayar tagihan listrik",
    }
    result = dispatcher.dispatch(sample_user.id, "record_transaction", args)

    assert result["status"] == "success"
    assert "reconciled_vault" not in result["transaction"]
    db_session.refresh(v1)
    db_session.refresh(v2)
    assert v1.allocated_amount == Decimal("500000.00")
    assert v2.allocated_amount == Decimal("500000.00")



