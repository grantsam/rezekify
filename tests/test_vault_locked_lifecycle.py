from decimal import Decimal
from fastapi.testclient import TestClient
from rezekify.api.deps import get_db
from rezekify.api.main import app
from tests.test_api_endpoints import override_get_db

client = TestClient(app)


def test_locked_vault_lifecycle():
    app.dependency_overrides[get_db] = override_get_db
    # 0. Register user
    auth_res = client.post(
        "/api/v1/auth/register",
        json={
            "email": "locked_vault@rezekify.id",
            "password": "Password123!",
            "full_name": "Vault Tester",
        },
    )
    token = auth_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create a locked vault
    create_res = client.post(
        "/api/v1/vaults/",
        json={
            "name": "Dana Darurat",
            "vault_type": "SAVINGS",
            "target_amount": 5000000.0,
            "allocated_amount": 1000000.0,
            "is_locked": True,
        },
        headers=headers,
    )
    assert create_res.status_code == 200
    vault_id = create_res.json()["id"]
    assert create_res.json()["is_locked"] is True

    # 2. Attempt to delete locked vault -> must fail with 400
    del_res = client.delete(f"/api/v1/vaults/{vault_id}", headers=headers)
    assert del_res.status_code == 400
    assert "terkunci" in del_res.json()["detail"].lower()

    # 3. Attempt to decrease allocated_amount -> must fail with 400
    update_fail = client.put(
        f"/api/v1/vaults/{vault_id}",
        json={
            "name": "Dana Darurat",
            "target_amount": 5000000.0,
            "allocated_amount": 500000.0,
        },
        headers=headers,
    )
    assert update_fail.status_code == 400
    assert "terkunci" in update_fail.json()["detail"].lower()

    # 4. Increasing allocated_amount while locked -> allowed
    update_ok = client.put(
        f"/api/v1/vaults/{vault_id}",
        json={
            "name": "Dana Darurat",
            "target_amount": 5000000.0,
            "allocated_amount": 1500000.0,
        },
        headers=headers,
    )
    assert update_ok.status_code == 200
    assert float(update_ok.json()["allocated_amount"]) == 1500000.0

    # 5. Toggle lock state to unlocked
    toggle_res = client.patch(f"/api/v1/vaults/{vault_id}/toggle-lock", headers=headers)
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_locked"] is False

    # 6. Now deletion succeeds
    del_ok = client.delete(f"/api/v1/vaults/{vault_id}", headers=headers)
    assert del_ok.status_code == 200
