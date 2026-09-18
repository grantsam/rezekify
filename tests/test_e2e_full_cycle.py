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
from rezekify.db.models import Base
from rezekify.gateway.telegram_bot import TelegramGateway

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
    gopay_id = acc1_res.json()["id"]

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
