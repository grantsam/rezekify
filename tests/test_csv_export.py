"""Tests for CSV transaction export streaming endpoint and anti-injection defenses."""

from datetime import datetime, timezone, timedelta
from decimal import Decimal
import io
import csv
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from rezekify.api.deps import get_current_user, get_db
from rezekify.api.main import app
from rezekify.db.models import (
    Account,
    AccountType,
    Base,
    Category,
    CategoryType,
    EntryType,
    LedgerEntry,
    Transaction,
    User,
)

# Isolated SQLite in-memory test database
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


current_test_user = None


def override_get_current_user():
    return current_test_user


client = TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def manage_dependency_overrides():
    prev_user = app.dependency_overrides.get(get_current_user)
    prev_db = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield
    if prev_user is not None:
        app.dependency_overrides[get_current_user] = prev_user
    else:
        app.dependency_overrides.pop(get_current_user, None)
    if prev_db is not None:
        app.dependency_overrides[get_db] = prev_db
    else:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture(autouse=True)
def setup_clean_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield


@pytest.fixture
def test_users():
    db = TestingSessionLocal()
    user_a = User(
        email="user_a@rezekify.test",
        password_hash="hash_a",
        full_name="User Alpha",
    )
    user_b = User(
        email="user_b@rezekify.test",
        password_hash="hash_b",
        full_name="User Beta",
    )
    db.add_all([user_a, user_b])
    db.commit()
    db.refresh(user_a)
    db.refresh(user_b)
    db.close()
    return user_a, user_b


def test_export_csv_unauthorized():
    """Unauthenticated access must be rejected with HTTP 401."""
    global current_test_user
    current_test_user = None
    app.dependency_overrides.pop(get_current_user, None)
    res = client.get("/api/v1/transactions/export")
    assert res.status_code == 401
    app.dependency_overrides[get_current_user] = override_get_current_user


def test_export_csv_success_and_headers(test_users):
    """Authenticated user receives valid CSV with Excel UTF-8 BOM and correct columns."""
    global current_test_user
    user_a, _ = test_users
    current_test_user = user_a

    db = TestingSessionLocal()
    acc = Account(
        user_id=user_a.id,
        name="BCA Utama",
        account_type=AccountType.BANK,
        current_balance=Decimal("1500000.00"),
    )
    cat = Category(
        user_id=user_a.id,
        name="Makanan & Minuman",
        category_type=CategoryType.EXPENSE,
    )
    db.add_all([acc, cat])
    db.commit()
    db.refresh(acc)
    db.refresh(cat)

    now = datetime(2026, 10, 13, 14, 30, 0, tzinfo=timezone.utc)
    tx = Transaction(
        user_id=user_a.id,
        description="Nasi Padang + Es Teh",
        source_channel="WEB_MANUAL",
        transaction_date=now,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)

    debit_entry = LedgerEntry(
        transaction_id=tx.id,
        user_id=user_a.id,
        category_id=cat.id,
        entry_type=EntryType.DEBIT,
        amount=Decimal("28000.00"),
    )
    credit_entry = LedgerEntry(
        transaction_id=tx.id,
        user_id=user_a.id,
        account_id=acc.id,
        entry_type=EntryType.CREDIT,
        amount=Decimal("28000.00"),
    )
    db.add_all([debit_entry, credit_entry])
    db.commit()
    db.close()

    res = client.get("/api/v1/transactions/export")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "Content-Disposition" in res.headers
    assert "attachment; filename=" in res.headers["Content-Disposition"]
    assert res.headers["Cache-Control"] == "no-cache, no-store, must-revalidate"

    content = res.content.decode("utf-8-sig")  # Decode BOM
    reader = list(csv.reader(io.StringIO(content)))
    assert len(reader) == 2  # Header + 1 row
    assert reader[0] == [
        "Tanggal",
        "Tipe",
        "Kategori",
        "Akun Sumber",
        "Akun Tujuan",
        "Deskripsi",
        "Nominal (IDR)",
        "Saldo Akun",
    ]
    assert reader[1] == [
        "2026-10-13 14:30:00",
        "PENGELUARAN",
        "Makanan & Minuman",
        "BCA Utama",
        "-",
        "Nasi Padang + Es Teh",
        "28000.00",
        "1500000.00",
    ]


def test_export_csv_tenant_isolation(test_users):
    """User A must never see User B's transactions in CSV export."""
    global current_test_user
    user_a, user_b = test_users

    db = TestingSessionLocal()
    tx_b = Transaction(
        user_id=user_b.id,
        description="Rahasia User B",
        source_channel="WEB_MANUAL",
        transaction_date=datetime.now(timezone.utc),
    )
    db.add(tx_b)
    db.commit()
    db.refresh(tx_b)
    db.add(
        LedgerEntry(
            transaction_id=tx_b.id,
            user_id=user_b.id,
            entry_type=EntryType.DEBIT,
            amount=Decimal("999999.00"),
        )
    )
    db.commit()
    db.close()

    current_test_user = user_a
    res = client.get("/api/v1/transactions/export")
    assert res.status_code == 200
    content = res.content.decode("utf-8-sig")
    assert "Rahasia User B" not in content
    assert "999999.00" not in content


def test_export_csv_formula_injection_defense(test_users):
    """CSV cells beginning with formula injection characters must be escaped with a single quote."""
    global current_test_user
    user_a, _ = test_users
    current_test_user = user_a

    db = TestingSessionLocal()
    tx1 = Transaction(
        user_id=user_a.id,
        description="=SUM(A1:A10)",
        source_channel="WEB_MANUAL",
        transaction_date=datetime.now(timezone.utc),
    )
    tx2 = Transaction(
        user_id=user_a.id,
        description="@malicious_link",
        source_channel="WEB_MANUAL",
        transaction_date=datetime.now(timezone.utc),
    )
    tx3 = Transaction(
        user_id=user_a.id,
        description="+cmd|' /C calc'!A0",
        source_channel="WEB_MANUAL",
        transaction_date=datetime.now(timezone.utc),
    )
    db.add_all([tx1, tx2, tx3])
    db.commit()
    db.close()

    res = client.get("/api/v1/transactions/export")
    assert res.status_code == 200
    content = res.content.decode("utf-8-sig")
    reader = list(csv.reader(io.StringIO(content)))

    descriptions = [row[5] for row in reader[1:]]
    assert "'=SUM(A1:A10)" in descriptions
    assert "'@malicious_link" in descriptions
    assert "'+cmd|' /C calc'!A0" in descriptions


def test_export_csv_reversed_date_filters(test_users):
    """When start_date is later than end_date, returns a valid empty CSV without crashing."""
    global current_test_user
    user_a, _ = test_users
    current_test_user = user_a

    start = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    end = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()

    res = client.get(f"/api/v1/transactions/export?start_date={start}&end_date={end}")
    assert res.status_code == 200
    content = res.content.decode("utf-8-sig")
    reader = list(csv.reader(io.StringIO(content)))
    assert len(reader) == 1  # Only header
