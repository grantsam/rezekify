# Vault Quick Deposit and Billing Cycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement fast nominal deposits (+50k, +100k, +250k, +500k) into savings vaults, autonomous double-entry billing rollover (+1 month) for fixed commitments, and multimodal AI agent vault control via `manage_vault`.

**Architecture:** Extend backend router `vaults_router.py` with `/deposit` and `/pay-bill` endpoints backed by `LedgerService` and `RunwayService`; register `manage_vault` deterministic tool dispatcher in `rezekify/agent/tools.py`; create dedicated accessible modals `DepositVaultModal` and `PayBillModal`; and integrate contextual action buttons (`+ Nabung` and `Bayar Tagihan`) into `VaultCard`, `VaultsView`, and `OverviewView`.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, PostgreSQL/SQLite, Pydantic v2, Python 3.12, React 18, HeroUI, Tailwind CSS, Lucide React, Framer Motion, Vitest, Pytest.

**Spec:** `docs/superpowers/specs/2026-10-14-vault-quick-deposit-and-billing-cycle-design.md`

## Global Constraints

- **Financial Determinism & Invariance:** Zero floating-point arithmetic for monetary calculations. All calculations use `decimal.Decimal` in Python and integer/numeric types in SQL. Double-entry invariant $\sum \text{Debit} = \sum \text{Credit}$ must hold for bill payment ledger transactions.
- **Multi-Tenant Row-Level Scoping:** Enforce `user_id == current_user.id` on every query, mutation, account lookup, and vault action. Context-injected user IDs from authenticated sessions are never overridden by client or LLM inputs.
- **Lock Invariance:** Vaults with `is_locked = True` cannot be reduced or deleted without explicit unlocking. Deposit automatically sets `is_locked = True`.
- **Idempotent Cache Invalidation:** Every deposit, bill payment, or lock toggle must invoke `RunwayService.clear_cache(user_id)`.
- **Bounded & Single-Pass Verification:** Frontend tests run with `npm --prefix frontend test -- <path>` without watch mode. Backend tests run with bounded `uv run --no-project pytest -x <path>`.
- **Mobile Ergonomics & Design Standards:** Minimum 38px touch targets on all buttons and chips. Smooth motion <= 250ms ease-out. Strict Zinc design system palette matching existing dashboard.

## Review Focus

1. **Calendar Month Clamping on Rollover:** Fixed bill due on January 31 rolling over by +1 month must resolve to February 28 (or February 29 in leap years) without throwing `ValueError: day is out of range for month` (`test_pay_bill_month_end_date_clamping` in Task 1).
2. **Insufficient Account Balance Safeguard:** Bill payment or deposit with source account where `account.current_balance < amount` must fail with HTTP 400 Bad Request, preventing unbacked commitments or negative ledger balances (`test_pay_bill_insufficient_funds` in Task 1).
3. **Non-Positive Nominal Rejection:** Deposits with `amount <= 0` or negative values must be rejected with HTTP 422 or 400 validation error (`test_deposit_negative_or_zero_amount` in Task 1).
4. **Cross-Tenant Isolation on Vault Actions:** User B attempting to deposit into or pay a bill for User A's vault must receive HTTP 404 Not Found rather than mutating another user's funds (`test_deposit_cross_tenant_isolation` and `test_pay_bill_cross_tenant_isolation` in Task 1).
5. **AI Tool Graceful Degradation on Missing Vault:** AI agent tool `manage_vault` receiving a non-existent vault name must return `{"status": "error", "message": "..."}` cleanly rather than raising an unhandled 500 error (`test_manage_vault_missing_vault_name_error` in Task 2).

---

### Task 1: Backend API Endpoints (`POST /api/v1/vaults/{id}/deposit` and `POST /api/v1/vaults/{id}/pay-bill`)

**Files:**
- Create: `tests/test_vault_operations.py`
- Modify: `rezekify/api/v1/vaults_router.py`

**Interfaces:**
- Consumes: `Session` (SQLAlchemy), `Vault`, `Account`, `Category`, `CategoryType`, `EntryType` from `rezekify.db.models`, `LedgerService` from `rezekify.services.ledger`, `RunwayService` from `rezekify.services.runway`.
- Produces:
  - `advance_one_month(d: date) -> date`: Deterministic calendar-safe month advancement with day clamping.
  - `VaultDepositRequest`: Pydantic model (`amount: Decimal = Field(gt=0)`, `source_account_id: Optional[UUID] = None`).
  - `VaultPayBillRequest`: Pydantic model (`account_id: UUID`, `category_id: Optional[UUID] = None`, `amount: Optional[Decimal] = None`, `notes: Optional[str] = None`).
  - `VaultPayBillResponse`: Pydantic model (`vault: VaultResponse`, `transaction: TransactionItemResponse`).
  - `POST /api/v1/vaults/{vault_id}/deposit` endpoint.
  - `POST /api/v1/vaults/{vault_id}/pay-bill` endpoint.

- [ ] **Step 1: Write the failing tests in `tests/test_vault_operations.py`**

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --no-project pytest -x tests/test_vault_operations.py`
Expected: FAIL with status code 404/405 Not Found for `/deposit` or `/pay-bill`.

- [ ] **Step 3: Write minimal implementation in `rezekify/api/v1/vaults_router.py`**

Modify `rezekify/api/v1/vaults_router.py`:
Add calendar month advance helper, new Pydantic request/response models, and the two endpoints (`POST /{vault_id}/deposit` and `POST /{vault_id}/pay-bill`).

```python
"""Vaults (Sinking Funds & Fixed Commitments) Router."""

from calendar import monthrange
from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from rezekify.api.deps import get_current_user, get_db
from rezekify.api.v1.transactions_router import TransactionItemResponse
from rezekify.db.models import Account, Category, CategoryType, User, Vault, VaultType
from rezekify.services.ledger import LedgerService
from rezekify.services.runway import RunwayService

vaults_router = APIRouter()


def advance_one_month(d: date) -> date:
    """Advances date by one calendar month, clamping day to month-end if needed."""
    year = d.year + (d.month // 12)
    month = (d.month % 12) + 1
    max_day = monthrange(year, month)[1]
    day = min(d.day, max_day)
    return date(year, month, day)


class VaultCreateRequest(BaseModel):
    name: str
    vault_type: VaultType = VaultType.SAVINGS
    target_amount: Decimal
    allocated_amount: Decimal = Decimal("0.00")
    target_date: Optional[date] = None
    is_locked: bool = False


class VaultUpdateRequest(BaseModel):
    name: str
    target_amount: Decimal
    allocated_amount: Decimal
    target_date: Optional[date] = None


class VaultDepositRequest(BaseModel):
    amount: Decimal = Field(gt=0)
    source_account_id: Optional[UUID] = None


class VaultPayBillRequest(BaseModel):
    account_id: UUID
    category_id: Optional[UUID] = None
    amount: Optional[Decimal] = None
    notes: Optional[str] = None


class VaultResponse(BaseModel):
    id: UUID
    name: str
    vault_type: VaultType
    target_amount: Decimal
    allocated_amount: Decimal
    target_date: Optional[date]
    is_locked: bool

    model_config = ConfigDict(from_attributes=True)


class VaultPayBillResponse(BaseModel):
    vault: VaultResponse
    transaction: TransactionItemResponse

    model_config = ConfigDict(from_attributes=True)


@vaults_router.get("", response_model=List[VaultResponse])
@vaults_router.get("/", response_model=List[VaultResponse])
def list_vaults(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists all commitment vaults and sinking funds for the user."""
    return (
        db.query(Vault)
        .filter(Vault.user_id == current_user.id)
        .all()
    )


@vaults_router.post("", response_model=VaultResponse)
@vaults_router.post("/", response_model=VaultResponse)
def create_vault(
    req: VaultCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Creates a new savings goal or fixed bill commitment vault."""
    vault = Vault(
        user_id=current_user.id,
        name=req.name.strip(),
        vault_type=req.vault_type,
        target_amount=req.target_amount,
        allocated_amount=req.allocated_amount,
        target_date=req.target_date,
        is_locked=req.is_locked,
    )
    db.add(vault)
    db.commit()
    db.refresh(vault)
    RunwayService.clear_cache(user_id=current_user.id)
    return vault


@vaults_router.patch("/{vault_id}/toggle-lock", response_model=VaultResponse)
def toggle_vault_lock(
    vault_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vault = db.query(Vault).filter_by(id=vault_id, user_id=current_user.id).one_or_none()
    if not vault:
        raise HTTPException(status_code=404, detail="Vault tidak ditemukan.")
    vault.is_locked = not vault.is_locked
    db.commit()
    db.refresh(vault)
    RunwayService.clear_cache(user_id=current_user.id)
    return vault


@vaults_router.post("/{vault_id}/deposit", response_model=VaultResponse)
def deposit_to_vault(
    vault_id: UUID,
    req: VaultDepositRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deposits funds into a vault, automatically securing it with a lock."""
    vault = db.query(Vault).filter_by(id=vault_id, user_id=current_user.id).one_or_none()
    if not vault:
        raise HTTPException(status_code=404, detail="Vault tidak ditemukan.")

    if req.source_account_id:
        source_acc = (
            db.query(Account)
            .filter_by(id=req.source_account_id, user_id=current_user.id)
            .one_or_none()
        )
        if not source_acc:
            raise HTTPException(status_code=404, detail="Akun sumber tidak ditemukan.")
        if source_acc.current_balance < req.amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Saldo akun tidak mencukupi untuk dialokasikan ke vault.",
            )

    vault.allocated_amount += req.amount
    vault.is_locked = True
    db.commit()
    db.refresh(vault)
    RunwayService.clear_cache(user_id=current_user.id)
    return vault


@vaults_router.post("/{vault_id}/pay-bill", response_model=VaultPayBillResponse)
def pay_bill_vault(
    vault_id: UUID,
    req: VaultPayBillRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Pays a fixed bill, records a double-entry ledger expense, and rolls over cycle."""
    vault = db.query(Vault).filter_by(id=vault_id, user_id=current_user.id).one_or_none()
    if not vault:
        raise HTTPException(status_code=404, detail="Vault tidak ditemukan.")

    pay_amount = req.amount if req.amount is not None else (vault.target_amount or vault.allocated_amount)
    if not pay_amount or pay_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nominal pembayaran harus lebih besar dari 0.",
        )

    account = (
        db.query(Account)
        .filter_by(id=req.account_id, user_id=current_user.id)
        .one_or_none()
    )
    if not account:
        raise HTTPException(status_code=404, detail="Akun sumber pembayaran tidak ditemukan.")
    if account.current_balance < pay_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Saldo akun tidak mencukupi untuk membayar tagihan.",
        )

    category = None
    if req.category_id:
        category = (
            db.query(Category)
            .filter_by(id=req.category_id, user_id=current_user.id)
            .one_or_none()
        )
        if not category:
            raise HTTPException(status_code=404, detail="Kategori tidak ditemukan.")
    else:
        category = (
            db.query(Category)
            .filter(
                Category.user_id == current_user.id,
                Category.category_type == CategoryType.EXPENSE,
                Category.name.ilike("%Tagihan%"),
            )
            .first()
        )
        if not category:
            category = (
                db.query(Category)
                .filter(
                    Category.user_id == current_user.id,
                    Category.category_type == CategoryType.EXPENSE,
                )
                .first()
            )
        if not category:
            category = Category(
                user_id=current_user.id,
                name="Tagihan",
                category_type=CategoryType.EXPENSE,
            )
            db.add(category)
            db.flush()

    ledger_service = LedgerService(db, auto_commit=False)
    tx = ledger_service.record_expense(
        user_id=current_user.id,
        account_id=account.id,
        category_id=category.id,
        amount=pay_amount,
        description=req.notes or f"Pembayaran tagihan: {vault.name}",
        source_channel="WEB_UI",
    )

    vault.allocated_amount = Decimal("0.00")
    if vault.target_date:
        vault.target_date = advance_one_month(vault.target_date)

    db.commit()
    db.refresh(vault)
    db.refresh(tx)
    RunwayService.clear_cache(user_id=current_user.id)

    return VaultPayBillResponse(vault=vault, transaction=tx)


@vaults_router.put("/{vault_id}", response_model=VaultResponse)
def update_vault(
    vault_id: UUID,
    req: VaultUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vault = db.query(Vault).filter_by(id=vault_id, user_id=current_user.id).one_or_none()
    if not vault:
        raise HTTPException(status_code=404, detail="Vault tidak ditemukan.")

    if vault.is_locked and req.allocated_amount < vault.allocated_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dana komitmen terkunci. Buka kunci terlebih dahulu untuk menarik atau mengurangi alokasi dana.",
        )

    vault.name = req.name.strip()
    vault.target_amount = req.target_amount
    vault.allocated_amount = req.allocated_amount
    vault.target_date = req.target_date
    db.commit()
    db.refresh(vault)
    RunwayService.clear_cache(user_id=current_user.id)
    return vault


@vaults_router.delete("/{vault_id}")
def delete_vault(
    vault_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    vault = db.query(Vault).filter_by(id=vault_id, user_id=current_user.id).one_or_none()
    if not vault:
        raise HTTPException(status_code=404, detail="Vault tidak ditemukan.")

    if vault.is_locked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Komitmen dana terkunci. Buka kunci terlebih dahulu untuk menghapus vault.",
        )

    db.delete(vault)
    db.commit()
    RunwayService.clear_cache(user_id=current_user.id)
    return {"detail": "Vault berhasil dihapus."}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --no-project pytest -x tests/test_vault_operations.py`
Expected: 9 passed in <2s with exit code 0.

- [ ] **Step 5: Commit**

```bash
git add tests/test_vault_operations.py rezekify/api/v1/vaults_router.py
git commit -m "feat(api): add vault deposit and pay-bill endpoints with month rollover"
```

---

### Task 2: AI Agent ReAct Tool `manage_vault` in Tools & Runtime

**Files:**
- Create: `tests/test_manage_vault_tool.py`
- Modify: `rezekify/agent/tools.py`
- Modify: `rezekify/agent/runtime.py`

**Interfaces:**
- Consumes: `Session`, `Vault`, `Account`, `Category`, `LedgerService`, `RunwayService`.
- Produces:
  - `AGENT_TOOL_DEFINITIONS`: Tool schema for `manage_vault` registered with `action`, `vault_name`, `amount`, `account_name`, `lock_state`.
  - `ManageVaultArgs`: Pydantic model for sanitizing and validating arguments.
  - `AgentToolDispatcher._dispatch_manage_vault(user_id, arguments)`: Dispatches `deposit`, `pay_bill`, `toggle_lock`, and `check_status`.
  - `build_cognitive_system_prompt`: Updated to list `manage_vault` in `[DAFTAR ALAT TERSEDIA]`.
  - `parse_agent_turn`: Added fallback thought for `manage_vault`.

- [ ] **Step 1: Write the failing tests in `tests/test_manage_vault_tool.py`**

```python
"""Tests for AI Agent ReAct manage_vault tool."""

from datetime import date
from decimal import Decimal
import uuid
import pytest
from sqlalchemy.orm import Session

from rezekify.agent.runtime import build_cognitive_system_prompt, parse_agent_turn
from rezekify.agent.tools import AGENT_TOOL_DEFINITIONS, AgentToolDispatcher
from rezekify.db.models import Account, AccountType, Category, CategoryType, User, Vault, VaultType


@pytest.fixture
def seeded_agent_vault_db(db_session: Session, sample_user: User):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("5000000.00"),
    )
    cat = Category(
        user_id=sample_user.id,
        name="Tagihan",
        category_type=CategoryType.EXPENSE,
    )
    v_sav = Vault(
        user_id=sample_user.id,
        name="Dana Darurat",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("10000000.00"),
        allocated_amount=Decimal("2000000.00"),
        is_locked=False,
    )
    v_bill = Vault(
        user_id=sample_user.id,
        name="Listrik PLN",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("500000.00"),
        allocated_amount=Decimal("500000.00"),
        target_date=date(2026, 1, 31),
        is_locked=True,
    )
    db_session.add_all([acc, cat, v_sav, v_bill])
    db_session.commit()
    return sample_user


def test_manage_vault_tool_definition_registered():
    tool_names = [t["name"] for t in AGENT_TOOL_DEFINITIONS]
    assert "manage_vault" in tool_names

    tool = next(t for t in AGENT_TOOL_DEFINITIONS if t["name"] == "manage_vault")
    props = tool["parameters"]["properties"]
    assert "action" in props
    assert "vault_name" in props
    assert "amount" in props
    assert "account_name" in props
    assert "lock_state" in props
    assert "action" in tool["parameters"]["required"]


def test_manage_vault_deposit_action(db_session: Session, seeded_agent_vault_db: User):
    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "deposit",
        "vault_name": "Dana Darurat",
        "amount": 500000,
        "account_name": "BCA",
    }
    result = dispatcher.dispatch(seeded_agent_vault_db.id, "manage_vault", args)

    assert result["status"] == "success"
    assert "Dana Darurat" in result["message"]
    assert float(result["vault"]["allocated_amount"]) == 2500000.0
    assert result["vault"]["is_locked"] is True


def test_manage_vault_pay_bill_action(db_session: Session, seeded_agent_vault_db: User):
    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "pay_bill",
        "vault_name": "Listrik PLN",
        "account_name": "BCA",
    }
    result = dispatcher.dispatch(seeded_agent_vault_db.id, "manage_vault", args)

    assert result["status"] == "success"
    assert float(result["vault"]["allocated_amount"]) == 0.0
    # Clamped to Feb 28
    assert str(result["vault"]["target_date"]) == "2026-02-28"

    # Verify ledger deduction
    acc = db_session.query(Account).filter_by(user_id=seeded_agent_vault_db.id, name="BCA").one()
    assert acc.current_balance == Decimal("4500000.00")


def test_manage_vault_toggle_lock_action(db_session: Session, seeded_agent_vault_db: User):
    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "toggle_lock",
        "vault_name": "Dana Darurat",
        "lock_state": True,
    }
    result = dispatcher.dispatch(seeded_agent_vault_db.id, "manage_vault", args)
    assert result["status"] == "success"
    assert result["vault"]["is_locked"] is True


def test_manage_vault_check_status_action(db_session: Session, seeded_agent_vault_db: User):
    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "check_status",
        "vault_name": "Dana Darurat",
    }
    result = dispatcher.dispatch(seeded_agent_vault_db.id, "manage_vault", args)
    assert result["status"] == "success"
    assert result["vault"]["name"] == "Dana Darurat"
    assert "percentage" in result["vault"]


def test_manage_vault_missing_vault_name_error(db_session: Session, seeded_agent_vault_db: User):
    """Review Focus 5: Graceful error response on missing vault name."""
    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "deposit",
        "vault_name": "Tabungan Rumah Impian 99",
        "amount": 1000000,
    }
    result = dispatcher.dispatch(seeded_agent_vault_db.id, "manage_vault", args)
    assert result["status"] == "error"
    assert "tidak ditemukan" in result["message"].lower()


def test_manage_vault_runtime_system_prompt_and_fallback():
    prompt = build_cognitive_system_prompt()
    assert "manage_vault" in prompt

    turn = parse_agent_turn("Tolong jalankan manage_vault untuk nabung 100rb")
    assert turn.thought is not None
    assert "vault" in turn.thought.lower() or "komitmen" in turn.thought.lower()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --no-project pytest -x tests/test_manage_vault_tool.py`
Expected: FAIL with `AssertionError: assert 'manage_vault' in tool_names`.

- [ ] **Step 3: Write minimal implementation in `rezekify/agent/tools.py` and `rezekify/agent/runtime.py`**

In `rezekify/agent/tools.py`:
1. Add `manage_vault` schema to `AGENT_TOOL_DEFINITIONS`.
2. Add Pydantic model `ManageVaultArgs`.
3. Add `_dispatch_manage_vault` method in `AgentToolDispatcher`.
4. In `dispatch()`, route `"manage_vault"` to `self._dispatch_manage_vault`.

```python
# Insert into AGENT_TOOL_DEFINITIONS list:
    {
        "name": "manage_vault",
        "description": "Kelola pos alokasi dana dan sinking fund (vault): nabung/deposit dana, bayar tagihan (dengan pembukuan otomatis), kunci/buka vault, atau periksa status vault.",
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["deposit", "pay_bill", "toggle_lock", "check_status"],
                    "description": "Aksi pada vault: 'deposit' (tambah saldo alokasi), 'pay_bill' (bayar tagihan & catat pengeluaran), 'toggle_lock' (kunci/buka kunci), atau 'check_status' (lihat progres vault).",
                },
                "vault_name": {
                    "type": "string",
                    "description": "Nama atau kata kunci nama vault/pos tabungan/tagihan (misal: 'Dana Darurat', 'Listrik PLN').",
                },
                "amount": {
                    "type": "number",
                    "description": "Nominal uang dalam Rupiah untuk deposit atau pembayaran tagihan.",
                },
                "account_name": {
                    "type": "string",
                    "description": "Nama akun sumber pembayaran atau deposit (misal: 'BCA', 'Mandiri', 'Cash').",
                },
                "lock_state": {
                    "type": "boolean",
                    "description": "Status kunci target (opsional, jika ingin mengunci/membuka eksplisit).",
                },
            },
            "required": ["action"],
        },
    },
```

Define `ManageVaultArgs` in `rezekify/agent/tools.py`:
```python
from rezekify.api.v1.vaults_router import advance_one_month
from rezekify.db.models import Vault, VaultType

class ManageVaultArgs(BaseModel):
    action: str
    vault_name: Optional[str] = None
    amount: Optional[Decimal] = None
    account_name: Optional[str] = None
    lock_state: Optional[bool] = None

    @model_validator(mode="before")
    @classmethod
    def sanitize(cls, data: Any) -> Any:
        if isinstance(data, dict):
            d = dict(data)
            if "action" in d and isinstance(d["action"], str):
                d["action"] = d["action"].strip().lower()
            if d.get("amount") is not None:
                try:
                    d["amount"] = Decimal(str(d["amount"]))
                except Exception:
                    d["amount"] = None
            return d
        return data
```

Add `_dispatch_manage_vault` in `AgentToolDispatcher`:
```python
    def _dispatch_manage_vault(self, user_id: UUID, arguments: Dict[str, Any]) -> Dict[str, Any]:
        validated = ManageVaultArgs(**arguments)
        action = validated.action

        if action == "check_status":
            query = self.db.query(Vault).filter(Vault.user_id == user_id)
            if validated.vault_name:
                vault = query.filter(Vault.name.ilike(f"%{validated.vault_name.strip()}%")).first()
                if not vault:
                    return {"status": "error", "message": f"Vault '{validated.vault_name}' tidak ditemukan."}
                pct = int(round((vault.allocated_amount / vault.target_amount) * 100)) if vault.target_amount > 0 else 100
                return {
                    "status": "success",
                    "vault": {
                        "id": str(vault.id),
                        "name": vault.name,
                        "vault_type": vault.vault_type.value,
                        "allocated_amount": vault.allocated_amount,
                        "target_amount": vault.target_amount,
                        "percentage": pct,
                        "is_locked": vault.is_locked,
                        "target_date": vault.target_date.isoformat() if vault.target_date else None,
                    },
                }
            all_vaults = query.all()
            return {
                "status": "success",
                "vaults": [
                    {
                        "id": str(v.id),
                        "name": v.name,
                        "vault_type": v.vault_type.value,
                        "allocated_amount": v.allocated_amount,
                        "target_amount": v.target_amount,
                        "percentage": int(round((v.allocated_amount / v.target_amount) * 100)) if v.target_amount > 0 else 100,
                        "is_locked": v.is_locked,
                    }
                    for v in all_vaults
                ],
            }

        if not validated.vault_name:
            return {"status": "error", "message": "Parameter 'vault_name' wajib diisi."}

        vault = (
            self.db.query(Vault)
            .filter(Vault.user_id == user_id, Vault.name.ilike(f"%{validated.vault_name.strip()}%"))
            .first()
        )
        if not vault:
            return {"status": "error", "message": f"Vault '{validated.vault_name}' tidak ditemukan."}

        if action == "deposit":
            if not validated.amount or validated.amount <= 0:
                return {"status": "error", "message": "Nominal deposit harus lebih besar dari 0."}
            if validated.account_name:
                acc = (
                    self.db.query(Account)
                    .filter(Account.user_id == user_id, Account.name.ilike(f"%{validated.account_name.strip()}%"))
                    .first()
                )
                if acc and acc.current_balance < validated.amount:
                    return {
                        "status": "error",
                        "message": f"Saldo akun '{acc.name}' (Rp {acc.current_balance:,.0f}) tidak mencukupi untuk deposit Rp {validated.amount:,.0f}.",
                    }

            vault.allocated_amount += validated.amount
            vault.is_locked = True
            self.db.commit()
            self.db.refresh(vault)
            RunwayService.clear_cache(user_id=user_id)
            pct = int(round((vault.allocated_amount / vault.target_amount) * 100)) if vault.target_amount > 0 else 100
            return {
                "status": "success",
                "message": f"Berhasil menabung Rp {validated.amount:,.0f} ke {vault.name}. Total terkumpul: Rp {vault.allocated_amount:,.0f} ({pct}%).",
                "vault": {
                    "id": str(vault.id),
                    "name": vault.name,
                    "allocated_amount": vault.allocated_amount,
                    "target_amount": vault.target_amount,
                    "is_locked": vault.is_locked,
                    "percentage": pct,
                },
            }

        elif action == "pay_bill":
            acc = None
            if validated.account_name:
                acc = (
                    self.db.query(Account)
                    .filter(Account.user_id == user_id, Account.name.ilike(f"%{validated.account_name.strip()}%"))
                    .first()
                )
            if not acc:
                acc = (
                    self.db.query(Account)
                    .filter(Account.user_id == user_id, Account.is_active.is_(True))
                    .order_by(Account.current_balance.desc())
                    .first()
                )
            if not acc:
                return {"status": "error", "message": "Akun sumber dana tidak ditemukan atau tidak tersedia."}

            pay_amount = validated.amount or vault.target_amount or vault.allocated_amount
            if not pay_amount or pay_amount <= 0:
                return {"status": "error", "message": "Nominal pembayaran tidak valid."}
            if acc.current_balance < pay_amount:
                return {
                    "status": "error",
                    "message": f"Saldo akun '{acc.name}' (Rp {acc.current_balance:,.0f}) tidak mencukupi untuk bayar tagihan Rp {pay_amount:,.0f}.",
                }

            cat = (
                self.db.query(Category)
                .filter(
                    Category.user_id == user_id,
                    Category.category_type == CategoryType.EXPENSE,
                    Category.name.ilike("%Tagihan%"),
                )
                .first()
            )
            if not cat:
                cat = Category(user_id=user_id, name="Tagihan", category_type=CategoryType.EXPENSE)
                self.db.add(cat)
                self.db.flush()

            tx = self.ledger_service.record_expense(
                user_id=user_id,
                account_id=acc.id,
                category_id=cat.id,
                amount=pay_amount,
                description=f"Pembayaran tagihan: {vault.name}",
                source_channel="AI_AGENT",
            )
            vault.allocated_amount = Decimal("0.00")
            if vault.target_date:
                vault.target_date = advance_one_month(vault.target_date)

            self.db.commit()
            self.db.refresh(vault)
            RunwayService.clear_cache(user_id=user_id)
            return {
                "status": "success",
                "message": f"Tagihan '{vault.name}' sebesar Rp {pay_amount:,.0f} berhasil dibayar melalui {acc.name}. Jatuh tempo diperbarui ke {vault.target_date.isoformat() if vault.target_date else '-'}.",
                "vault": {
                    "id": str(vault.id),
                    "name": vault.name,
                    "allocated_amount": vault.allocated_amount,
                    "target_date": vault.target_date.isoformat() if vault.target_date else None,
                    "is_locked": vault.is_locked,
                },
                "transaction_id": str(tx.id),
            }

        elif action == "toggle_lock":
            if validated.lock_state is not None:
                vault.is_locked = validated.lock_state
            else:
                vault.is_locked = not vault.is_locked
            self.db.commit()
            self.db.refresh(vault)
            RunwayService.clear_cache(user_id=user_id)
            state_text = "terkunci" if vault.is_locked else "terbuka"
            return {
                "status": "success",
                "message": f"Vault '{vault.name}' sekarang {state_text}.",
                "vault": {
                    "id": str(vault.id),
                    "name": vault.name,
                    "is_locked": vault.is_locked,
                },
            }

        return {"status": "error", "message": f"Aksi '{action}' tidak dikenali."}
```

In `rezekify/agent/runtime.py`:
In `build_cognitive_system_prompt()`:
Add to `[DAFTAR ALAT TERSEDIA]`:
```text
5. manage_vault(action, vault_name, amount, account_name, lock_state)
```
In `parse_agent_turn()`:
Add fallback thought for `manage_vault`:
```python
                elif "manage_vault" in cleaned_text:
                    thought = "Mengelola alokasi pos komitmen dan tabungan (vault) pengguna."
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --no-project pytest -x tests/test_manage_vault_tool.py`
Expected: 7 passed in <1s with exit code 0.

- [ ] **Step 5: Commit**

```bash
git add tests/test_manage_vault_tool.py rezekify/agent/tools.py rezekify/agent/runtime.py
git commit -m "feat(agent): register manage_vault ReAct tool for autonomous vault operations"
```

---

### Task 3: Frontend Types & API Client Methods (`depositVault`, `payBillVault`)

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/services/apiClient.ts`
- Modify: `frontend/src/__tests__/apiClient.test.ts`

**Interfaces:**
- Consumes: `apiFetch` in `frontend/src/services/apiClient.ts`.
- Produces:
  - `VaultDepositRequest`: `{ amount: number; source_account_id?: string | null; }`
  - `VaultPayBillRequest`: `{ account_id: string; category_id?: string | null; amount?: number | null; notes?: string | null; }`
  - `VaultPayBillResponse`: `{ vault: Vault; transaction: Transaction; }`
  - `depositVault(id: string, data: VaultDepositRequest): Promise<Vault>`
  - `payBillVault(id: string, data: VaultPayBillRequest): Promise<VaultPayBillResponse>`

- [ ] **Step 1: Write the failing tests in `frontend/src/__tests__/apiClient.test.ts`**

Add tests to `frontend/src/__tests__/apiClient.test.ts`:

```typescript
  it('depositVault sends POST /vaults/:id/deposit with body', async () => {
    setAuthToken('sample-token');
    const mockVault: Vault = {
      id: 'v-123',
      name: 'Dana Darurat',
      vault_type: 'SAVINGS',
      target_amount: 5000000,
      allocated_amount: 1500000,
      is_locked: true,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockVault,
    });

    const res = await depositVault('v-123', { amount: 500000, source_account_id: 'acc-1' });
    expect(res).toEqual(mockVault);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/vaults/v-123/deposit',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ amount: 500000, source_account_id: 'acc-1' }),
      })
    );
  });

  it('payBillVault sends POST /vaults/:id/pay-bill with body', async () => {
    setAuthToken('sample-token');
    const mockResponse: VaultPayBillResponse = {
      vault: {
        id: 'v-456',
        name: 'Listrik PLN',
        vault_type: 'FIXED_BILL',
        target_amount: 500000,
        allocated_amount: 0,
        target_date: '2026-11-20',
        is_locked: true,
      },
      transaction: {
        id: 'tx-999',
        description: 'Pembayaran tagihan: Listrik PLN',
        source_channel: 'WEB_UI',
        transaction_date: '2026-10-20T10:00:00Z',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const res = await payBillVault('v-456', { account_id: 'acc-1', amount: 500000 });
    expect(res).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/vaults/v-456/pay-bill',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ account_id: 'acc-1', amount: 500000 }),
      })
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- src/__tests__/apiClient.test.ts`
Expected: FAIL (`depositVault is not defined` / `payBillVault is not defined`).

- [ ] **Step 3: Write minimal implementation in `types/api.ts` and `services/apiClient.ts`**

In `frontend/src/types/api.ts`:
```typescript
export interface VaultDepositRequest {
  amount: number;
  source_account_id?: string | null;
}

export interface VaultPayBillRequest {
  account_id: string;
  category_id?: string | null;
  amount?: number | null;
  notes?: string | null;
}

export interface VaultPayBillResponse {
  vault: Vault;
  transaction: Transaction;
}
```

In `frontend/src/services/apiClient.ts`:
Import `VaultDepositRequest`, `VaultPayBillRequest`, `VaultPayBillResponse` from `../types/api`, and export functions:

```typescript
export async function depositVault(
  id: string,
  data: VaultDepositRequest
): Promise<Vault> {
  return apiFetch<Vault>(`/vaults/${id}/deposit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function payBillVault(
  id: string,
  data: VaultPayBillRequest
): Promise<VaultPayBillResponse> {
  return apiFetch<VaultPayBillResponse>(`/vaults/${id}/pay-bill`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- src/__tests__/apiClient.test.ts`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/services/apiClient.ts frontend/src/__tests__/apiClient.test.ts
git commit -m "feat(frontend): add depositVault and payBillVault client methods and request types"
```

---

### Task 4: Frontend Modals (`DepositVaultModal.tsx` and `PayBillModal.tsx`)

**Files:**
- Create: `frontend/src/components/DepositVaultModal.tsx`
- Create: `frontend/src/components/PayBillModal.tsx`
- Create: `frontend/src/__tests__/VaultModals.test.tsx`

**Interfaces:**
- Consumes: `Vault`, `Account`, `Category`, `depositVault`, `payBillVault`, `formatRupiah`, `@heroui/react` Modal components.
- Produces:
  - `DepositVaultModal`: Modal with input, chips (+50k, +100k, +250k, +500k), source account select, progress bar telemetry.
  - `PayBillModal`: Modal with bill info, account select, custom/default amount, explanation banner on rollover.

- [ ] **Step 1: Write the failing tests in `frontend/src/__tests__/VaultModals.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DepositVaultModal } from '../components/DepositVaultModal';
import { PayBillModal } from '../components/PayBillModal';
import { Account, Vault } from '../types/api';
import * as apiClient from '../services/apiClient';

describe('VaultModals Components', () => {
  const sampleSavingsVault: Vault = {
    id: 'vault-sav-1',
    name: 'Dana Darurat',
    vault_type: 'SAVINGS',
    target_amount: 5000000,
    allocated_amount: 1000000,
    is_locked: false,
  };

  const sampleBillVault: Vault = {
    id: 'vault-bill-1',
    name: 'Internet IndiHome',
    vault_type: 'FIXED_BILL',
    target_amount: 450000,
    allocated_amount: 450000,
    target_date: '2026-10-25',
    is_locked: true,
  };

  const sampleAccounts: Account[] = [
    { id: 'acc-1', name: 'BCA Utama', account_type: 'BANK', current_balance: 2000000, is_active: true },
    { id: 'acc-2', name: 'Dompet Cash', account_type: 'CASH', current_balance: 50000, is_active: true },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('DepositVaultModal', () => {
    it('renders vault name, current progress, and quick nominal chips', () => {
      render(
        <DepositVaultModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          vault={sampleSavingsVault}
          accounts={sampleAccounts}
        />
      );

      expect(screen.getByText(/Nabung ke Dana Darurat/i)).toBeInTheDocument();
      expect(screen.getByText('+50rb')).toBeInTheDocument();
      expect(screen.getByText('+100rb')).toBeInTheDocument();
      expect(screen.getByText('+250rb')).toBeInTheDocument();
      expect(screen.getByText('+500rb')).toBeInTheDocument();
    });

    it('increments amount when quick chips are clicked', () => {
      render(
        <DepositVaultModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          vault={sampleSavingsVault}
          accounts={sampleAccounts}
        />
      );

      const input = screen.getByLabelText(/Nominal Tambahan/i) as HTMLInputElement;
      expect(input.value).toBe('');

      fireEvent.click(screen.getByText('+50rb'));
      expect(input.value).toBe('50000');

      fireEvent.click(screen.getByText('+100rb'));
      expect(input.value).toBe('150000');
    });

    it('submits deposit successfully and calls onSuccess', async () => {
      const handleSuccess = vi.fn();
      const depositSpy = vi.spyOn(apiClient, 'depositVault').mockResolvedValue({
        ...sampleSavingsVault,
        allocated_amount: 1100000,
        is_locked: true,
      });

      render(
        <DepositVaultModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={handleSuccess}
          vault={sampleSavingsVault}
          accounts={sampleAccounts}
        />
      );

      fireEvent.click(screen.getByText('+100rb'));
      const submitBtn = screen.getByRole('button', { name: /Simpan Alokasi/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(depositSpy).toHaveBeenCalledWith('vault-sav-1', {
          amount: 100000,
          source_account_id: null,
        });
        expect(handleSuccess).toHaveBeenCalled();
      });
    });

    it('displays error message when deposit API fails', async () => {
      vi.spyOn(apiClient, 'depositVault').mockRejectedValue(new Error('Saldo akun tidak cukup'));

      render(
        <DepositVaultModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          vault={sampleSavingsVault}
          accounts={sampleAccounts}
        />
      );

      fireEvent.click(screen.getByText('+50rb'));
      const submitBtn = screen.getByRole('button', { name: /Simpan Alokasi/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Saldo akun tidak cukup')).toBeInTheDocument();
      });
    });
  });

  describe('PayBillModal', () => {
    it('renders bill details, rollover explanation, and default amount', () => {
      render(
        <PayBillModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          vault={sampleBillVault}
          accounts={sampleAccounts}
        />
      );

      expect(screen.getByText(/Bayar Tagihan: Internet IndiHome/i)).toBeInTheDocument();
      expect(screen.getByText(/buku besar/i)).toBeInTheDocument();
      expect(screen.getByText(/bulan depan/i)).toBeInTheDocument();

      const input = screen.getByLabelText(/Nominal Pembayaran/i) as HTMLInputElement;
      expect(input.value).toBe('450000');
    });

    it('submits bill payment with selected account and triggers onSuccess', async () => {
      const handleSuccess = vi.fn();
      const paySpy = vi.spyOn(apiClient, 'payBillVault').mockResolvedValue({
        vault: { ...sampleBillVault, allocated_amount: 0, target_date: '2026-11-25' },
        transaction: { id: 'tx-1', description: 'Pembayaran tagihan', source_channel: 'WEB_UI', transaction_date: '2026-10-25' },
      });

      render(
        <PayBillModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={handleSuccess}
          vault={sampleBillVault}
          accounts={sampleAccounts}
        />
      );

      const select = screen.getByLabelText(/Sumber Rekening Pembayaran/i);
      fireEvent.change(select, { target: { value: 'acc-1' } });

      const submitBtn = screen.getByRole('button', { name: /Konfirmasi & Bayar Tagihan/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(paySpy).toHaveBeenCalledWith('vault-bill-1', {
          account_id: 'acc-1',
          amount: 450000,
          notes: '',
        });
        expect(handleSuccess).toHaveBeenCalled();
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- src/__tests__/VaultModals.test.tsx`
Expected: FAIL (Cannot find modules `../components/DepositVaultModal` and `../components/PayBillModal`).

- [ ] **Step 3: Write minimal implementation for `DepositVaultModal.tsx` and `PayBillModal.tsx`**

Create `frontend/src/components/DepositVaultModal.tsx`:

```tsx
import React, { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
import { PiggyBank, Loader2, AlertCircle } from 'lucide-react';
import { Account, Vault } from '../types/api';
import { depositVault } from '../services/apiClient';
import { formatRupiah } from '../utils/formatters';

export interface DepositVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  vault: Vault | null;
  accounts: Account[];
}

const QUICK_CHIPS = [
  { label: '+50rb', amount: 50000 },
  { label: '+100rb', amount: 100000 },
  { label: '+250rb', amount: 250000 },
  { label: '+500rb', amount: 500000 },
];

export const DepositVaultModal: React.FC<DepositVaultModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  vault,
  accounts,
}) => {
  const [amountStr, setAmountStr] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!vault) return null;

  const currentAllocated = vault.allocated_amount || 0;
  const target = vault.target_amount || 0;
  const depositNum = parseFloat(amountStr) || 0;
  const projectedAllocated = currentAllocated + depositNum;
  const projectedPct = target > 0 ? Math.min(100, Math.round((projectedAllocated / target) * 100)) : 100;

  const handleAddChip = (chipAmount: number) => {
    const current = parseFloat(amountStr) || 0;
    setAmountStr((current + chipAmount).toString());
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (depositNum <= 0) {
      setErrorMessage('Nominal tambahan harus lebih besar dari 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await depositVault(vault.id, {
        amount: depositNum,
        source_account_id: selectedAccountId || null,
      });
      await onSuccess();
      onClose();
      setAmountStr('');
      setSelectedAccountId('');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menambahkan alokasi ke vault.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
      backdrop="blur"
      classNames={{
        base: 'bg-white/95 dark:bg-[#141417]/95 border border-slate-200/80 dark:border-zinc-800/80 rounded-[32px] shadow-2xl p-6 max-w-md w-full',
      }}
    >
      <ModalContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <ModalHeader className="p-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <PiggyBank className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Nabung ke {vault.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                Terkumpul saat ini: {formatRupiah(currentAllocated)} / {formatRupiah(target)}
              </p>
            </div>
          </ModalHeader>

          <ModalBody className="p-0 space-y-4">
            {errorMessage && (
              <div role="alert" className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-600 dark:text-rose-300 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Nominal Input */}
            <div className="space-y-1.5">
              <label htmlFor="deposit-amount-input" className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Nominal Tambahan
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 dark:text-zinc-500">
                  Rp
                </span>
                <input
                  id="deposit-amount-input"
                  type="number"
                  min="1"
                  step="any"
                  required
                  placeholder="0"
                  value={amountStr}
                  onChange={(e) => {
                    setAmountStr(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="w-full pl-12 pr-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            {/* Quick Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => handleAddChip(chip.amount)}
                  className="px-3 py-1.5 rounded-xl text-xs font-extrabold bg-slate-100 dark:bg-zinc-800 hover:bg-emerald-500/15 text-slate-700 dark:text-zinc-300 hover:text-emerald-500 border border-slate-200 dark:border-zinc-700/80 transition-all min-h-[38px] flex items-center justify-center cursor-pointer select-none"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Account Selector (Optional verification) */}
            <div className="space-y-1.5">
              <label htmlFor="source-account-select" className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Verifikasi Saldo Rekening (Opsional)
              </label>
              <select
                id="source-account-select"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="">Pilih rekening sumber (opsional)</option>
                {accounts.filter(a => a.is_active).map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} — {formatRupiah(acc.current_balance)}
                  </option>
                ))}
              </select>
            </div>

            {/* Projection Card */}
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1.5">
              <div className="flex items-center justify-between font-bold text-slate-700 dark:text-zinc-300">
                <span>Proyeksi Terkumpul:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">
                  {formatRupiah(projectedAllocated)} ({projectedPct}%)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed font-medium">
                Dana akan langsung dikunci (<span className="text-emerald-500 font-bold">is_locked</span>) agar kas operasional harian terlindungi.
              </p>
            </div>
          </ModalBody>

          <ModalFooter className="p-0 pt-2 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="light"
              size="sm"
              onPress={onClose}
              isDisabled={isSubmitting}
              className="text-xs font-bold text-slate-500 dark:text-zinc-400 min-h-[38px] rounded-xl"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              isDisabled={isSubmitting || depositNum <= 0}
              className="bg-gradient-to-r from-[#0F766E] to-[#10B981] text-white font-extrabold text-xs min-h-[38px] px-5 rounded-2xl shadow-lg shadow-emerald-900/20"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Alokasi'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};
```

Create `frontend/src/components/PayBillModal.tsx`:

```tsx
import React, { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
import { Receipt, Loader2, AlertCircle, Calendar } from 'lucide-react';
import { Account, Vault } from '../types/api';
import { payBillVault } from '../services/apiClient';
import { formatRupiah } from '../utils/formatters';

export interface PayBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  vault: Vault | null;
  accounts: Account[];
}

export const PayBillModal: React.FC<PayBillModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  vault,
  accounts,
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts.find(a => a.is_active)?.id || ''
  );
  const [amountStr, setAmountStr] = useState<string>(
    vault?.target_amount ? vault.target_amount.toString() : ''
  );
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!vault) return null;

  const payAmount = parseFloat(amountStr) || vault.target_amount || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) {
      setErrorMessage('Pilih rekening untuk pembayaran tagihan.');
      return;
    }
    if (payAmount <= 0) {
      setErrorMessage('Nominal pembayaran harus lebih besar dari 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await payBillVault(vault.id, {
        account_id: selectedAccountId,
        amount: payAmount,
        notes: notes.trim(),
      });
      await onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal memproses pembayaran tagihan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
      backdrop="blur"
      classNames={{
        base: 'bg-white/95 dark:bg-[#141417]/95 border border-slate-200/80 dark:border-zinc-800/80 rounded-[32px] shadow-2xl p-6 max-w-md w-full',
      }}
    >
      <ModalContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <ModalHeader className="p-0 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                Bayar Tagihan: {vault.name}
              </h2>
              {vault.target_date && (
                <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium flex items-center gap-1 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  Jatuh tempo: {vault.target_date}
                </p>
              )}
            </div>
          </ModalHeader>

          <ModalBody className="p-0 space-y-4">
            {errorMessage && (
              <div role="alert" className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-600 dark:text-rose-300 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Account Selector */}
            <div className="space-y-1.5">
              <label htmlFor="pay-bill-account-select" className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Sumber Rekening Pembayaran
              </label>
              <select
                id="pay-bill-account-select"
                required
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value);
                  setErrorMessage(null);
                }}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                <option value="">Pilih rekening</option>
                {accounts.filter(a => a.is_active).map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} — Saldo: {formatRupiah(acc.current_balance)}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount Input */}
            <div className="space-y-1.5">
              <label htmlFor="pay-bill-amount-input" className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Nominal Pembayaran
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 dark:text-zinc-500">
                  Rp
                </span>
                <input
                  id="pay-bill-amount-input"
                  type="number"
                  min="1"
                  step="any"
                  required
                  placeholder="0"
                  value={amountStr}
                  onChange={(e) => {
                    setAmountStr(e.target.value);
                    setErrorMessage(null);
                  }}
                  className="w-full pl-12 pr-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label htmlFor="pay-bill-notes-input" className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Catatan (Opsional)
              </label>
              <input
                id="pay-bill-notes-input"
                type="text"
                placeholder="misal: Periode Oktober 2026"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            {/* Explanation card */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1 text-slate-600 dark:text-zinc-400 font-medium">
              <p className="font-bold text-amber-700 dark:text-amber-400">
                Pencatatan Otomatis & Siklus Baru:
              </p>
              <p className="text-[11px] leading-relaxed">
                Pembayaran akan dicatat di buku besar, memotong saldo rekening, mengosongkan alokasi terkumpul, dan memajukan jatuh tempo tagihan ke bulan depan.
              </p>
            </div>
          </ModalBody>

          <ModalFooter className="p-0 pt-2 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="light"
              size="sm"
              onPress={onClose}
              isDisabled={isSubmitting}
              className="text-xs font-bold text-slate-500 dark:text-zinc-400 min-h-[38px] rounded-xl"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              isDisabled={isSubmitting || !selectedAccountId || payAmount <= 0}
              className="bg-gradient-to-r from-amber-600 to-amber-500 text-white font-extrabold text-xs min-h-[38px] px-5 rounded-2xl shadow-lg shadow-amber-900/20"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Konfirmasi & Bayar Tagihan'}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- src/__tests__/VaultModals.test.tsx`
Expected: 6 passed with exit code 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/DepositVaultModal.tsx frontend/src/components/PayBillModal.tsx frontend/src/__tests__/VaultModals.test.tsx
git commit -m "feat(ui): create DepositVaultModal and PayBillModal with quick chips and rollover preview"
```

---

### Task 5: Frontend Integration on `VaultCard.tsx`, `VaultsView.tsx`, and `OverviewView.tsx`

**Files:**
- Modify: `frontend/src/components/VaultCard.tsx`
- Modify: `frontend/src/hooks/useDashboardModals.ts`
- Modify: `frontend/src/components/VaultsView.tsx`
- Modify: `frontend/src/components/OverviewView.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/__tests__/VaultCard.test.tsx`

**Interfaces:**
- Consumes: `VaultCardProps` with new `onDeposit?: (vault: Vault) => void` and `onPayBill?: (vault: Vault) => void`.
- Produces:
  - Contextual action buttons in `VaultCard`:
    - SAVINGS: `+ Nabung` button (`data-testid="vault-deposit-btn"`).
    - FIXED_BILL: `Bayar Tagihan` button (`data-testid="vault-pay-bill-btn"`).
  - Modal controls in `useDashboardModals`: `isDepositModalOpen`, `selectedVaultForDeposit`, `openDepositModal`, `closeDepositModal`, `isPayBillModalOpen`, `selectedVaultForPayBill`, `openPayBillModal`, `closePayBillModal`.
  - Wired interactions in `VaultsView` and `OverviewView` triggering modals and refreshing data.

- [ ] **Step 1: Write the failing tests in `frontend/src/__tests__/VaultCard.test.tsx`**

Add tests to `frontend/src/__tests__/VaultCard.test.tsx`:

```tsx
  it('renders "+ Nabung" button for SAVINGS vault and triggers onDeposit', () => {
    const handleDeposit = vi.fn();
    render(
      <VaultCard
        vault={sampleSavingsVault}
        onToggleLock={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onDeposit={handleDeposit}
      />
    );

    const depositBtn = screen.getByTestId('vault-deposit-btn');
    expect(depositBtn).toBeInTheDocument();
    expect(depositBtn).toHaveTextContent('+ Nabung');

    fireEvent.click(depositBtn);
    expect(handleDeposit).toHaveBeenCalledWith(sampleSavingsVault);
  });

  it('renders "Bayar Tagihan" button for FIXED_BILL vault and triggers onPayBill', () => {
    const handlePayBill = vi.fn();
    render(
      <VaultCard
        vault={sampleFixedBillVault}
        onToggleLock={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onPayBill={handlePayBill}
      />
    );

    const payBtn = screen.getByTestId('vault-pay-bill-btn');
    expect(payBtn).toBeInTheDocument();
    expect(payBtn).toHaveTextContent('Bayar Tagihan');

    fireEvent.click(payBtn);
    expect(handlePayBill).toHaveBeenCalledWith(sampleFixedBillVault);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- src/__tests__/VaultCard.test.tsx`
Expected: FAIL (`Unable to find an element by: [data-testid="vault-deposit-btn"]`).

- [ ] **Step 3: Write minimal implementation in components and hooks**

1. In `frontend/src/components/VaultCard.tsx`:
Add `onDeposit` and `onPayBill` to `VaultCardProps`:
```tsx
export interface VaultCardProps {
  vault: Vault;
  onToggleLock: (id: string) => Promise<void> | void;
  onEdit: (vault: Vault) => void;
  onDelete: (id: string) => Promise<void> | void;
  onDeposit?: (vault: Vault) => void;
  onPayBill?: (vault: Vault) => void;
  isTogglingLock?: boolean;
  isDeleting?: boolean;
}
```

At the bottom of `VaultCard.tsx` (before the closing `</div>`), add the contextual action button:
```tsx
      {/* Contextual Action Trigger */}
      <div className="pt-1">
        {isFixedBill ? (
          <Button
            size="sm"
            data-testid="vault-pay-bill-btn"
            onPress={() => onPayBill?.(vault)}
            aria-label={`Bayar tagihan ${vault.name}`}
            startContent={<Receipt className="w-3.5 h-3.5" />}
            className="w-full min-h-[38px] rounded-xl text-xs font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all"
          >
            Bayar Tagihan
          </Button>
        ) : (
          <Button
            size="sm"
            data-testid="vault-deposit-btn"
            onPress={() => onDeposit?.(vault)}
            aria-label={`Nabung ke ${vault.name}`}
            startContent={<PiggyBank className="w-3.5 h-3.5" />}
            className="w-full min-h-[38px] rounded-xl text-xs font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all"
          >
            + Nabung
          </Button>
        )}
      </div>
```

2. In `frontend/src/hooks/useDashboardModals.ts`:
Add states and callbacks:
```tsx
  const [isDepositModalOpen, setIsDepositModalOpen] = useState<boolean>(false);
  const [selectedVaultForDeposit, setSelectedVaultForDeposit] = useState<Vault | null>(null);

  const [isPayBillModalOpen, setIsPayBillModalOpen] = useState<boolean>(false);
  const [selectedVaultForPayBill, setSelectedVaultForPayBill] = useState<Vault | null>(null);

  const openDepositModal = useCallback((vault: Vault) => {
    setSelectedVaultForDeposit(vault);
    setIsDepositModalOpen(true);
  }, []);

  const closeDepositModal = useCallback(() => {
    setIsDepositModalOpen(false);
    setSelectedVaultForDeposit(null);
  }, []);

  const openPayBillModal = useCallback((vault: Vault) => {
    setSelectedVaultForPayBill(vault);
    setIsPayBillModalOpen(true);
  }, []);

  const closePayBillModal = useCallback(() => {
    setIsPayBillModalOpen(false);
    setSelectedVaultForPayBill(null);
  }, []);
```
Return these new properties from `useDashboardModals`.

3. In `frontend/src/components/VaultsView.tsx`:
Add `onDepositVault?: (vault: Vault) => void` and `onPayBillVault?: (vault: Vault) => void` to `VaultsViewProps`, and pass them to `VaultCard`:
```tsx
            <VaultCard
              key={vault.id}
              vault={vault}
              onToggleLock={onToggleLock}
              onEdit={onEditVault}
              onDelete={onDeleteVault}
              onDeposit={onDepositVault}
              onPayBill={onPayBillVault}
            />
```

4. In `frontend/src/components/OverviewView.tsx`:
Add `onDepositVault?: (vault: Vault) => void` and `onPayBillVault?: (vault: Vault) => void` to `OverviewViewProps`.
Inside the vault card slice map, render quick action buttons `Nabung` or `Bayar`:
```tsx
                        <div className="flex items-center justify-between text-[11px] font-mono font-bold tabular-nums">
                          <span className="text-slate-900 dark:text-white">{formatRupiah(vault.allocated_amount)}</span>
                          <span className="text-slate-400 dark:text-zinc-500">/ {formatRupiah(vault.target_amount)}</span>
                        </div>

                        {(onDepositVault || onPayBillVault) && (
                          <div className="pt-2">
                            {vault.vault_type === 'FIXED_BILL' ? (
                              <button
                                type="button"
                                onClick={() => onPayBillVault?.(vault)}
                                className="w-full py-1.5 px-3 rounded-xl text-[11px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all text-center min-h-[38px] flex items-center justify-center cursor-pointer select-none"
                              >
                                Bayar Tagihan
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onDepositVault?.(vault)}
                                className="w-full py-1.5 px-3 rounded-xl text-[11px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all text-center min-h-[38px] flex items-center justify-center cursor-pointer select-none"
                              >
                                + Nabung
                              </button>
                            )}
                          </div>
                        )}
```

5. In `frontend/src/pages/DashboardPage.tsx`:
- Import lazy modals:
```tsx
const DepositVaultModal = React.lazy(() => import('../components/DepositVaultModal').then(m => ({ default: m.DepositVaultModal })));
const PayBillModal = React.lazy(() => import('../components/PayBillModal').then(m => ({ default: m.PayBillModal })));
```
- Pass `onDepositVault={modals.openDepositModal}` and `onPayBillVault={modals.openPayBillModal}` to both `OverviewView` and `VaultsView`.
- Render `DepositVaultModal` and `PayBillModal`:
```tsx
          {modals.isDepositModalOpen && (
            <DepositVaultModal
              isOpen={modals.isDepositModalOpen}
              onClose={modals.closeDepositModal}
              onSuccess={async () => {
                modals.closeDepositModal();
                await refreshAllData();
              }}
              vault={modals.selectedVaultForDeposit}
              accounts={dashboard.accounts}
            />
          )}

          {modals.isPayBillModalOpen && (
            <PayBillModal
              isOpen={modals.isPayBillModalOpen}
              onClose={modals.closePayBillModal}
              onSuccess={async () => {
                modals.closePayBillModal();
                await refreshAllData();
              }}
              vault={modals.selectedVaultForPayBill}
              accounts={dashboard.accounts}
            />
          )}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npm --prefix frontend test -- src/__tests__/VaultCard.test.tsx`
Run: `npm --prefix frontend test -- src/__tests__/VaultModals.test.tsx`
Run: `npm --prefix frontend test -- src/__tests__/useDashboardModals.test.ts`
Run: `npm --prefix frontend test -- src/__tests__/OverviewView.test.tsx`
Run: `uv run --no-project pytest -x tests/test_vault_operations.py tests/test_manage_vault_tool.py`
Expected: ALL PASS with exit code 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/VaultCard.tsx frontend/src/components/VaultsView.tsx frontend/src/components/OverviewView.tsx frontend/src/hooks/useDashboardModals.ts frontend/src/pages/DashboardPage.tsx frontend/src/__tests__/VaultCard.test.tsx
git commit -m "feat(ui): integrate quick deposit and pay bill actions into VaultCard, views, and DashboardPage"
```

---

## Plan Self-Review Checklist

- [x] **Spec Coverage**: All items in `docs/superpowers/specs/2026-10-14-vault-quick-deposit-and-billing-cycle-design.md` mapped directly to Tasks 1 through 5.
- [x] **Zero Placeholders**: No `TODO`, no `// ...`, no `fill in details`. Full source code and test files are written explicitly.
- [x] **Type Consistency**: Request and response interfaces (`VaultDepositRequest`, `VaultPayBillRequest`, `VaultPayBillResponse`) match between Python Pydantic models in Task 1 and TypeScript interfaces in Task 3, 4, and 5.
- [x] **Review Focus**: All 5 edge cases (month date clamping, insufficient balance check, negative amount rejection, cross-tenant isolation, AI missing vault name handling) are explicitly verified in Task 1 and Task 2 test steps.
- [x] **Bounded Test Execution**: Pytest uses `uv run --no-project pytest -x` and Vitest uses `npm --prefix frontend test -- ...`.
