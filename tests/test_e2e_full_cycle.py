"""End-to-End Integration Test: Autonomous Multi-Modal Personal Finance Lifecycle."""

from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from rezekify.api.deps import get_db
from rezekify.api.main import app
from rezekify.db.models import Account, AccountType, Base
from rezekify.gateway.telegram_bot import TelegramGateway
from rezekify.services.auth import AuthService

# Set up isolated in-memory DB for E2E TestClient
engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_full_system_e2e():
    """Tests the complete end-to-end user financial lifecycle across all 3 tiers."""
    # 1. User Registration & JWT Authentication
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "e2e_student@rezekify.id",
            "password": "SecurePassword123!",
            "full_name": "Mahasiswa Mandiri",
        },
    )
    assert reg_res.status_code == 200
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Add Holding Accounts (GoPay & BCA)
    acc1_res = client.post(
        "/api/v1/accounts",
        json={"name": "GoPay", "account_type": "EWALLET", "initial_balance": 500000.00},
        headers=headers,
    )
    assert acc1_res.status_code == 200
    assert "id" in acc1_res.json()

    acc2_res = client.post(
        "/api/v1/accounts",
        json={"name": "BCA", "account_type": "BANK", "initial_balance": 1500000.00},
        headers=headers,
    )
    assert acc2_res.status_code == 200
    bca_id = acc2_res.json()["id"]

    # Total liquid = 500,000 + 1,500,000 = 2,000,000

    # 3. Add Virtual Vault (Fixed Bill H-5 for Sewa Kos)
    due_date = (date.today() + timedelta(days=5)).isoformat()
    vault_res = client.post(
        "/api/v1/vaults",
        json={
            "name": "Sewa Kos",
            "vault_type": "FIXED_BILL",
            "target_amount": 1000000.00,
            "allocated_amount": 600000.00,
            "target_date": due_date,
        },
        headers=headers,
    )
    assert vault_res.status_code == 200

    # Operational free = 2,000,000 - 600,000 = 1,400,000

    # 4. Check Initial Dashboard Telemetry
    initial_dash = client.get("/api/v1/dashboard/summary", headers=headers)
    assert initial_dash.status_code == 200
    summary1 = initial_dash.json()
    assert Decimal(str(summary1["total_liquid_cash"])) == Decimal("2000000.00")
    assert Decimal(str(summary1["vault_locked_cash"])) == Decimal("600000.00")
    assert Decimal(str(summary1["operational_free_cash"])) == Decimal("1400000.00")
    assert len(summary1["upcoming_bills"]) == 1
    assert summary1["upcoming_bills"][0]["name"] == "Sewa Kos"
    initial_daily_runway = Decimal(str(summary1["daily_safe_runway"]))

    # 5. Simulate and Record Natural Language Expense via AI Omni-Input
    with pytest.MonkeyPatch.context() as mp:
        from rezekify.agent.orchestrator import AgentOrchestrator
        # Mock entity extraction to test deterministic integration
        mp.setattr(
            AgentOrchestrator,
            "extract_entities",
            lambda self, text, image_bytes=None, user_id=None: {
                "action": "expense",
                "amount": 100000,
                "account_name": "GoPay",
                "category_name": "Pendidikan",
                "note": "Beli Buku Referensi",
            },
        )
        chat_res = client.post(
            "/api/v1/dashboard/ai-chat",
            json={"message": "beli buku referensi 100rb gopay"},
            headers=headers,
        )
        assert chat_res.status_code == 200
        assert "Tercatat" in chat_res.json()["reply"]
        assert "Beli Buku Referensi" in chat_res.json()["reply"]

    # 6. Check Updated Runway Telemetry
    # Operational free cash should now be 1,400,000 - 100,000 = 1,300,000
    updated_dash = client.get("/api/v1/dashboard/summary", headers=headers)
    assert updated_dash.status_code == 200
    summary2 = updated_dash.json()
    assert Decimal(str(summary2["total_liquid_cash"])) == Decimal("1900000.00")
    assert Decimal(str(summary2["operational_free_cash"])) == Decimal("1300000.00")
    assert Decimal(str(summary2["daily_safe_runway"])) < initial_daily_runway

    # 7. Check Transactions Ledger Listing
    tx_list = client.get("/api/v1/transactions", headers=headers)
    assert tx_list.status_code == 200
    assert len(tx_list.json()) == 1
    assert tx_list.json()[0]["description"] == "Beli Buku Referensi"

    # 8. Manual Transaction CRUD & Balance Reversal
    manual_res = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "EXPENSE",
            "account_id": bca_id,
            "amount": 200000.00,
            "description": "Beli Perlengkapan Meja",
        },
        headers=headers,
    )
    assert manual_res.status_code == 200
    manual_tx = manual_res.json()
    assert manual_tx["description"] == "Beli Perlengkapan Meja"
    manual_id = manual_tx["id"]

    # Check operational free cash drops by 200,000 (1,300,000 -> 1,100,000)
    dash_after_manual = client.get("/api/v1/dashboard/summary", headers=headers)
    assert dash_after_manual.status_code == 200
    assert Decimal(str(dash_after_manual.json()["operational_free_cash"])) == Decimal("1100000.00")

    # Delete transaction and verify deterministic balance reversal
    del_res = client.delete(f"/api/v1/transactions/{manual_id}", headers=headers)
    assert del_res.status_code == 200

    # Check operational free cash is reversed back to 1,300,000
    dash_after_del = client.get("/api/v1/dashboard/summary", headers=headers)
    assert dash_after_del.status_code == 200
    assert Decimal(str(dash_after_del.json()["operational_free_cash"])) == Decimal("1300000.00")

    # Ensure transaction is no longer in list
    tx_list_after_del = client.get("/api/v1/transactions", headers=headers)
    assert tx_list_after_del.status_code == 200
    assert len(tx_list_after_del.json()) == 1

    # 9. Telegram Bot Pairing & Autonomous Command Execution
    # Request OTP pairing code
    pairing_res = client.post("/api/v1/auth/telegram-pairing-code", headers=headers)
    assert pairing_res.status_code == 200
    pairing_code = pairing_res.json()["pairing_code"]
    assert pairing_code.startswith("DK-")

    # Connect to database via TelegramGateway
    tg_db = TestingSessionLocal()
    try:
        tg_gateway = TelegramGateway(db=tg_db)
        chat_id = 99887766

        # Step A: Link Telegram account
        link_reply = tg_gateway.process_text_message(
            chat_id=chat_id, text=f"/link {pairing_code}"
        )
        assert "berhasil terhubung" in link_reply
        assert "Mahasiswa Mandiri" in link_reply

        # Step B: Execute /runway command
        runway_reply = tg_gateway.process_text_message(chat_id=chat_id, text="/runway")
        assert "Status Keuangan Rezekify" in runway_reply
        assert "Saldo Bebas Operasional: Rp 1,300,000" in runway_reply
        assert "Sewa Kos" in runway_reply

        # Step C: Log natural language expense via Telegram
        tg_gateway.orchestrator.extract_entities = MagicMock(
            return_value={
                "action": "expense",
                "amount": 25000,
                "account_name": "GoPay",
                "category_name": "Konsumsi",
                "note": "Kopi Sore",
            }
        )
        expense_reply = tg_gateway.process_text_message(
            chat_id=chat_id, text="ngopi sore 25rb gopay"
        )
        assert "Tercatat" in expense_reply
        assert "Kopi Sore" in expense_reply
        assert "Rp 25,000" in expense_reply

        # Step D: Final check on Dashboard API reflecting Telegram expense
        final_dash = client.get("/api/v1/dashboard/summary", headers=headers)
        assert final_dash.status_code == 200
        final_summary = final_dash.json()
        assert Decimal(str(final_summary["total_liquid_cash"])) == Decimal("1875000.00")
        assert Decimal(str(final_summary["operational_free_cash"])) == Decimal("1275000.00")
    finally:
        tg_db.close()


def test_e2e_voice_note_ingestion_and_runway_update():
    """Validates Telegram voice note ingestion end-to-end: transcription -> ledger expense -> runway update."""
    db = TestingSessionLocal()
    try:
        auth_service = AuthService(db)
        user = auth_service.register(
            email="voice_e2e@rezekify.id",
            password="SecurePassword123!",
            full_name="Voice E2E User",
        )
        user.telegram_chat_id = 88776655
        db.commit()

        account = Account(
            user_id=user.id,
            name="BCA",
            account_type=AccountType.BANK,
            current_balance=Decimal("1000000.00"),
            is_active=True,
        )
        db.add(account)
        db.commit()
        db.refresh(account)

        mock_downloader = MagicMock(return_value=b"fake_voice_ogg_bytes")
        gateway = TelegramGateway(db=db, voice_downloader=mock_downloader)

        # Mock transcription on orchestrator's agent and entity extraction
        mock_agent = MagicMock()
        mock_agent.transcribe_audio.return_value = "makan malam 50000 bca"
        gateway.orchestrator.agent = mock_agent

        gateway.orchestrator.extract_entities = MagicMock(
            return_value={
                "action": "expense",
                "amount": 50000,
                "account_name": "BCA",
                "category_name": "Konsumsi",
                "note": "makan malam",
            }
        )

        update_payload = {
            "update_id": 8801,
            "message": {
                "chat": {"id": 88776655},
                "voice": {"file_id": "telegram_voice_ogg_file_88"},
            },
        }

        reply = gateway.handle_update(update_payload)

        # Verify downloader was invoked with file_id
        mock_downloader.assert_called_once_with("telegram_voice_ogg_file_88")
        mock_agent.transcribe_audio.assert_called_once_with(b"fake_voice_ogg_bytes")

        # Assert transcription header and recorded expense amount in reply
        assert '🎙️ Transkripsi: "makan malam 50000 bca"' in reply
        assert "Tercatat" in reply
        assert "Rp 50,000" in reply

        # Assert account balance decreased from Rp 1.000.000 to Rp 950.000
        db.refresh(account)
        assert account.current_balance == Decimal("950000.00")
    finally:
        db.close()


