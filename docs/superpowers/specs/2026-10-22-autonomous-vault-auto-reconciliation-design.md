# Specification: Autonomous FIXED_BILL Vault Auto-Reconciliation & Ledger Linking (Phase 7)

**Date**: 2026-10-22  
**Status**: Approved (Architecture Design Spec)  
**Target Surface**:  
- `rezekify/services/vault_reconciliation.py` (New Service)  
- `rezekify/agent/tools.py` & `rezekify/agent/orchestrator.py` (Tool Integration)  
- `rezekify/api/v1/transactions_router.py` (API Contract & Endpoint Mutation)  
- `frontend/src/types/api.ts` (TypeScript Type Contracts)  
- `frontend/src/components/ManualTransactionModal.tsx` (Manual Linking Affordance)  
- `frontend/src/components/TransactionsTable.tsx` (Visual Badge & Ledger Audit)  

---

## 1. Problem Statement & User Intent

### 1.1 Context & Problem
In Rezekify, vaults act as mental accounting containers:
1. `SAVINGS` goals: Sinking funds dedicated to long-term objectives (e.g., Dana Darurat, Liburan).
2. `FIXED_BILL` commitments: Recurring monthly obligations (e.g., "Wifi Indihome", "Listrik PLN", "Kost Bulanan", "BPJS Kesehatan"). These vaults lock money away from operational free cash and generate warning telemetry (such as H-7 due date alerts in the cockpit runway).

Currently, when a user logs recurring expenses (e.g., natural language commands such as *"Bayar wifi Indihome 350rb BCA"*, omni-input text, mobile receipt camera captures for utility bills, or manual form inputs):
- The transaction is recorded solely as an unlinked double-entry ledger expense (`Transaction` + debit category / credit account `LedgerEntry`).
- The corresponding `FIXED_BILL` vault remains completely unsettled: its `allocated_amount` stays locked, its `target_date` is not advanced, and its status is never marked as paid for the cycle.
- **The symptom**: The user suffers from double deduction in mental accounting. Their bank balance decreases by Rp 350.000, yet the runway continues to subtract the locked vault allocation from operational free cash. Redundant H-7 warning cards continue to prompt the user to pay a bill that has already been settled.

### 1.2 User Intent
One-shot autonomous reconciliation. Logging a bill payment—whether via AI natural language, receipt OCR, or manual input—must atomically:
1. Deduct the payment account balance.
2. Record the balanced double-entry ledger expense.
3. Automatically match and settle the active `FIXED_BILL` vault:
   - Reset the vault's locked allocation (`allocated_amount`) to Rp 0.00.
   - Advance the bill's `target_date` by +1 calendar month using deterministic clamping (`advance_one_month`).
   - Associate the debit `LedgerEntry.vault_id` with the settled vault.
4. Invalidate the user's runway cache (`RunwayService.clear_cache(user_id)`).
5. Provide clear AI feedback confirming both the expense mutation and the vault rollover.

---

## 2. Goals, Non-Goals, and Anti-Goals

### 2.1 Goals
- **Autonomous Matching Heuristics**: Deterministically match expense descriptions and merchant names against active `FIXED_BILL` vaults in `record_transaction` tool execution and `AgentOrchestrator._execute_action`.
- **Explicit Linking Contract**: Support an optional `vault_id: Optional[UUID]` in `TransactionCreateRequest` and provide a dropdown in `ManualTransactionModal.tsx` for explicit user selection.
- **Atomic Settlement & Due-Date Rollover**: Reset vault locked allocation to Rp 0 and advance the billing cycle by exactly +1 calendar month in a single atomic database transaction.
- **Audit Traceability**: Stamp `LedgerEntry.vault_id` on the expense entry so historical ledger records track which commitment was settled.
- **Informative AI Feedback**: Return transparent agent feedback indicating both transaction capture and vault cycle update (e.g., *"Tagihan Wifi Indihome lunas, jatuh tempo diperbarui ke 2026-11-20"*).
- **Cockpit Visual Verification**: Display a linked Vault badge (`🔒 Pos: [Nama Vault]`) in `TransactionsTable` and transaction cards.

### 2.2 Non-Goals
- **No Automatic Modification of `SAVINGS` Vaults**: Sinking funds for savings are not bills. Generic expenses must never auto-deduct or settle `SAVINGS` vaults.
- **No Ambiguous Guessing**: If token matching returns multiple plausible bills or low confidence, the system MUST NOT guess. It falls back to a standard unlinked expense to prevent settling the wrong bill.
- **No Automatic Creation of New Vaults**: The auto-reconciliation engine only reconciles against pre-existing user vaults; it does not synthesize new vaults.
- **No Variable Cadence Calculation**: Billing cycles for `FIXED_BILL` rollover remain strictly monthly (+1 month).

### 2.3 Anti-Goals
- **Zero Balance Drift**: Every mutation must strictly preserve the double-entry accounting invariant ($\sum \text{Debit} = \sum \text{Credit}$). `vault_id` is an audit attribute on the debit `LedgerEntry` and never alters monetary balances.
- **No Silent Date Skipping**: A vault's due date must NEVER advance without a verified double-entry expense record.
- **No Cross-Tenant Leaks**: All matching, lookup, and settlement logic must strictly enforce `user_id == current_user.id`.
- **Zero Floating-Point Math**: Strict integer or `Decimal` calculations; no floats for monetary values.

---

## 3. Architecture & Data Flow

### 3.1 Reconciliation Engine (`rezekify/services/vault_reconciliation.py`)

A dedicated service encapsulates the auto-matching and settlement logic, keeping `LedgerService` focused on pure double-entry accounting and `AgentToolDispatcher` on orchestration:

```
[User Input: "Bayar wifi Indihome 350rb BCA" / Manual Modal]
                       │
                       ▼
         [record_transaction / create_transaction]
                       │
                       ├───────────────────────────────────────────┐
                       ▼                                           ▼
             (Double-Entry Ledger)                    (Vault Reconciliation)
          Debit Category: Rp 350.000             find_matching_fixed_bill_vault()
          Credit BCA:     Rp 350.000                               │
                       │                                           ▼
                       │                             Matched: "Wifi Indihome"
                       │                                           │
                       └───────────────────┬───────────────────────┘
                                           ▼
                     [reconcile_fixed_bill_vault(db, user, vault, tx)]
                                           │
                       ┌───────────────────┴───────────────────────┐
                       ▼                                           ▼
          vault.allocated_amount = 0.00              debit_entry.vault_id = vault.id
          vault.target_date += 1 month               RunwayService.clear_cache(user_id)
```

#### Primary Signatures:
```python
class VaultReconciliationResult(BaseModel):
    reconciled: bool
    vault_id: Optional[UUID] = None
    vault_name: Optional[str] = None
    previous_due_date: Optional[date] = None
    new_due_date: Optional[date] = None
    previous_allocated_amount: Optional[Decimal] = None

class VaultReconciliationService:
    def __init__(self, db: Session):
        self.db = db

    def find_matching_fixed_bill_vault(
        self,
        user_id: UUID,
        description: str,
        amount: Optional[Decimal] = None,
    ) -> Optional[Vault]:
        """Matches transaction description against user's active FIXED_BILL vaults."""
        ...

    def reconcile_fixed_bill_vault(
        self,
        user_id: UUID,
        vault: Vault,
        transaction: Transaction,
        amount: Decimal,
    ) -> VaultReconciliationResult:
        """Atomically resets vault allocated_amount, rolls target_date by +1 month,
        associates debit LedgerEntry.vault_id, and invalidates runway cache."""
        ...
```

### 3.2 Matching Heuristics & Stop-Word Filtering

The matching algorithm executes in deterministic stages:
1. **Candidate Retrieval**:
   Query all vaults where `user_id == user_id` and `vault_type == VaultType.FIXED_BILL`. If no active bills exist, return `None` immediately.
2. **Text Normalization**:
   Lowercase the transaction description and strip punctuation characters.
3. **Stop-Word Removal**:
   Filter out common Indonesian financial and transaction noise words:
   ```python
   STOP_WORDS = {
       "bayar", "tagihan", "beli", "bulan", "bulanan", "lunas", "ke", "di",
       "via", "pembayaran", "trx", "transfer", "biaya", "rek", "rekening",
       "nominal", "sebesar", "untuk", "buat", "pakai", "dari"
   }
   ```
4. **Token Matching**:
   - Extract keywords of length $\ge 3$.
   - Compute normalized name match:
     - Exact match: `normalized_vault_name in normalized_description`.
     - Reverse match: `normalized_description in normalized_vault_name`.
     - Token overlap: Set intersection between description tokens and vault name tokens.
5. **Disambiguation & Ambiguity Guard**:
   - If exactly **one** `FIXED_BILL` vault matches: select it.
   - If **multiple** vaults match (e.g. "Listrik Rumah" and "Listrik Kantor"):
     - If `amount` is provided and matches `vault.target_amount` or `vault.allocated_amount` for exactly one candidate, select that candidate.
     - Otherwise, mark as ambiguous and return `None` (anti-goal: prevent accidental settlement of wrong bills).

### 3.3 Atomic Vault Settlement Mutations
When `reconcile_fixed_bill_vault` executes:
1. Verify tenant ownership: `assert vault.user_id == user_id` and `assert transaction.user_id == user_id`.
2. Record state snapshot for telemetry: `previous_due_date = vault.target_date`, `previous_allocated = vault.allocated_amount`.
3. Reset allocated funds: `vault.allocated_amount = Decimal("0.00")`.
4. Advance due date:
   ```python
   if vault.target_date:
       vault.target_date = advance_one_month(vault.target_date)
   ```
5. Stamp `vault_id` on the debit entry:
   Find `LedgerEntry` for `transaction` where `entry_type == EntryType.DEBIT` and set `entry.vault_id = vault.id`.
6. Flush & clear cache:
   `self.db.flush()`  
   `RunwayService.clear_cache(user_id=user_id)`

### 3.4 Integration with AI Agent & Tools

#### `record_transaction` Tool (`rezekify/agent/tools.py`)
In `_dispatch_record_transaction`:
```python
if action == "expense":
    # 1. Standard ledger recording
    tx = self.ledger_service.record_expense(...)
    
    # 2. Check for matching FIXED_BILL vault
    recon_service = VaultReconciliationService(self.db)
    vault = recon_service.find_matching_fixed_bill_vault(
        user_id=user_id,
        description=validated.description,
        amount=validated.amount,
    )
    reconciled_info = None
    if vault:
        res = recon_service.reconcile_fixed_bill_vault(
            user_id=user_id,
            vault=vault,
            transaction=tx,
            amount=validated.amount,
        )
        reconciled_info = res.model_dump()
        self.db.commit()
```
When `reconciled_info` is present, the dispatcher appends a cognitive confirmation message:
`"Pos tagihan '{vault.name}' otomatis diselesaikan. Jatuh tempo berikutnya: {new_due_date}."`

#### `manage_vault` Tool (`rezekify/agent/tools.py`)
The explicit `action="pay_bill"` flow remains intact for users who prefer direct vault commands (*"Bayar tagihan listrik PLN"*). It reuses `reconcile_fixed_bill_vault` internally to guarantee consistent ledger entry attribution.

---

## 4. API & Frontend Contracts

### 4.1 Backend Schemas & Endpoints

#### Schema Updates (`rezekify/api/v1/transactions_router.py`)
Add optional `vault_id` to `TransactionCreateRequest`:
```python
class TransactionCreateRequest(BaseModel):
    transaction_type: str = "EXPENSE"
    amount: Decimal
    description: str
    account_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    from_account_id: Optional[UUID] = None
    to_account_id: Optional[UUID] = None
    source_channel: str = "WEB_MANUAL"
    transaction_date: Optional[datetime] = None
    vault_id: Optional[UUID] = None  # Explicit FIXED_BILL vault linking
```

Update `create_transaction` endpoint in `transactions_router.py`:
- If `req.vault_id` is supplied:
  - Validates `vault = db.query(Vault).filter_by(id=req.vault_id, user_id=current_user.id).first()`.
  - Asserts `vault.vault_type == VaultType.FIXED_BILL`.
  - Records expense via `LedgerService.record_expense(...)`.
  - Reconciles vault via `VaultReconciliationService.reconcile_fixed_bill_vault(...)`.
- If `req.vault_id` is not supplied:
  - Runs `find_matching_fixed_bill_vault(user_id, req.description, req.amount)`.
  - If confident match found, automatically reconciles.

### 4.2 Frontend Contracts & UI Affordance

#### TypeScript Type Updates (`frontend/src/types/api.ts`)
```typescript
export interface TransactionCreateRequest {
  transaction_type?: 'EXPENSE' | 'INCOME' | 'TRANSFER';
  amount: number;
  description: string;
  account_id?: string;
  category_id?: string;
  from_account_id?: string;
  to_account_id?: string;
  source_channel?: string;
  transaction_date?: string;
  vault_id?: string | null;
}
```

#### `ManualTransactionModal.tsx` Enhancements
- Add `vaults?: Vault[]` to `TransactionModalProps`.
- When `type === 'EXPENSE'`:
  - Render an optional Select dropdown: **"Hubungkan ke Pos Tagihan (Opsional)"**.
  - Populate with user's `FIXED_BILL` vaults:
    - Display format: `{vault.name} (Target: Rp {formatRupiah(vault.target_amount)} - Tempo: {target_date})`.
  - Auto-select candidate if transaction description matches an active bill name.
  - Submit `vault_id` payload to `POST /api/v1/transactions`.

#### `TransactionsTable.tsx` Enhancements
- Accept `vaults?: Vault[]` optional prop.
- In both desktop table rows and mobile card-view:
  - Check if any `ledger_entry` contains `vault_id`.
  - Find matching vault name from `vaults` prop (or fallback to `"Pos Tagihan"`).
  - Render a distinct badge:
    ```tsx
    {vaultBadge && (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
        <Lock className="w-2.5 h-2.5" />
        {vaultBadge.name}
      </span>
    )}
    ```

---

## 5. Invariants & Financial Safety Rules

1. **Deterministic Double-Entry Integrity**:
   - $\sum \text{Debit} = \sum \text{Credit}$ must hold across all transactions.
   - `LedgerEntry.vault_id` is strictly an audit foreign key; it never impacts account balance arithmetic.
2. **Multi-Tenant Scoping**:
   - `user_id == current_user_id` enforced on every SQL query (`Vault`, `Transaction`, `LedgerEntry`, `Account`, `Category`).
   - Cross-tenant vault IDs passed to `TransactionCreateRequest` return `404 Not Found`.
3. **Rollover Date Invariance**:
   - Month rollover strictly uses `calendar.monthrange` clamping (`advance_one_month`). A bill due on Jan 31 rolls over to Feb 28 (or Feb 29 on leap years), never March.
4. **Sinking Fund Protection**:
   - `SAVINGS` vaults can NEVER have their allocated amount reset or date shifted by expense transactions.
5. **Idempotent Runway Invalidation**:
   - Cache keys for `user_id` are purged after every reconciliation, ensuring the cockpit dashboard immediately reflects updated free cash and cleared bill alerts.

---

## 6. Testing & Verification Strategy

### 6.1 Backend Test Coverage
1. **Service Unit Tests (`tests/test_vault_reconciliation_service.py`)**:
   - Exact and substring name matching (e.g., `"wifi indihome"` matches `"Wifi Indihome"`).
   - Stop-word filtering (`"Bayar tagihan listrik PLN bulan ini"` matches `"Listrik PLN"`).
   - Ambiguity handling: returns `None` when multiple bills match without amount alignment.
   - Strict isolation: `SAVINGS` vaults ignored during expense matching.
   - Settle mutation: `allocated_amount` resets to `0.00`, `target_date` rolls +1 month, `LedgerEntry.vault_id` populated.
2. **Agent Tool Integration Tests (`tests/test_agent_tools.py`)**:
   - Dispatch `record_transaction` with bill keyword; verify response confirms vault settlement.
   - Dispatch generic expense; verify vault remains untouched.
3. **API Endpoint Integration Tests (`tests/test_api_endpoints.py`)**:
   - `POST /api/v1/transactions` with explicit `vault_id`.
   - Cross-tenant attempt (`vault_id` belonging to another user) returns `404`.
   - Automatic reconciliation via `POST /api/v1/transactions` when description matches a bill.

### 6.2 Frontend Test Coverage
1. **`ManualTransactionModal.test.tsx`**:
   - Renders vault selection dropdown when type is `EXPENSE`.
   - Sends selected `vault_id` in API payload on form submission.
2. **`TransactionsTable.test.tsx`**:
   - Renders linked vault badge when transaction has `vault_id`.
   - Preserves mobile responsiveness and accessibility attributes.

### 6.3 Verification Gate Commands
- Backend: `uv run --no-project pytest tests/test_vault_reconciliation_service.py tests/test_agent_tools.py tests/test_manage_vault_tool.py tests/test_api_endpoints.py -x`
- Frontend: `npm test -- --run`
- Quality: All touched files compile cleanly with zero diagnostic errors.
