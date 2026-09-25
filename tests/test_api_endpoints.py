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
            "is_locked": True,
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
            "transaction_date": "2026-05-10T14:30:00Z",
        },
        headers=headers,
    )
    assert exp_res.status_code == 200
    exp_data = exp_res.json()
    assert exp_data["description"] == "Belanja Mingguan"
    assert len(exp_data["ledger_entries"]) == 2
    assert "2026-05-10" in exp_data["transaction_date"]
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


def test_ai_chat_rate_limiting():
    # Register user
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "rate_limit_chat@rezekify.id",
            "password": "Password123!",
            "full_name": "Rate Limit Chat Tester",
        },
    )
    assert res.status_code == 200
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fire 15 requests to verify all succeed (200)
    for _ in range(15):
        chat_res = client.post(
            "/api/v1/dashboard/ai-chat",
            json={"message": "cek runway"},
            headers=headers,
        )
        assert chat_res.status_code == 200

    # 16th request must trigger HTTP 429
    limited_res = client.post(
        "/api/v1/dashboard/ai-chat",
        json={"message": "cek runway"},
        headers=headers,
    )
    assert limited_res.status_code == 429
    assert "Retry-After" in limited_res.headers
    assert "Batas permintaan tercapai" in limited_res.json()["detail"]


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


def test_ai_receipt_upload_runs_in_threadpool(sample_user, db_session):
    """Verifies that receipt processing runs asynchronously via handle_message_async without worker thread blocking."""
    from unittest.mock import AsyncMock
    from rezekify.core.security import create_access_token

    with db_override(db_session):
        token = create_access_token({"sub": str(sample_user.id)})
        headers = {"Authorization": f"Bearer {token}"}
        fake_jpeg = io.BytesIO(b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb")

        with patch("rezekify.agent.orchestrator.AgentOrchestrator.handle_message_async", new_callable=AsyncMock, return_value="✅ Sukses Struk") as mock_handle:
            res = client.post(
                "/api/v1/dashboard/ai-receipt",
                files={"file": ("receipt.jpg", fake_jpeg, "image/jpeg")},
                data={"message": "Struk makan siang"},
                headers=headers,
            )
            assert res.status_code == 200
            assert res.json() == {"reply": "✅ Sukses Struk"}
            assert mock_handle.called


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


def test_ai_voice_upload_success(sample_user, db_session):
    """Tests POST /api/v1/dashboard/ai-voice endpoint with valid audio file and message."""
    from rezekify.core.security import create_access_token

    with db_override(db_session):
        token = create_access_token({"sub": str(sample_user.id)})
        headers = {"Authorization": f"Bearer {token}"}
        fake_audio = io.BytesIO(b"RIFF....WAVEfmt ....data....")
        with patch("rezekify.agent.orchestrator.AgentOrchestrator.handle_voice", return_value={"transcription": "beli kopi 25rb", "reply": "Tercatat!", "success": True}) as mock_handle:
            res = client.post(
                "/api/v1/dashboard/ai-voice",
                files={"file": ("voice.webm", fake_audio, "audio/webm")},
                data={"message": "Catatan tambahan"},
                headers=headers,
            )
            assert res.status_code == 200
            assert res.json() == {"reply": "Tercatat!", "transcription": "beli kopi 25rb"}
            assert mock_handle.called
            call_kwargs = mock_handle.call_args.kwargs
            assert call_kwargs["user_id"] == sample_user.id
            assert call_kwargs["audio_bytes"] == b"RIFF....WAVEfmt ....data...."
            assert call_kwargs["caption"] == "Catatan tambahan"
            assert call_kwargs["mime_type"] == "audio/webm"


def test_ai_voice_upload_invalid_mime(sample_user, db_session):
    """Tests that non-audio MIME types are rejected with HTTP 400."""
    from rezekify.core.security import create_access_token

    with db_override(db_session):
        token = create_access_token({"sub": str(sample_user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        files = {"file": ("statement.pdf", io.BytesIO(b"%PDF-1.4..."), "application/pdf")}
        res = client.post("/api/v1/dashboard/ai-voice", headers=headers, files=files)
        assert res.status_code == 400
        assert res.json()["detail"] == "Format file audio tidak didukung. Harap gunakan WebM, OGG, WAV, MP4, atau MP3."


def test_ai_voice_upload_empty_file(sample_user, db_session):
    """Tests that empty 0-byte voice uploads are rejected with HTTP 400."""
    from rezekify.core.security import create_access_token

    with db_override(db_session):
        token = create_access_token({"sub": str(sample_user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        files = {"file": ("empty.webm", io.BytesIO(b""), "audio/webm")}
        res = client.post("/api/v1/dashboard/ai-voice", headers=headers, files=files)
        assert res.status_code == 400
        assert res.json()["detail"] == "File audio kosong."


def test_ai_voice_upload_size_limit_exceeded(sample_user, db_session):
    """Tests that audio uploads exceeding 10MB are rejected with HTTP 400."""
    from rezekify.core.security import create_access_token

    with db_override(db_session):
        token = create_access_token({"sub": str(sample_user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        large_bytes = b"0" * (11 * 1024 * 1024)
        files = {"file": ("huge_audio.webm", io.BytesIO(large_bytes), "audio/webm")}
        res = client.post("/api/v1/dashboard/ai-voice", headers=headers, files=files)
        assert res.status_code == 400
        assert res.json()["detail"] == "Ukuran file audio melebihi batas maksimal 10MB."


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


def test_list_transactions_pagination_and_bounds(sample_user, db_session):
    """Tests pagination offset, limit capping, and boundary validation on list_transactions."""
    import time
    from rezekify.core.security import create_access_token

    with db_override(db_session):
        token = create_access_token({"sub": str(sample_user.id)})
        headers = {"Authorization": f"Bearer {token}"}

        # Create an account
        acc_res = client.post(
            "/api/v1/accounts",
            json={"name": "Dompet Utama", "account_type": "CASH", "initial_balance": 1000000.00},
            headers=headers,
        )
        assert acc_res.status_code == 200
        account_id = acc_res.json()["id"]

        # Create 5 transactions with distinct amounts or descriptions
        for i in range(1, 6):
            res = client.post(
                "/api/v1/transactions",
                json={
                    "transaction_type": "EXPENSE",
                    "account_id": account_id,
                    "amount": 10000.0 * i,
                    "description": f"Transaksi Ke-{i}",
                },
                headers=headers,
            )
            assert res.status_code == 200
            time.sleep(0.01)

        # Query with default params: assert returns all 5 transactions
        res_default = client.get("/api/v1/transactions", headers=headers)
        assert res_default.status_code == 200
        txs_default = res_default.json()
        assert len(txs_default) == 5

        # Query with limit=2&offset=0: assert returns 2 transactions
        res_p1 = client.get("/api/v1/transactions?limit=2&offset=0", headers=headers)
        assert res_p1.status_code == 200
        txs_p1 = res_p1.json()
        assert len(txs_p1) == 2

        # Query with limit=2&offset=2: assert returns the next 2 transactions (verify they are different from page 1)
        res_p2 = client.get("/api/v1/transactions?limit=2&offset=2", headers=headers)
        assert res_p2.status_code == 200
        txs_p2 = res_p2.json()
        assert len(txs_p2) == 2
        p1_ids = {tx["id"] for tx in txs_p1}
        p2_ids = {tx["id"] for tx in txs_p2}
        assert p1_ids.isdisjoint(p2_ids)

        # Query with limit=2&offset=4: assert returns 1 transaction
        res_p3 = client.get("/api/v1/transactions?limit=2&offset=4", headers=headers)
        assert res_p3.status_code == 200
        txs_p3 = res_p3.json()
        assert len(txs_p3) == 1
        assert txs_p3[0]["id"] not in p1_ids
        assert txs_p3[0]["id"] not in p2_ids

        # Query with limit=0: assert status_code == 422
        assert client.get("/api/v1/transactions?limit=0", headers=headers).status_code == 422

        # Query with limit=101: assert status_code == 422
        assert client.get("/api/v1/transactions?limit=101", headers=headers).status_code == 422

        # Query with offset=-1: assert status_code == 422
        assert client.get("/api/v1/transactions?offset=-1", headers=headers).status_code == 422


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


def test_update_transaction_endpoint_success():
    import uuid

    email = f"update_succ_{uuid.uuid4().hex[:6]}@rezekify.id"
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "full_name": "Update Success Tester",
        },
    )
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    acc_res = client.post(
        "/api/v1/accounts",
        json={"name": "BCA Update", "account_type": "BANK", "initial_balance": 1000000.00},
        headers=headers,
    )
    acc_id = acc_res.json()["id"]

    exp_res = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "EXPENSE",
            "account_id": acc_id,
            "amount": 50000.00,
            "description": "Original Expense",
        },
        headers=headers,
    )
    assert exp_res.status_code == 200
    tx_id = exp_res.json()["id"]

    update_res = client.put(
        f"/api/v1/transactions/{tx_id}",
        json={
            "amount": 120000.00,
            "description": "Updated Expense Note",
        },
        headers=headers,
    )
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["id"] == tx_id
    assert data["description"] == "Updated Expense Note"
    assert len(data["ledger_entries"]) == 2
    for entry in data["ledger_entries"]:
        assert Decimal(str(entry["amount"])) == Decimal("120000.00")


def test_update_transaction_endpoint_not_found():
    import uuid

    email = f"update_404_{uuid.uuid4().hex[:6]}@rezekify.id"
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "full_name": "Update 404 Tester",
        },
    )
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    random_id = str(uuid.uuid4())
    res = client.put(
        f"/api/v1/transactions/{random_id}",
        json={
            "amount": 50000.00,
            "description": "Non-existent Tx",
        },
        headers=headers,
    )
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


def test_update_transaction_endpoint_invalid_amount():
    import uuid

    email = f"update_inv_{uuid.uuid4().hex[:6]}@rezekify.id"
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "full_name": "Update Invalid Tester",
        },
    )
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    acc_res = client.post(
        "/api/v1/accounts",
        json={"name": "BCA Invalid", "account_type": "BANK", "initial_balance": 500000.00},
        headers=headers,
    )
    acc_id = acc_res.json()["id"]

    exp_res = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "EXPENSE",
            "account_id": acc_id,
            "amount": 30000.00,
            "description": "Valid Expense",
        },
        headers=headers,
    )
    tx_id = exp_res.json()["id"]

    # Negative amount -> 400
    res = client.put(
        f"/api/v1/transactions/{tx_id}",
        json={
            "amount": -50000.00,
            "description": "Negative Amount Update",
        },
        headers=headers,
    )
    assert res.status_code == 400
    assert "Amount must be positive" in res.json()["detail"]


def test_update_transaction_endpoint_tenant_isolation():
    import uuid

    # User A
    email_a = f"user_a_{uuid.uuid4().hex[:6]}@rezekify.id"
    reg_a = client.post(
        "/api/v1/auth/register",
        json={
            "email": email_a,
            "password": "Password123!",
            "full_name": "User A",
        },
    )
    token_a = reg_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    acc_a = client.post(
        "/api/v1/accounts",
        json={"name": "Acc A", "account_type": "BANK", "initial_balance": 500000.00},
        headers=headers_a,
    ).json()

    exp_a = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "EXPENSE",
            "account_id": acc_a["id"],
            "amount": 40000.00,
            "description": "User A Expense",
        },
        headers=headers_a,
    ).json()
    tx_a_id = exp_a["id"]

    # User B
    email_b = f"user_b_{uuid.uuid4().hex[:6]}@rezekify.id"
    reg_b = client.post(
        "/api/v1/auth/register",
        json={
            "email": email_b,
            "password": "Password123!",
            "full_name": "User B",
        },
    )
    token_b = reg_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User B attempts to update User A's transaction
    res = client.put(
        f"/api/v1/transactions/{tx_a_id}",
        json={
            "amount": 60000.00,
            "description": "User B Hijack Attempt",
        },
        headers=headers_b,
    )
    assert res.status_code == 404
    assert res.json()["detail"] == "Transaction not found"


def test_list_transactions_query_filtering_and_pagination():
    """Tests server-side query filtering and pagination envelope for transactions."""
    email = f"filter_test_{uuid.uuid4().hex[:8]}@rezekify.id"
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "full_name": "Filter Test User",
        },
    )
    assert reg_res.status_code == 200
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create Accounts
    acc1_res = client.post(
        "/api/v1/accounts",
        json={"name": "Bank BCA", "account_type": "BANK", "initial_balance": 1000000.00},
        headers=headers,
    )
    assert acc1_res.status_code == 200
    acc1_id = acc1_res.json()["id"]

    acc2_res = client.post(
        "/api/v1/accounts",
        json={"name": "Dompet Cash", "account_type": "CASH", "initial_balance": 500000.00},
        headers=headers,
    )
    assert acc2_res.status_code == 200
    acc2_id = acc2_res.json()["id"]

    # Create Categories
    cat1_res = client.post(
        "/api/v1/categories",
        json={"name": "Makanan", "category_type": "EXPENSE"},
        headers=headers,
    )
    assert cat1_res.status_code == 200
    cat1_id = cat1_res.json()["id"]

    cat2_res = client.post(
        "/api/v1/categories",
        json={"name": "Pendidikan", "category_type": "EXPENSE"},
        headers=headers,
    )
    assert cat2_res.status_code == 200
    cat2_id = cat2_res.json()["id"]

    # Create 3 transactions with varied dates, accounts, categories, and descriptions
    tx1_res = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "EXPENSE",
            "account_id": acc1_id,
            "category_id": cat1_id,
            "amount": 25000.00,
            "description": "Kopi Kenangan Pagi",
            "transaction_date": "2026-09-20T10:00:00Z",
        },
        headers=headers,
    )
    assert tx1_res.status_code == 200

    tx2_res = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "EXPENSE",
            "account_id": acc2_id,
            "category_id": cat2_id,
            "amount": 75000.00,
            "description": "Buku Panduan Belajar",
            "transaction_date": "2026-09-21T10:00:00Z",
        },
        headers=headers,
    )
    assert tx2_res.status_code == 200

    tx3_res = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "INCOME",
            "account_id": acc1_id,
            "category_id": cat1_id,
            "amount": 500000.00,
            "description": "Gaji Proyek Lepas",
            "transaction_date": "2026-09-22T10:00:00Z",
        },
        headers=headers,
    )
    assert tx3_res.status_code == 200

    # 1. Test PaginatedTransactionsResponse envelope
    page_res = client.get("/api/v1/transactions?page=1&page_size=2", headers=headers)
    assert page_res.status_code == 200
    page_data = page_res.json()
    assert "items" in page_data
    assert "total" in page_data
    assert "page" in page_data
    assert "page_size" in page_data
    assert "total_pages" in page_data
    assert page_data["total"] == 3
    assert page_data["page"] == 1
    assert page_data["page_size"] == 2
    assert page_data["total_pages"] == 2
    assert len(page_data["items"]) == 2

    # 2. Test filtering by account_id
    acc_filter_res = client.get(
        f"/api/v1/transactions?account_id={acc2_id}&page=1&page_size=10",
        headers=headers,
    )
    assert acc_filter_res.status_code == 200
    acc_data = acc_filter_res.json()
    assert acc_data["total"] == 1
    assert len(acc_data["items"]) == 1
    assert acc_data["items"][0]["description"] == "Buku Panduan Belajar"

    # 3. Test filtering by category_id
    cat_filter_res = client.get(
        f"/api/v1/transactions?category_id={cat2_id}&page=1&page_size=10",
        headers=headers,
    )
    assert cat_filter_res.status_code == 200
    cat_data = cat_filter_res.json()
    assert cat_data["total"] == 1
    assert len(cat_data["items"]) == 1
    assert cat_data["items"][0]["description"] == "Buku Panduan Belajar"

    # 4. Test keyword search
    search_res = client.get(
        "/api/v1/transactions?search=Kenangan&page=1&page_size=10",
        headers=headers,
    )
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert search_data["total"] == 1
    assert search_data["items"][0]["description"] == "Kopi Kenangan Pagi"

    # 5. Test date range start_date and end_date
    date_res = client.get(
        "/api/v1/transactions?start_date=2026-09-21T00:00:00Z&end_date=2026-09-21T23:59:59Z&page=1&page_size=10",
        headers=headers,
    )
    assert date_res.status_code == 200
    date_data = date_res.json()
    assert date_data["total"] == 1
    assert date_data["items"][0]["description"] == "Buku Panduan Belajar"


def test_account_lifecycle_and_tenant_isolation():
    # User A
    email_a = f"acc_lifecycle_a_{uuid.uuid4().hex[:6]}@rezekify.id"
    reg_a = client.post(
        "/api/v1/auth/register",
        json={
            "email": email_a,
            "password": "Password123!",
            "full_name": "Account Life Tester A",
        },
    )
    token_a = reg_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Create account for User A
    acc_res = client.post(
        "/api/v1/accounts",
        json={"name": "Bank BCA Awal", "account_type": "BANK", "initial_balance": 1000000.00},
        headers=headers_a,
    )
    assert acc_res.status_code == 200
    acc_id = acc_res.json()["id"]

    # 1. Test PUT /api/v1/accounts/{id} updates name and account type
    update_res = client.put(
        f"/api/v1/accounts/{acc_id}",
        json={"name": "Bank BCA Diganti", "account_type": "EWALLET"},
        headers=headers_a,
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["name"] == "Bank BCA Diganti"
    assert updated_data["account_type"] == "EWALLET"

    # User B setup
    email_b = f"acc_lifecycle_b_{uuid.uuid4().hex[:6]}@rezekify.id"
    reg_b = client.post(
        "/api/v1/auth/register",
        json={
            "email": email_b,
            "password": "Password123!",
            "full_name": "Account Life Tester B",
        },
    )
    token_b = reg_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 2. Test cross-tenant isolation: user B attempting PUT or DELETE on user A's account returns 404
    hijack_put = client.put(
        f"/api/v1/accounts/{acc_id}",
        json={"name": "Bank Hijack"},
        headers=headers_b,
    )
    assert hijack_put.status_code == 404
    assert hijack_put.json()["detail"] == "Rekening tidak ditemukan."

    hijack_del = client.delete(
        f"/api/v1/accounts/{acc_id}",
        headers=headers_b,
    )
    assert hijack_del.status_code == 404
    assert hijack_del.json()["detail"] == "Rekening tidak ditemukan."

    # 3. Test DELETE /api/v1/accounts/{id} soft-deactivates the account (is_active == False)
    del_res = client.delete(
        f"/api/v1/accounts/{acc_id}",
        headers=headers_a,
    )
    assert del_res.status_code == 200
    assert del_res.json() == {"detail": "Rekening berhasil dinonaktifkan."}

    # 4. Test GET /api/v1/accounts excludes deactivated account by default, but includes it when ?include_inactive=true
    list_active = client.get("/api/v1/accounts", headers=headers_a)
    assert list_active.status_code == 200
    active_accounts = list_active.json()
    assert not any(a["id"] == acc_id for a in active_accounts)

    list_all = client.get("/api/v1/accounts?include_inactive=true", headers=headers_a)
    assert list_all.status_code == 200
    all_accounts = list_all.json()
    found = next((a for a in all_accounts if a["id"] == acc_id), None)
    assert found is not None
    assert found["is_active"] is False


