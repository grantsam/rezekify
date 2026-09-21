"""Hermetic Full-Stack Integration Verification Suite.

Validates the complete end-to-end user lifecycle across all new integration endpoints:
1. POST /api/v1/auth/register, POST /api/v1/auth/login, GET /api/v1/auth/me
2. POST /api/v1/accounts (Bank and e-Wallet holding accounts)
3. POST /api/v1/vaults (Fixed Commitment H-7 upcoming bill)
4. GET /api/v1/dashboard/summary (runway gauge, operational cash, bills)
5. POST /api/v1/dashboard/simulate-purchase (what-if runway drop calculation)
6. POST /api/v1/dashboard/ai-receipt (multipart receipt upload and validation)
7. GET /api/v1/analytics/spending-breakdown (daily and monthly analytics)
"""

from datetime import date, timedelta
from decimal import Decimal
import io
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from rezekify.api.deps import get_db
from rezekify.api.main import app
from rezekify.db.models import Base


@pytest.fixture
def client():
    """Hermetic test client fixture with isolated in-memory SQLite database."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    prev_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    if prev_override is not None:
        app.dependency_overrides[get_db] = prev_override
    else:
        app.dependency_overrides.pop(get_db, None)

    Base.metadata.drop_all(bind=engine)


def test_full_stack_user_lifecycle_e2e(client: TestClient):
    """Executes the complete user lifecycle through all primary integrated REST endpoints."""
    # 0. Health probe
    health_res = client.get("/healthz")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "healthy"
    assert health_res.json()["database"] == "connected"

    # 1. Registration
    reg_payload = {
        "email": "fullstack_tester@rezekify.id",
        "password": "SecurePassword123!",
        "full_name": "Fullstack Integrator",
    }
    reg_res = client.post("/api/v1/auth/register", json=reg_payload)
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["token_type"] == "bearer"
    assert reg_data["user"]["email"] == "fullstack_tester@rezekify.id"
    assert reg_data["user"]["full_name"] == "Fullstack Integrator"

    # 2. Login
    login_payload = {
        "email": "fullstack_tester@rezekify.id",
        "password": "SecurePassword123!",
    }
    login_res = client.post("/api/v1/auth/login", json=login_payload)
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Authenticated /me
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "fullstack_tester@rezekify.id"
    assert me_res.json()["full_name"] == "Fullstack Integrator"

    # 4. Create Holding Accounts (Bank & e-Wallet)
    bank_res = client.post(
        "/api/v1/accounts",
        headers=headers,
        json={"name": "Bank BCA Prioritas", "account_type": "BANK", "initial_balance": 3500000.00},
    )
    assert bank_res.status_code == 200
    assert bank_res.json()["name"] == "Bank BCA Prioritas"
    assert bank_res.json()["account_type"] == "BANK"
    assert Decimal(str(bank_res.json()["current_balance"])) == Decimal("3500000.00")

    ewallet_res = client.post(
        "/api/v1/accounts",
        headers=headers,
        json={"name": "GoPay Operasional", "account_type": "EWALLET", "initial_balance": 1500000.00},
    )
    assert ewallet_res.status_code == 200
    assert ewallet_res.json()["name"] == "GoPay Operasional"
    assert ewallet_res.json()["account_type"] == "EWALLET"
    assert Decimal(str(ewallet_res.json()["current_balance"])) == Decimal("1500000.00")

    # List Accounts
    accounts_res = client.get("/api/v1/accounts", headers=headers)
    assert accounts_res.status_code == 200
    account_names = [acc["name"] for acc in accounts_res.json()]
    assert "Bank BCA Prioritas" in account_names
    assert "GoPay Operasional" in account_names
    assert len(accounts_res.json()) == 2

    # 5. Create Virtual Vault (Fixed Commitment H-7 bill)
    due_date = (date.today() + timedelta(days=7)).isoformat()
    vault_payload = {
        "name": "Tagihan Listrik & WiFi",
        "vault_type": "FIXED_BILL",
        "target_amount": 1000000.00,
        "allocated_amount": 500000.00,
        "target_date": due_date,
    }
    vault_res = client.post("/api/v1/vaults", headers=headers, json=vault_payload)
    assert vault_res.status_code == 200
    vault_data = vault_res.json()
    assert vault_data["name"] == "Tagihan Listrik & WiFi"
    assert vault_data["vault_type"] == "FIXED_BILL"
    assert Decimal(str(vault_data["target_amount"])) == Decimal("1000000.00")
    assert Decimal(str(vault_data["allocated_amount"])) == Decimal("500000.00")

    # List Vaults
    vaults_res = client.get("/api/v1/vaults", headers=headers)
    assert vaults_res.status_code == 200
    assert len(vaults_res.json()) == 1
    assert vaults_res.json()[0]["name"] == "Tagihan Listrik & WiFi"

    # 6. Dashboard Telemetry & Summary
    # Total Liquid = 3,500,000 + 1,500,000 = 5,000,000
    # Vault Locked = 500,000
    # Operational Free = 5,000,000 - 500,000 = 4,500,000
    dash_res = client.get("/api/v1/dashboard/summary", headers=headers)
    assert dash_res.status_code == 200
    summary = dash_res.json()
    assert Decimal(str(summary["total_liquid_cash"])) == Decimal("5000000.00")
    assert Decimal(str(summary["vault_locked_cash"])) == Decimal("500000.00")
    assert Decimal(str(summary["operational_free_cash"])) == Decimal("4500000.00")
    assert summary["days_remaining"] > 0
    assert Decimal(str(summary["daily_safe_runway"])) > Decimal("0.00")
    assert summary["health_status"] in ["HEALTHY", "WARNING", "CRITICAL"]

    # Upcoming Bills H-7
    assert len(summary["upcoming_bills"]) == 1
    bill = summary["upcoming_bills"][0]
    assert bill["name"] == "Tagihan Listrik & WiFi"
    assert bill["days_until_due"] == 7
    assert Decimal(str(bill["target_amount"])) == Decimal("1000000.00")
    assert Decimal(str(bill["allocated_amount"])) == Decimal("500000.00")

    # 7. What-If Purchase Simulator
    sim_res = client.post(
        "/api/v1/dashboard/simulate-purchase",
        headers=headers,
        json={"planned_amount": 300000.00},
    )
    assert sim_res.status_code == 200
    sim_data = sim_res.json()
    assert Decimal(str(sim_data["current_daily_runway"])) == Decimal(str(summary["daily_safe_runway"]))
    assert Decimal(str(sim_data["projected_daily_runway"])) < Decimal(str(sim_data["current_daily_runway"]))
    assert Decimal(str(sim_data["daily_drop_amount"])) > Decimal("0.00")
    assert isinstance(sim_data["is_safe"], bool)
    assert len(sim_data["advice"]) > 0

    # 8. Multimodal AI Receipt Upload
    mock_reply = "✅ Struk terverifikasi: Belanja Supermarket Rp 175.000 via Bank BCA Prioritas"
    fake_jpeg = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb")
    with patch("rezekify.agent.orchestrator.AgentOrchestrator.handle_message", return_value=mock_reply) as mock_ocr:
        receipt_res = client.post(
            "/api/v1/dashboard/ai-receipt",
            headers=headers,
            files={"file": ("supermarket_receipt.jpg", fake_jpeg, "image/jpeg")},
            data={"message": "Catat belanja mingguan"},
        )
        assert receipt_res.status_code == 200
        assert receipt_res.json() == {"reply": mock_reply}
        assert mock_ocr.called
        call_kwargs = mock_ocr.call_args.kwargs
        assert call_kwargs["text"] == "Catat belanja mingguan"
        assert len(call_kwargs["image_bytes"]) > 0

    # 9. Spending Analytics Breakdowns
    daily_analytics = client.get("/api/v1/analytics/spending-breakdown?period=daily", headers=headers)
    assert daily_analytics.status_code == 200
    daily_data = daily_analytics.json()
    assert daily_data["period"] == "daily"
    assert len(daily_data["items"]) == 7

    monthly_analytics = client.get("/api/v1/analytics/spending-breakdown?period=monthly", headers=headers)
    assert monthly_analytics.status_code == 200
    monthly_data = monthly_analytics.json()
    assert monthly_data["period"] == "monthly"
    assert "total_spent" in monthly_data


def test_auth_and_boundary_validations(client: TestClient):
    """Verifies edge cases, validation boundaries, and unauthenticated rejections."""
    # 1. Unauthenticated endpoints return 401
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/accounts").status_code == 401
    assert client.get("/api/v1/vaults").status_code == 401
    assert client.get("/api/v1/dashboard/summary").status_code == 401
    assert client.post("/api/v1/dashboard/simulate-purchase", json={"planned_amount": 50000.00}).status_code == 401

    # 2. Register user for boundary testing
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"email": "boundary_user@rezekify.id", "password": "Password123!", "full_name": "Boundary Tester"},
    )
    assert reg_res.status_code == 200
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Duplicate email registration rejected with 400
    dup_res = client.post(
        "/api/v1/auth/register",
        json={"email": "boundary_user@rezekify.id", "password": "Password123!", "full_name": "Boundary Tester"},
    )
    assert dup_res.status_code == 400

    # 4. Bad password login rejected with 401
    bad_login = client.post(
        "/api/v1/auth/login",
        json={"email": "boundary_user@rezekify.id", "password": "WrongPassword!"},
    )
    assert bad_login.status_code == 401

    # 5. Simulate purchase non-positive amount rejected with 400
    bad_sim_zero = client.post(
        "/api/v1/dashboard/simulate-purchase",
        headers=headers,
        json={"planned_amount": 0.00},
    )
    assert bad_sim_zero.status_code == 400

    bad_sim_neg = client.post(
        "/api/v1/dashboard/simulate-purchase",
        headers=headers,
        json={"planned_amount": -10000.00},
    )
    assert bad_sim_neg.status_code == 400

    # 6. AI receipt invalid MIME rejected with 400
    pdf_upload = client.post(
        "/api/v1/dashboard/ai-receipt",
        headers=headers,
        files={"file": ("invoice.pdf", io.BytesIO(b"%PDF-1.5"), "application/pdf")},
    )
    assert pdf_upload.status_code == 400
    assert "Format file tidak didukung" in pdf_upload.json()["detail"]

    # 7. AI receipt empty file rejected with 400
    empty_upload = client.post(
        "/api/v1/dashboard/ai-receipt",
        headers=headers,
        files={"file": ("empty.png", io.BytesIO(b""), "image/png")},
    )
    assert empty_upload.status_code == 400
    assert "File gambar kosong" in empty_upload.json()["detail"]

    # 8. Zero-Bloat Invariant: yearly spending query rejected with 422
    yearly_res = client.get("/api/v1/analytics/spending-breakdown?period=yearly", headers=headers)
    assert yearly_res.status_code == 422
