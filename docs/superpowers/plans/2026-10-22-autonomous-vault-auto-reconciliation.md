# Autonomous FIXED_BILL Vault Auto-Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement one-shot autonomous reconciliation and explicit manual linking of recurring FIXED_BILL vaults with double-entry ledger expense transactions, automatically clearing locked amounts, advancing monthly billing cycles, and surfacing audit badges in the cockpit.

**Architecture:** A dedicated reconciliation domain service (`rezekify/services/vault_reconciliation.py`) executes deterministic keyword/token matching and atomic settlement mutations ($\sum \text{Debit} = \sum \text{Credit}$, resetting `allocated_amount = 0.00`, rolling `target_date` by +1 month via deterministic calendar clamping, and stamping `LedgerEntry.vault_id`). The AI agent's `record_transaction` tool and the FastAPI `transactions_router.py` automatically detect or receive `vault_id` to settle the bill and purge the runway cache. The React frontend provides an optional vault selector in `ManualTransactionModal.tsx` and renders a violet locked-vault badge in `TransactionsTable.tsx`.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, pytest, React 19, TypeScript 5, Vite, HeroUI, Tailwind CSS, Lucide React, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-22-autonomous-vault-auto-reconciliation-design.md`

## Global Constraints

- **Financial Invariant (Zero Floating-Point Math):** All backend calculations strictly use `decimal.Decimal`. All frontend currency rendering uses integer formatting (`formatRupiah`).
- **Accounting Invariant (Deterministic Double-Entry Integrity):** Invariant $\sum \text{Debit} = \sum \text{Credit}$ must be preserved on all mutations. `LedgerEntry.vault_id` is an audit foreign key and never alters account balance arithmetic.
- **Security & Multi-Tenant Row Isolation:** All queries and mutations strictly filter `user_id == current_user.id`. Cross-tenant vault IDs passed to endpoints return `404 Not Found`.
- **Zero Balance Drift:** Reversal and re-post operations must ensure that historical ledger deletion and replacement preserve identical financial balance deltas.
- **Design Tokens & UI Standards:** Modern Zinc aesthetic (`#141417`, `#0c0c0e`, zinc/slate borders), minimum 38px touch targets, zero Cumulative Layout Shift (CLS), and WCAG AA contrast.

## Review Focus

1. **SAVINGS Vault Accidental Match:** Sinking funds for savings (e.g., "Tabungan Liburan", "Dana Darurat") must NEVER be auto-deducted, settled, or have their target date shifted by expense transactions. Query must strictly filter `vault_type == VaultType.FIXED_BILL` (`test_find_matching_vault_ignores_savings_vaults` in Task 1, `test_agent_expense_does_not_match_savings_vault` in Task 2).
2. **Ambiguous Vendor Keyword:** When a description matches multiple active `FIXED_BILL` vaults (e.g. "Listrik Rumah" and "Listrik Kantor") and the transaction amount does not uniquely resolve candidate ambiguity, matching must return `None` (unlinked expense fallback) rather than guessing (`test_ambiguous_vault_matching_returns_none` in Task 1, `test_agent_ambiguous_bill_falls_back_to_unlinked_expense` in Task 2).
3. **Already-Reconciled Bill in Same Cycle:** If a bill is already settled (`allocated_amount == 0.00` and `target_date` is in the future cycle), auto-matching should not double-advance cycle dates unless explicitly linked by `vault_id` (`test_already_reconciled_bill_behavior` in Task 1).
4. **Partial Payments:** When a logged expense is less than `vault.target_amount`, explicit linking resets `allocated_amount` to 0.00 and rolls cycle by +1 month per commitment specification; auto-matching without exact amount match declines ambiguous candidates (`test_partial_bill_payment_reconciliation` in Task 1).
5. **Manual Transaction Reversal-and-Repost of Bill Payments:** When an expense transaction linked to a vault is updated via `LedgerService.update_transaction` or deleted via `delete_transaction`, the debit entry's `vault_id` must be preserved on update and clean cascading deletion must not violate foreign key constraints (`test_update_transaction_preserves_vault_id` and `test_delete_reconciled_transaction_cascades` in Task 1).

---

### Task 1: Backend `reconcile_fixed_bill_vault` Service & Model Linking

**Files:**
- Create: `rezekify/services/vault_reconciliation.py`
- Modify: `rezekify/db/models.py:127-142,172-189`
- Modify: `rezekify/services/ledger.py:26-92,253-365,455-475`
- Create: `tests/test_vault_reconciliation_service.py`
- Modify: `tests/test_ledger_service.py`

**Interfaces:**
- Consumes: `Session`, `User`, `Vault`, `Transaction`, `LedgerEntry`, `EntryType`, `VaultType`, `RunwayService.clear_cache`
- Produces:
  - `class VaultReconciliationResult(BaseModel)`: fields `reconciled: bool`, `vault_id: Optional[UUID]`, `vault_name: Optional[str]`, `previous_due_date: Optional[date]`, `new_due_date: Optional[date]`, `previous_allocated_amount: Optional[Decimal]`, `settled_amount: Optional[Decimal]`
  - `advance_one_month(d: date) -> date` in `rezekify.services.vault_reconciliation`
  - `class VaultReconciliationService`:
    - `find_matching_fixed_bill_vault(user_id: UUID, description: str, amount: Optional[Decimal] = None) -> Optional[Vault]`
    - `reconcile_fixed_bill_vault(user_id: UUID, vault: Vault, transaction: Transaction, amount: Decimal) -> VaultReconciliationResult`
  - `LedgerService.reconcile_fixed_bill_vault(user_id: UUID, vault: Vault, transaction: Transaction, amount: Decimal) -> VaultReconciliationResult`
  - `LedgerService.record_expense(..., vault_id: Optional[UUID] = None) -> Transaction`
  - `Vault.ledger_entries` & `LedgerEntry.vault` ORM relationships in `rezekify/db/models.py`

- [ ] **Step 1: Write the failing tests in `tests/test_vault_reconciliation_service.py` and `tests/test_ledger_service.py`**

In `tests/test_vault_reconciliation_service.py`:
```python
from datetime import date
from decimal import Decimal
import pytest
from sqlalchemy.orm import Session

from rezekify.db.models import Account, AccountType, Category, CategoryType, EntryType, User, Vault, VaultType
from rezekify.services.ledger import LedgerService
from rezekify.services.vault_reconciliation import (
    VaultReconciliationService,
    advance_one_month,
)


@pytest.fixture
def recon_db(db_session: Session, sample_user: User):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("2000000.00"),
    )
    cat = Category(
        user_id=sample_user.id,
        name="Tagihan",
        category_type=CategoryType.EXPENSE,
    )
    v_wifi = Vault(
        user_id=sample_user.id,
        name="Wifi Indihome",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("350000.00"),
        allocated_amount=Decimal("350000.00"),
        target_date=date(2026, 10, 25),
        is_locked=True,
    )
    v_sav = Vault(
        user_id=sample_user.id,
        name="Dana Darurat",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("10000000.00"),
        allocated_amount=Decimal("2000000.00"),
        target_date=date(2026, 12, 31),
        is_locked=False,
    )
    db_session.add_all([acc, cat, v_wifi, v_sav])
    db_session.commit()
    return sample_user


def test_advance_one_month_clamping():
    assert advance_one_month(date(2026, 1, 31)) == date(2026, 2, 28)
    assert advance_one_month(date(2026, 3, 31)) == date(2026, 4, 30)
    assert advance_one_month(date(2026, 12, 15)) == date(2027, 1, 15)


def test_find_matching_vault_exact_and_substring(db_session: Session, recon_db: User):
    service = VaultReconciliationService(db_session)
    # Exact / substring match with Indonesian stop-words
    vault = service.find_matching_fixed_bill_vault(
        user_id=recon_db.id,
        description="Bayar tagihan wifi indihome bulan ini",
    )
    assert vault is not None
    assert vault.name == "Wifi Indihome"


def test_find_matching_vault_ignores_savings_vaults(db_session: Session, recon_db: User):
    # Review Focus 1: SAVINGS vault must never match
    service = VaultReconciliationService(db_session)
    vault = service.find_matching_fixed_bill_vault(
        user_id=recon_db.id,
        description="Topup tabungan Dana Darurat",
    )
    assert vault is None


def test_ambiguous_vault_matching_returns_none(db_session: Session, recon_db: User):
    # Review Focus 2: Ambiguous vendor keyword without exact amount returns None
    v2 = Vault(
        user_id=recon_db.id,
        name="Wifi Kantor",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("500000.00"),
        allocated_amount=Decimal("500000.00"),
        target_date=date(2026, 10, 20),
    )
    db_session.add(v2)
    db_session.commit()

    service = VaultReconciliationService(db_session)
    # Both "Wifi Indihome" and "Wifi Kantor" match token "wifi", ambiguous amount
    matched = service.find_matching_fixed_bill_vault(
        user_id=recon_db.id,
        description="Bayar wifi bulanan",
        amount=Decimal("100000.00"),
    )
    assert matched is None

    # Disambiguates if amount matches one vault's target_amount
    disambiguated = service.find_matching_fixed_bill_vault(
        user_id=recon_db.id,
        description="Bayar wifi bulanan",
        amount=Decimal("350000.00"),
    )
    assert disambiguated is not None
    assert disambiguated.name == "Wifi Indihome"


def test_reconcile_fixed_bill_vault_mutation(db_session: Session, recon_db: User):
    acc = db_session.query(Account).filter_by(user_id=recon_db.id).first()
    vault = db_session.query(Vault).filter_by(user_id=recon_db.id, name="Wifi Indihome").first()

    ledger = LedgerService(db_session)
    tx = ledger.record_expense(
        user_id=recon_db.id,
        account_id=acc.id,
        category_id=None,
        amount=Decimal("350000.00"),
        description="Bayar Wifi Indihome",
    )

    recon_service = VaultReconciliationService(db_session)
    res = recon_service.reconcile_fixed_bill_vault(
        user_id=recon_db.id,
        vault=vault,
        transaction=tx,
        amount=Decimal("350000.00"),
    )

    assert res.reconciled is True
    assert res.vault_name == "Wifi Indihome"
    assert res.new_due_date == date(2026, 11, 25)

    db_session.refresh(vault)
    assert vault.allocated_amount == Decimal("0.00")
    assert vault.target_date == date(2026, 11, 25)

    # Verify debit LedgerEntry.vault_id populated
    debit_entry = [e for e in tx.ledger_entries if e.entry_type == EntryType.DEBIT][0]
    assert debit_entry.vault_id == vault.id


def test_reconcile_cross_tenant_raises_error(db_session: Session, recon_db: User):
    other_user = User(
        email="intruder@test.com",
        password_hash="hash",
        full_name="Intruder",
    )
    db_session.add(other_user)
    db_session.commit()

    vault = db_session.query(Vault).filter_by(user_id=recon_db.id).first()
    acc = db_session.query(Account).filter_by(user_id=recon_db.id).first()
    ledger = LedgerService(db_session)
    tx = ledger.record_expense(
        user_id=recon_db.id,
        account_id=acc.id,
        category_id=None,
        amount=Decimal("10000.00"),
        description="Test",
    )

    service = VaultReconciliationService(db_session)
    with pytest.raises(ValueError, match="Access denied or tenant mismatch"):
        service.reconcile_fixed_bill_vault(
            user_id=other_user.id,
            vault=vault,
            transaction=tx,
            amount=Decimal("10000.00"),
        )
```

In `tests/test_ledger_service.py` (add Review Focus 5 and `vault_id` support):
```python
def test_record_expense_with_vault_id(db_session, sample_user):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("500000.00"),
    )
    vault = Vault(
        user_id=sample_user.id,
        name="Listrik PLN",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("200000.00"),
    )
    db_session.add_all([acc, vault])
    db_session.commit()

    service = LedgerService(db_session)
    tx = service.record_expense(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=None,
        amount=Decimal("200000.00"),
        description="Token Listrik",
        vault_id=vault.id,
    )
    debit_entry = [e for e in tx.ledger_entries if e.entry_type == EntryType.DEBIT][0]
    assert debit_entry.vault_id == vault.id


def test_update_transaction_preserves_vault_id(db_session, sample_user):
    # Review Focus 5: update_transaction preserves debit entry vault_id
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("500000.00"),
    )
    vault = Vault(
        user_id=sample_user.id,
        name="BPJS",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("100000.00"),
    )
    db_session.add_all([acc, vault])
    db_session.commit()

    service = LedgerService(db_session)
    tx = service.record_expense(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=None,
        amount=Decimal("100000.00"),
        description="BPJS Kesehatan",
        vault_id=vault.id,
    )

    updated_tx = service.update_transaction(
        user_id=sample_user.id,
        transaction_id=tx.id,
        amount=Decimal("105000.00"),
        description="BPJS Kesehatan + Admin",
        account_id=acc.id,
    )
    debit_entry = [e for e in updated_tx.ledger_entries if e.entry_type == EntryType.DEBIT][0]
    assert debit_entry.vault_id == vault.id
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --no-project pytest tests/test_vault_reconciliation_service.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'rezekify.services.vault_reconciliation'`

- [ ] **Step 3: Implement `VaultReconciliationService` and link models/ledger**

1. In `rezekify/db/models.py`:
   - Add `ledger_entries = relationship("LedgerEntry", back_populates="vault")` to `Vault`.
   - Add `vault = relationship("Vault", back_populates="ledger_entries")` to `LedgerEntry`.
2. In `rezekify/services/vault_reconciliation.py`:
   - Implement `STOP_WORDS = {"bayar", "tagihan", "beli", "bulan", "bulanan", "lunas", "ke", "di", "via", "pembayaran", "trx", "transfer", "biaya", "rek", "rekening", "nominal", "sebesar", "untuk", "buat", "pakai", "dari"}`
   - Implement `advance_one_month(d: date) -> date`: clamps `min(d.day, monthrange(year, month)[1])`.
   - Implement `VaultReconciliationResult(BaseModel)`.
   - Implement `VaultReconciliationService`:
     - `find_matching_fixed_bill_vault(self, user_id: UUID, description: str, amount: Optional[Decimal] = None) -> Optional[Vault]`:
       - Query `self.db.query(Vault).filter(Vault.user_id == user_id, Vault.vault_type == VaultType.FIXED_BILL).all()`.
       - Normalize strings, remove punctuation and stop-words.
       - Match tokens and exact substrings.
       - Disambiguate multiple candidates using `amount` when available; return `None` if ambiguous.
     - `reconcile_fixed_bill_vault(self, user_id: UUID, vault: Vault, transaction: Transaction, amount: Decimal) -> VaultReconciliationResult`:
       - Validate tenant ownership (`assert vault.user_id == user_id and transaction.user_id == user_id`).
       - Validate `vault.vault_type == VaultType.FIXED_BILL`.
       - Record `prev_due = vault.target_date`, `prev_alloc = vault.allocated_amount`.
       - Set `vault.allocated_amount = Decimal("0.00")`.
       - If `vault.target_date`: `vault.target_date = advance_one_month(vault.target_date)`.
       - Set `entry.vault_id = vault.id` on debit `LedgerEntry` of `transaction`.
       - Call `RunwayService.clear_cache(user_id=user_id)`.
       - Call `self.db.flush()`.
3. In `rezekify/services/ledger.py`:
   - Accept optional `vault_id: Optional[UUID] = None` in `record_expense`.
   - Set `debit_entry.vault_id = vault_id` when creating debit entry.
   - In `update_transaction`: preserve existing `debit_entry.vault_id` when rebuilding ledger entries.
   - Add method `reconcile_fixed_bill_vault(self, user_id: UUID, vault: Vault, transaction: Transaction, amount: Decimal) -> VaultReconciliationResult`:
     - Delegates to `VaultReconciliationService(self.db).reconcile_fixed_bill_vault(...)`.
     - Calls `self._maybe_commit()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --no-project pytest tests/test_vault_reconciliation_service.py tests/test_ledger_service.py -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/db/models.py rezekify/services/vault_reconciliation.py rezekify/services/ledger.py tests/test_vault_reconciliation_service.py tests/test_ledger_service.py
git commit -m "feat(ledger): add VaultReconciliationService and debit entry vault linking"
```

---

### Task 2: Autonomous Matching in Agent `record_transaction` Tool

**Files:**
- Modify: `rezekify/agent/tools.py:516-594,690-762`
- Modify: `tests/test_agent_tools.py`

**Interfaces:**
- Consumes: `VaultReconciliationService`, `reconcile_fixed_bill_vault`, `find_matching_fixed_bill_vault`
- Produces:
  - `_dispatch_record_transaction`: when `action == "expense"`, queries `find_matching_fixed_bill_vault`. If match found: reconciles vault, attaches `reconciled_vault` payload, and appends cognitive confirmation copy.
  - `_dispatch_manage_vault`: updates `action == "pay_bill"` to stamp `debit_entry.vault_id = vault.id` via `reconcile_fixed_bill_vault`.

- [ ] **Step 1: Write the failing tests in `tests/test_agent_tools.py`**

In `tests/test_agent_tools.py`:
```python
def test_agent_expense_auto_reconciles_fixed_bill(db_session: Session, sample_user: User):
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("2000000.00"),
    )
    v_bill = Vault(
        user_id=sample_user.id,
        name="Wifi Indihome",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("350000.00"),
        allocated_amount=Decimal("350000.00"),
        target_date=date(2026, 10, 20),
        is_locked=True,
    )
    db_session.add_all([acc, v_bill])
    db_session.commit()

    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "expense",
        "amount": 350000,
        "account_name": "BCA",
        "description": "Bayar tagihan wifi indihome",
    }
    result = dispatcher.dispatch(sample_user.id, "record_transaction", args)

    assert result["status"] == "success"
    assert "reconciled_vault" in result["transaction"]
    assert result["transaction"]["reconciled_vault"]["name"] == "Wifi Indihome"
    assert "Wifi Indihome" in result["message"]

    db_session.refresh(v_bill)
    assert v_bill.allocated_amount == Decimal("0.00")
    assert v_bill.target_date == date(2026, 11, 20)


def test_agent_expense_does_not_match_savings_vault(db_session: Session, sample_user: User):
    # Review Focus 1
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("2000000.00"),
    )
    v_sav = Vault(
        user_id=sample_user.id,
        name="Dana Liburan",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("5000000.00"),
        allocated_amount=Decimal("1000000.00"),
        target_date=date(2026, 12, 1),
    )
    db_session.add_all([acc, v_sav])
    db_session.commit()

    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "expense",
        "amount": 500000,
        "account_name": "BCA",
        "description": "Beli tiket dana liburan",
    }
    result = dispatcher.dispatch(sample_user.id, "record_transaction", args)

    assert result["status"] == "success"
    assert "reconciled_vault" not in result["transaction"]
    db_session.refresh(v_sav)
    assert v_sav.allocated_amount == Decimal("1000000.00")
    assert v_sav.target_date == date(2026, 12, 1)


def test_agent_ambiguous_bill_falls_back_to_unlinked_expense(db_session: Session, sample_user: User):
    # Review Focus 2
    acc = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("2000000.00"),
    )
    v1 = Vault(
        user_id=sample_user.id,
        name="Listrik Rumah",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("500000.00"),
        allocated_amount=Decimal("500000.00"),
        target_date=date(2026, 10, 15),
    )
    v2 = Vault(
        user_id=sample_user.id,
        name="Listrik Toko",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("500000.00"),
        allocated_amount=Decimal("500000.00"),
        target_date=date(2026, 10, 15),
    )
    db_session.add_all([acc, v1, v2])
    db_session.commit()

    dispatcher = AgentToolDispatcher(db_session)
    args = {
        "action": "expense",
        "amount": 250000,  # does not match either target_amount
        "account_name": "BCA",
        "description": "Bayar tagihan listrik",
    }
    result = dispatcher.dispatch(sample_user.id, "record_transaction", args)

    assert result["status"] == "success"
    assert "reconciled_vault" not in result["transaction"]
    db_session.refresh(v1)
    db_session.refresh(v2)
    assert v1.allocated_amount == Decimal("500000.00")
    assert v2.allocated_amount == Decimal("500000.00")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --no-project pytest tests/test_agent_tools.py -k "test_agent_expense_auto_reconciles_fixed_bill" -v`
Expected: FAIL with `AssertionError: assert 'reconciled_vault' in result['transaction']`

- [ ] **Step 3: Implement autonomous matching in `rezekify/agent/tools.py`**

1. In `_dispatch_record_transaction` under `if action == "expense":`:
   - After creating transaction `tx = self.ledger_service.record_expense(...)`:
   - Initialize `recon_service = VaultReconciliationService(self.db)`.
   - Call `matched_vault = recon_service.find_matching_fixed_bill_vault(user_id=user_id, description=validated.description, amount=validated.amount)`.
   - If `matched_vault`:
     - Execute `res = recon_service.reconcile_fixed_bill_vault(user_id=user_id, vault=matched_vault, transaction=tx, amount=validated.amount)`.
     - Commit db session: `self.db.commit()`.
     - Attach `reconciled_vault` object to `result["transaction"]`.
     - Append copy to message: `f" Pos tagihan '{matched_vault.name}' otomatis diselesaikan. Jatuh tempo berikutnya: {res.new_due_date.isoformat() if res.new_due_date else '-' }."`.
2. In `_dispatch_manage_vault` under `elif action == "pay_bill":`:
   - After `record_expense`, call `reconcile_fixed_bill_vault` so `debit_entry.vault_id` is linked.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --no-project pytest tests/test_agent_tools.py -k "test_agent_expense" -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/agent/tools.py tests/test_agent_tools.py
git commit -m "feat(agent): support autonomous FIXED_BILL reconciliation in record_transaction tool"
```

---

### Task 3: Transaction API Schema & Router `vault_id` Support

**Files:**
- Create: `rezekify/schemas/transaction.py`
- Modify: `rezekify/api/v1/transactions_router.py:24-78,145-194`
- Modify: `tests/test_api_endpoints.py`

**Interfaces:**
- Consumes: `VaultReconciliationService`, `LedgerService`, `reconcile_fixed_bill_vault`
- Produces:
  - `TransactionCreateRequest.vault_id: Optional[UUID] = None`
  - Re-exported schemas from `rezekify.schemas.transaction`: `TransactionCreateRequest`, `TransactionUpdateRequest`, `TransactionItemResponse`, `LedgerEntryResponse`, `PaginatedTransactionsResponse`
  - `POST /api/v1/transactions`: validates `vault_id` (if supplied, verifies user ownership and `FIXED_BILL` type; if omitted, runs auto-matching heuristic).

- [ ] **Step 1: Write the failing tests in `tests/test_api_endpoints.py`**

In `tests/test_api_endpoints.py`:
```python
def test_create_transaction_with_explicit_vault_id():
    auth_headers = _get_auth_headers("vault_tx_test@rezekify.id")
    # 1. Create account & fixed_bill vault
    acc_res = client.post(
        "/api/v1/accounts",
        json={"name": "BCA", "account_type": "BANK", "current_balance": 1000000.00},
        headers=auth_headers,
    )
    acc_id = acc_res.json()["id"]

    vault_res = client.post(
        "/api/v1/vaults",
        json={
            "name": "Wifi Indihome",
            "vault_type": "FIXED_BILL",
            "target_amount": 350000.00,
            "allocated_amount": 350000.00,
            "target_date": "2026-10-25",
        },
        headers=auth_headers,
    )
    vault_id = vault_res.json()["id"]

    # 2. Record expense with explicit vault_id
    tx_res = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "EXPENSE",
            "account_id": acc_id,
            "amount": 350000.00,
            "description": "Pembayaran Indihome Manual",
            "vault_id": vault_id,
        },
        headers=auth_headers,
    )
    assert tx_res.status_code == 200
    tx_data = tx_res.json()
    debit_entry = [e for e in tx_data["ledger_entries"] if e["entry_type"] == "DEBIT"][0]
    assert debit_entry["vault_id"] == vault_id

    # 3. Verify vault rolled over
    v_check = client.get(f"/api/v1/vaults/{vault_id}", headers=auth_headers).json()
    assert Decimal(str(v_check["allocated_amount"])) == Decimal("0.00")
    assert v_check["target_date"] == "2026-11-25"


def test_create_transaction_cross_tenant_vault_returns_404():
    user1_headers = _get_auth_headers("user1_vault@rezekify.id")
    user2_headers = _get_auth_headers("user2_vault@rezekify.id")

    # User 1 creates vault
    v_res = client.post(
        "/api/v1/vaults",
        json={"name": "PLN", "vault_type": "FIXED_BILL", "target_amount": 100000.00},
        headers=user1_headers,
    )
    user1_vault_id = v_res.json()["id"]

    # User 2 creates account
    acc_res = client.post(
        "/api/v1/accounts",
        json={"name": "GoPay", "account_type": "EWALLET", "current_balance": 500000.00},
        headers=user2_headers,
    )
    user2_acc_id = acc_res.json()["id"]

    # User 2 tries to link User 1's vault
    res = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "EXPENSE",
            "account_id": user2_acc_id,
            "amount": 100000.00,
            "description": "PLN",
            "vault_id": user1_vault_id,
        },
        headers=user2_headers,
    )
    assert res.status_code == 404
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --no-project pytest tests/test_api_endpoints.py -k "test_create_transaction_with_explicit_vault_id" -v`
Expected: FAIL (debit entry has `vault_id: None` or validation error)

- [ ] **Step 3: Implement `rezekify/schemas/transaction.py` and endpoint in `transactions_router.py`**

1. Create `rezekify/schemas/transaction.py`:
   - Move/define `TransactionCreateRequest` with `vault_id: Optional[UUID] = None`.
   - Define `TransactionUpdateRequest`, `LedgerEntryResponse`, `TransactionItemResponse`, `PaginatedTransactionsResponse`.
2. In `rezekify/api/v1/transactions_router.py`:
   - Import schemas from `rezekify.schemas.transaction`.
   - In `create_transaction`:
     - If `req.transaction_type == "EXPENSE"`:
       - If `req.vault_id` is supplied:
         - Lookup `vault = db.query(Vault).filter_by(id=req.vault_id, user_id=current_user.id).one_or_none()`.
         - If not `vault`: raise `HTTPException(status_code=404, detail="Pos tagihan (vault) tidak ditemukan.")`.
         - If `vault.vault_type != VaultType.FIXED_BILL`: raise `HTTPException(status_code=400, detail="Hanya pos tagihan (FIXED_BILL) yang dapat dihubungkan ke transaksi.")`.
         - Record expense: `tx = ledger.record_expense(..., vault_id=vault.id)`.
         - Call `ledger.reconcile_fixed_bill_vault(user_id=current_user.id, vault=vault, transaction=tx, amount=req.amount)`.
         - Return `tx`.
       - If `req.vault_id` is None:
         - Record expense: `tx = ledger.record_expense(...)`.
         - Check auto-match: `recon_service = VaultReconciliationService(db)`.
         - `vault = recon_service.find_matching_fixed_bill_vault(user_id=current_user.id, description=req.description, amount=req.amount)`.
         - If `vault`: `ledger.reconcile_fixed_bill_vault(user_id=current_user.id, vault=vault, transaction=tx, amount=req.amount)`.
         - Return `tx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --no-project pytest tests/test_api_endpoints.py -k "vault" -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/schemas/transaction.py rezekify/api/v1/transactions_router.py tests/test_api_endpoints.py
git commit -m "feat(api): support explicit and autonomous vault_id linking in transactions router"
```

---

### Task 4: Frontend `ManualTransactionModal` Vault Selector & Table Badge

**Files:**
- Modify: `frontend/src/types/api.ts:241-255`
- Modify: `frontend/src/components/ManualTransactionModal.tsx:7-46,150-195`
- Modify: `frontend/src/components/TransactionsTable.tsx:8-22,309-345,545-566,650-672`
- Modify: `frontend/src/pages/DashboardPage.tsx:312-323`
- Modify: `frontend/src/components/LedgerView.tsx`
- Modify: `frontend/src/__tests__/ManualTransactionModal.test.tsx`
- Modify: `frontend/src/__tests__/TransactionsTable.test.tsx`

**Interfaces:**
- Consumes: `Vault`, `TransactionCreateRequest`, `Transaction` from `frontend/src/types/api.ts`
- Produces:
  - `TransactionCreateRequest.vault_id?: string | null;`
  - `TransactionModalProps.vaults?: Vault[];`
  - Dropdown **"Hubungkan ke Pos Tagihan (Opsional)"** rendered when `type === 'EXPENSE'`.
  - Auto-selects bill if description contains bill name.
  - Submits `vault_id` in `apiFetch('/transactions', ...)` payload.
  - `TransactionsTableProps.vaults?: Vault[];`
  - Violet badge `<Lock className="w-2.5 h-2.5" /> Pos: [Nama Vault]` rendered when `tx.ledger_entries` has `vault_id`.

- [ ] **Step 1: Write the failing tests in `ManualTransactionModal.test.tsx` and `TransactionsTable.test.tsx`**

In `frontend/src/__tests__/ManualTransactionModal.test.tsx`:
```tsx
import { Vault } from '../types/api';

const mockVaults: Vault[] = [
  {
    id: 'vault-1',
    name: 'Wifi Indihome',
    vault_type: 'FIXED_BILL',
    target_amount: 350000,
    allocated_amount: 350000,
    target_date: '2026-10-25',
    is_locked: true,
  },
  {
    id: 'vault-2',
    name: 'Dana Darurat',
    vault_type: 'SAVINGS',
    target_amount: 10000000,
    allocated_amount: 2000000,
    is_locked: false,
  },
];

it('renders vault dropdown for FIXED_BILL vaults when type is EXPENSE', () => {
  render(
    <ManualTransactionModal
      isOpen={true}
      onClose={vi.fn()}
      accounts={mockAccounts}
      vaults={mockVaults}
    />
  );

  expect(screen.getByLabelText(/Hubungkan ke Pos Tagihan/i)).toBeInTheDocument();
  // Dana Darurat (SAVINGS) must NOT be listed
  expect(screen.queryByText(/Dana Darurat/i)).not.toBeInTheDocument();
});

it('submits manual expense with selected vault_id', async () => {
  const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({ id: 'tx-new' });
  render(
    <ManualTransactionModal
      isOpen={true}
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      accounts={mockAccounts}
      vaults={mockVaults}
    />
  );

  fireEvent.change(screen.getByLabelText(/Nominal/i), { target: { value: '350000' } });
  fireEvent.change(screen.getByLabelText(/Deskripsi/i), { target: { value: 'Tagihan Indihome' } });
  fireEvent.change(screen.getByLabelText(/Pilih Akun/i), { target: { value: 'acc-1' } });
  fireEvent.change(screen.getByLabelText(/Hubungkan ke Pos Tagihan/i), { target: { value: 'vault-1' } });

  fireEvent.click(screen.getByRole('button', { name: /Simpan Transaksi/i }));

  await waitFor(() => {
    const callArgs = apiFetchSpy.mock.calls[0][1] as any;
    const parsedBody = JSON.parse(callArgs.body);
    expect(parsedBody.vault_id).toBe('vault-1');
  });
});
```

In `frontend/src/__tests__/TransactionsTable.test.tsx`:
```tsx
it('renders linked vault badge when transaction has vault_id in ledger_entry', () => {
  const txWithVault: Transaction = {
    id: 'tx-1',
    description: 'Bayar Wifi',
    source_channel: 'WEB_MANUAL',
    transaction_date: '2026-10-22T10:00:00Z',
    ledger_entries: [
      { id: 'le-1', vault_id: 'vault-1', entry_type: 'DEBIT', amount: 350000 },
      { id: 'le-2', account_id: 'acc-1', entry_type: 'CREDIT', amount: 350000 },
    ],
  };

  render(
    <TransactionsTable
      transactions={[txWithVault]}
      onDelete={vi.fn()}
      vaults={mockVaults}
    />
  );

  expect(screen.getAllByText(/Wifi Indihome/i).length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run frontend/src/__tests__/ManualTransactionModal.test.tsx`
Expected: FAIL with missing element `Hubungkan ke Pos Tagihan`

- [ ] **Step 3: Implement UI updates in `types/api.ts`, `ManualTransactionModal.tsx`, and `TransactionsTable.tsx`**

1. In `frontend/src/types/api.ts`:
   - Add `vault_id?: string | null;` to `TransactionCreateRequest`.
2. In `frontend/src/components/ManualTransactionModal.tsx`:
   - Add `vaults?: Vault[];` to `TransactionModalProps`.
   - Filter `fixedBillVaults = (vaults || []).filter(v => v.vault_type === 'FIXED_BILL')`.
   - Add state `selectedVaultId, setSelectedVaultId`.
   - Auto-match candidate if `description` matches vault name.
   - When `type === 'EXPENSE'` and `fixedBillVaults.length > 0`:
     - Render `Select` component labeled **"Hubungkan ke Pos Tagihan (Opsional)"**.
     - Options: default empty "Tidak dihubungkan" + each bill `{vault.name} (Target: Rp {formatRupiah(vault.target_amount)} - Tempo: {vault.target_date || '-'})`.
   - In `handleSubmit`: include `vault_id: selectedVaultId || undefined` in the POST payload.
3. In `frontend/src/components/TransactionsTable.tsx`:
   - Add `vaults?: Vault[];` to `Props`.
   - In `getTxDetails`: inspect `tx.ledger_entries?.find(e => Boolean(e.vault_id))?.vault_id`.
   - Look up `vaultName = vaults?.find(v => v.id === vaultId)?.name || 'Pos Tagihan'`.
   - In mobile card-view and desktop row, render violet badge:
     ```tsx
     {linkedVault && (
       <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
         <Lock className="w-2.5 h-2.5" />
         {linkedVault.name}
       </span>
     )}
     ```
4. In `frontend/src/pages/DashboardPage.tsx` and `frontend/src/components/LedgerView.tsx`:
   - Pass `vaults={dashboard.vaults}` (or `vaults={vaults}`) to `ManualTransactionModal` and `TransactionsTable`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run frontend/src/__tests__/ManualTransactionModal.test.tsx frontend/src/__tests__/TransactionsTable.test.tsx`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/components/ManualTransactionModal.tsx frontend/src/components/TransactionsTable.tsx frontend/src/pages/DashboardPage.tsx frontend/src/components/LedgerView.tsx frontend/src/__tests__/ManualTransactionModal.test.tsx frontend/src/__tests__/TransactionsTable.test.tsx
git commit -m "feat(frontend): add vault selector in ManualTransactionModal and linked vault badge in TransactionsTable"
```

---

### Task 5: Full Verification Gate

**Files:**
- All touched files across backend and frontend

**Interfaces:**
- Consumes: Complete backend test suite, frontend vitest test suite, TypeScript compiler
- Produces: Verified exit code 0 clean build and test run

- [ ] **Step 1: Run complete backend test suite**

Run: `uv run --no-project pytest tests/test_vault_reconciliation_service.py tests/test_ledger_service.py tests/test_agent_tools.py tests/test_manage_vault_tool.py tests/test_api_endpoints.py -x`
Expected: PASS with exit code 0.

- [ ] **Step 2: Run frontend test suite single-pass**

Run: `npm test -- --run`
Expected: PASS with exit code 0.

- [ ] **Step 3: Run TypeScript compiler validation**

Run: `npx tsc --noEmit`
Expected: Zero type errors.

- [ ] **Step 4: Commit and finalize branch**

```bash
git add .
git commit -m "chore(audit): verify complete autonomous vault auto-reconciliation test suite"
```
