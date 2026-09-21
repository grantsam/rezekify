# Full Transaction Update Lifecycle & Atomic Balance Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full transaction update lifecycle (`update_transaction` service method and `PUT /api/v1/transactions/{id}` REST endpoint) with deterministic double-entry accounting balance reconciliation (reversal and re-post pattern), tenant isolation defense, and an Impeccable-grade frontend interactive edit modal (`EditTransactionModal.tsx`) integrated with `TransactionsTable.tsx` and reactive dashboard telemetry.

**Architecture:** A two-phase accounting state machine (reversal of historical balance mutations, validation of new tenant entities, application of new account mutations, purging of stale ledger entries, and atomic re-post of balanced debit/credit pairs) within `LedgerService.update_transaction`; exposed via a strictly validated FastAPI endpoint with Pydantic v2 schemas enforcing HTTP 400/404/422 status code semantics; and an accessible React modal dialog that pre-populates transaction details, supports expense/income/transfer mutations, and increments `refreshTrigger` to update `RunwayMetricCard`, `ExpenseCharts`, and account balances without full page reloads.

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy 2.0, Pydantic v2, PostgreSQL 16 / SQLite (in-memory test runner), React 18, Vite, Vitest, TypeScript, Tailwind CSS, Lucide React, Framer Motion.

**Spec:** `docs/specs/2026-09-22-transaction-update-lifecycle-design.md`

## Global Constraints

* **Deterministic Financial Math:** Strictly zero IEEE 754 floating-point drift. All transaction amounts, account balance mutations, and ledger entries use Python `decimal.Decimal` and SQL `NUMERIC(15, 2)`. Updates with `amount <= Decimal("0.00")` are rejected immediately.
* **Balanced Ledger Invariant:** Every transaction update must atomically preserve $\sum \text{Debit} = \sum \text{Credit}$. The reversal and re-post execute in a single atomic database transaction.
* **Row-Level Tenant Isolation:** Strict multi-tenant boundaries (`WHERE user_id = current_user_id`). Updating a foreign transaction raises `NoResultFound` (mapping to HTTP 404). Assigning accounts or categories belonging to another user raises `ValueError` (mapping to HTTP 400).
* **Audit Trail & Metadata Preservation:** Retain the original primary key (`Transaction.id`), `created_at`, `raw_input_text`, `receipt_image_url`, and `source_channel`. Only mutate business fields (`amount`, `description`, `transaction_date`, accounts, and categories).
* **Windows PowerShell Compatibility:** All shell commands must adhere to Windows PowerShell syntax (statement terminators with semicolons `;` or distinct lines; never unescaped bash `&&`).
* **Conventional Commits:** All git commit messages must adhere to Conventional Commits format (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`) followed by the mandatory Co-Authored-By attribution.
* **Zero Truncation Rule:** All code snippets in this plan must be 100% complete, fully compilable, and self-contained with zero placeholders, ellipsis comments (`...`), or `TODO` annotations.

---

### Task 1: `LedgerService.update_transaction` & Unit Tests

**Files:**
- Modify: `rezekify/services/ledger.py`
- Modify: `tests/test_ledger_service.py`

**Interfaces:**
- Consumes: `Session`, `Transaction`, `LedgerEntry`, `Account`, `Category`, `EntryType` from `rezekify.db.models`, `UUID`, `Decimal`, `datetime`
- Produces:
  ```python
  def update_transaction(
      self,
      user_id: UUID,
      transaction_id: UUID,
      amount: Decimal,
      description: str,
      transaction_type: str = "EXPENSE",
      account_id: Optional[UUID] = None,
      category_id: Optional[UUID] = None,
      from_account_id: Optional[UUID] = None,
      to_account_id: Optional[UUID] = None,
      transaction_date: Optional[datetime] = None,
  ) -> Transaction
  ```

- [ ] **Step 1: Write the failing tests in `tests/test_ledger_service.py`**

Add the comprehensive test suite for `update_transaction` to `tests/test_ledger_service.py`:

```python
def test_update_transaction_expense_amount_and_account(db_session, sample_user):
    """Verifies atomic reversal of previous account and correct deduction from new account."""
    acc_cash = Account(
        user_id=sample_user.id,
        name="Kas Tunai",
        account_type=AccountType.CASH,
        current_balance=Decimal("1000000.00"),
    )
    acc_bank = Account(
        user_id=sample_user.id,
        name="Bank BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("5000000.00"),
    )
    cat_food = Category(
        user_id=sample_user.id,
        name="Makanan & Minuman",
        category_type=CategoryType.EXPENSE,
    )
    db_session.add_all([acc_cash, acc_bank, cat_food])
    db_session.commit()

    service = LedgerService(db_session)
    tx = service.record_expense(
        user_id=sample_user.id,
        account_id=acc_cash.id,
        category_id=cat_food.id,
        amount=Decimal("100000.00"),
        description="Makan Siang",
    )
    db_session.refresh(acc_cash)
    assert acc_cash.current_balance == Decimal("900000.00")
    assert acc_bank.current_balance == Decimal("5000000.00")

    # Update: Change to Rp 150,000 paid from Bank BCA
    updated_tx = service.update_transaction(
        user_id=sample_user.id,
        transaction_id=tx.id,
        amount=Decimal("150000.00"),
        description="Makan Siang Tim",
        transaction_type="EXPENSE",
        account_id=acc_bank.id,
        category_id=cat_food.id,
    )

    db_session.refresh(acc_cash)
    db_session.refresh(acc_bank)
    # Cash balance restored to 1,000,000; Bank balance deducted by 150,000 to 4,850,000
    assert acc_cash.current_balance == Decimal("1000000.00")
    assert acc_bank.current_balance == Decimal("4850000.00")
    assert updated_tx.description == "Makan Siang Tim"

    # Verify ledger entries are balanced
    entries = updated_tx.ledger_entries
    assert len(entries) == 2
    debit = next(e for e in entries if e.entry_type == EntryType.DEBIT)
    credit = next(e for e in entries if e.entry_type == EntryType.CREDIT)
    assert debit.amount == Decimal("150000.00")
    assert credit.amount == Decimal("150000.00")
    assert credit.account_id == acc_bank.id
    assert debit.category_id == cat_food.id


def test_update_transaction_income_and_transfer(db_session, sample_user):
    """Verifies update reconciliation across income and transfer transaction types."""
    acc_a = Account(
        user_id=sample_user.id,
        name="Akun A",
        account_type=AccountType.BANK,
        current_balance=Decimal("2000000.00"),
    )
    acc_b = Account(
        user_id=sample_user.id,
        name="Akun B",
        account_type=AccountType.EWALLET,
        current_balance=Decimal("500000.00"),
    )
    cat_inc = Category(
        user_id=sample_user.id,
        name="Freelance",
        category_type=CategoryType.INCOME,
    )
    db_session.add_all([acc_a, acc_b, cat_inc])
    db_session.commit()

    service = LedgerService(db_session)

    # 1. Test Income Update: Initial Rp 300,000 to Akun A -> Update to Rp 500,000 to Akun B
    tx_inc = service.record_income(
        user_id=sample_user.id,
        account_id=acc_a.id,
        category_id=cat_inc.id,
        amount=Decimal("300000.00"),
        description="Proyek Logo",
    )
    db_session.refresh(acc_a)
    assert acc_a.current_balance == Decimal("2300000.00")

    service.update_transaction(
        user_id=sample_user.id,
        transaction_id=tx_inc.id,
        amount=Decimal("500000.00"),
        description="Proyek Logo & Banner",
        transaction_type="INCOME",
        account_id=acc_b.id,
        category_id=cat_inc.id,
    )
    db_session.refresh(acc_a)
    db_session.refresh(acc_b)
    # Akun A restored by deducting 300,000 -> 2,000,000; Akun B increased by 500,000 -> 1,000,000
    assert acc_a.current_balance == Decimal("2000000.00")
    assert acc_b.current_balance == Decimal("1000000.00")

    # 2. Test Transfer Update: Initial Rp 200,000 from A to B -> Update to Rp 100,000 from A to B
    tx_trf = service.record_transfer(
        user_id=sample_user.id,
        from_account_id=acc_a.id,
        to_account_id=acc_b.id,
        amount=Decimal("200000.00"),
        description="Transfer A ke B",
    )
    db_session.refresh(acc_a)
    db_session.refresh(acc_b)
    assert acc_a.current_balance == Decimal("1800000.00")
    assert acc_b.current_balance == Decimal("1200000.00")

    service.update_transaction(
        user_id=sample_user.id,
        transaction_id=tx_trf.id,
        amount=Decimal("100000.00"),
        description="Transfer Revisi 100k",
        transaction_type="TRANSFER",
        from_account_id=acc_a.id,
        to_account_id=acc_b.id,
    )
    db_session.refresh(acc_a)
    db_session.refresh(acc_b)
    # Net: A should be 2,000,000 - 100,000 = 1,900,000; B should be 1,000,000 + 100,000 = 1,100,000
    assert acc_a.current_balance == Decimal("1900000.00")
    assert acc_b.current_balance == Decimal("1100000.00")


def test_update_transaction_cross_tenant_rejection(db_session, sample_user):
    """Verifies that updating another user's transaction or using another user's account raises errors."""
    from sqlalchemy.orm.exc import NoResultFound
    from rezekify.db.models import User

    # Create second tenant
    user_b = User(
        email="tenant_b@rezekify.local",
        password_hash="hash_b",
        full_name="Tenant B",
        monthly_cycle_day=25,
    )
    acc_b = Account(
        user_id=user_b.id,
        name="Rekening B",
        account_type=AccountType.BANK,
        current_balance=Decimal("1000000.00"),
    )
    acc_a = Account(
        user_id=sample_user.id,
        name="Rekening A",
        account_type=AccountType.BANK,
        current_balance=Decimal("1000000.00"),
    )
    db_session.add_all([user_b, acc_b, acc_a])
    db_session.commit()

    service = LedgerService(db_session)
    tx_a = service.record_expense(
        user_id=sample_user.id,
        account_id=acc_a.id,
        category_id=None,
        amount=Decimal("50000.00"),
        description="Expense User A",
    )

    # User B attempts to modify User A's transaction -> NoResultFound
    with pytest.raises(NoResultFound):
        service.update_transaction(
            user_id=user_b.id,
            transaction_id=tx_a.id,
            amount=Decimal("70000.00"),
            description="Unauthorized Edit",
            account_id=acc_b.id,
        )

    # User A attempts to reassign transaction to User B's account -> ValueError
    with pytest.raises(ValueError, match="Account not found or access denied"):
        service.update_transaction(
            user_id=sample_user.id,
            transaction_id=tx_a.id,
            amount=Decimal("70000.00"),
            description="Theft Attempt",
            account_id=acc_b.id,
        )


def test_update_transaction_invalid_inputs(db_session, sample_user):
    """Verifies that non-positive amounts and invalid transfer configurations are rejected."""
    acc = Account(
        user_id=sample_user.id,
        name="Rekening Valid",
        account_type=AccountType.CASH,
        current_balance=Decimal("500000.00"),
    )
    db_session.add(acc)
    db_session.commit()

    service = LedgerService(db_session)
    tx = service.record_expense(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=None,
        amount=Decimal("50000.00"),
        description="Test Tx",
    )

    # Negative amount
    with pytest.raises(ValueError, match="Amount must be positive"):
        service.update_transaction(
            user_id=sample_user.id,
            transaction_id=tx.id,
            amount=Decimal("-10000.00"),
            description="Negative Amount",
            account_id=acc.id,
        )

    # Zero amount
    with pytest.raises(ValueError, match="Amount must be positive"):
        service.update_transaction(
            user_id=sample_user.id,
            transaction_id=tx.id,
            amount=Decimal("0.00"),
            description="Zero Amount",
            account_id=acc.id,
        )

    # Transfer with identical source and destination
    with pytest.raises(ValueError, match="Source and destination accounts must be distinct"):
        service.update_transaction(
            user_id=sample_user.id,
            transaction_id=tx.id,
            amount=Decimal("10000.00"),
            description="Self Transfer",
            transaction_type="TRANSFER",
            from_account_id=acc.id,
            to_account_id=acc.id,
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_ledger_service.py -k "test_update_transaction" -v`
Expected: FAIL with `AttributeError: 'LedgerService' object has no attribute 'update_transaction'`

- [ ] **Step 3: Implement minimal code in `rezekify/services/ledger.py`**

In `rezekify/services/ledger.py`, add `from datetime import datetime` and `Category` to model imports:

```python
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from rezekify.db.models import Account, Category, EntryType, LedgerEntry, Transaction
```

Add the `update_transaction` method to the `LedgerService` class:

```python
    def update_transaction(
        self,
        user_id: UUID,
        transaction_id: UUID,
        amount: Decimal,
        description: str,
        transaction_type: str = "EXPENSE",
        account_id: Optional[UUID] = None,
        category_id: Optional[UUID] = None,
        from_account_id: Optional[UUID] = None,
        to_account_id: Optional[UUID] = None,
        transaction_date: Optional[datetime] = None,
    ) -> Transaction:
        """Deterministically updates an existing transaction using reversal and re-post pattern.

        Reverses prior account balance modifications, validates tenant ownership of all
        target entities, applies new account mutations, purges historical ledger entries,
        and posts new balanced debit/credit entries atomically.
        """
        if amount <= Decimal("0.00"):
            raise ValueError("Amount must be positive.")

        # Step A: Locate transaction with strict row-level tenant isolation
        tx = (
            self.db.query(Transaction)
            .filter_by(id=transaction_id, user_id=user_id)
            .one()
        )

        # Step B: Reverse previous balance mutations based on existing ledger entries
        for entry in tx.ledger_entries:
            if entry.account_id:
                acc = (
                    self.db.query(Account)
                    .filter_by(id=entry.account_id, user_id=user_id)
                    .one()
                )
                if entry.entry_type == EntryType.CREDIT:
                    acc.current_balance += entry.amount
                elif entry.entry_type == EntryType.DEBIT:
                    acc.current_balance -= entry.amount

        # Step C & D: Validate targets and apply new balance mutations
        tt = transaction_type.upper()
        new_entries: list[LedgerEntry] = []

        if tt == "EXPENSE":
            if not account_id:
                raise ValueError("account_id is required for expense transaction.")
            new_acc = (
                self.db.query(Account)
                .filter_by(id=account_id, user_id=user_id)
                .one_or_none()
            )
            if not new_acc:
                raise ValueError("Account not found or access denied.")

            if category_id:
                cat = (
                    self.db.query(Category)
                    .filter_by(id=category_id, user_id=user_id)
                    .one_or_none()
                )
                if not cat:
                    raise ValueError("Category not found or access denied.")

            new_acc.current_balance -= amount

            new_entries = [
                LedgerEntry(
                    transaction_id=tx.id,
                    user_id=user_id,
                    category_id=category_id,
                    entry_type=EntryType.DEBIT,
                    amount=amount,
                ),
                LedgerEntry(
                    transaction_id=tx.id,
                    user_id=user_id,
                    account_id=new_acc.id,
                    entry_type=EntryType.CREDIT,
                    amount=amount,
                ),
            ]

        elif tt == "INCOME":
            if not account_id:
                raise ValueError("account_id is required for income transaction.")
            new_acc = (
                self.db.query(Account)
                .filter_by(id=account_id, user_id=user_id)
                .one_or_none()
            )
            if not new_acc:
                raise ValueError("Account not found or access denied.")

            if category_id:
                cat = (
                    self.db.query(Category)
                    .filter_by(id=category_id, user_id=user_id)
                    .one_or_none()
                )
                if not cat:
                    raise ValueError("Category not found or access denied.")

            new_acc.current_balance += amount

            new_entries = [
                LedgerEntry(
                    transaction_id=tx.id,
                    user_id=user_id,
                    account_id=new_acc.id,
                    entry_type=EntryType.DEBIT,
                    amount=amount,
                ),
                LedgerEntry(
                    transaction_id=tx.id,
                    user_id=user_id,
                    category_id=category_id,
                    entry_type=EntryType.CREDIT,
                    amount=amount,
                ),
            ]

        elif tt == "TRANSFER":
            src_id = from_account_id or account_id
            dst_id = to_account_id
            if not src_id or not dst_id:
                raise ValueError("Both source and destination accounts are required for transfer.")
            if src_id == dst_id:
                raise ValueError("Source and destination accounts must be distinct.")

            from_acc = (
                self.db.query(Account)
                .filter_by(id=src_id, user_id=user_id)
                .one_or_none()
            )
            to_acc = (
                self.db.query(Account)
                .filter_by(id=dst_id, user_id=user_id)
                .one_or_none()
            )
            if not from_acc or not to_acc:
                raise ValueError("Source or destination account not found or access denied.")

            from_acc.current_balance -= amount
            to_acc.current_balance += amount

            new_entries = [
                LedgerEntry(
                    transaction_id=tx.id,
                    user_id=user_id,
                    account_id=from_acc.id,
                    entry_type=EntryType.CREDIT,
                    amount=amount,
                ),
                LedgerEntry(
                    transaction_id=tx.id,
                    user_id=user_id,
                    account_id=to_acc.id,
                    entry_type=EntryType.DEBIT,
                    amount=amount,
                ),
            ]
        else:
            raise ValueError(f"Unsupported transaction type: {transaction_type}")

        # Step E: Purge historical ledger entries and emit replacement balanced entries
        for old_entry in list(tx.ledger_entries):
            self.db.delete(old_entry)
        self.db.flush()

        self.db.add_all(new_entries)

        # Step F: Update metadata and transaction timestamp
        tx.description = description
        if transaction_date is not None:
            tx.transaction_date = transaction_date

        self.db.commit()
        self.db.refresh(tx)
        return tx
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_ledger_service.py -v`
Expected: PASS (all tests in `test_ledger_service.py` pass)

- [ ] **Step 5: Commit**

```powershell
git add rezekify/services/ledger.py tests/test_ledger_service.py
git commit -m "feat(ledger): implement atomic transaction update and balance reconciliation

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: REST Endpoint `PUT /api/v1/transactions/{id}` & API Tests

**Files:**
- Modify: `rezekify/api/v1/transactions_router.py`
- Modify: `tests/test_api_endpoints.py`

**Interfaces:**
- Consumes: `LedgerService.update_transaction` from `rezekify.services.ledger`, `get_current_user`, `get_db`
- Produces:
  - Schema: `TransactionUpdateRequest` in `rezekify/api/v1/transactions_router.py`
  - Endpoint: `PUT /api/v1/transactions/{transaction_id}` returning `TransactionItemResponse`

- [ ] **Step 1: Write the failing integration tests in `tests/test_api_endpoints.py`**

Add the endpoint integration test to `tests/test_api_endpoints.py`:

```python
def test_api_update_transaction_lifecycle():
    """Verifies PUT /api/v1/transactions/{id} lifecycle, reconciliation, and tenant isolation."""
    import uuid

    # 1. Register User A
    user_a_email = f"update_a_{uuid.uuid4().hex[:6]}@rezekify.local"
    res_a = client.post(
        "/api/v1/auth/register",
        json={
            "email": user_a_email,
            "password": "Password123!",
            "full_name": "User Update A",
        },
    )
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # 2. Create two accounts for User A (Cash: 500,000, Bank: 1,000,000)
    acc_cash_res = client.post(
        "/api/v1/accounts",
        json={"name": "Dompet Tunai", "account_type": "CASH", "current_balance": 500000.00},
        headers=headers_a,
    )
    acc_cash_id = acc_cash_res.json()["id"]

    acc_bank_res = client.post(
        "/api/v1/accounts",
        json={"name": "Bank Utama", "account_type": "BANK", "current_balance": 1000000.00},
        headers=headers_a,
    )
    acc_bank_id = acc_bank_res.json()["id"]

    # 3. Create initial expense of Rp 50,000 from Cash
    tx_create_res = client.post(
        "/api/v1/transactions",
        json={
            "transaction_type": "EXPENSE",
            "account_id": acc_cash_id,
            "amount": 50000.00,
            "description": "Beli Kopi",
        },
        headers=headers_a,
    )
    assert tx_create_res.status_code == 200
    tx_id = tx_create_res.json()["id"]

    # 4. PUT /api/v1/transactions/{id} - Change to Rp 120,000 paid from Bank
    update_res = client.put(
        f"/api/v1/transactions/{tx_id}",
        json={
            "transaction_type": "EXPENSE",
            "account_id": acc_bank_id,
            "amount": 120000.00,
            "description": "Beli Kopi & Makan Tim",
        },
        headers=headers_a,
    )
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["id"] == tx_id
    assert updated_data["description"] == "Beli Kopi & Makan Tim"
    assert len(updated_data["ledger_entries"]) == 2
    assert float(updated_data["ledger_entries"][0]["amount"]) == 120000.00

    # Verify account balance reconciliation: Cash refunded to 500,000; Bank deducted to 880,000
    accounts_res = client.get("/api/v1/accounts", headers=headers_a)
    acc_map = {a["id"]: float(a["current_balance"]) for a in accounts_res.json()}
    assert acc_map[acc_cash_id] == 500000.00
    assert acc_map[acc_bank_id] == 880000.00

    # 5. Error Scenarios
    # 404 for nonexistent transaction ID
    res_404 = client.put(
        f"/api/v1/transactions/{uuid.uuid4()}",
        json={
            "transaction_type": "EXPENSE",
            "account_id": acc_bank_id,
            "amount": 50000.00,
            "description": "Ghost Tx",
        },
        headers=headers_a,
    )
    assert res_404.status_code == 404
    assert res_404.json()["detail"] == "Transaction not found"

    # 422 for non-positive amount
    res_422 = client.put(
        f"/api/v1/transactions/{tx_id}",
        json={
            "transaction_type": "EXPENSE",
            "account_id": acc_bank_id,
            "amount": -5000.00,
            "description": "Negative Amount",
        },
        headers=headers_a,
    )
    assert res_422.status_code == 422

    # 400 for missing account_id in Expense
    res_400 = client.put(
        f"/api/v1/transactions/{tx_id}",
        json={
            "transaction_type": "EXPENSE",
            "amount": 25000.00,
            "description": "Missing Account",
        },
        headers=headers_a,
    )
    assert res_400.status_code == 400

    # 6. Cross-Tenant Defense: Register User B and attempt to PUT User A's transaction
    user_b_email = f"update_b_{uuid.uuid4().hex[:6]}@rezekify.local"
    res_b = client.post(
        "/api/v1/auth/register",
        json={
            "email": user_b_email,
            "password": "Password123!",
            "full_name": "User Update B",
        },
    )
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    res_cross = client.put(
        f"/api/v1/transactions/{tx_id}",
        json={
            "transaction_type": "EXPENSE",
            "account_id": acc_bank_id,
            "amount": 10000.00,
            "description": "Cross Tenant Hack",
        },
        headers=headers_b,
    )
    assert res_cross.status_code == 404
    assert res_cross.json()["detail"] == "Transaction not found"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_api_endpoints.py -k "test_api_update_transaction_lifecycle" -v`
Expected: FAIL with `405 Method Not Allowed`

- [ ] **Step 3: Implement `TransactionUpdateRequest` and `PUT /{transaction_id}` in `rezekify/api/v1/transactions_router.py`**

In `rezekify/api/v1/transactions_router.py`:
1. Add imports:
   ```python
   from pydantic import BaseModel, ConfigDict, Field
   from sqlalchemy.orm.exc import NoResultFound
   ```
2. Define the `TransactionUpdateRequest` schema:
   ```python
   class TransactionUpdateRequest(BaseModel):
       transaction_type: str = Field(
           default="EXPENSE",
           pattern="^(EXPENSE|INCOME|TRANSFER)$",
           description="Transaction type category: EXPENSE, INCOME, or TRANSFER",
       )
       amount: Decimal = Field(
           ...,
           gt=Decimal("0.00"),
           description="Positive monetary transaction amount",
       )
       description: str = Field(
           ...,
           min_length=1,
           max_length=500,
           description="Descriptive explanation of the transaction",
       )
       account_id: Optional[UUID] = Field(
           default=None,
           description="Primary account ID for expense or income",
       )
       category_id: Optional[UUID] = Field(
           default=None,
           description="Associated category ID for expense or income",
       )
       from_account_id: Optional[UUID] = Field(
           default=None,
           description="Source account ID for transfer",
       )
       to_account_id: Optional[UUID] = Field(
           default=None,
           description="Destination account ID for transfer",
       )
       transaction_date: Optional[datetime] = Field(
           default=None,
           description="Optional custom transaction timestamp; defaults to existing timestamp if omitted",
       )
   ```
3. Add the route handler:
   ```python
   @transactions_router.put("/{transaction_id}", response_model=TransactionItemResponse)
   def update_transaction(
       transaction_id: UUID,
       req: TransactionUpdateRequest,
       current_user: User = Depends(get_current_user),
       db: Session = Depends(get_db),
   ):
       """Updates an existing transaction, deterministically reconciling account balances."""
       ledger = LedgerService(db)
       try:
           updated_tx = ledger.update_transaction(
               user_id=current_user.id,
               transaction_id=transaction_id,
               amount=req.amount,
               description=req.description,
               transaction_type=req.transaction_type,
               account_id=req.account_id,
               category_id=req.category_id,
               from_account_id=req.from_account_id,
               to_account_id=req.to_account_id,
               transaction_date=req.transaction_date,
           )
           return updated_tx
       except NoResultFound:
           raise HTTPException(
               status_code=status.HTTP_404_NOT_FOUND,
               detail="Transaction not found",
           )
       except ValueError as e:
           raise HTTPException(
               status_code=status.HTTP_400_BAD_REQUEST,
               detail=str(e),
           )
   ```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_api_endpoints.py -k "test_api_update_transaction_lifecycle" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add rezekify/api/v1/transactions_router.py tests/test_api_endpoints.py
git commit -m "feat(api): expose PUT /api/v1/transactions/{id} endpoint with balance reconciliation

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: Frontend Types & API Client

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/services/apiClient.ts`
- Modify: `frontend/src/__tests__/apiClient.test.ts`

**Interfaces:**
- Consumes: `apiFetch` in `frontend/src/services/apiClient.ts`
- Produces:
  - `TransactionUpdateRequest` in `frontend/src/types/api.ts`
  - `updateTransaction(id: string, payload: TransactionUpdateRequest): Promise<Transaction>` in `frontend/src/services/apiClient.ts`

- [ ] **Step 1: Write the failing test in `frontend/src/__tests__/apiClient.test.ts`**

Add unit test for `updateTransaction` in `frontend/src/__tests__/apiClient.test.ts`:

```typescript
import { updateTransaction } from '../services/apiClient';
import { Transaction, TransactionUpdateRequest } from '../types/api';

describe('updateTransaction api client', () => {
  it('sends PUT request with JSON payload to /transactions/{id}', async () => {
    setAuthToken('mock-auth-token');
    const mockUpdatedTx: Transaction = {
      id: 'tx-reconcile-1',
      description: 'Belanja Mingguan Beras & Telur',
      source_channel: 'WEB_MANUAL',
      transaction_date: '2026-09-22T10:00:00Z',
      ledger_entries: [
        { id: 'le-1', entry_type: 'DEBIT', amount: 85000 },
        { id: 'le-2', entry_type: 'CREDIT', amount: 85000, account_id: 'acc-bank-1' },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockUpdatedTx,
    });

    const payload: TransactionUpdateRequest = {
      transaction_type: 'EXPENSE',
      amount: 85000,
      description: 'Belanja Mingguan Beras & Telur',
      account_id: 'acc-bank-1',
      transaction_date: '2026-09-22T10:00:00.000Z',
    };

    const result = await updateTransaction('tx-reconcile-1', payload);
    expect(result).toEqual(mockUpdatedTx);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/transactions/tx-reconcile-1',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer mock-auth-token',
        }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npx vitest run src/__tests__/apiClient.test.ts`
Expected: FAIL with `updateTransaction is not a function` or import error

- [ ] **Step 3: Implement minimal code in `frontend/src/types/api.ts` and `frontend/src/services/apiClient.ts`**

1. In `frontend/src/types/api.ts`, append:
```typescript
export interface TransactionUpdateRequest {
  transaction_type: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  amount: number;
  description: string;
  account_id?: string;
  category_id?: string;
  from_account_id?: string;
  to_account_id?: string;
  transaction_date?: string;
}
```

2. In `frontend/src/services/apiClient.ts`, import `Transaction` and `TransactionUpdateRequest` and export `updateTransaction`:
```typescript
import { Transaction, TransactionUpdateRequest } from '../types/api';

export async function updateTransaction(
  id: string,
  payload: TransactionUpdateRequest
): Promise<Transaction> {
  return apiFetch<Transaction>(`/transactions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npx vitest run src/__tests__/apiClient.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/types/api.ts frontend/src/services/apiClient.ts frontend/src/__tests__/apiClient.test.ts
git commit -m "feat(frontend): add TransactionUpdateRequest type and updateTransaction api client

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: Frontend `EditTransactionModal.tsx` & `TransactionsTable.tsx` Integration

**Files:**
- Create: `frontend/src/components/EditTransactionModal.tsx`
- Modify: `frontend/src/components/TransactionsTable.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Create: `frontend/src/__tests__/EditTransactionModal.test.tsx`
- Modify: `frontend/src/__tests__/TransactionsTable.test.tsx`

**Interfaces:**
- Consumes: `Account`, `Transaction`, `CategoryOption`, `updateTransaction` or `apiFetch`
- Produces:
  - `EditTransactionModal`: Dialog component with pre-population, validation, and submission.
  - `TransactionsTable`: Added `onEdit?: (transaction: Transaction) => void` and `Pencil` button.
  - `DashboardPage`: Integrated edit state and reactive refresh on transaction reconciliation.

- [ ] **Step 1: Write the failing tests**

1. Create `frontend/src/__tests__/EditTransactionModal.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditTransactionModal } from '../components/EditTransactionModal';
import { Account, Transaction } from '../types/api';
import * as apiClient from '../services/apiClient';

describe('EditTransactionModal Component', () => {
  const mockAccounts: Account[] = [
    { id: 'acc-1', name: 'Dompet Tunai', account_type: 'CASH', current_balance: 500000, is_active: true },
    { id: 'acc-2', name: 'Bank BCA', account_type: 'BANK', current_balance: 2000000, is_active: true },
  ];

  const mockTx: Transaction = {
    id: 'tx-edit-1',
    description: 'Beli Makan Siang',
    source_channel: 'WEB_MANUAL',
    transaction_date: '2026-09-22T12:00:00.000Z',
    ledger_entries: [
      { id: 'le-1', entry_type: 'DEBIT', amount: 45000 },
      { id: 'le-2', entry_type: 'CREDIT', amount: 45000, account_id: 'acc-1' },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders pre-populated values when open', () => {
    render(
      <EditTransactionModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={mockTx}
        accounts={mockAccounts}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText('Edit Transaksi')).toBeInTheDocument();
    expect(screen.getByDisplayValue('45000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Beli Makan Siang')).toBeInTheDocument();
  });

  it('submits updated values and triggers onSuccess and onClose', async () => {
    const handleSuccess = vi.fn();
    const handleClose = vi.fn();
    const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({});

    render(
      <EditTransactionModal
        isOpen={true}
        onClose={handleClose}
        transaction={mockTx}
        accounts={mockAccounts}
        onSuccess={handleSuccess}
      />
    );

    const amountInput = screen.getByLabelText(/Nominal Transaksi/i);
    const descInput = screen.getByLabelText(/Keterangan Transaksi/i);

    fireEvent.change(amountInput, { target: { value: '60000' } });
    fireEvent.change(descInput, { target: { value: 'Beli Makan Siang Spesial' } });

    const submitBtn = screen.getByRole('button', { name: /Simpan Perubahan/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiFetchSpy).toHaveBeenCalledWith(
        '/transactions/tx-edit-1',
        expect.objectContaining({
          method: 'PUT',
          body: expect.stringContaining('"amount":60000'),
        })
      );
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('displays error when amount is invalid or zero', async () => {
    render(
      <EditTransactionModal
        isOpen={true}
        onClose={vi.fn()}
        transaction={mockTx}
        accounts={mockAccounts}
        onSuccess={vi.fn()}
      />
    );

    const amountInput = screen.getByLabelText(/Nominal Transaksi/i);
    fireEvent.change(amountInput, { target: { value: '0' } });

    const submitBtn = screen.getByRole('button', { name: /Simpan Perubahan/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Nominal harus berupa angka positif/i)).toBeInTheDocument();
  });
});
```

2. In `frontend/src/__tests__/TransactionsTable.test.tsx`, add test for `onEdit`:

```typescript
  it('calls onEdit when edit pencil button is clicked', () => {
    const handleEdit = vi.fn();
    render(<TransactionsTable transactions={mockTransactions} onDelete={vi.fn()} onEdit={handleEdit} />);

    const editButtons = screen.getAllByRole('button', { name: /Edit transaksi/i });
    expect(editButtons.length).toBe(mockTransactions.length);

    fireEvent.click(editButtons[0]);
    expect(handleEdit).toHaveBeenCalledWith(mockTransactions[0]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend; npx vitest run src/__tests__/EditTransactionModal.test.tsx src/__tests__/TransactionsTable.test.tsx`
Expected: FAIL with `Cannot find module '../components/EditTransactionModal'`

- [ ] **Step 3: Implement minimal code**

1. Create `frontend/src/components/EditTransactionModal.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Calendar, Tag, CreditCard, FileText } from 'lucide-react';
import { Account, Transaction } from '../types/api';
import { apiFetch } from '../services/apiClient';

export interface CategoryOption {
  id: string;
  name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  accounts: Account[];
  categories?: CategoryOption[];
  onSuccess: () => void;
}

export const EditTransactionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  transaction,
  accounts,
  categories = [],
  onSuccess,
}) => {
  const [type, setType] = useState<'EXPENSE' | 'INCOME' | 'TRANSFER'>('EXPENSE');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [fromAccountId, setFromAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [transactionDate, setTransactionDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!transaction) return;

    setDescription(transaction.description || '');

    if (transaction.transaction_date) {
      const d = new Date(transaction.transaction_date);
      const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setTransactionDate(localIso);
    } else {
      setTransactionDate('');
    }

    const entries = transaction.ledger_entries || [];
    const accountEntries = entries.filter((e) => e.account_id);
    const categoryEntry = entries.find((e) => e.category_id);

    if (categoryEntry) {
      setCategoryId(categoryEntry.category_id || '');
    } else {
      setCategoryId('');
    }

    if (accountEntries.length >= 2) {
      setType('TRANSFER');
      const creditEntry = accountEntries.find((e) => e.entry_type === 'CREDIT');
      const debitEntry = accountEntries.find((e) => e.entry_type === 'DEBIT');
      setFromAccountId(creditEntry?.account_id || accounts[0]?.id || '');
      setToAccountId(debitEntry?.account_id || accounts[1]?.id || '');
      setAmount(String(creditEntry?.amount ?? entries[0]?.amount ?? ''));
    } else if (accountEntries.length === 1) {
      const accEntry = accountEntries[0];
      setAmount(String(accEntry.amount ?? ''));
      setAccountId(accEntry.account_id || accounts[0]?.id || '');
      if (accEntry.entry_type === 'CREDIT') {
        setType('EXPENSE');
      } else {
        setType('INCOME');
      }
    } else {
      setAmount(String(entries[0]?.amount ?? ''));
      setAccountId(accounts[0]?.id || '');
      setType('EXPENSE');
    }
    setErrorMsg(null);
  }, [transaction, accounts]);

  if (!isOpen || !transaction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Nominal harus berupa angka positif lebih dari 0.');
      return;
    }
    if (!description.trim()) {
      setErrorMsg('Deskripsi transaksi tidak boleh kosong.');
      return;
    }

    const payload = {
      transaction_type: type,
      amount: parsedAmount,
      description: description.trim(),
      account_id: type !== 'TRANSFER' ? accountId : undefined,
      category_id: type !== 'TRANSFER' && categoryId ? categoryId : undefined,
      from_account_id: type === 'TRANSFER' ? fromAccountId : undefined,
      to_account_id: type === 'TRANSFER' ? toAccountId : undefined,
      transaction_date: transactionDate ? new Date(transactionDate).toISOString() : undefined,
    };

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await apiFetch(`/transactions/${transaction.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal memperbarui transaksi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 text-white shadow-2xl relative my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2 text-white">
              <span>Edit Transaksi</span>
              <span className="text-[10px] font-mono uppercase bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
                Reconciliation
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Perubahan nominal atau rekening akan merekonsiliasi saldo secara otomatis.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
            {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`py-2 rounded-lg font-medium transition-all ${
                  type === t
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t === 'EXPENSE' ? 'Pengeluaran' : t === 'INCOME' ? 'Pemasukan' : 'Transfer'}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="edit-amount-input" className="block text-xs font-medium text-slate-400 mb-1">
              Nominal Transaksi (Rp) *
            </label>
            <input
              id="edit-amount-input"
              type="number"
              min="1"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Contoh: 75000"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 tabular-nums"
            />
          </div>

          <div>
            <label htmlFor="edit-desc-input" className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              <span>Keterangan Transaksi *</span>
            </label>
            <input
              id="edit-desc-input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Belanja Bulanan di Supermarket"
              required
              maxLength={500}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {type !== 'TRANSFER' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-account-select" className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                  <span>Rekening / Akun *</span>
                </label>
                <select
                  id="edit-account-select"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Rp {Number(acc.current_balance).toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="edit-category-select" className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-500" />
                  <span>Kategori (Opsional)</span>
                </label>
                <select
                  id="edit-category-select"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Tanpa Kategori --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="edit-from-account" className="block text-xs font-medium text-slate-400 mb-1">
                  Dari Rekening Asal *
                </label>
                <select
                  id="edit-from-account"
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Rp {Number(acc.current_balance).toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="edit-to-account" className="block text-xs font-medium text-slate-400 mb-1">
                  Ke Rekening Tujuan *
                </label>
                <select
                  id="edit-to-account"
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Rp {Number(acc.current_balance).toLocaleString('id-ID')})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="edit-datetime-input" className="block text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Waktu Transaksi</span>
            </label>
            <input
              id="edit-datetime-input"
              type="datetime-local"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-95 rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

2. In `frontend/src/components/TransactionsTable.tsx`, update Props to accept `onEdit?: (transaction: Transaction) => void`, import `Pencil`, and render the edit button:

```tsx
import React from 'react';
import { Trash2, ArrowUpRight, Clock, Pencil } from 'lucide-react';
import { Transaction } from '../types/api';

interface Props {
  transactions: Transaction[];
  onDelete: (id: string) => Promise<void> | void;
  onEdit?: (transaction: Transaction) => void;
  isLoading?: boolean;
}

export const TransactionsTable: React.FC<Props> = ({
  transactions,
  onDelete,
  onEdit,
  isLoading,
}) => {
  if (transactions.length === 0) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">Belum ada transaksi.</p>
        <p className="text-xs text-slate-500 mt-1">
          Gunakan Omni-Input bar di atas atau catat manual untuk memulai mutasi ledger.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden text-white shadow-xl">
      <div className="p-5 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-base">Riwayat Transaksi Ledger</h3>
          <p className="text-xs text-slate-400 mt-0.5">Pencatatan ganda deterministik & rekonsiliasi otomatis</p>
        </div>
        <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/50">
          {transactions.length} mutasi
        </span>
      </div>
      <div className="divide-y divide-slate-800/60 max-h-96 overflow-y-auto">
        {transactions.map((tx) => {
          const dateStr = new Date(tx.transaction_date).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          });

          const channelBadge = {
            TELEGRAM: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
            AI_OMNI_INPUT: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
            WEB_MANUAL: 'bg-slate-700/50 text-slate-300 border-slate-600/30',
          }[tx.source_channel] || 'bg-slate-800 text-slate-400 border-slate-700/40';

          const amount = tx.ledger_entries?.[0]?.amount ?? 0;

          return (
            <div key={tx.id} className="p-4 hover:bg-slate-800/30 transition-colors flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 shrink-0">
                  <ArrowUpRight className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="font-medium text-sm text-white">{tx.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                    <span>{dateStr}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] border ${channelBadge}`}>
                      {tx.source_channel}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-sm font-bold tabular-nums text-slate-100 mr-1 sm:mr-2">
                  Rp {Number(amount).toLocaleString('id-ID')}
                </span>
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(tx)}
                    disabled={isLoading}
                    className="text-slate-400 hover:text-indigo-400 p-2 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
                    aria-label="Edit transaksi"
                    title="Edit transaksi (rekonsiliasi saldo otomatis)"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDelete(tx.id)}
                  disabled={isLoading}
                  className="text-slate-500 hover:text-rose-400 p-2 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
                  aria-label="Hapus transaksi"
                  title="Hapus transaksi (otomatis kembalikan saldo)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

3. In `frontend/src/pages/DashboardPage.tsx`:
- Import `EditTransactionModal`:
  ```tsx
  import { EditTransactionModal } from '../components/EditTransactionModal';
  ```
- Add state and handlers:
  ```tsx
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  const handleOpenEdit = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsEditModalOpen(true);
  };

  const handleEditSuccess = async () => {
    await loadData();
    setRefreshTrigger((prev) => prev + 1);
  };
  ```
- Pass `onEdit={handleOpenEdit}` to `TransactionsTable`:
  ```tsx
  <TransactionsTable
    transactions={transactions}
    onDelete={handleDeleteTransaction}
    onEdit={handleOpenEdit}
    isLoading={isDeleting}
  />
  ```
- Render `EditTransactionModal` at the bottom of JSX:
  ```tsx
  <EditTransactionModal
    isOpen={isEditModalOpen}
    onClose={() => {
      setIsEditModalOpen(false);
      setEditingTransaction(null);
    }}
    transaction={editingTransaction}
    accounts={accounts}
    onSuccess={handleEditSuccess}
  />
  ```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend; npx vitest run src/__tests__/EditTransactionModal.test.tsx src/__tests__/TransactionsTable.test.tsx`
Expected: PASS (all component tests pass)

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/components/EditTransactionModal.tsx frontend/src/components/TransactionsTable.tsx frontend/src/pages/DashboardPage.tsx frontend/src/__tests__/EditTransactionModal.test.tsx frontend/src/__tests__/TransactionsTable.test.tsx
git commit -m "feat(frontend): implement EditTransactionModal and integrate edit action in TransactionsTable

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: End-to-End Quality Gates & System Verification

**Files:**
- Entire repository backend and frontend suites

**Interfaces:**
- Consumes: All components from Tasks 1 through 4
- Produces: 100% clean verification proof across all linters, typecheckers, test suites, and asset builders.

- [ ] **Step 1: Run backend linting & format check**

Run: `ruff check .`
Expected: `All checks passed!`

Run: `ruff format --check .`
Expected: `All files already formatted.`

- [ ] **Step 2: Run backend static type check**

Run: `mypy rezekify`
Expected: `Success: no issues found in source files`

- [ ] **Step 3: Run full backend pytest suite**

Run: `pytest tests/ -v`
Expected: All tests pass with exit code 0.

- [ ] **Step 4: Run frontend type checking, unit tests, and production build**

Run:
```powershell
cd frontend; npx tsc --noEmit; npm run test; npm run build
```
Expected: TypeScript compiles cleanly with 0 errors, Vitest passes 100% of test suites, Vite production build succeeds (`dist/` generated).

- [ ] **Step 5: Commit verification proof**

```powershell
git commit --allow-empty -m "chore(verification): verify exit code 0 across full backend and frontend quality gates

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```
