"""Tests for eager loading of ledger entries in transactions router."""

from decimal import Decimal
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from rezekify.api.main import app
from rezekify.api.deps import get_current_user, get_db
from rezekify.db.models import User, Account, Category
from rezekify.services.ledger import LedgerService


# Compatibility shim for plan specification fixture and Account kwargs
@pytest.fixture
def test_db(db_session: Session) -> Session:
    return db_session


_orig_account_init = Account.__init__


def _account_init(self, *args, **kwargs):
    if "balance" in kwargs:
        kwargs["current_balance"] = kwargs.pop("balance")
    if kwargs.get("account_type") == "ASSET":
        kwargs["account_type"] = "BANK"
    _orig_account_init(self, *args, **kwargs)


Account.__init__ = _account_init


def test_list_transactions_eager_loads_ledger_entries(test_db: Session):
    user = User(id=uuid4(), email="eager@test.com", password_hash="dummy", full_name="Eager Tester")
    test_db.add(user)
    account = Account(id=uuid4(), user_id=user.id, name="Checking", account_type="ASSET", balance=Decimal("1000000"))
    category = Category(id=uuid4(), user_id=user.id, name="Food", category_type="EXPENSE")
    test_db.add_all([account, category])
    test_db.commit()

    ledger = LedgerService(test_db)
    for i in range(5):
        ledger.record_expense(
            user_id=user.id,
            account_id=account.id,
            category_id=category.id,
            amount=Decimal("10000"),
            description=f"Expense {i}",
        )

    prev_user_override = app.dependency_overrides.get(get_current_user)
    prev_db_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: test_db
    client = TestClient(app)

    try:
        res = client.get("/api/v1/transactions?page=1&page_size=10")
        assert res.status_code == 200
        data = res.json()
        assert len(data["items"]) == 5
        for item in data["items"]:
            assert len(item["ledger_entries"]) == 2
    finally:
        if prev_user_override is not None:
            app.dependency_overrides[get_current_user] = prev_user_override
        else:
            app.dependency_overrides.pop(get_current_user, None)
        if prev_db_override is not None:
            app.dependency_overrides[get_db] = prev_db_override
        else:
            app.dependency_overrides.pop(get_db, None)


def test_list_transactions_emits_single_batched_query_for_ledger_entries(test_db: Session):
    from sqlalchemy import event

    user = User(id=uuid4(), email="batch@test.com", password_hash="dummy", full_name="Batch Tester")
    test_db.add(user)
    account = Account(id=uuid4(), user_id=user.id, name="Checking", account_type="BANK", balance=Decimal("1000000"))
    category = Category(id=uuid4(), user_id=user.id, name="Food", category_type="EXPENSE")
    test_db.add_all([account, category])
    test_db.commit()

    ledger = LedgerService(test_db)
    for i in range(5):
        ledger.record_expense(
            user_id=user.id,
            account_id=account.id,
            category_id=category.id,
            amount=Decimal("10000"),
            description=f"Expense {i}",
        )

    queries = []

    def capture_queries(conn, cursor, statement, parameters, context, executemany):
        queries.append(statement)

    engine = test_db.get_bind()
    event.listen(engine, "before_cursor_execute", capture_queries)

    prev_user_override = app.dependency_overrides.get(get_current_user)
    prev_db_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = lambda: test_db
    client = TestClient(app)

    try:
        res = client.get("/api/v1/transactions?page=1&page_size=10")
        assert res.status_code == 200
        data = res.json()
        assert len(data["items"]) == 5
        ledger_queries = [q for q in queries if "ledger_entries" in q.lower() and "select" in q.lower()]
        # Exactly 1 batched query for ledger_entries instead of 5 separate N+1 queries
        assert len(ledger_queries) == 1
    finally:
        event.remove(engine, "before_cursor_execute", capture_queries)
        if prev_user_override is not None:
            app.dependency_overrides[get_current_user] = prev_user_override
        else:
            app.dependency_overrides.pop(get_current_user, None)
        if prev_db_override is not None:
            app.dependency_overrides[get_db] = prev_db_override
        else:
            app.dependency_overrides.pop(get_db, None)
