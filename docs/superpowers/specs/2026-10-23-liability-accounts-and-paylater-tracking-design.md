# Liability Accounts & PayLater / Credit Card Tracking Design

- **Date**: 2026-10-23
- **Scope**: Backend Ledger & Runway (`rezekify`), Frontend Cockpit & Modals (`frontend`)
- **Status**: Approved

---

## 1. Intent & Problem Statement

Rezekify tracks daily financial runway to answer one primary question: *"How much money can I safely spend today until my next income cycle without starving or missing fixed obligations?"*

Currently, the data layer defines `AccountType.LIABILITY` in `rezekify/db/models.py`, but it is completely hidden from the user interface and excluded from runway calculation models. Users managing credit cards (e.g., BCA Everyday Card, Mandiri Card) or digital PayLater services (e.g., GoPay Later, Shopee PayLater, Kredivo) face significant drawbacks:
1. **Cash Distortions**: Recording PayLater as cash or bank accounts gives users the false impression of possessing liquid wealth, dangerously inflating their safe daily runway.
2. **Omission & Visibility Lag**: Excluding PayLater purchases from Rezekify causes expenses to remain invisible until the monthly billing cycle when debts are settled, destroying real-time expense awareness.
3. **Negative Balance Confusion**: In basic accounting software, credit cards often show confusing negative balances (e.g., `-Rp 1.500.000`), which causes UX friction and complicates straightforward runway math.

Unlocking `AccountType.LIABILITY` in the UI and Runway formulas allows users to record PayLater debts and credit card purchases with precision:
- As an **obligation magnitude** (`Tagihan Rp X`) rather than negative cash.
- Factorable directly into liquid runway deductions (`operational_free_cash = max(0, liquid_sum - vault_sum - liability_sum)`).
- Clearable via an intuitive 1-tap payoff flow (`Lunasi`) using standard double-entry transfers.

---

## 2. Goals, Non-Goals, and Anti-Goals

### 2.1 Goals
- **Account Creation**: Expose `LIABILITY` option in `AccountModal.tsx` under `ACCOUNT_TYPE_OPTIONS` with the Lucide `CreditCard` icon, labeled `"PayLater / Kredit"`, with intuitive initial balance placeholders (`"Saldo tagihan saat ini"`).
- **Cockpit Visual Distinction**: In `OverviewView.tsx` (the Account Capsule Strip), render liability accounts with:
  - Lucide `CreditCard` icon.
  - Formatted label: `Tagihan Rp ...` (reflecting outstanding debt).
  - Distinctive subtle rose/amber pill styling (`bg-rose-500/10 text-rose-600 border-rose-500/30 dark:bg-rose-950/20 dark:text-rose-400`).
  - 1-tap `"Lunasi"` action trigger initiating a payoff flow to settle the obligation.
- **Runway Mathematical Integrity**: Factor liability debt directly into `RunwayService`:
  - `liability_sum = sum(Account.current_balance)` where `account_type == AccountType.LIABILITY`.
  - `operational_free = max(Decimal("0.00"), liquid_sum - vault_sum - liability_sum)`.
  - Add `total_liability_debt` to `RunwayReport` and `DashboardSummaryResponse`.
- **Frictionless Debt Settlement**: Provide a 1-tap payoff flow (`PayBillModal` / transfer) to clear liability balances, transferring funds from a liquid asset account (`CASH`, `BANK`, `EWALLET`) directly into the `LIABILITY` account.
- **Double-Entry Bookkeeping**:
  - Paying an expense with a liability account increases debt (`credit liability_acc`, `debit expense_category`).
  - Transferring from CASH/BANK to LIABILITY reduces debt (`credit from_acc`, `debit liability_acc`).

### 2.2 Non-Goals
- **Credit Score Modeling**: No automated credit rating estimations (e.g., SLIK OJK, FICO) or credit limit utilization percentages.
- **Automated Open Finance Scraping**: No automated bank feeds, Plaid, or SMS scraping; transactions and balance reconciliations remain privacy-first and user-directed (manual or AI multimodal receipt capture).
- **Compound Interest & Amortization Schedules**: No multi-month EMI loan amortization curves or late fee simulation engines. Debts are tracked as current nominal obligations.

### 2.3 Anti-Goals
- **Guilt-Tripping Copy**: Never shame or alarm users with punitive terminology (e.g., *"Hutang Anda Menumpuk!"* or *"Bahaya Finansial!"*). Use neutral, clear, and objective terminology (`"Tagihan"`, `"Lunasi"`, `"Total Kewajiban"`).
- **Negative Balances Confusion**: Avoid displaying negative numbers like `-Rp 1.500.000`. Liability balances represent positive magnitudes of obligation (`current_balance = Decimal("1500000.00")`), labeled as `Tagihan Rp 1.500.000`.
- **Floating-Point Drift**: Never perform liability or runway math with native floats. Strict adherence to Python `Decimal` on the backend and integer cents math in frontend helpers.

---

## 3. Backend Service & Mathematical Ledger

### 3.1 Model & Enum Layer (`rezekify/db/models.py`)
`AccountType.LIABILITY` already exists in `AccountType(str, Enum)`. No database schema migration is required.
```python
class AccountType(str, Enum):
    CASH = "CASH"
    BANK = "BANK"
    EWALLET = "EWALLET"
    LIABILITY = "LIABILITY"
```

In `Account`, `current_balance` for `AccountType.LIABILITY` represents the user's outstanding debt:
- Initial balance: `initial_balance >= 0` (e.g., Rp 500.000 of existing PayLater debt).
- Zero balance (`0.00`): no outstanding liability.

### 3.2 Runway Service Formula Updates (`rezekify/services/runway.py`)

#### 3.2.1 Data Contracts (`RunwayReport`)
Add `total_liability_debt` to `RunwayReport`:
```python
class RunwayReport(NamedTuple):
    total_liquid_cash: Decimal
    vault_locked_cash: Decimal
    operational_free_cash: Decimal
    days_remaining: int
    daily_safe_runway: Decimal
    health_status: str
    upcoming_bills: List[UpcomingBill]
    today_spent: Decimal = Decimal("0.00")
    safe_runway_threshold: Decimal = Decimal("30000.00")
    survival_guidance: Optional[SurvivalGuidance] = None
    total_liability_debt: Decimal = Decimal("0.00")
```

#### 3.2.2 Mathematical Deductions in `calculate_runway`
```python
# 1. Total liquid cash from CASH, BANK, EWALLET only
liquid_sum = (
    self.db.query(func.coalesce(func.sum(Account.current_balance), Decimal("0.00")))
    .filter(
        Account.user_id == user_id,
        Account.account_type.in_([AccountType.CASH, AccountType.BANK, AccountType.EWALLET]),
    )
    .scalar()
)

# 2. Total locked vault reserves
vault_sum = (
    self.db.query(func.coalesce(func.sum(Vault.allocated_amount), Decimal("0.00")))
    .filter(Vault.user_id == user_id, Vault.is_locked == True)
    .scalar()
)

# 3. Total outstanding liability obligations
liability_sum = (
    self.db.query(func.coalesce(func.sum(Account.current_balance), Decimal("0.00")))
    .filter(
        Account.user_id == user_id,
        Account.account_type == AccountType.LIABILITY,
    )
    .scalar()
)

# 4. Operational free cash adjusted for locked vaults AND outstanding liability
operational_free = max(Decimal("0.00"), liquid_sum - vault_sum - liability_sum)
```

#### 3.2.3 Purchase Simulation Engine
In `simulate_purchase`, calculate projected operational free cash accounting for liability debt:
```python
projected_free = max(Decimal("0.00"), liquid_sum - vault_sum - liability_sum - planned_amount)
```

### 3.3 Double-Entry Ledger Service (`rezekify/services/ledger.py`)

#### 3.3.1 Recording Transfers (`record_transfer`)
When transferring funds to settle a liability:
- Transfer from `CASH`/`BANK`/`EWALLET` (asset) to `LIABILITY`:
  - `from_acc.current_balance -= amount` (cash is depleted).
  - `to_acc.current_balance -= amount` (liability debt is reduced).
  - Ledger entries:
    - `CREDIT` on `from_acc` (asset reduction).
    - `DEBIT` on `to_acc` (liability obligation reduction).
- Transfer from `LIABILITY` to asset (e.g., cash advance / dana tunai):
  - `from_acc.current_balance += amount` (liability debt increases).
  - `to_acc.current_balance += amount` (cash increases).
  - Ledger entries:
    - `CREDIT` on `from_acc` (liability obligation increase).
    - `DEBIT` on `to_acc` (asset increase).

```python
# In LedgerService.record_transfer:
if from_acc.account_type == AccountType.LIABILITY:
    from_acc.current_balance += amount
else:
    from_acc.current_balance -= amount

if to_acc.account_type == AccountType.LIABILITY:
    to_acc.current_balance -= amount
else:
    to_acc.current_balance += amount
```

#### 3.3.2 Recording Expenses (`record_expense`)
When an expense is charged to an account:
- If `account.account_type == AccountType.LIABILITY`:
  - `account.current_balance += amount` (liability debt increases).
- Else (asset account):
  - `account.current_balance -= amount` (liquid cash decreases).

```python
# In LedgerService.record_expense:
if account.account_type == AccountType.LIABILITY:
    account.current_balance += amount
else:
    account.current_balance -= amount
```

#### 3.3.3 Reversing Transactions (`delete_transaction`)
When a transaction is deleted, balance updates must be reversed:
- Deleting an expense on a liability account reduces `account.current_balance -= amount`.
- Deleting a transfer from bank to liability restores `from_acc.current_balance += amount` and restores liability `to_acc.current_balance += amount`.

### 3.4 API Schemas & Routers (`rezekify/api/v1/dashboard_router.py`)
Update `DashboardSummaryResponse`:
```python
class DashboardSummaryResponse(BaseModel):
    total_liquid_cash: Decimal
    vault_locked_cash: Decimal
    operational_free_cash: Decimal
    days_remaining: int
    daily_safe_runway: Decimal
    health_status: str
    upcoming_bills: List[UpcomingBillResponse]
    today_spent: Decimal = Decimal("0.00")
    safe_runway_threshold: Decimal = Decimal("30000.00")
    survival_guidance: SurvivalGuidanceResponse
    total_liability_debt: Decimal = Decimal("0.00")
```

---

## 4. Frontend UI/UX & Impeccable Craft

### 4.1 TypeScript Contracts (`frontend/src/types/api.ts`)
```typescript
export interface DashboardSummaryResponse {
  total_liquid_cash: number;
  vault_locked_cash: number;
  operational_free_cash: number;
  days_remaining: number;
  daily_safe_runway: number;
  today_spent?: number;
  safe_runway_threshold?: number;
  health_status: HealthStatus;
  upcoming_bills: UpcomingBill[];
  survival_guidance?: SurvivalGuidance;
  total_liability_debt?: number;
}
```

### 4.2 Account Modal (`frontend/src/components/AccountModal.tsx`)
1. **Account Type Selection**:
   Include `LIABILITY` in `ACCOUNT_TYPE_OPTIONS`:
   ```typescript
   import { Building2, Wallet, Coins, CreditCard } from 'lucide-react';

   const ACCOUNT_TYPE_OPTIONS: { type: AccountType; label: string; icon: React.FC<{ className?: string }> }[] = [
     { type: 'BANK', label: 'Bank', icon: Building2 },
     { type: 'EWALLET', label: 'E-Wallet', icon: Wallet },
     { type: 'CASH', label: 'Cash', icon: Coins },
     { type: 'LIABILITY', label: 'PayLater / Kredit', icon: CreditCard },
   ];
   ```
2. **Context-Sensitive Copy**:
   - When `accountType === 'LIABILITY'`:
     - Label: `"Saldo Tagihan Awal"` (instead of `"Saldo Awal"`).
     - Helper text: `"Nominal tagihan atau cicilan berjalan saat ini (Rp)"`.
     - Placeholder: `"Contoh: 750.000"`.
   - Clear validation preventing negative numbers (obligations are positive numbers).

### 4.3 Overview View (`frontend/src/components/OverviewView.tsx`)

#### 4.3.1 Account Capsule Strip
In the horizontal capsule strip:
1. **Asset Accounts** (`BANK`, `EWALLET`, `CASH`):
   - Styled with standard card border and emerald vector icon (`Smartphone`, `Banknote`, `Building2`).
   - Format: `{acc.name}: {formatRupiah(acc.current_balance)}`.
2. **Liability Accounts** (`LIABILITY`):
   - Lucide `CreditCard` icon.
   - Styled with subtle rose/amber accents:
     ```tsx
     className="flex items-center gap-2 px-3.5 py-1.5 min-h-[36px] rounded-full bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-200 shadow-xs shrink-0 transition-all hover:border-rose-400"
     ```
   - Content: `{acc.name}: Tagihan {formatRupiah(acc.current_balance)}`.
   - **1-Tap "Lunasi" Action Trigger**:
     If `acc.current_balance > 0`, display a compact button or chip:
     ```tsx
     <button
       type="button"
       onClick={() => onPayOffLiability?.(acc)}
       className="ml-1 px-2 py-0.5 text-[10px] font-bold tracking-wide rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-all cursor-pointer"
     >
       Lunasi
     </button>
     ```

#### 4.3.2 1-Tap Payoff Flow
When clicking `"Lunasi"`:
- Opens `PayBillModal` or a pre-filled Transfer modal.
- Sets target account to the selected `LIABILITY` account.
- Sets nominal amount to `acc.current_balance`.
- Prompts user to pick the funding asset account (`BCA`, `Mandiri`, `GoPay`).
- Confirms payment, executing `POST /transactions` with `transaction_type: 'TRANSFER'`.

#### 4.3.3 Bento KPI Header
In the 3-Card Bento Header, Card 2 (`Uang Dingin & Simpanan` / `Total Cadangan`):
- When `total_liability_debt > 0`, render a secondary detail row:
  - `<CreditCard className="w-3.5 h-3.5 text-rose-500" />`
  - `Kewajiban: {formatRupiah(summary.total_liability_debt)}`
  - Keeps users conscious of net free cash without alarming banners.

### 4.4 Zero Raw Emoji Rule
All graphical elements and badges strictly use Lucide React vector SVGs:
- `CreditCard` for Liability / PayLater / Credit Card accounts.
- `ArrowRightLeft` for transfers and payoff operations.
- `AlertCircle` / `CheckCircle2` for statuses.
- No raw emojis (`💳`, `💸`, `⚠️`).

---

## 5. Testing Strategy

### 5.1 Backend Tests (`tests/`)
1. **`tests/test_runway_service.py`**:
   - `test_calculate_runway_deducts_liability_debt`:
     - Bank balance = Rp 2.000.000
     - Vault locked = Rp 500.000
     - Liability balance = Rp 300.000
     - Expected `operational_free_cash` = `max(0, 2.000.000 - 500.000 - 300.000) = 1.200.000`.
     - Expected `report.total_liability_debt = 300.000`.
   - `test_calculate_runway_clamps_negative_free_cash_to_zero`:
     - Bank balance = Rp 500.000
     - Liability balance = Rp 1.000.000
     - Expected `operational_free_cash = Decimal("0.00")`.
2. **`tests/test_ledger_service.py`**:
   - `test_record_expense_with_liability_increases_debt`:
     - SpayLater initial balance = Rp 0.
     - Record expense Rp 150.000 via SpayLater.
     - SpayLater balance becomes Rp 150.000.
   - `test_record_transfer_to_liability_reduces_debt`:
     - BCA balance = Rp 1.000.000, SpayLater balance = Rp 300.000.
     - Transfer Rp 300.000 from BCA to SpayLater.
     - BCA becomes Rp 700.000, SpayLater becomes Rp 0.
     - Entries: BCA credited, SpayLater debited.
   - `test_delete_transfer_to_liability_reverses_balances`:
     - Verify reversal restores BCA and SpayLater balances.
3. **`tests/test_accounts_api.py`**:
   - `test_create_liability_account_with_initial_debt`:
     - POST `/accounts` with `account_type="LIABILITY"`, `initial_balance=500000`.
     - Returns 200 with `account_type="LIABILITY"` and `current_balance=500000`.

### 5.2 Frontend Tests (`frontend/src/__tests__/`)
1. **`frontend/src/__tests__/AccountModal.test.tsx`**:
   - Renders "PayLater / Kredit" radio/chip option with `CreditCard` icon.
   - Updates form placeholder and label to "Saldo Tagihan Awal".
   - Submits `account_type: 'LIABILITY'` successfully to API.
2. **`frontend/src/__tests__/OverviewView.test.tsx`**:
   - Renders liability account capsule with `CreditCard` icon and `Tagihan Rp ...`.
   - Renders "Lunasi" action trigger when `current_balance > 0`.
   - Clicking "Lunasi" fires callback with account payload.
3. **`frontend/src/__tests__/ZeroEmojiAudit.test.ts`**:
   - Passes with 0 raw unicode emoji violations.

### 5.3 E2E Tests (`frontend/e2e/`)
- **`frontend/e2e/liability-accounts.spec.ts`**:
  - Full end-to-end user journey in browser:
    1. Login to Cockpit.
    2. Open Account Modal and create "Shopee PayLater" with Rp 400.000 initial debt.
    3. Verify Cockpit capsule strip displays "Shopee PayLater: Tagihan Rp 400.000" in rose styling.
    4. Verify Operational Free Cash decreases by Rp 400.000.
    5. Click "Lunasi" and execute payoff transfer from BCA.
    6. Verify PayLater debt becomes Rp 0 and runway recalculates dynamically.
