"""Tests for Autonomous Multi-Turn ReAct Loop Orchestration."""

from decimal import Decimal
from unittest.mock import MagicMock
import pytest
from sqlalchemy.orm import Session

from rezekify.agent.orchestrator import AgentOrchestrator
from rezekify.agent.runtime import ReActAgent
from rezekify.db.models import Account, AccountType, Category, CategoryType, User


@pytest.fixture
def autonomous_env(db_session: Session, sample_user: User):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("3000000.00"),
    )
    cat = Category(
        user_id=sample_user.id,
        name="Makanan",
        category_type=CategoryType.EXPENSE,
    )
    db_session.add_all([acc, cat])
    db_session.commit()
    return sample_user


def test_autonomous_react_loop_retrospective_inquiry(db_session: Session, autonomous_env: User):
    """Verifies ReAct cycle: Thought -> Tool Call (query_financial_ledger) -> Final Synthesized Answer."""
    mock_agent = MagicMock(spec=ReActAgent)
    # Turn 1: Model decides to call query_financial_ledger
    # Turn 2: Model receives observation and outputs final answer
    mock_agent.process_input.side_effect = [
        {
            "raw": """{
              "thought": "Pengguna menanyakan total makan bulan ini.",
              "tool_call": {
                "name": "query_financial_ledger",
                "arguments": {"flow_type": "EXPENSE", "categories": ["Makanan"]}
              }
            }"""
        },
        {
            "raw": """{
              "thought": "Observasi menunjukkan total 0.",
              "final_response": "Total pengeluaran kategori Makanan Anda bulan ini adalah Rp 0."
            }"""
        },
    ]

    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)
    res = orchestrator.run_autonomous_loop(
        user_id=autonomous_env.id,
        prompt="Berapa pengeluaran makan saya bulan ini?",
    )

    assert "Total pengeluaran kategori Makanan" in res["reply"]
    assert res["hops"] == 2
    assert mock_agent.process_input.call_count == 2


def test_autonomous_react_loop_what_if_simulation(db_session: Session, autonomous_env: User):
    """Verifies ReAct cycle for simulate_purchase."""
    mock_agent = MagicMock(spec=ReActAgent)
    mock_agent.process_input.side_effect = [
        {
            "raw": """{
              "thought": "Pengguna berencana membeli sepatu 500rb, saya simulasikan.",
              "tool_call": {
                "name": "simulate_purchase",
                "arguments": {"planned_amount": 500000, "category_name": "Belanja"}
              }
            }"""
        },
        {
            "raw": """{
              "thought": "Simulasi aman dilakukan.",
              "final_response": "Pembelian sepatu Rp 500.000 aman dilakukan. Jatah harian Anda tetap stabil."
            }"""
        },
    ]

    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)
    res = orchestrator.run_autonomous_loop(
        user_id=autonomous_env.id,
        prompt="Boleh nggak saya beli sepatu 500rb?",
    )

    assert "aman dilakukan" in res["reply"]
    assert res["hops"] == 2


def test_autonomous_react_loop_capped_at_max_turns(db_session: Session, autonomous_env: User):
    """Review Focus 5: ReAct loop terminates safely when model exceeds max 3 hops."""
    mock_agent = MagicMock(spec=ReActAgent)
    # Infinitely calls tool
    mock_agent.process_input.return_value = {
        "raw": """{
          "thought": "Saya ingin mengecek lagi.",
          "tool_call": {
            "name": "get_runway_telemetry",
            "arguments": {}
          }
        }"""
    }

    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)
    res = orchestrator.run_autonomous_loop(
        user_id=autonomous_env.id,
        prompt="Cek data keuangan saya berulang-ulang",
        max_turns=3,
    )

    assert res["hops"] == 3
    assert "reply" in res
    assert mock_agent.process_input.call_count == 3


def test_autonomous_react_loop_record_transaction_mutation(db_session: Session, autonomous_env: User):
    """Verifies ReAct loop executing record_transaction mutations and capturing tx metadata."""
    mock_agent = MagicMock(spec=ReActAgent)
    mock_agent.process_input.side_effect = [
        {
            "raw": """{
              "thought": "Mencatat makan siang 35rb via BCA.",
              "tool_call": {
                "name": "record_transaction",
                "arguments": {
                  "action": "expense",
                  "amount": 35000,
                  "account_name": "BCA",
                  "category_name": "Makanan",
                  "description": "Makan siang ayam geprek"
                }
              }
            }"""
        },
        {
            "raw": """{
              "thought": "Transaksi berhasil dicatat.",
              "final_response": "Tercatat pengeluaran Rp 35.000 untuk Makan siang ayam geprek via BCA."
            }"""
        },
    ]

    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)
    res = orchestrator.run_autonomous_loop(
        user_id=autonomous_env.id,
        prompt="Catat makan siang ayam geprek 35rb pake BCA",
    )

    assert "Tercatat pengeluaran Rp 35.000" in res["reply"]
    assert res["transaction_id"] is not None
    assert res["transaction"]["amount"] == Decimal("35000")
    assert res["hops"] == 2

    # Check database account balance
    acc = db_session.query(Account).filter_by(user_id=autonomous_env.id, name="BCA").one()
    assert acc.current_balance == Decimal("2965000.00")


def test_autonomous_react_loop_comparative_inquiry(db_session: Session, autonomous_env: User):
    """Verifies ReAct cycle for historical comparative question."""
    mock_agent = MagicMock(spec=ReActAgent)
    mock_agent.process_input.side_effect = [
        {
            "raw": """{
              "thought": "Komparasi makan bulan ini vs bulan lalu.",
              "tool_call": {
                "name": "query_financial_ledger",
                "arguments": {
                  "flow_type": "EXPENSE",
                  "categories": ["Makanan"],
                  "compare_with_previous_period": true
                }
              }
            }"""
        },
        {
            "raw": """{
              "thought": "Observasi komparasi siap.",
              "final_response": "Pengeluaran makan bulan ini turun 15% dibanding bulan lalu."
            }"""
        },
    ]

    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)
    res = orchestrator.run_autonomous_loop(
        user_id=autonomous_env.id,
        prompt="Cek pengeluaran makan bulan ini vs bulan lalu",
    )

    assert "Pengeluaran makan bulan ini turun" in res["reply"]
    assert res["hops"] == 2


def test_autonomous_react_loop_no_agent_configured(db_session: Session, autonomous_env: User):
    """Verifies graceful response when no AI agent is configured."""
    orchestrator = AgentOrchestrator(db=db_session, agent=None)
    res = orchestrator.run_autonomous_loop(
        user_id=autonomous_env.id,
        prompt="Halo apa kabar?",
    )
    assert "belum terkonfigurasi" in res["reply"]
    assert res["hops"] == 0


def test_handle_message_delegates_to_autonomous_loop(db_session: Session, autonomous_env: User):
    """Verifies handle_message dispatches through autonomous loop for analytical queries."""
    mock_agent = MagicMock(spec=ReActAgent)
    mock_agent.process_input.return_value = {
        "raw": """{
          "thought": "Menjawab sapaan.",
          "final_response": "Halo! Saya copilot keuangan Rezekify Anda."
        }"""
    }
    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)
    reply = orchestrator.handle_message(
        user_id=autonomous_env.id,
        text="Halo!",
    )
    assert reply == "Halo! Saya copilot keuangan Rezekify Anda."


@pytest.mark.asyncio
async def test_handle_message_async_delegates_to_autonomous_loop(db_session: Session, autonomous_env: User):
    """Verifies handle_message_async dispatches through autonomous loop and returns enriched dict."""
    mock_agent = MagicMock(spec=ReActAgent)
    mock_agent.process_input.return_value = {
        "raw": """{
          "thought": "Menjawab sapaan async.",
          "final_response": "Halo dari async loop!"
        }"""
    }
    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)
    result = await orchestrator.handle_message_async(
        user_id=autonomous_env.id,
        text="Halo async!",
    )
    assert isinstance(result, dict)
    assert result["reply"] == "Halo dari async loop!"
    assert result["hops"] == 1
    assert result["telemetry"] is not None


def test_autonomous_react_loop_preserves_action_and_thought_traces_in_history(
    db_session: Session, autonomous_env: User
):
    """Verifies that the next turn's history_context contains [TINDAKAN ASISTEN] with thought and tool call."""
    mock_agent = MagicMock(spec=ReActAgent)
    mock_agent.process_input.side_effect = [
        {
            "raw": """{
              "thought": "Memeriksa pengeluaran kopi",
              "tool_call": {
                "name": "query_financial_ledger",
                "arguments": {"flow_type": "EXPENSE"}
              }
            }"""
        },
        {
            "raw": """{
              "thought": "Data didapat.",
              "final_response": "Selesai."
            }"""
        },
    ]

    orchestrator = AgentOrchestrator(db=db_session, agent=mock_agent)
    orchestrator.run_autonomous_loop(
        user_id=autonomous_env.id,
        prompt="Berapa beli kopi?",
    )

    assert mock_agent.process_input.call_count == 2
    second_call_text = mock_agent.process_input.call_args_list[1].kwargs["text"]
    assert "[TINDAKAN ASISTEN]: Penalaran: Memeriksa pengeluaran kopi. Memanggil alat 'query_financial_ledger'" in second_call_text
    assert "[OBSERVASI DARI query_financial_ledger]:" in second_call_text


