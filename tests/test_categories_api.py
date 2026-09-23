"""Tests for Categories CRUD API and tenant isolation."""

import uuid
from decimal import Decimal
from fastapi.testclient import TestClient
from rezekify.api.deps import get_db
from rezekify.api.main import app
from rezekify.db.models import Account, AccountType, Category, CategoryType, EntryType, LedgerEntry, Transaction
from tests.test_api_endpoints import TestingSessionLocal, override_get_db

client = TestClient(app)


def test_categories_crud_and_isolation():
    app.dependency_overrides[get_db] = override_get_db

    uid_a = uuid.uuid4().hex[:8]
    uid_b = uuid.uuid4().hex[:8]
    # Register User A
    res_a = client.post(
        "/api/v1/auth/register",
        json={"email": f"cat_user_a_{uid_a}@example.com", "password": "Password123!", "full_name": "Cat User A"},
    )
    token_a = res_a.json()["access_token"]
    user_a_id = res_a.json()["user"]["id"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Register User B
    res_b = client.post(
        "/api/v1/auth/register",
        json={"email": f"cat_user_b_{uid_b}@example.com", "password": "Password123!", "full_name": "Cat User B"},
    )
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # 1. Create category with defaults
    create_default = client.post(
        "/api/v1/categories",
        json={"name": "Belanja Bulanan"},
        headers=headers_a,
    )
    assert create_default.status_code == 200
    data_def = create_default.json()
    assert data_def["name"] == "Belanja Bulanan"
    assert data_def["category_type"] == "EXPENSE"
    assert data_def["icon"] == "tag"
    assert data_def["color"] == "#64748b"

    # 2. Create custom category for User A
    create_res = client.post(
        "/api/v1/categories/",
        json={"name": "Makanan", "category_type": "EXPENSE", "icon": "utensils", "color": "#ef4444"},
        headers=headers_a,
    )
    assert create_res.status_code == 200
    cat_id = create_res.json()["id"]
    assert create_res.json()["name"] == "Makanan"

    # 3. List categories User A -> contains both categories in alphabetical order
    list_a = client.get("/api/v1/categories", headers=headers_a)
    assert list_a.status_code == 200
    names_a = [c["name"] for c in list_a.json()]
    assert names_a == sorted(names_a)
    assert "Belanja Bulanan" in names_a
    assert "Makanan" in names_a

    # 4. List categories User B -> does NOT include User A's categories
    list_b = client.get("/api/v1/categories", headers=headers_b)
    assert list_b.status_code == 200
    cat_ids_b = [c["id"] for c in list_b.json()]
    assert cat_id not in cat_ids_b

    # 5. User B tries to update User A's category -> 404
    put_b = client.put(f"/api/v1/categories/{cat_id}", json={"name": "Hacked"}, headers=headers_b)
    assert put_b.status_code == 404

    # 6. User A updates own category (name, category_type, icon, color) -> 200
    put_a = client.put(
        f"/api/v1/categories/{cat_id}",
        json={"name": "Kuliner", "category_type": "INCOME", "icon": "coffee", "color": "#10b981"},
        headers=headers_a,
    )
    assert put_a.status_code == 200
    updated_data = put_a.json()
    assert updated_data["name"] == "Kuliner"
    assert updated_data["category_type"] == "INCOME"
    assert updated_data["icon"] == "coffee"
    assert updated_data["color"] == "#10b981"

    # 7. User B tries to delete User A's category -> 404
    del_b = client.delete(f"/api/v1/categories/{cat_id}", headers=headers_b)
    assert del_b.status_code == 404

    # 8. Test ledger reference nullification on delete
    db = TestingSessionLocal()
    try:
        account = Account(user_id=user_a_id, name="Cash", account_type=AccountType.CASH, current_balance=Decimal("1000"))
        db.add(account)
        db.flush()
        tx = Transaction(user_id=user_a_id, description="Makan siang")
        db.add(tx)
        db.flush()
        entry = LedgerEntry(
            transaction_id=tx.id,
            user_id=user_a_id,
            account_id=account.id,
            category_id=cat_id,
            entry_type=EntryType.DEBIT,
            amount=Decimal("50.00"),
        )
        db.add(entry)
        db.commit()
        entry_id = entry.id
    finally:
        db.close()

    # 9. User A deletes own category -> 200 {"detail": "Category deleted."}
    del_a = client.delete(f"/api/v1/categories/{cat_id}", headers=headers_a)
    assert del_a.status_code == 200
    assert del_a.json() == {"detail": "Category deleted."}

    # Verify category is deleted from DB and ledger entry category_id is set to None
    db = TestingSessionLocal()
    try:
        assert db.query(Category).filter_by(id=cat_id).first() is None
        reloaded_entry = db.query(LedgerEntry).filter_by(id=entry_id).first()
        assert reloaded_entry is not None
        assert reloaded_entry.category_id is None
    finally:
        db.close()

    # 10. Check deleted -> 404 on subsequent update & delete
    assert client.put(f"/api/v1/categories/{cat_id}", json={"name": "Kuliner"}, headers=headers_a).status_code == 404
    assert client.delete(f"/api/v1/categories/{cat_id}", headers=headers_a).status_code == 404
