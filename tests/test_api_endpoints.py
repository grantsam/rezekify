"""Comprehensive tests for FastAPI application REST endpoints."""

from datetime import date, timedelta
from decimal import Decimal
import io
import uuid
from contextlib import contextmanager
from unittest.mock import patch
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
client = TestClient(app, raise_server_exceptions=False)


def test_api_register_and_login_flow():
    # 1. Register with email, password, full_name
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "auth_flow@rezekify.id",
            "password": "SecurePassword123!",
            "full_name": "Auth Flow User",
        },
    )
    assert reg_res.status_code == 200
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["token_type"] == "bearer"
    assert "user" in reg_data
    assert reg_data["user"]["email"] == "auth_flow@rezekify.id"
    assert reg_data["user"]["full_name"] == "Auth Flow User"

    # Duplicate registration should fail
    dup_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "auth_flow@rezekify.id",
            "password": "SecurePassword123!",
            "full_name": "Auth Flow User",
        },
    )
    assert dup_res.status_code == 400

    # 2. Login with valid credentials
    login_res = client.post(
        "/api/v1/auth/login",
        json={
            "email": "auth_flow@rezekify.id",
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
            "email": "auth_flow@rezekify.id",
            "password": "WrongPassword!",
        },
    )
    assert bad_login.status_code == 401

    # 4. /me endpoint
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "auth_flow@rezekify.id"

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
            "email": "crud_accounts@rezekify.id",
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
            "email": "dash_user@rezekify.id",
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
            "email": "tx_tester@rezekify.id",
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
            "email": "chat_user@rezekify.id",
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


def test_analytics_spending_breakdown_full_payload(sample_user, db_session):
    """Tests that GET /api/v1/analytics/spending-breakdown returns valid Daily and Monthly schemas."""
    from rezekify.core.security import create_access_token
    from rezekify.db.models import Category, CategoryType, EntryType, LedgerEntry, Transaction
    from datetime import datetime, timezone

    def _get_db_override():
        yield db_session

    old_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _get_db_override
    try:
        token = create_access_token({"sub": str(sample_user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        # Seed an account, category, and an expense
        acc = Account(
            user_id=sample_user.id,
            name="Bank Mandiri",
            account_type=AccountType.BANK,
            current_balance=Decimal("1500000.00"),
        )
        cat = Category(
            user_id=sample_user.id,
            name="Kebutuhan Rumah",
            category_type=CategoryType.EXPENSE,
            color="#10b981",
        )
        db_session.add_all([acc, cat])
        db_session.commit()

        tx = Transaction(
            user_id=sample_user.id,
            description="Belanja Sabun",
            transaction_date=datetime.now(timezone.utc),
        )
        db_session.add(tx)
        db_session.flush()

        le = LedgerEntry(
            transaction_id=tx.id,
            user_id=sample_user.id,
            account_id=acc.id,
            category_id=cat.id,
            entry_type=EntryType.DEBIT,
            amount=Decimal("50000.00"),
        )
        db_session.add(le)
        db_session.commit()

        # 1. Test Daily Breakdown
        res_daily = client.get("/api/v1/analytics/spending-breakdown?period=daily", headers=headers)
        assert res_daily.status_code == 200
        data_daily = res_daily.json()
        assert data_daily["period"] == "daily"
        assert "daily_safe_runway" in data_daily
        assert "total_spent_in_period" in data_daily
        assert len(data_daily["items"]) == 7
        # Verify item schema
        item = data_daily["items"][-1]
        assert "date" in item
        assert "day_label" in item
        assert "amount" in item
        assert "safe_runway_threshold" in item
        assert "is_over_budget" in item
        assert isinstance(item["is_over_budget"], bool)

        # 2. Test Monthly Breakdown
        res_monthly = client.get("/api/v1/analytics/spending-breakdown?period=monthly", headers=headers)
        assert res_monthly.status_code == 200
        data_monthly = res_monthly.json()
        assert data_monthly["period"] == "monthly"
        assert "cycle_start_date" in data_monthly
        assert "cycle_end_date" in data_monthly
        assert Decimal(str(data_monthly["total_spent"])) >= Decimal("50000.00")
        assert len(data_monthly["items"]) >= 1
        cat_item = data_monthly["items"][0]
        assert cat_item["category_name"] == "Kebutuhan Rumah"
        assert Decimal(str(cat_item["percentage"])) == Decimal("100.0")
        assert cat_item["color"] == "#10b981"

        # 3. Test Yearly Rejection (Zero-Bloat Invariant)
        res_yearly = client.get("/api/v1/analytics/spending-breakdown?period=yearly", headers=headers)
        assert res_yearly.status_code == 422
    finally:
        if old_override is not None:
            app.dependency_overrides[get_db] = old_override
        else:
            app.dependency_overrides.pop(get_db, None)


@contextmanager
def db_override(session):
    def _gen():
        yield session
    old = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _gen
    try:
        yield
    finally:
        if old is not None:
            app.dependency_overrides[get_db] = old
        else:
            app.dependency_overrides.pop(get_db, None)


def test_ai_receipt_upload_endpoint(sample_user, db_session):
    """Tests multipart receipt upload with valid JPEG and PNG forwarding to AgentOrchestrator."""
    from rezekify.core.security import create_access_token

    with db_override(db_session):
        token = create_access_token({"sub": str(sample_user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Valid JPEG with custom message
        fake_jpeg = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb")
        with patch("rezekify.agent.orchestrator.AgentOrchestrator.handle_message", return_value="✅ Tercatat: Rp 50,000 via BCA") as mock_handle:
            res = client.post(
                "/api/v1/dashboard/ai-receipt",
                files={"file": ("receipt.jpg", fake_jpeg, "image/jpeg")},
                data={"message": "Catat struk ini"},
                headers=headers,
            )
            assert res.status_code == 200
            assert res.json() == {"reply": "✅ Tercatat: Rp 50,000 via BCA"}
            assert mock_handle.called
            call_kwargs = mock_handle.call_args.kwargs
            assert call_kwargs["text"] == "Catat struk ini"
            assert call_kwargs["image_bytes"] == b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb"
            assert call_kwargs["user_id"] == sample_user.id
            assert call_kwargs["mime_type"] == "image/jpeg"

        # 2. Valid PNG with default message fallback
        fake_png = io.BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR")
        with patch("rezekify.agent.orchestrator.AgentOrchestrator.handle_message", return_value="✅ Tercatat dari Struk") as mock_handle:
            res_png = client.post(
                "/api/v1/dashboard/ai-receipt",
                files={"file": ("struk.png", fake_png, "image/png")},
                headers=headers,
            )
            assert res_png.status_code == 200
            assert res_png.json() == {"reply": "✅ Tercatat dari Struk"}
            assert mock_handle.called
            assert mock_handle.call_args.kwargs["text"] == "Foto struk kasir"
            assert mock_handle.call_args.kwargs["mime_type"] == "image/png"


def test_ai_receipt_upload_invalid_mime(sample_user, db_session):
    """Tests that non-image MIME types and invalid magic bytes are rejected with HTTP 400."""
    from rezekify.core.security import create_access_token

    with db_override(db_session):
        token = create_access_token({"sub": str(sample_user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        files = {"file": ("statement.pdf", io.BytesIO(b"%PDF-1.4..."), "application/pdf")}
        res = client.post("/api/v1/dashboard/ai-receipt", headers=headers, files=files)
        assert res.status_code == 400
        assert res.json()["detail"] == "Format file tidak didukung. Harap unggah file gambar (JPEG, PNG, WebP)."

        bad_magic = {"file": ("corrupt.jpg", io.BytesIO(b"not-real-jpeg-header"), "image/jpeg")}
        res_bad = client.post("/api/v1/dashboard/ai-receipt", headers=headers, files=bad_magic)
        assert res_bad.status_code == 400
        assert res_bad.json()["detail"] == "Format file tidak didukung atau header file tidak valid."


def test_ai_receipt_upload_size_limit_exceeded(sample_user, db_session):
    """Tests that payloads exceeding 10MB are rejected with HTTP 400."""
    from rezekify.core.security import create_access_token

    with db_override(db_session):
        token = create_access_token({"sub": str(sample_user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        # 10.5 MB payload (11MB)
        large_bytes = b"0" * (11 * 1024 * 1024)
        files = {"file": ("huge_receipt.png", io.BytesIO(large_bytes), "image/png")}
        res = client.post("/api/v1/dashboard/ai-receipt", headers=headers, files=files)
        assert res.status_code == 400
        assert res.json()["detail"] == "Ukuran file melebihi batas maksimal 10MB."


def test_ai_receipt_upload_empty_file(sample_user, db_session):
    """Tests that empty 0-byte file uploads are rejected with HTTP 400."""
    from rezekify.core.security import create_access_token

    with db_override(db_session):
        token = create_access_token({"sub": str(sample_user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        files = {"file": ("empty.jpg", io.BytesIO(b""), "image/jpeg")}
        res = client.post("/api/v1/dashboard/ai-receipt", headers=headers, files=files)
        assert res.status_code == 400
        assert res.json()["detail"] == "File gambar kosong."


def test_simulate_purchase_api(sample_user, db_session):
    """Tests POST /api/v1/dashboard/simulate-purchase endpoint for valid and invalid amounts."""
    from rezekify.core.security import create_access_token

    with db_override(db_session):
        token = create_access_token({"sub": str(sample_user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        # Seed an account with liquid balance
        acc = Account(
            user_id=sample_user.id,
            name="Bank BCA",
            account_type=AccountType.BANK,
            current_balance=Decimal("1500000.00"),
        )
        db_session.add(acc)
        db_session.commit()

        # 1. Successful simulation with safe purchase
        res = client.post(
            "/api/v1/dashboard/simulate-purchase",
            headers=headers,
            json={"planned_amount": 50000.00},
        )
        assert res.status_code == 200
        data = res.json()
        assert "current_daily_runway" in data
        assert "projected_daily_runway" in data
        assert "daily_drop_amount" in data
        assert "is_safe" in data
        assert "advice" in data
        assert Decimal(str(data["current_daily_runway"])) > Decimal("0.00")
        assert Decimal(str(data["projected_daily_runway"])) < Decimal(str(data["current_daily_runway"]))
        assert Decimal(str(data["daily_drop_amount"])) > Decimal("0.00")

        # 2. Test 0 amount -> 400
        res_zero = client.post(
            "/api/v1/dashboard/simulate-purchase",
            headers=headers,
            json={"planned_amount": 0.00},
        )
        assert res_zero.status_code == 400
        assert "Nominal belanja harus lebih besar dari 0." in res_zero.json()["detail"]

        # 3. Test negative amount -> 400
        res_neg = client.post(
            "/api/v1/dashboard/simulate-purchase",
            headers=headers,
            json={"planned_amount": -50000.00},
        )
        assert res_neg.status_code == 400
        assert "Nominal belanja harus lebih besar dari 0." in res_neg.json()["detail"]


@pytest.fixture(name="client")
def client_fixture():
    return client


def test_cors_origin_restriction(client):
    # Allowed origin gets Access-Control-Allow-Origin header
    res_allowed = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert res_allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"

    # Disallowed origin does not get Access-Control-Allow-Origin header
    res_disallowed = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://evil-attacker-site.com",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert res_disallowed.headers.get("access-control-allow-origin") != "http://evil-attacker-site.com"


def test_settings_allowed_origins_parsing():
    from rezekify.core.config import Settings

    # Comma-separated string
    cfg_csv = Settings(ALLOWED_ORIGINS="http://foo.com, https://bar.com")
    assert cfg_csv.ALLOWED_ORIGINS == ["http://foo.com", "https://bar.com"]

    # Comma-separated with trailing slashes normalized
    cfg_csv_slash = Settings(ALLOWED_ORIGINS="http://foo.com/, https://bar.com/")
    assert cfg_csv_slash.ALLOWED_ORIGINS == ["http://foo.com", "https://bar.com"]

    # JSON list string
    cfg_json = Settings(ALLOWED_ORIGINS='["http://foo.com", "https://bar.com"]')
    assert cfg_json.ALLOWED_ORIGINS == ["http://foo.com", "https://bar.com"]

    # JSON list string with trailing slashes normalized
    cfg_json_slash = Settings(ALLOWED_ORIGINS='["http://foo.com/", "https://bar.com/"]')
    assert cfg_json_slash.ALLOWED_ORIGINS == ["http://foo.com", "https://bar.com"]

    # Direct list with trailing slash
    cfg_list = Settings(ALLOWED_ORIGINS=["http://foo.com/"])
    assert cfg_list.ALLOWED_ORIGINS == ["http://foo.com"]


def test_cors_origin_matching_with_trailing_slash_normalized():
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from rezekify.core.config import Settings

    custom_settings = Settings(ALLOWED_ORIGINS="http://frontend.example.com/")
    assert custom_settings.ALLOWED_ORIGINS == ["http://frontend.example.com"]

    test_app = FastAPI()
    test_app.add_middleware(
        CORSMiddleware,
        allow_origins=custom_settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @test_app.get("/ping")
    def ping():
        return {"ping": "pong"}

    cors_client = TestClient(test_app)
    res = cors_client.options(
        "/ping",
        headers={
            "Origin": "http://frontend.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert res.headers.get("access-control-allow-origin") == "http://frontend.example.com"


@pytest.fixture
def auth_headers(client):
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": f"auth_{uuid.uuid4().hex[:8]}@rezekify.id",
            "password": "SecurePassword123!",
            "full_name": "Auth User",
        },
    )
    token = reg_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_delete_transaction_nonexistent_returns_404(client, auth_headers):
    fake_id = str(uuid.uuid4())
    res = client.delete(f"/api/v1/transactions/{fake_id}", headers=auth_headers)
    assert res.status_code == 404
    assert res.json()["detail"] == "Transaction not found"


def test_delete_transaction_database_error_raises_500(client, auth_headers):
    with patch("rezekify.services.ledger.LedgerService.delete_transaction", side_effect=RuntimeError("DB dead")):
        fake_id = str(uuid.uuid4())
        res = client.delete(f"/api/v1/transactions/{fake_id}", headers=auth_headers)
        assert res.status_code == 500


def test_register_invalid_email_format_fails(client):
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "not-an-email", "password": "password123", "full_name": "Test User"},
    )
    assert res.status_code == 422


def test_register_short_password_fails(client):
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "valid@example.com", "password": "short", "full_name": "Test User"},
    )
    assert res.status_code == 422


def test_register_short_name_fails(client):
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "valid@example.com", "password": "validpassword123", "full_name": "a"},
    )
    assert res.status_code == 422


def test_register_long_password_fails(client):
    long_pw = "P" * 73
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "valid@example.com", "password": long_pw, "full_name": "Test User"},
    )
    assert res.status_code == 422


def test_register_whitespace_only_full_name_fails(client):
    res = client.post(
        "/api/v1/auth/register",
        json={"email": "valid@example.com", "password": "validpassword123", "full_name": "     "},
    )
    assert res.status_code == 422

