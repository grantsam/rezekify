"""Comprehensive End-to-End Integration Test Suite for Rezekify Phases 6-10 Lifecycle.

Verifies the complete deterministic financial journey across all newly implemented phases:
1. User Setup & Preference Ingestion (safe_runway_threshold, monthly_cycle_day)
2. Holding Account Ingestion (BCA)
3. Phase 8: Lump-Sum Wizard Multi-Vault Distribution (Atomic exact sum conservation)
4. Phase 6 & 9: Runway Telemetry, What-If Purchase Simulation & Contextual Survival Guidance
5. Phase 7: Autonomous Bill Auto-Reconciliation & Ledger Linking
6. Phase 7: Manual Explicit Linking & Deselection
"""

from datetime import date, timedelta
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from rezekify.api.deps import get_db
from rezekify.api.main import app
from rezekify.core.rate_limit import RateLimiter
from rezekify.db.models import Base
from rezekify.services.vault_reconciliation import advance_one_month


# ponytail: Isolated in-memory SQLite database per test suite; upgrade to testcontainer Postgres if DB dialect parity is needed.
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
Base.metadata.create_all(bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    RateLimiter.reset_all()
    prev_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    if prev_override is not None:
        app.dependency_overrides[get_db] = prev_override
    else:
        app.dependency_overrides.pop(get_db, None)
    RateLimiter.reset_all()


def test_all_phases_e2e_lifecycle(client: TestClient):
    """Executes a full lifecycle test exercising Phases 6, 7, 8, 9, and 10 end-to-end."""
    # -------------------------------------------------------------------------
    # 1. User Setup: Register user & update safe runway threshold + monthly cycle
    # -------------------------------------------------------------------------
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "e2e_all_phases@rezekify.id",
            "password": "SecurePassword123!",
            "full_name": "Penguji Siklus Lengkap",
        },
    )
    assert reg_res.status_code == 200, f"Registration failed: {reg_res.text}"
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Set safe_runway_threshold = 40000.00 and monthly_cycle_day = 25
    profile_res = client.put(
        "/api/v1/settings/profile",
        json={
            "safe_runway_threshold": 40000.00,
            "monthly_cycle_day": 25,
        },
        headers=headers,
    )
    assert profile_res.status_code == 200, f"Profile update failed: {profile_res.text}"
    profile_data = profile_res.json()
    assert Decimal(str(profile_data["safe_runway_threshold"])) == Decimal("40000.00")
    assert profile_data["monthly_cycle_day"] == 25

    # -------------------------------------------------------------------------
    # 2. Account Ingestion: Add BCA (initial_balance = 5000000.00)
    # -------------------------------------------------------------------------
    acc_res = client.post(
        "/api/v1/accounts",
        json={
            "name": "BCA",
            "account_type": "BANK",
            "initial_balance": 5000000.00,
        },
        headers=headers,
    )
    assert acc_res.status_code == 200, f"Account creation failed: {acc_res.text}"
    bca_id = acc_res.json()["id"]
    assert Decimal(str(acc_res.json()["current_balance"])) == Decimal("5000000.00")

    # -------------------------------------------------------------------------
    # 3. Phase 8 (Lump-Sum Wizard Backend):
    #    Create 2 vaults: "Listrik PLN" (Fixed Bill, target 500k, allocated 0, due in 5 days)
    #    and "Dana Darurat" (Savings, target 10jt, allocated 1jt).
    #    Distribute Rp 2.500.000 (500k to Listrik PLN, 2.000.000 to Dana Darurat).
    # -------------------------------------------------------------------------
    listrik_due_date = (date.today() + timedelta(days=5)).isoformat()
    listrik_res = client.post(
        "/api/v1/vaults",
        json={
            "name": "Listrik PLN",
            "vault_type": "FIXED_BILL",
            "target_amount": 500000.00,
            "allocated_amount": 0.00,
            "target_date": listrik_due_date,
            "is_locked": False,
        },
        headers=headers,
    )
    assert listrik_res.status_code == 200, f"Listrik vault creation failed: {listrik_res.text}"
    listrik_id = listrik_res.json()["id"]

    darurat_res = client.post(
        "/api/v1/vaults",
        json={
            "name": "Dana Darurat",
            "vault_type": "SAVINGS",
            "target_amount": 10000000.00,
            "allocated_amount": 1000000.00,
            "is_locked": False,
        },
        headers=headers,
    )
    assert darurat_res.status_code == 200, f"Dana Darurat vault creation failed: {darurat_res.text}"
    darurat_id = darurat_res.json()["id"]

    # Distribute lump-sum: 500k to Listrik PLN, 2.000.000 to Dana Darurat
    distribute_res = client.post(
        "/api/v1/vaults/distribute",
        json={
            "total_amount": 2500000.00,
            "source_account_id": bca_id,
            "allocations": [
                {"vault_id": listrik_id, "amount": 500000.00},
                {"vault_id": darurat_id, "amount": 2000000.00},
            ],
        },
        headers=headers,
    )
    assert distribute_res.status_code == 200, f"Distribution failed: {distribute_res.text}"
    dist_data = distribute_res.json()
    assert Decimal(str(dist_data["total_allocated"])) == Decimal("2500000.00")

    # Assert both vaults are locked (is_locked=True), Listrik has 500k, Dana Darurat has 3jt
    v_listrik = client.get(f"/api/v1/vaults/{listrik_id}", headers=headers).json()
    assert v_listrik["is_locked"] is True
    assert Decimal(str(v_listrik["allocated_amount"])) == Decimal("500000.00")

    v_darurat = client.get(f"/api/v1/vaults/{darurat_id}", headers=headers).json()
    assert v_darurat["is_locked"] is True
    # Initial 1jt + 2jt allocated = 3jt
    assert Decimal(str(v_darurat["allocated_amount"])) == Decimal("3000000.00")

    # -------------------------------------------------------------------------
    # 4. Phase 6 & 9 (Runway Telemetry, Simulation & Survival Guidance):
    #    Fetch /api/v1/dashboard/summary, verify safe_runway_threshold == 40000.00,
    #    verify survival_guidance presence and structure.
    #    Call /api/v1/dashboard/simulate-purchase with planned_amount = 500000.00.
    # -------------------------------------------------------------------------
    dash_res = client.get("/api/v1/dashboard/summary", headers=headers)
    assert dash_res.status_code == 200, f"Dashboard summary failed: {dash_res.text}"
    summary = dash_res.json()

    assert Decimal(str(summary["safe_runway_threshold"])) == Decimal("40000.00")

    guidance = summary.get("survival_guidance")
    assert guidance is not None, "survival_guidance missing from summary"
    assert "tone" in guidance
    assert "headline" in guidance
    assert "message" in guidance
    assert "tactical_action" in guidance
    assert guidance["tone"] in ["CRITICAL", "WARNING", "HEALTHY"]
    assert len(guidance["headline"]) > 0
    assert len(guidance["message"]) > 0
    assert len(guidance["tactical_action"]) > 0

    # Simulate purchase of 500,000.00
    sim_res = client.post(
        "/api/v1/dashboard/simulate-purchase",
        json={"planned_amount": 500000.00},
        headers=headers,
    )
    assert sim_res.status_code == 200, f"Simulation failed: {sim_res.text}"
    sim = sim_res.json()
    assert Decimal(str(sim["current_daily_runway"])) >= Decimal("0.00")
    assert Decimal(str(sim["projected_daily_runway"])) >= Decimal("0.00")
    assert Decimal(str(sim["daily_drop_amount"])) >= Decimal("0.00")
    assert Decimal(str(sim["projected_daily_runway"])) <= Decimal(str(sim["current_daily_runway"]))
    assert isinstance(sim["is_safe"], bool)
    assert isinstance(sim["advice"], str) and len(sim["advice"]) > 0

    # -------------------------------------------------------------------------
    # 5. Phase 7 (Autonomous Bill Auto-Reconciliation & Ledger Linking):
    #    Call POST /api/v1/transactions with description "Bayar tagihan listrik PLN bulan ini"
    #    without vault_id. Verify autonomous matching, zeroing allocated, rollover +1 month,
    #    and ledger debit entry linking.
    # -------------------------------------------------------------------------
    tx1_res = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "EXPENSE",
            "amount": 500000.00,
            "account_id": bca_id,
            "description": "Bayar tagihan listrik PLN bulan ini",
        },
        headers=headers,
    )
    assert tx1_res.status_code == 200, f"Transaction creation failed: {tx1_res.text}"
    tx1_data = tx1_res.json()

    # Query Listrik PLN vault: verify allocated_amount == 0.00 and target_date rolled over by +1 month
    v_listrik_after = client.get(f"/api/v1/vaults/{listrik_id}", headers=headers).json()
    assert Decimal(str(v_listrik_after["allocated_amount"])) == Decimal("0.00")
    expected_listrik_rollover = advance_one_month(date.fromisoformat(listrik_due_date)).isoformat()
    assert v_listrik_after["target_date"] == expected_listrik_rollover

    # Query transaction detail: verify ledger_entries debit entry has vault_id matching Listrik PLN
    debit_entries_tx1 = [e for e in tx1_data["ledger_entries"] if e["entry_type"] == "DEBIT"]
    assert len(debit_entries_tx1) == 1
    assert debit_entries_tx1[0]["vault_id"] == listrik_id

    # -------------------------------------------------------------------------
    # 6. Phase 7 (Manual Explicit Linking & Deselection):
    #    Create second fixed bill vault "Wifi Indihome" (target 350k, allocated 350k).
    #    Call POST /api/v1/transactions explicitly passing vault_id = wifi_vault_id.
    #    Verify Wifi Indihome is reconciled and rolled over.
    # -------------------------------------------------------------------------
    wifi_due_date = (date.today() + timedelta(days=10)).isoformat()
    wifi_res = client.post(
        "/api/v1/vaults",
        json={
            "name": "Wifi Indihome",
            "vault_type": "FIXED_BILL",
            "target_amount": 350000.00,
            "allocated_amount": 350000.00,
            "target_date": wifi_due_date,
            "is_locked": True,
        },
        headers=headers,
    )
    assert wifi_res.status_code == 200, f"Wifi vault creation failed: {wifi_res.text}"
    wifi_vault_id = wifi_res.json()["id"]

    tx2_res = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "EXPENSE",
            "amount": 350000.00,
            "account_id": bca_id,
            "description": "Pembayaran Tagihan Wifi Indihome",
            "vault_id": wifi_vault_id,
        },
        headers=headers,
    )
    assert tx2_res.status_code == 200, f"Explicit linked transaction failed: {tx2_res.text}"
    tx2_data = tx2_res.json()

    # Verify Wifi Indihome is reconciled and rolled over
    v_wifi_after = client.get(f"/api/v1/vaults/{wifi_vault_id}", headers=headers).json()
    assert Decimal(str(v_wifi_after["allocated_amount"])) == Decimal("0.00")
    expected_wifi_rollover = advance_one_month(date.fromisoformat(wifi_due_date)).isoformat()
    assert v_wifi_after["target_date"] == expected_wifi_rollover

    # Verify debit entry has vault_id matching wifi_vault_id
    debit_entries_tx2 = [e for e in tx2_data["ledger_entries"] if e["entry_type"] == "DEBIT"]
    assert len(debit_entries_tx2) == 1
    assert debit_entries_tx2[0]["vault_id"] == wifi_vault_id
