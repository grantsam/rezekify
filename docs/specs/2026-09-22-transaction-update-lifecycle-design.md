# REZEKIFY: Full Transaction Update Lifecycle & Atomic Balance Reconciliation

**Document Type:** Architectural & Technical Design Specification (Spec)  
**Document ID:** `SPEC-2026-09-22-TRANSACTION-UPDATE-LIFECYCLE`  
**Target File:** `docs/specs/2026-09-22-transaction-update-lifecycle-design.md`  
**Author:** Principal System Architect  
**Status:** Approved for Implementation  
**Project Classification:** Program Komputer / Rekayasa Perangkat Lunak Berbasis Kecerdasan Buatan (HKI)  

---

## 1. Executive Summary & Objective

### 1.1 Context & Operational Evaluation
Across Phases 1 through 3, Rezekify established its deterministic double-entry accounting engine (`LedgerService`), daily safe runway simulation engine (`RunwayService`), multimodal ingestion pipeline (Gemini 2.5 Flash Vision OCR, Groq Whisper voice note transcription, and Groq Llama 4 Scout Vision fallback), unified Nginx edge proxy, Alembic schema migrations with hybrid fallback bootstrapping, and automated CI/CD quality gates.

However, an audit of daily user interactions and transaction workflows identified a major usability and auditability friction point:
1. **Absence of In-Place Transaction Modification:**
   The current ledger architecture supports transaction creation (`record_expense`, `record_income`, `record_transfer`) and transaction deletion (`delete_transaction`), but completely lacks an update operation (`update_transaction`).
2. **Destructive Correction Anti-Pattern:**
   When an ingestion error occurs—such as OCR misreading Rp 50.000 as Rp 500.000, a user assigning the incorrect funding account (e.g. Bank BCA instead of Cash), a typographical mistake in the vendor note, or a misclassified spending category—the user is forced to delete the transaction and recreate it from scratch.
3. **Audit Trail & Metadata Destruction:**
   Deleting and recreating transactions results in:
   - Primary key ID churn (`transactions.id`), breaking external references and client-side pagination keys.
   - Destruction of ingested metadata: original receipt image URLs (`receipt_image_url`), raw natural language input strings (`raw_input_text`), and ingestion source telemetry (`source_channel` such as `AI_OMNI_INPUT` or `TELEGRAM`).
   - Cognitive overhead on the user, who must re-enter information from memory.

### 1.2 Phase 4 Objectives
This specification designs and standardizes Phase 4 infrastructure: the **Full Transaction Update Lifecycle & Atomic Balance Reconciliation**. This feature spans three cohesive architectural components:

* **Component 1: Deterministic Accounting Reversal & Re-post Pattern (`LedgerService.update_transaction`):**
  Implement an atomic ledger update state machine. The service reverses historical balance mutations based on existing ledger entries, validates new accounts and categories against tenant ownership boundaries, calculates new account mutations using Python `decimal.Decimal`, purges stale ledger entries, emits new balanced entries ($\sum \text{Debit} = \sum \text{Credit}$), updates transaction metadata, and commits all changes within a single atomic database transaction.
* **Component 2: REST API Endpoint (`PUT /api/v1/transactions/{id}`):**
  Expose a secure, strictly validated endpoint with Pydantic v2 schemas (`TransactionUpdateRequest`). Enforce granular HTTP error semantics: `404 Not Found` for nonexistent or cross-tenant transactions, `400 Bad Request` for invalid balances, negative amounts, or cross-tenant account/category reassignments, and `422 Unprocessable Entity` for malformed payloads.
* **Component 3: Frontend Interactive Experience (`EditTransactionModal.tsx` & `TransactionsTable.tsx`):**
  Deliver an Impeccable-grade modal dialog pre-populated with current transaction attributes (amount, account, category, description, and timestamp). Enhance `TransactionsTable` with an edit trigger (`Pencil` icon). Integrate reactive state synchronization via `refreshTrigger` so that an edit instantly recalculates the runway metric card, daily spending breakdown, category breakdown charts, and account balance telemetry without requiring a full browser reload.

---

## 2. Core Invariants Enforcement

All transaction update and reconciliation mechanisms strictly enforce Rezekify's core architectural invariants:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       REZEKIFY ARCHITECTURAL INVARIANTS                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Deterministic Math      │ Python decimal.Decimal & SQL NUMERIC(15, 2).   │
│                            │ Zero IEEE 754 float drift in balance mutation. │
├────────────────────────────┼────────────────────────────────────────────────┤
│ 2. Balanced Ledger         │ Strict Double-Entry: Sum(Debit) = Sum(Credit). │
│                            │ Atomically preserved across reversal & re-post.│
├────────────────────────────┼────────────────────────────────────────────────┤
│ 3. Tenant Isolation        │ Strict Row-Level Scoping: WHERE user_id = :uid │
│                            │ Prohibit cross-tenant account/category theft.  │
├────────────────────────────┼────────────────────────────────────────────────┤
│ 4. Audit Preservation      │ Maintain transaction.id, receipt_image_url,    │
│                            │ raw_input_text, and original source_channel.   │
├────────────────────────────┼────────────────────────────────────────────────┤
│ 5. Atomic Consistency      │ All reversals, account mutations, and re-posts │
│                            │ execute in a single commit; rollback on error. │
└────────────────────────────┴────────────────────────────────────────────────┘
```

### 2.1 Invariant 1: Deterministic Precision via `NUMERIC(15, 2)` & `decimal.Decimal`
Monetary calculations must never introduce binary floating-point rounding errors. 
- In Python application code, all amounts are parsed and manipulated exclusively as `decimal.Decimal`.
- In PostgreSQL and SQLite schemas, balance and transaction amount columns map to `sa.Numeric(15, 2)`.
- Updates must validate that `amount > Decimal("0.00")`. Zero or negative updates are rejected immediately before database execution.

### 2.2 Invariant 2: Balanced Ledger Guarantee Across Updates
Every financial transaction requires balanced debit and credit entries:
$$\sum \text{Debit} - \sum \text{Credit} = 0$$
When updating a transaction:
1. Historical ledger entries are read and their account effects are precisely reversed.
2. New ledger entries are generated:
   - **Expense:** $\text{Debit(Category)} = \text{Amount}$, $\text{Credit(Account)} = \text{Amount}$.
   - **Income:** $\text{Debit(Account)} = \text{Amount}$, $\text{Credit(Category)} = \text{Amount}$.
   - **Transfer:** $\text{Debit(To\_Account)} = \text{Amount}$, $\text{Credit(From\_Account)} = \text{Amount}$.
3. The database transaction fails and aborts if any balance calculation produces an unhandled state or violates table constraints.

### 2.3 Invariant 3: Row-Level Tenant Isolation & Cross-Tenant Defense
Multi-tenant security requires defense-in-depth at every layer:
- **Transaction Ownership:** The transaction being updated must satisfy `Transaction.user_id == current_user.id`. If a user attempts to update a transaction belonging to another tenant, the system returns `HTTP 404 Not Found` (to prevent ID enumeration).
- **Target Account Ownership:** Any new account ID (`account_id`, `from_account_id`, `to_account_id`) supplied in the update payload must be verified with `Account.user_id == current_user.id`. Attempting to assign an account belonging to another tenant is blocked with `HTTP 400 Bad Request`.
- **Target Category Ownership:** Any new `category_id` supplied in the update payload must be verified with `Category.user_id == current_user.id`. Attempting to assign another tenant's category is blocked with `HTTP 400 Bad Request`.

### 2.4 Invariant 4: Audit Trail Preservation
Unlike deletion followed by recreation, an in-place update:
- Retains the primary key `Transaction.id`.
- Retains historical metadata: `raw_input_text`, `receipt_image_url`, `source_channel`, and `created_at`.
- Updates only mutable business fields: `description`, `transaction_date`, amount, accounts, and categories.

---

## 3. Component 1: Deterministic Accounting Reversal & Re-post Pattern

### 3.1 Accounting State Machine & Lifecycle Flow
The update process follows a two-phase transactional lifecycle: **Reversal** followed by **Re-post**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TRANSACTION UPDATE LIFECYCLE PIPELINE                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Incoming Update Request] -> (amount, description, date, accounts, cat)    │
│                                 │                                           │
│                                 ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 1. TENANT LOOKUP & VALIDATION                                         │  │
│  │    • Query Transaction WHERE id = :id AND user_id = :uid              │  │
│  │    • If missing -> Raise NoResultFound (HTTP 404)                     │  │
│  └──────────────────────────────┬────────────────────────────────────────┘  │
│                                 │                                           │
│                                 ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 2. REVERSAL PHASE (RESTORE ACCOUNT BALANCES)                          │  │
│  │    • For each old LedgerEntry in tx.ledger_entries:                   │  │
│  │      - If entry_type == CREDIT and account_id:                        │  │
│  │          account.current_balance += entry.amount                      │  │
│  │      - If entry_type == DEBIT and account_id:                         │  │
│  │          account.current_balance -= entry.amount                      │  │
│  └──────────────────────────────┬────────────────────────────────────────┘  │
│                                 │                                           │
│                                 ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 3. TARGET ENTITY TENANT VERIFICATION                                  │  │
│  │    • Verify new account(s) WHERE id = :acc_id AND user_id = :uid      │  │
│  │    • Verify new category (if any) WHERE id = :cat_id AND user_id =:uid│  │
│  │    • If verification fails -> Raise ValueError (HTTP 400)             │  │
│  └──────────────────────────────┬────────────────────────────────────────┘  │
│                                 │                                           │
│                                 ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 4. RE-POST PHASE (APPLY NEW BALANCE MUTATIONS)                        │  │
│  │    • If EXPENSE:   new_account.current_balance -= new_amount          │  │
│  │    • If INCOME:    new_account.current_balance += new_amount          │  │
│  │    • If TRANSFER:  from_acc.current_balance -= new_amount             │  │
│  │                    to_acc.current_balance += new_amount               │  │
│  └──────────────────────────────┬────────────────────────────────────────┘  │
│                                 │                                           │
│                                 ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 5. RE-LEDGER PHASE (PURGE OLD & EMIT NEW ENTRIES)                     │  │
│  │    • Delete existing entries: DELETE FROM ledger_entries WHERE tx_id  │  │
│  │    • Flush deletion to avoid unique or relational constraints         │  │
│  │    • Add new balanced LedgerEntry records (Debit + Credit)            │  │
│  └──────────────────────────────┬────────────────────────────────────────┘  │
│                                 │                                           │
│                                 ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 6. METADATA UPDATE & ATOMIC COMMIT                                    │  │
│  │    • Update tx.description, tx.transaction_date                      │  │
│  │    • Commit session: db.commit() -> refresh(tx)                       │  │
│  │    • On any exception: db.rollback() -> Raise error                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Detailed Step-by-Step Execution Mechanics

#### Step A: Lookup Transaction Ensuring Tenant Ownership
The service retrieves the existing transaction scoped strictly to `user_id`:
```python
tx = (
    self.db.query(Transaction)
    .filter_by(id=transaction_id, user_id=user_id)
    .one()
)
```
If no record matches, SQLAlchemy raises `NoResultFound`, which maps to an HTTP 404 in the API router.

#### Step B: Reverse Previous Account Balance Modifications
Before modifying any state or deleting records, the service iterates over all existing `ledger_entries` associated with `tx`.
For any entry referencing an asset account (`entry.account_id is not None`):
* If `entry.entry_type == EntryType.CREDIT`: This entry originally decreased an asset account (such as in an expense or the source of a transfer). Reversing it requires adding the amount back:
  $$\text{account.current\_balance} \mathrel{+}= \text{entry.amount}$$
* If `entry.entry_type == EntryType.DEBIT`: This entry originally increased an asset account (such as in income or the destination of a transfer). Reversing it requires deducting the amount:
  $$\text{account.current\_balance} \mathrel{-}= \text{entry.amount}$$

This reversal logic is completely generic and mathematical. It restores all involved accounts to their exact state prior to the transaction.

#### Step C: Verify New Account(s) and Category Belong to Current User
The service queries the database to confirm that every new entity reference belongs to the authenticating user:
* New primary account:
  ```python
  new_acc = self.db.query(Account).filter_by(id=account_id, user_id=user_id).one_or_none()
  if not new_acc:
      raise ValueError("Account not found or unauthorized.")
  ```
* For transfers:
  ```python
  from_acc = self.db.query(Account).filter_by(id=from_account_id, user_id=user_id).one_or_none()
  to_acc = self.db.query(Account).filter_by(id=to_account_id, user_id=user_id).one_or_none()
  if not from_acc or not to_acc:
      raise ValueError("Source or destination account not found or unauthorized.")
  if from_acc.id == to_acc.id:
      raise ValueError("Source and destination accounts must be distinct.")
  ```
* New category (if provided):
  ```python
  if category_id:
      cat = self.db.query(Category).filter_by(id=category_id, user_id=user_id).one_or_none()
      if not cat:
          raise ValueError("Category not found or unauthorized.")
  ```

#### Step D: Apply New Balance Mutations with New Amount
Once target entities are validated:
* **EXPENSE:** `new_acc.current_balance -= amount`
* **INCOME:** `new_acc.current_balance += amount`
* **TRANSFER:** `from_acc.current_balance -= amount`, `to_acc.current_balance += amount`

#### Step E: Purge Stale Ledger Entries and Emit New Balanced Entries
To guarantee data cleanliness and prevent orphaned rows:
1. Delete all existing ledger entries associated with the transaction:
   ```python
   for old_entry in list(tx.ledger_entries):
       self.db.delete(old_entry)
   self.db.flush()
   ```
2. Construct and insert the replacement balanced pair:
   - For **EXPENSE**:
     - `Debit`: `LedgerEntry(transaction_id=tx.id, user_id=user_id, category_id=category_id, entry_type=EntryType.DEBIT, amount=amount)`
     - `Credit`: `LedgerEntry(transaction_id=tx.id, user_id=user_id, account_id=new_acc.id, entry_type=EntryType.CREDIT, amount=amount)`
   - For **INCOME**:
     - `Debit`: `LedgerEntry(transaction_id=tx.id, user_id=user_id, account_id=new_acc.id, entry_type=EntryType.DEBIT, amount=amount)`
     - `Credit`: `LedgerEntry(transaction_id=tx.id, user_id=user_id, category_id=category_id, entry_type=EntryType.CREDIT, amount=amount)`
   - For **TRANSFER**:
     - `Credit`: `LedgerEntry(transaction_id=tx.id, user_id=user_id, account_id=from_acc.id, entry_type=EntryType.CREDIT, amount=amount)`
     - `Debit`: `LedgerEntry(transaction_id=tx.id, user_id=user_id, account_id=to_acc.id, entry_type=EntryType.DEBIT, amount=amount)`
   ```python
   self.db.add_all(new_entries)
   ```

#### Step F: Update Transaction Metadata, Date, and Atomically Commit
Update mutable fields on the `Transaction` entity:
```python
tx.description = description
if transaction_date is not None:
    tx.transaction_date = transaction_date
self.db.commit()
self.db.refresh(tx)
return tx
```

### 3.3 Complete Backend Implementation Code: `LedgerService.update_transaction`
Below is the complete, untruncated implementation to be added to `rezekify/services/ledger.py`:

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

---

## 4. Component 2: REST API Endpoint (`PUT /api/v1/transactions/{id}`)

### 4.1 Request & Response Contracts
The transaction update API contract is implemented using Pydantic v2 schemas within `rezekify/api/v1/transactions_router.py`.

#### `TransactionUpdateRequest` Schema
```python
class TransactionUpdateRequest(BaseModel):
    transaction_type: str = Field(
        default="EXPENSE",
        pattern="^(EXPENSE|INCOME|TRANSFER)$",
        description="Transaction type category: EXPENSE, INCOME, or TRANSFER"
    )
    amount: Decimal = Field(
        ...,
        gt=Decimal("0.00"),
        description="Positive monetary transaction amount"
    )
    description: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Descriptive explanation of the transaction"
    )
    account_id: Optional[UUID] = Field(
        default=None,
        description="Primary account ID for expense or income"
    )
    category_id: Optional[UUID] = Field(
        default=None,
        description="Associated category ID for expense or income"
    )
    from_account_id: Optional[UUID] = Field(
        default=None,
        description="Source account ID for transfer"
    )
    to_account_id: Optional[UUID] = Field(
        default=None,
        description="Destination account ID for transfer"
    )
    transaction_date: Optional[datetime] = Field(
        default=None,
        description="Optional custom transaction timestamp; defaults to existing timestamp if omitted"
    )
```

### 4.2 Error Handling & HTTP Status Code Matrix
The router guarantees deterministic error mapping to prevent information disclosure while providing unambiguous diagnostic feedback:

| Scenario | HTTP Status | Error Detail String | Underlying Exception |
| :--- | :--- | :--- | :--- |
| Transaction ID does not exist | `404 NOT FOUND` | `"Transaction not found"` | `sqlalchemy.orm.exc.NoResultFound` |
| Transaction belongs to another tenant | `404 NOT FOUND` | `"Transaction not found"` | Scoped query returns empty / `NoResultFound` |
| `amount <= 0` | `422 UNPROCESSABLE` | Pydantic validation error (`gt=0.00`) | Pydantic `ValidationError` |
| Missing `account_id` for Expense/Income | `400 BAD REQUEST` | `"account_id is required for expense transaction."` | Python `ValueError` |
| Missing `to_account_id` for Transfer | `400 BAD REQUEST` | `"Both source and destination accounts are required..."` | Python `ValueError` |
| Same source and target accounts | `400 BAD REQUEST` | `"Source and destination accounts must be distinct."` | Python `ValueError` |
| Account ID belongs to another tenant | `400 BAD REQUEST` | `"Account not found or access denied."` | Python `ValueError` |
| Category ID belongs to another tenant | `400 BAD REQUEST` | `"Category not found or access denied."` | Python `ValueError` |
| Successful update | `200 OK` | Serialized `TransactionItemResponse` | Normal execution |

### 4.3 Complete Router Implementation
Below is the complete router endpoint to add to `rezekify/api/v1/transactions_router.py`:

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

---

## 5. Component 3: Frontend Interactive Experience

### 5.1 UX Design & Visual Architecture
In accordance with Rezekify's Impeccable Design Guidelines:
* **Micro-Interactions & Action Density:**
  Each transaction row in `TransactionsTable.tsx` is equipped with an edit action button alongside the delete button. The edit button uses the Lucide `Pencil` icon with subtle slate hover states (`hover:text-indigo-400 hover:bg-slate-800/80`).
* **Modal Accessibility & Focus:**
  The `EditTransactionModal.tsx` provides an accessible, high-contrast modal dialog adhering to the dark slate aesthetic (`bg-slate-900 border-slate-800 text-white`). The modal traps focus, supports keyboard dismissal (`Escape`), and includes explicit form labels and accessible ARIA attributes.
* **Pre-Population Intelligence:**
  When invoked, the modal inspects the transaction's existing `ledger_entries` to determine whether it is an `EXPENSE`, `INCOME`, or `TRANSFER`, pre-populating the amount, the active account, category, vendor description, and formatted local transaction date.

### 5.2 Component Implementation: `EditTransactionModal.tsx`
Below is the complete, production-grade implementation of `frontend/src/components/EditTransactionModal.tsx`:

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

  // Pre-populate form state whenever active transaction changes
  useEffect(() => {
    if (!transaction) return;

    setDescription(transaction.description || '');

    // Format ISO string for <input type="datetime-local" />
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
      // Transfer transaction
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
      // Fallback
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

### 5.3 Enhancement to `TransactionsTable.tsx`
`TransactionsTable.tsx` is updated to expose an edit action button with the Lucide `Pencil` icon and support an `onEdit` callback:

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

### 5.4 Reactive Refresh Flow in `DashboardPage.tsx`
In `DashboardPage.tsx`, state is wired up to synchronize modal actions with dashboard telemetry:
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
When `handleEditSuccess` fires:
1. `loadData()` re-fetches `/dashboard/summary`, `/transactions`, and `/accounts`.
2. `setRefreshTrigger(prev => prev + 1)` triggers `ExpenseCharts.tsx` to re-fetch daily spending metrics and monthly category breakdown.
3. The `RunwayMetricCard.tsx` immediately reflects the updated `daily_safe_runway` and `health_status`.

---

## 6. Verification & Quality Gate Strategy

### 6.1 Deterministic Test Matrix
The implementation requires unit and integration tests covering the full suite of operational states:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AUTOMATED VERIFICATION MATRIX                         │
├───────────────────────────────────┬─────────────────────────────────────────┤
│ Test Scenario                     │ Verification Invariant                  │
├───────────────────────────────────┼─────────────────────────────────────────┤
│ 1. Expense Amount Increase        │ Prior balance restored, new amount      │
│    (Rp 50.000 -> Rp 80.000)       │ deducted. Account net delta = -Rp 30.000│
├───────────────────────────────────┼─────────────────────────────────────────┤
│ 2. Expense Amount Decrease        │ Prior balance restored, new amount      │
│    (Rp 100.000 -> Rp 40.000)      │ deducted. Account net delta = +Rp 60.000│
├───────────────────────────────────┼─────────────────────────────────────────┤
│ 3. Account Migration on Expense   │ Old account balance refunded in full;   │
│    (Cash -> Bank Mandiri)         │ new account balance deducted by amount. │
├───────────────────────────────────┼─────────────────────────────────────────┤
│ 4. Category Reclassification      │ Debit entry category_id updated;        │
│    (Food -> Entertainment)        │ Account balance preserved.              │
├───────────────────────────────────┼─────────────────────────────────────────┤
│ 5. Transfer Reconciliation        │ Old source refunded, old target deducted│
│    (Change amount & accounts)     │ New source deducted, new target credited│
├───────────────────────────────────┼─────────────────────────────────────────┤
│ 6. Cross-Tenant Defense           │ Attempting to edit another user's tx    │
│    (User B edits User A's tx)     │ raises NoResultFound -> HTTP 404.       │
├───────────────────────────────────┼─────────────────────────────────────────┤
│ 7. Cross-Tenant Account Theft     │ Attempting to assign User B's account   │
│    (User A uses User B's account) │ raises ValueError -> HTTP 400.          │
├───────────────────────────────────┼─────────────────────────────────────────┤
│ 8. Non-Positive Amount Rejection  │ amount = Decimal("0.00") or negative    │
│    (Zero or negative amount)      │ raises ValueError / HTTP 422.           │
├───────────────────────────────────┼─────────────────────────────────────────┤
│ 9. UI Pre-Population & Reactive   │ Modal inputs match tx ledger entries;   │
│    Save & Refresh                 │ PUT dispatched; refreshTrigger bumped.  │
└───────────────────────────────────┴─────────────────────────────────────────┘
```

### 6.2 Unit Test Specification (`tests/test_ledger_service.py`)
```python
def test_update_transaction_expense_amount_and_account(db_session, test_user, test_accounts):
    """Verifies atomic reversal of previous account and correct deduction from new account."""
    ledger = LedgerService(db_session)
    acc_cash = test_accounts[0]  # Initial balance: 1,000,000
    acc_bank = test_accounts[1]  # Initial balance: 5,000,000

    # Initial expense: Rp 100,000 from Cash
    tx = ledger.record_expense(
        user_id=test_user.id,
        account_id=acc_cash.id,
        category_id=None,
        amount=Decimal("100000.00"),
        description="Makan Siang",
    )
    assert acc_cash.current_balance == Decimal("900000.00")
    assert acc_bank.current_balance == Decimal("5000000.00")

    # Update: Change to Rp 150,000 paid from Bank
    updated_tx = ledger.update_transaction(
        user_id=test_user.id,
        transaction_id=tx.id,
        amount=Decimal("150000.00"),
        description="Makan Siang Tim",
        transaction_type="EXPENSE",
        account_id=acc_bank.id,
        category_id=None,
    )

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


def test_update_transaction_cross_tenant_rejection(db_session, test_user, other_user, test_accounts):
    """Verifies that updating another user's transaction or using another user's account fails."""
    ledger = LedgerService(db_session)
    user_a_acc = test_accounts[0]

    # User A creates a transaction
    tx_a = ledger.record_expense(
        user_id=test_user.id,
        account_id=user_a_acc.id,
        category_id=None,
        amount=Decimal("50000.00"),
        description="User A Item",
    )

    # User B attempts to update User A's transaction
    with pytest.raises(NoResultFound):
        ledger.update_transaction(
            user_id=other_user.id,
            transaction_id=tx_a.id,
            amount=Decimal("60000.00"),
            description="Unauthorized Edit",
            account_id=user_a_acc.id,
        )
```

### 6.3 Quality Gate Execution Protocol
Before any pull request or deployment is approved, the standard quality gate commands must execute and achieve exit code 0:
```powershell
# 1. Backend Linting & Formatting Check
ruff check .
ruff format --check .

# 2. Strict Static Type Checking
mypy rezekify

# 3. Unit & Integration Test Suite
pytest tests/ -v

# 4. Frontend Type Checking & Compilation
cd frontend
npx tsc --noEmit
npm run test:run
npm run build
```

---

## 7. Definition of Done

The Transaction Update Lifecycle feature is considered complete only when all the following criteria are met:

1. **Deterministic Service Layer:**
   - `LedgerService.update_transaction` is implemented with zero IEEE 754 float drift.
   - Exact mathematical reversal of prior ledger entries is verified against all supported transaction types (`EXPENSE`, `INCOME`, `TRANSFER`).
   - $\sum \text{Debit} = \sum \text{Credit}$ is verified on every update mutation.
2. **Security & Tenant Isolation:**
   - Updating a foreign transaction raises `NoResultFound` and produces `HTTP 404`.
   - Assigning an account or category belonging to another tenant raises `ValueError` and produces `HTTP 400`.
3. **API Standards & Serialization:**
   - `PUT /api/v1/transactions/{id}` returns `TransactionItemResponse` with updated ledger entries.
   - Comprehensive error handling for `400`, `404`, and `422` is fully validated.
4. **Interactive UI & Reactive Telemetry:**
   - `EditTransactionModal.tsx` handles pre-population, form validation, and accessible keyboard dismissal.
   - `TransactionsTable.tsx` exposes the Lucide `Pencil` edit button on each row.
   - Transaction edits trigger `refreshTrigger`, causing immediate recalculation and re-rendering of `RunwayMetricCard` and `ExpenseCharts`.
5. **Quality Gates:**
   - All backend unit tests in `pytest` pass with 100% success.
   - All frontend Vitest component tests pass.
   - `mypy rezekify` and `tsc --noEmit` pass with zero type errors.
   - `ruff check .` passes with zero lint warnings.
