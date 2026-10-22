"""Tests for Vault Deposit and Autonomous Bill Rollover Operations."""

from datetime import date
from decimal import Decimal
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from rezekify.api.deps import get_db
from rezekify.api.main import app
from rezekify.db.models import Account, AccountType, Category, CategoryType, User, Vault, VaultType
from tests.test_api_endpoints import override_get_db

client = TestClient(app)


def _get_auth_headers(email: str = "vault_ops@rezekify.id") -> dict:
    app.dependency_overrides[get_db] = override_get_db
    res = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "password": "Password123!",
            "full_name": "Vault Ops Tester",
        },
    )
    if res.status_code == 200:
        token = res.json()["access_token"]
    else:
        login_res = client.post(
            "/api/v1/auth/login",
            data={"username": email, "password": "Password123!"},
        )
        token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_deposit_to_savings_vault_success():
    headers = _get_auth_headers("deposit_success@rezekify.id")

    # 1. Create a savings vault
    create_res = client.post(
        "/api/v1/vaults/",
        json={
            "name": "Dana Darurat",
            "vault_type": "SAVINGS",
            "target_amount": 5000000.0,
            "allocated_amount": 1000000.0,
            "is_locked": False,
        },
        headers=headers,
    )
    assert create_res.status_code == 200
    vault_id = create_res.json()["id"]

    # 2. Deposit Rp 500,000
    deposit_res = client.post(
        f"/api/v1/vaults/{vault_id}/deposit",
        json={"amount": 500000.0},
        headers=headers,
    )
    assert deposit_res.status_code == 200
    data = deposit_res.json()
    assert float(data["allocated_amount"]) == 1500000.0
    assert data["is_locked"] is True


def test_deposit_with_source_account_validation():
    headers = _get_auth_headers("deposit_source@rezekify.id")

    # Create account with balance
    acc_res = client.post(
        "/api/v1/accounts/",
        json={"name": "BCA Rekening", "account_type": "BANK", "initial_balance": 2000000.0},
        headers=headers,
    )
    assert acc_res.status_code == 200
    account_id = acc_res.json()["id"]

    # Create vault
    v_res = client.post(
        "/api/v1/vaults/",
        json={"name": "Liburan", "vault_type": "SAVINGS", "target_amount": 3000000.0, "allocated_amount": 0.0},
        headers=headers,
    )
    vault_id = v_res.json()["id"]

    # Deposit with valid source account
    dep_res = client.post(
        f"/api/v1/vaults/{vault_id}/deposit",
        json={"amount": 500000.0, "source_account_id": account_id},
        headers=headers,
    )
    assert dep_res.status_code == 200
    assert float(dep_res.json()["allocated_amount"]) == 500000.0


def test_deposit_insufficient_source_account_balance():
    """Review Focus 2: Insufficient source account balance rejects deposit with 400."""
    headers = _get_auth_headers("dep_insufficient@rezekify.id")

    acc_res = client.post(
        "/api/v1/accounts/",
        json={"name": "Dompet Kecil", "account_type": "CASH", "initial_balance": 100000.0},
        headers=headers,
    )
    account_id = acc_res.json()["id"]

    v_res = client.post(
        "/api/v1/vaults/",
        json={"name": "Laptop Baru", "vault_type": "SAVINGS", "target_amount": 10000000.0},
        headers=headers,
    )
    vault_id = v_res.json()["id"]

    # Attempt to deposit 500,000 from account having only 100,000
    dep_res = client.post(
        f"/api/v1/vaults/{vault_id}/deposit",
        json={"amount": 500000.0, "source_account_id": account_id},
        headers=headers,
    )
    assert dep_res.status_code == 400
    assert "tidak mencukupi" in dep_res.json()["detail"].lower()


def test_deposit_negative_or_zero_amount():
    """Review Focus 3: Zero or negative deposit amount rejected."""
    headers = _get_auth_headers("dep_zero@rezekify.id")

    v_res = client.post(
        "/api/v1/vaults/",
        json={"name": "Kurban", "vault_type": "SAVINGS", "target_amount": 3000000.0},
        headers=headers,
    )
    vault_id = v_res.json()["id"]

    dep_zero = client.post(
        f"/api/v1/vaults/{vault_id}/deposit",
        json={"amount": 0},
        headers=headers,
    )
    assert dep_zero.status_code in (400, 422)

    dep_neg = client.post(
        f"/api/v1/vaults/{vault_id}/deposit",
        json={"amount": -100000},
        headers=headers,
    )
    assert dep_neg.status_code in (400, 422)


def test_deposit_cross_tenant_isolation():
    """Review Focus 4: Cross-tenant deposit attempts return 404."""
    headers_a = _get_auth_headers("tenant_a_dep@rezekify.id")
    headers_b = _get_auth_headers("tenant_b_dep@rezekify.id")

    v_res = client.post(
        "/api/v1/vaults/",
        json={"name": "Vault Milik A", "vault_type": "SAVINGS", "target_amount": 1000000.0},
        headers=headers_a,
    )
    vault_id_a = v_res.json()["id"]

    # User B attempts to deposit into User A's vault
    res_b = client.post(
        f"/api/v1/vaults/{vault_id_a}/deposit",
        json={"amount": 100000.0},
        headers=headers_b,
    )
    assert res_b.status_code == 404


def test_pay_bill_success_and_rollover():
    headers = _get_auth_headers("pay_bill_success@rezekify.id")

    # Create paying account with balance Rp 3,000,000
    acc_res = client.post(
        "/api/v1/accounts/",
        json={"name": "BCA Payroll", "account_type": "BANK", "initial_balance": 3000000.0},
        headers=headers,
    )
    account_id = acc_res.json()["id"]

    # Create fixed bill vault with target date 2026-10-25
    v_res = client.post(
        "/api/v1/vaults/",
        json={
            "name": "Listrik PLN",
            "vault_type": "FIXED_BILL",
            "target_amount": 500000.0,
            "allocated_amount": 500000.0,
            "target_date": "2026-10-25",
            "is_locked": True,
        },
        headers=headers,
    )
    vault_id = v_res.json()["id"]

    # Pay bill
    pay_res = client.post(
        f"/api/v1/vaults/{vault_id}/pay-bill",
        json={"account_id": account_id, "amount": 500000.0, "notes": "Bayar Token Listrik"},
        headers=headers,
    )
    assert pay_res.status_code == 200
    data = pay_res.json()

    # 1. Check updated vault
    vault_data = data["vault"]
    assert float(vault_data["allocated_amount"]) == 0.0
    assert vault_data["target_date"] == "2026-11-25"  # Rolled over +1 month

    # 2. Check generated transaction
    tx_data = data["transaction"]
    assert "Listrik" in tx_data["description"]
    assert len(tx_data["ledger_entries"]) == 2
    debit_entry = next(e for e in tx_data["ledger_entries"] if e["entry_type"] == "DEBIT")
    assert debit_entry["vault_id"] == vault_id

    # 3. Check account balance deducted
    acc_check = client.get("/api/v1/accounts/", headers=headers)
    acc = next(a for a in acc_check.json() if a["id"] == account_id)
    assert float(acc["current_balance"]) == 2500000.0


def test_pay_bill_insufficient_funds():
    """Review Focus 2: Bill payment with insufficient balance fails with 400."""
    headers = _get_auth_headers("pay_insufficient@rezekify.id")

    acc_res = client.post(
        "/api/v1/accounts/",
        json={"name": "Tabungan Tipis", "account_type": "BANK", "initial_balance": 150000.0},
        headers=headers,
    )
    account_id = acc_res.json()["id"]

    v_res = client.post(
        "/api/v1/vaults/",
        json={
            "name": "Sewa Kos",
            "vault_type": "FIXED_BILL",
            "target_amount": 1500000.0,
            "allocated_amount": 1500000.0,
        },
        headers=headers,
    )
    vault_id = v_res.json()["id"]

    pay_res = client.post(
        f"/api/v1/vaults/{vault_id}/pay-bill",
        json={"account_id": account_id, "amount": 1500000.0},
        headers=headers,
    )
    assert pay_res.status_code == 400
    assert "tidak mencukupi" in pay_res.json()["detail"].lower()


def test_pay_bill_month_end_date_clamping():
    """Review Focus 1: Bill due on Jan 31 clamps to Feb 28 on rollover without ValueError."""
    headers = _get_auth_headers("pay_clamp@rezekify.id")

    acc_res = client.post(
        "/api/v1/accounts/",
        json={"name": "Mandiri", "account_type": "BANK", "initial_balance": 5000000.0},
        headers=headers,
    )
    account_id = acc_res.json()["id"]

    v_res = client.post(
        "/api/v1/vaults/",
        json={
            "name": "Asuransi Tahunan / Bulanan",
            "vault_type": "FIXED_BILL",
            "target_amount": 750000.0,
            "allocated_amount": 750000.0,
            "target_date": "2026-01-31",
        },
        headers=headers,
    )
    vault_id = v_res.json()["id"]

    pay_res = client.post(
        f"/api/v1/vaults/{vault_id}/pay-bill",
        json={"account_id": account_id},
        headers=headers,
    )
    assert pay_res.status_code == 200
    # 2026 is not a leap year, February ends on the 28th
    assert pay_res.json()["vault"]["target_date"] == "2026-02-28"


def test_pay_bill_cross_tenant_isolation():
    """Review Focus 4: Cross-tenant bill payment returns 404."""
    headers_a = _get_auth_headers("tenant_a_pay@rezekify.id")
    headers_b = _get_auth_headers("tenant_b_pay@rezekify.id")

    acc_b = client.post(
        "/api/v1/accounts/",
        json={"name": "BCA B", "account_type": "BANK", "initial_balance": 2000000.0},
        headers=headers_b,
    ).json()["id"]

    v_a = client.post(
        "/api/v1/vaults/",
        json={"name": "Tagihan User A", "vault_type": "FIXED_BILL", "target_amount": 500000.0},
        headers=headers_a,
    ).json()["id"]

    res_b = client.post(
        f"/api/v1/vaults/{v_a}/pay-bill",
        json={"account_id": acc_b, "amount": 500000.0},
        headers=headers_b,
    )
    assert res_b.status_code == 404
