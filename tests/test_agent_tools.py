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
from rezekify.db.models import Account, AccountType, Category, CategoryType, User


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
