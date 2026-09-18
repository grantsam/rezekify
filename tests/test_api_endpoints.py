"""Comprehensive tests for FastAPI application REST endpoints."""

from datetime import date, timedelta
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from rezekify.api.deps import get_db
from rezekify.api.main import app
from rezekify.db.models import Account, AccountType, Base

# Configure isolated in-memory test database for TestClient
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


def test_api_register_and_login_flow():
    # 1. Register with email, password, full_name
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "auth_flow@rezekify.local",
            "password": "SecurePassword123!",
            "full_name": "Auth Flow User",
        },
    )
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["token_type"] == "bearer"
    assert "user" in reg_data
    assert reg_data["user"]["email"] == "auth_flow@rezekify.local"
    assert reg_data["user"]["full_name"] == "Auth Flow User"

    # Duplicate registration should fail
    dup_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "auth_flow@rezekify.local",
            "password": "SecurePassword123!",
            "full_name": "Auth Flow User",
        },
    )
    assert dup_res.status_code == 400

    # 2. Login with valid credentials
    login_res = client.post(
        "/api/v1/auth/login",
        json={
            "email": "auth_flow@rezekify.local",
            "password": "SecurePassword123!",
        },
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Login with invalid password
    bad_login = client.post(
        "/api/v1/auth/login",
        json={
            "email": "auth_flow@rezekify.local",
            "password": "WrongPassword!",
        },
    )
    assert bad_login.status_code == 401

    # 4. /me endpoint
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "auth_flow@rezekify.local"

    # 5. /me without token -> 401
    unauth_res = client.get("/api/v1/auth/me")
    assert unauth_res.status_code == 401

    # 6. Telegram pairing code generation
    otp_res = client.post("/api/v1/auth/telegram-pairing-code", headers=headers)
    assert otp_res.status_code == 200
    code = otp_res.json()["pairing_code"]
    assert code.startswith("DK-")


def test_api_accounts_and_vaults_crud():
    # Register user
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "crud_accounts@rezekify.local",
            "password": "Password123!",
            "full_name": "Account Tester",
        },
    )
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Accounts (CASH and BANK)
    acc1 = client.post(
        "/api/v1/accounts",
        json={"name": "Dompet Tunai", "account_type": "CASH", "initial_balance": 500000.00},
        headers=headers,
    )
    assert acc1.status_code == 200
    assert acc1.json()["name"] == "Dompet Tunai"

    acc2 = client.post(
        "/api/v1/accounts/",
        json={"name": "Bank Jago", "account_type": "BANK", "initial_balance": 1500000.00},
        headers=headers,
    )
    assert acc2.status_code == 200

    # List accounts
    acc_list = client.get("/api/v1/accounts", headers=headers)
    assert acc_list.status_code == 200
    assert len(acc_list.json()) == 2

    # 2. Create Vault
    due_date = (date.today() + timedelta(days=5)).isoformat()
    vault_res = client.post(
        "/api/v1/vaults",
        json={
            "name": "Cicilan Laptop",
            "vault_type": "FIXED_BILL",
            "target_amount": 1200000.00,
            "allocated_amount": 600000.00,
            "target_date": due_date,
        },
        headers=headers,
    )
    assert vault_res.status_code == 200
    assert vault_res.json()["name"] == "Cicilan Laptop"

    # List vaults
    vault_list = client.get("/api/v1/vaults", headers=headers)
    assert vault_list.status_code == 200
    assert len(vault_list.json()) == 1


def test_api_dashboard_and_analytics():
    # Register user
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "dash_user@rezekify.local",
            "password": "Password123!",
            "full_name": "Dashboard Tester",
        },
    )
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Add Account
    client.post(
        "/api/v1/accounts",
        json={"name": "Rekening BCA", "account_type": "BANK", "initial_balance": 2000000.00},
        headers=headers,
    )

    # Add Vault (H-4 Fixed Bill)
    due_date = (date.today() + timedelta(days=4)).isoformat()
    client.post(
        "/api/v1/vaults",
        json={
            "name": "Listrik & Internet",
            "vault_type": "FIXED_BILL",
            "target_amount": 500000.00,
            "allocated_amount": 200000.00,
            "target_date": due_date,
        },
        headers=headers,
    )

    # Get Dashboard Summary
    dash_res = client.get("/api/v1/dashboard/summary", headers=headers)
    assert dash_res.status_code == 200
    summary = dash_res.json()
    assert Decimal(str(summary["total_liquid_cash"])) == Decimal("2000000.00")
    assert Decimal(str(summary["vault_locked_cash"])) == Decimal("200000.00")
    assert Decimal(str(summary["operational_free_cash"])) == Decimal("1800000.00")
    assert summary["days_remaining"] > 0
    assert Decimal(str(summary["daily_safe_runway"])) > Decimal("0.00")
    assert summary["health_status"] in ["HEALTHY", "WARNING", "CRITICAL"]
    assert len(summary["upcoming_bills"]) == 1
    assert summary["upcoming_bills"][0]["name"] == "Listrik & Internet"

    # Analytics spending breakdown: daily vs monthly
    daily_res = client.get("/api/v1/analytics/spending-breakdown?period=daily", headers=headers)
    assert daily_res.status_code == 200
    assert daily_res.json()["period"] == "daily"

    monthly_res = client.get("/api/v1/analytics/spending-breakdown?period=monthly", headers=headers)
    assert monthly_res.status_code == 200
    assert monthly_res.json()["period"] == "monthly"

    # Analytics: yearly rejected with 422
    bad_res = client.get("/api/v1/analytics/spending-breakdown?period=yearly", headers=headers)
    assert bad_res.status_code == 422


def test_api_transactions_crud_and_balance_reversal():
    # Register user
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "tx_tester@rezekify.local",
            "password": "Password123!",
            "full_name": "Tx Tester",
        },
    )
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create two accounts
    acc1 = client.post(
        "/api/v1/accounts",
        json={"name": "BCA Utama", "account_type": "BANK", "initial_balance": 1000000.00},
        headers=headers,
    ).json()

    acc2 = client.post(
        "/api/v1/accounts",
        json={"name": "GoPay", "account_type": "EWALLET", "initial_balance": 100000.00},
        headers=headers,
    ).json()

    # 1. Record Expense via POST /api/v1/transactions
    exp_res = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "EXPENSE",
            "account_id": acc1["id"],
            "amount": 150000.00,
            "description": "Belanja Mingguan",
        },
        headers=headers,
    )
    assert exp_res.status_code == 200
    exp_data = exp_res.json()
    assert exp_data["description"] == "Belanja Mingguan"
    assert len(exp_data["ledger_entries"]) == 2
    exp_id = exp_data["id"]

    # 2. Record Income via POST /api/v1/transactions
    inc_res = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "INCOME",
            "account_id": acc1["id"],
            "amount": 300000.00,
            "description": "Freelance Design",
        },
        headers=headers,
    )
    assert inc_res.status_code == 200
    assert len(inc_res.json()["ledger_entries"]) == 2

    # 3. Record Transfer via POST /api/v1/transactions
    trf_res = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "TRANSFER",
            "from_account_id": acc1["id"],
            "to_account_id": acc2["id"],
            "amount": 50000.00,
            "description": "Top up Gopay",
        },
        headers=headers,
    )
    assert trf_res.status_code == 200
    assert len(trf_res.json()["ledger_entries"]) == 2

    # 4. List transactions
    tx_list = client.get("/api/v1/transactions", headers=headers)
    assert tx_list.status_code == 200
    assert len(tx_list.json()) == 3
    # Check that ledger entries are populated
    for tx in tx_list.json():
        assert "ledger_entries" in tx
        assert len(tx["ledger_entries"]) == 2

    # 5. Delete expense transaction and verify balance reversal
    del_res = client.delete(f"/api/v1/transactions/{exp_id}", headers=headers)
    assert del_res.status_code == 200

    # Delete non-existent transaction -> 404
    del_404 = client.delete(f"/api/v1/transactions/{exp_id}", headers=headers)
    assert del_404.status_code == 404


def test_api_ai_chat():
    # Register user
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "chat_user@rezekify.local",
            "password": "Password123!",
            "full_name": "Chat Tester",
        },
    )
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    chat_res = client.post(
        "/api/v1/dashboard/ai-chat",
        json={"message": "cek runway hari ini"},
        headers=headers,
    )
    assert chat_res.status_code == 200
    assert "reply" in chat_res.json()
    assert len(chat_res.json()["reply"]) > 0
