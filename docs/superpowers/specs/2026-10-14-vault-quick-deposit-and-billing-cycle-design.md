# Specification: Vault Quick Deposit, Autonomous Billing Rollover & AI Vault Management

## 1. Problem Statement & User Intent
In Rezekify, vaults serve as mental accounting barriers (sinking funds for savings and fixed commitments for upcoming bills) that subtract locked money from operational free cash. Currently:
1. Depositing to a savings vault requires opening the full edit modal and manually recalculating and typing the new cumulative allocated balance.
2. Paying a fixed bill does not record a double-entry ledger expense or rollover the bill's due date to the next monthly cycle.
3. The autonomous AI agent has no tool to manipulate or query vaults via text or voice.

This feature introduces:
1. Contextual action triggers on `VaultCard`: `+ Nabung` for savings goals and `Bayar Tagihan` for fixed bills.
2. Dedicated modals: `DepositVaultModal` with quick nominal pills (+50k, +100k, +250k, +500k) and account source selection; `PayBillModal` which triggers an atomic double-entry ledger expense and rolls over the bill's target date by +1 month while resetting locked allocation to Rp 0.
3. Backend endpoints `POST /api/v1/vaults/{id}/deposit` and `POST /api/v1/vaults/{id}/pay-bill`.
4. AI ReAct tool `manage_vault` enabling autonomous text and voice commands (e.g., "Nabung 100rb ke Dana Darurat dari BCA", "Bayar kos 1.5jt pakai Mandiri", "Kunci tabungan liburan").

## 2. Architecture & Data Flow

### 2.1 Backend Endpoints (`rezekify/api/v1/vaults_router.py`)
1. `POST /api/v1/vaults/{vault_id}/deposit`:
   - Request Body:
     - `amount: Decimal` (must be > 0)
     - `source_account_id: Optional[UUID]` (optional check: if supplied, validates that account exists and balance >= amount)
   - Behavior:
     - Increments `vault.allocated_amount += amount`.
     - Sets `vault.is_locked = True`.
     - Invalidates runway cache via `RunwayService.clear_cache(user_id)`.
     - Returns updated `VaultResponse`.

2. `POST /api/v1/vaults/{vault_id}/pay-bill`:
   - Request Body:
     - `account_id: UUID` (account paying the bill)
     - `category_id: Optional[UUID]` (expense category, defaults to category matching "Tagihan" or first expense category)
     - `amount: Optional[Decimal]` (defaults to `vault.target_amount` or `vault.allocated_amount`)
     - `notes: Optional[str]`
   - Behavior:
     - Verifies account belongs to user and has sufficient balance.
     - Invokes `LedgerService.record_transaction()` with:
       - Debit: Expense Category (`amount`)
       - Credit: Account (`amount`)
       - Description: `notes` or `f"Pembayaran tagihan: {vault.name}"`
       - Source channel: `WEB_UI` or `AI_AGENT`
     - Rollover cycle for `FIXED_BILL`:
       - Resets `vault.allocated_amount = Decimal("0.00")`.
       - If `vault.target_date`: advances date by 1 month deterministically (preserving day or capping to month-end).
     - Clears runway cache via `RunwayService.clear_cache(user_id)`.
     - Returns updated `VaultResponse` and generated `TransactionResponse`.

### 2.2 Autonomous Cognitive Agent Tool (`rezekify/agent/tools.py` & `runtime.py`)
1. Tool Definition `manage_vault`:
   - `action: Literal["deposit", "pay_bill", "toggle_lock", "check_status"]`
   - `vault_name: Optional[str]`
   - `amount: Optional[Decimal]`
   - `account_name: Optional[str]`
   - `lock_state: Optional[bool]`
2. Dispatcher Logic:
   - Case-insensitive substring/fuzzy matching of `vault_name` against user's vaults.
   - Case-insensitive matching of `account_name` against user's active accounts.
   - Executes deposit, pay_bill (with double-entry ledger mutation), toggle_lock, or status inspection.
   - Formats a clear cognitive response reporting the updated vault balance, account balance, and new safe daily runway.

### 2.3 Frontend UI (`frontend/src/`)
1. `VaultCard.tsx`:
   - Action buttons at the bottom:
     - If `vault.vault_type === 'SAVINGS'`: Button `+ Nabung` (`bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25`).
     - If `vault.vault_type === 'FIXED_BILL'`: Button `Bayar Tagihan` (`bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25`).
2. `DepositVaultModal.tsx`:
   - Controlled amount input with formatted Rupiah display.
   - Quick preset chips: `+50rb`, `+100rb`, `+250rb`, `+500rb` that increment the input value.
   - Account selector showing account name and current balance.
   - Telemetry projection: shows current % -> new %, and how much operational runway will be locked.
3. `PayBillModal.tsx`:
   - Summary of bill name, target amount, due date.
   - Account selector for paying account.
   - Explanatory note: "Pembayaran akan dicatat di buku besar, memotong saldo rekening, dan memajukan jatuh tempo tagihan ke bulan depan."
4. `VaultsView.tsx` & `OverviewView.tsx`:
   - Wire `DepositVaultModal` and `PayBillModal` triggers into view and refresh dashboard telemetry upon success.

## 3. Invariants & Safety Constraints
1. **Mathematical Invariance**: Double-entry ledger invariant $\sum \text{Debit} = \sum \text{Credit}$ must hold for bill payments.
2. **Lock Invariance**: Locked vaults cannot be reduced or deleted without explicit unlocking. Deposit automatically secures the fund (`is_locked = True`).
3. **Rollover Safety**: Date addition handles edge cases (e.g. Jan 31 + 1 month -> Feb 28/29) using calendar arithmetic.
4. **Idempotent Cache Invalidation**: Every deposit or payment clears the user's runway cache.
