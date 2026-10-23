# Liability Accounts & PayLater / Credit Card Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unlock `AccountType.LIABILITY` across Rezekify to track PayLater and credit card obligations as positive debt magnitudes (`Tagihan Rp X`), factor liabilities directly into liquid runway deductions (`operational_free = max(0, liquid_sum - vault_sum - liability_sum)`), and provide high-contrast visual capsules with 1-tap payoff triggers (`Lunasi`) in the Cockpit.

**Architecture:**
1. **Backend Runway & Ledger Services**: Extend `RunwayService` to aggregate active `AccountType.LIABILITY` balances into `total_liability_debt`, deduct them from operational free cash, and expose this field via `RunwayReport` and `DashboardSummaryResponse`. Update `LedgerService` double-entry bookkeeping so liability balances increment on expense credits and decrement on payoff transfer debits.
2. **Frontend Types & Account Modal**: Extend `DashboardSummaryResponse` in `types/api.ts` with `total_liability_debt`. Expose `LIABILITY` under `ACCOUNT_TYPE_OPTIONS` in `AccountModal.tsx` with Lucide `CreditCard` icon, `"PayLater / Kredit"` label, and context-sensitive initial debt copy.
3. **Cockpit Account Strip & 1-Tap Payoff**: In `OverviewView.tsx`, render liability accounts in the capsule strip with subtle rose pill styling (`border-rose-500/30 bg-rose-500/10`), `CreditCard` icon, `Tagihan Rp ...` label, and a 1-tap `"Lunasi"` action triggering payoff transfer. In Bento KPI Card 2, display `Tagihan Berjalan: Rp ...` when debt exists.
4. **E2E Browser Verification**: Add a real Chromium Playwright suite in `frontend/e2e/liability-accounts.spec.ts` validating account creation, capsule rendering, runway deduction, and payoff modal launch.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Python `Decimal`, React 18, TypeScript, Tailwind CSS, Lucide React, HeroUI, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-liability-accounts-and-paylater-tracking-design.md`

## Global Constraints

- Strictly ZERO raw unicode emojis / emoticons — all visual icons use Lucide React vector SVGs (`CreditCard`, `ArrowRightLeft`, `Wallet`, `Building2`).
- Deterministic decimal math: all spending, liability, and runway calculations on the backend strictly use Python `Decimal`; zero native `float` arithmetic.
- Single-step non-interactive test commands: `cd "C:\Grant code\rezekify" ; pytest tests/<test_file>.py -v` (backend), `npm test -- src/__tests__/<test_file>.tsx --run` (frontend), `npx playwright test e2e/<test_file>.spec.ts` (E2E).
- Strict WCAG AA contrast: minimum 4.5:1 text/badge contrast in both light and dark modes across rose, emerald, and zinc accents.
- Zinc studio tokens: adhere strictly to Rezekify styling tokens (`rose-500`, `rose-600`, `rose-500/10`, `rose-500/30`, `emerald-500`, `slate-200/80`, `zinc-800/80`, `zinc-900/60`).
- Multi-tenant data safety: row-level isolation (`user_id == current_user.id`) enforced on all database queries and mutation endpoints.

## Review Focus

1. **Zero liability balance:** When a liability account has balance `0.00` (e.g. no current PayLater debt), `liability_sum = Decimal("0.00")`, `operational_free` remains unreduced (`liquid_sum - vault_sum`), and `total_liability_debt` is `0.00`. In the UI, the liability capsule still shows `Tagihan Rp 0`, but the "Lunasi" action trigger button is hidden since there is no balance to pay off. (Tested in Task 1 & Task 3)
2. **Liability exceeds liquid cash resulting in zero operational free:** When `liability_sum` (e.g. Rp 3.000.000) exceeds liquid cash minus locked vaults (`liquid_sum - vault_sum` = Rp 2.000.000), `operational_free` must be clamped to `max(Decimal("0.00"), ...)` = `0.00`. It must never become negative (`-Rp 1.000.000`), and daily safe runway becomes `0.00` with `CRITICAL` health status. (Tested in Task 1)
3. **Liability account deactivation:** When a liability account is deactivated (`is_active = False`), it must be excluded from `liability_sum` in runway calculation and filtered out of the account capsule strip in the UI (`accounts.filter(acc => acc.is_active !== false)`). (Tested in Task 1 & Task 3)
4. **Transfer between cash and liability reducing balance:** When a user executes a payoff transfer from a liquid account (e.g. BCA) to a liability account (e.g. Shopee PayLater), the ledger service must decrease cash balance (`credit from_acc`) AND decrease the liability balance/debt magnitude (`debit to_acc`), rather than incorrectly adding to the liability balance. (Tested in Task 1)
5. **Multiple liability accounts aggregate sum:** When a user possesses multiple active liability accounts (e.g., BCA Everyday Card Rp 1.500.000 and Shopee PayLater Rp 500.000), `RunwayService` sums all liability accounts (`liability_sum = Rp 2.000.000`), accurately deducting the total aggregate debt from operational free cash and returning `total_liability_debt = Decimal("2000000.00")`. (Tested in Task 1)

---

### Task 1: Backend Runway Service, Ledger Service & Dashboard Summary Response

**Files:**
- Modify: `rezekify/services/runway.py:52-88`, `rezekify/services/runway.py:207-295`, `rezekify/services/runway.py:331-361`
- Modify: `rezekify/services/ledger.py:30-97`, `rezekify/services/ledger.py:162-230`, `rezekify/services/ledger.py:232-257`, `rezekify/services/ledger.py:290-302`
- Modify: `rezekify/api/v1/dashboard_router.py:66-77`, `rezekify/api/v1/dashboard_router.py:143-183`
- Test: `tests/test_runway_service.py`
- Test: `tests/test_ledger_service.py`

**Interfaces:**
- Consumes:
  - `Account(user_id=UUID, account_type=AccountType.LIABILITY, current_balance=Decimal, is_active=bool)` from `rezekify.db.models`
- Produces:
  - `RunwayReport(..., total_liability_debt: Decimal = Decimal("0.00"))` in `rezekify.services.runway`
  - `DashboardSummaryResponse(..., total_liability_debt: Decimal = Decimal("0.00"))` in `rezekify.api.v1.dashboard_router`
  - `RunwayService.calculate_runway(user_id: UUID, today: Optional[date] = None, use_cache: bool = True) -> RunwayReport`
  - `LedgerService.record_transfer(...) -> Transaction` (decreases debt balance when `to_account` is `LIABILITY`)
  - `LedgerService.record_expense(...) -> Transaction` (increases debt balance when `account` is `LIABILITY`)
  - `LedgerService.delete_transaction(...) -> bool` (reverses liability account balance mutations correctly)

- [ ] **Step 1: Write the failing tests in `tests/test_runway_service.py` and `tests/test_ledger_service.py`**

Add to `tests/test_runway_service.py`:
```python
def test_calculate_runway_deducts_liability_debt(db_session, sample_user):
    sample_user.monthly_cycle_day = 25
    bca = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("2000000.00"),
        is_active=True,
    )
    vault = Vault(
        user_id=sample_user.id,
        name="Dana Darurat",
        vault_type=VaultType.SAVINGS,
        target_amount=Decimal("1000000.00"),
        allocated_amount=Decimal("500000.00"),
        is_locked=True,
    )
    spaylater = Account(
        user_id=sample_user.id,
        name="Shopee PayLater",
        account_type=AccountType.LIABILITY,
        current_balance=Decimal("300000.00"),
        is_active=True,
    )
    db_session.add_all([bca, vault, spaylater])
    db_session.commit()

    service = RunwayService(db_session)
    report = service.calculate_runway(user_id=sample_user.id, today=date(2026, 9, 18), use_cache=False)

    # 2.000.000 liquid - 500.000 vault - 300.000 liability = 1.200.000 operational free
    assert report.total_liquid_cash == Decimal("2000000.00")
    assert report.vault_locked_cash == Decimal("500000.00")
    assert report.total_liability_debt == Decimal("300000.00")
    assert report.operational_free_cash == Decimal("1200000.00")


def test_calculate_runway_clamps_negative_free_cash_to_zero(db_session, sample_user):
    sample_user.monthly_cycle_day = 25
    bca = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("500000.00"),
        is_active=True,
    )
    spaylater = Account(
        user_id=sample_user.id,
        name="Shopee PayLater",
        account_type=AccountType.LIABILITY,
        current_balance=Decimal("1000000.00"),
        is_active=True,
    )
    db_session.add_all([bca, spaylater])
    db_session.commit()

    service = RunwayService(db_session)
    report = service.calculate_runway(user_id=sample_user.id, today=date(2026, 9, 18), use_cache=False)

    # 500.000 liquid - 0 vault - 1.000.000 liability = -500.000 -> clamped to 0.00
    assert report.total_liability_debt == Decimal("1000000.00")
    assert report.operational_free_cash == Decimal("0.00")
    assert report.daily_safe_runway == Decimal("0.00")
    assert report.health_status == "CRITICAL"


def test_calculate_runway_multiple_liabilities_aggregate_sum(db_session, sample_user):
    sample_user.monthly_cycle_day = 25
    bca = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("3000000.00"),
        is_active=True,
    )
    cc = Account(
        user_id=sample_user.id,
        name="Mandiri CC",
        account_type=AccountType.LIABILITY,
        current_balance=Decimal("1500000.00"),
        is_active=True,
    )
    gopaylater = Account(
        user_id=sample_user.id,
        name="GoPay Later",
        account_type=AccountType.LIABILITY,
        current_balance=Decimal("500000.00"),
        is_active=True,
    )
    db_session.add_all([bca, cc, gopaylater])
    db_session.commit()

    service = RunwayService(db_session)
    report = service.calculate_runway(user_id=sample_user.id, today=date(2026, 9, 18), use_cache=False)

    assert report.total_liability_debt == Decimal("2000000.00")
    assert report.operational_free_cash == Decimal("1000000.00")


def test_calculate_runway_excludes_inactive_liability(db_session, sample_user):
    sample_user.monthly_cycle_day = 25
    bca = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("2000000.00"),
        is_active=True,
    )
    inactive_cc = Account(
        user_id=sample_user.id,
        name="Closed Card",
        account_type=AccountType.LIABILITY,
        current_balance=Decimal("500000.00"),
        is_active=False,
    )
    db_session.add_all([bca, inactive_cc])
    db_session.commit()

    service = RunwayService(db_session)
    report = service.calculate_runway(user_id=sample_user.id, today=date(2026, 9, 18), use_cache=False)

    assert report.total_liability_debt == Decimal("0.00")
    assert report.operational_free_cash == Decimal("2000000.00")
```

Add to `tests/test_ledger_service.py`:
```python
def test_record_expense_with_liability_increases_debt(db_session, sample_user):
    spaylater = Account(
        user_id=sample_user.id,
        name="Shopee PayLater",
        account_type=AccountType.LIABILITY,
        current_balance=Decimal("0.00"),
    )
    cat = Category(
        user_id=sample_user.id,
        name="Elektronik",
        category_type=CategoryType.EXPENSE,
    )
    db_session.add_all([spaylater, cat])
    db_session.commit()

    service = LedgerService(db_session)
    tx = service.record_expense(
        user_id=sample_user.id,
        account_id=spaylater.id,
        category_id=cat.id,
        amount=Decimal("150000.00"),
        description="Beli Mouse Logitech",
    )

    db_session.refresh(spaylater)
    assert spaylater.current_balance == Decimal("150000.00")


def test_record_transfer_to_liability_reduces_debt(db_session, sample_user):
    bca = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("1000000.00"),
    )
    spaylater = Account(
        user_id=sample_user.id,
        name="Shopee PayLater",
        account_type=AccountType.LIABILITY,
        current_balance=Decimal("300000.00"),
    )
    db_session.add_all([bca, spaylater])
    db_session.commit()

    service = LedgerService(db_session)
    tx = service.record_transfer(
        user_id=sample_user.id,
        from_account_id=bca.id,
        to_account_id=spaylater.id,
        amount=Decimal("300000.00"),
        description="Pelunasan Shopee PayLater",
    )

    db_session.refresh(bca)
    db_session.refresh(spaylater)
    assert bca.current_balance == Decimal("700000.00")
    assert spaylater.current_balance == Decimal("0.00")


def test_delete_transfer_to_liability_reverses_balances(db_session, sample_user):
    bca = Account(
        user_id=sample_user.id,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("1000000.00"),
    )
    spaylater = Account(
        user_id=sample_user.id,
        name="Shopee PayLater",
        account_type=AccountType.LIABILITY,
        current_balance=Decimal("300000.00"),
    )
    db_session.add_all([bca, spaylater])
    db_session.commit()

    service = LedgerService(db_session)
    tx = service.record_transfer(
        user_id=sample_user.id,
        from_account_id=bca.id,
        to_account_id=spaylater.id,
        amount=Decimal("300000.00"),
    )

    db_session.refresh(bca)
    db_session.refresh(spaylater)
    assert bca.current_balance == Decimal("700000.00")
    assert spaylater.current_balance == Decimal("0.00")

    service.delete_transaction(user_id=sample_user.id, transaction_id=tx.id)

    db_session.refresh(bca)
    db_session.refresh(spaylater)
    assert bca.current_balance == Decimal("1000000.00")
    assert spaylater.current_balance == Decimal("300000.00")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:\Grant code\rezekify" ; pytest tests/test_runway_service.py -k "liability" -v`
Expected: FAIL with `AttributeError: 'RunwayReport' object has no attribute 'total_liability_debt'` or `AssertionError`.

Run: `cd "C:\Grant code\rezekify" ; pytest tests/test_ledger_service.py -k "liability" -v`
Expected: FAIL with `AssertionError: assert spaylater.current_balance == Decimal('600000.00')`.

- [ ] **Step 3: Implement RunwayService, LedgerService, and Dashboard router updates**

1. In `rezekify/services/runway.py`:
   - Add `total_liability_debt: Decimal = Decimal("0.00")` to `RunwayReport`.
   - In `RunwayService.calculate_runway`:
     - Calculate `liability_sum`:
       ```python
       liability_sum = (
           self.db.query(func.coalesce(func.sum(Account.current_balance), Decimal("0.00")))
           .filter(
               Account.user_id == user_id,
               Account.account_type == AccountType.LIABILITY,
               Account.is_active == True,
           )
           .scalar()
       )
       operational_free = max(Decimal("0.00"), liquid_sum - vault_sum - liability_sum)
       ```
     - Pass `total_liability_debt=liability_sum` to `RunwayReport(...)`.
2. In `rezekify/services/ledger.py`:
   - In `record_expense`:
     ```python
     if account.account_type == AccountType.LIABILITY:
         account.current_balance += amount
     else:
         account.current_balance -= amount
     ```
   - In `record_transfer`:
     ```python
     if from_acc.account_type == AccountType.LIABILITY:
         from_acc.current_balance += amount
     else:
         from_acc.current_balance -= amount

     if to_acc.account_type == AccountType.LIABILITY:
         to_acc.current_balance -= amount
     else:
         to_acc.current_balance += amount
     ```
   - In `delete_transaction` and `update_transaction`:
     ```python
     if acc.account_type == AccountType.LIABILITY:
         if entry.entry_type == EntryType.CREDIT:
             acc.current_balance -= entry.amount
         elif entry.entry_type == EntryType.DEBIT:
             acc.current_balance += entry.amount
     else:
         if entry.entry_type == EntryType.CREDIT:
             acc.current_balance += entry.amount
         elif entry.entry_type == EntryType.DEBIT:
             acc.current_balance -= entry.amount
     ```
3. In `rezekify/api/v1/dashboard_router.py`:
   - Add `total_liability_debt: Decimal = Decimal("0.00")` to `DashboardSummaryResponse`.
   - In `get_dashboard_summary`: pass `total_liability_debt=report.total_liability_debt`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "C:\Grant code\rezekify" ; pytest tests/test_runway_service.py tests/test_ledger_service.py -v`
Expected: PASS (all tests passed with 0 failures).

- [ ] **Step 5: Commit**

```bash
git add rezekify/services/runway.py rezekify/services/ledger.py rezekify/api/v1/dashboard_router.py tests/test_runway_service.py tests/test_ledger_service.py
git commit -m "feat(runway): deduct liability accounts in runway math and support double-entry payoff"
```

---

### Task 2: Frontend API Types & Account Modal Exposure

**Files:**
- Modify: `frontend/src/types/api.ts:136-148`
- Modify: `frontend/src/components/AccountModal.tsx:1-35`, `frontend/src/components/AccountModal.tsx:180-235`
- Test: `frontend/src/__tests__/AccountModal.test.tsx`

**Interfaces:**
- Consumes:
  - `AccountType` including `'LIABILITY'` from `frontend/src/types/api`
- Produces:
  - `DashboardSummaryResponse.total_liability_debt?: number` in `frontend/src/types/api`
  - `AccountModal` exposing `'LIABILITY'` under `ACCOUNT_TYPE_OPTIONS` with `CreditCard` icon and adapted context-sensitive placeholder/labels

- [ ] **Step 1: Write the failing tests in `frontend/src/__tests__/AccountModal.test.tsx`**

Add to `frontend/src/__tests__/AccountModal.test.tsx`:
```tsx
it('renders PayLater / Kredit radio option with CreditCard icon', () => {
  render(<AccountModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />);

  const liabilityRadio = screen.getByRole('radio', { name: /PayLater \/ Kredit/i });
  expect(liabilityRadio).toBeInTheDocument();
});

it('adapts form labels and placeholders when LIABILITY account type is selected', () => {
  render(<AccountModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />);

  const liabilityRadio = screen.getByRole('radio', { name: /PayLater \/ Kredit/i });
  fireEvent.click(liabilityRadio);

  expect(screen.getByLabelText(/Saldo Tagihan Awal/i)).toBeInTheDocument();
  expect(
    screen.getByPlaceholderText(/Contoh: BCA Card, SpayLater, Kredivo/i)
  ).toBeInTheDocument();
});

it('submits account creation successfully with account_type LIABILITY', async () => {
  const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockResolvedValue({
    id: 'acc-liability-1',
    name: 'Shopee PayLater',
    account_type: 'LIABILITY',
    current_balance: 450000,
    is_active: true,
  });
  const handleSuccess = vi.fn().mockResolvedValue(undefined);
  const handleClose = vi.fn();

  render(<AccountModal isOpen={true} onClose={handleClose} onSuccess={handleSuccess} />);

  const liabilityRadio = screen.getByRole('radio', { name: /PayLater \/ Kredit/i });
  fireEvent.click(liabilityRadio);

  fireEvent.change(screen.getByLabelText(/Nama Rekening/i), {
    target: { value: 'Shopee PayLater' },
  });
  fireEvent.change(screen.getByLabelText(/Saldo Tagihan Awal/i), {
    target: { value: '450000' },
  });

  fireEvent.click(screen.getByRole('button', { name: /Simpan Akun/i }));

  await waitFor(() => {
    expect(apiFetchSpy).toHaveBeenCalledWith(
      '/accounts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'Shopee PayLater',
          account_type: 'LIABILITY',
          initial_balance: 450000,
        }),
      })
    );
    expect(handleSuccess).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/AccountModal.test.tsx --run`
Expected: FAIL with `TestingLibraryElementError: Unable to find an accessible element with the role "radio" and name `/PayLater \/ Kredit/i``.

- [ ] **Step 3: Implement API types and AccountModal updates**

1. In `frontend/src/types/api.ts`:
   Add `total_liability_debt?: number;` to `DashboardSummaryResponse`.
2. In `frontend/src/components/AccountModal.tsx`:
   - Import `CreditCard` from `'lucide-react'`.
   - Update `ACCOUNT_TYPE_OPTIONS`:
     ```typescript
     const ACCOUNT_TYPE_OPTIONS: { type: AccountType; label: string; icon: React.FC<{ className?: string }> }[] = [
       { type: 'BANK', label: 'Bank', icon: Building2 },
       { type: 'EWALLET', label: 'E-Wallet', icon: Wallet },
       { type: 'CASH', label: 'Cash', icon: Coins },
       { type: 'LIABILITY', label: 'PayLater / Kredit', icon: CreditCard },
     ];
     ```
   - Update the radio group container grid from `grid-cols-3` to `grid-cols-2 sm:grid-cols-4`.
   - When `accountType === 'LIABILITY'`:
     - Name input placeholder: `"Contoh: BCA Card, SpayLater, Kredivo"`.
     - Initial balance label: `"Saldo Tagihan Awal (Rp)"`.
     - Initial balance placeholder: `"Contoh: 750.000"`.
     - Helper text: `"Nominal tagihan atau cicilan berjalan saat ini (Rp)"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/AccountModal.test.tsx --run`
Expected: PASS (all tests in `AccountModal.test.tsx` pass).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/components/AccountModal.tsx frontend/src/__tests__/AccountModal.test.tsx
git commit -m "feat(accounts): expose liability paylater option in account modal"
```

---

### Task 3: Account Capsule Strip Styling & 1-Tap Payoff Trigger

**Files:**
- Modify: `frontend/src/components/OverviewView.tsx:30-48`, `frontend/src/components/OverviewView.tsx:320-358`, `frontend/src/components/OverviewView.tsx:422-445`
- Test: `frontend/src/__tests__/OverviewView.test.tsx`

**Interfaces:**
- Consumes:
  - `Account.account_type == 'LIABILITY'` from `frontend/src/types/api`
  - `DashboardSummaryResponse.total_liability_debt`
- Produces:
  - Account capsule strip styling with subtle rose pill accent (`border-rose-500/30 bg-rose-500/10`), `CreditCard` icon, and formatted label `Tagihan Rp ...`
  - 1-tap `"Lunasi"` button on liability accounts with balance > 0 triggering `onOpenManualModal?.({ type: 'TRANSFER', to_account_id: acc.id, amount: acc.current_balance })`
  - Subtitle badge in Bento KPI Card 2 (`Uang Bebas Pakai`) displaying `Tagihan Berjalan: Rp ...` when `total_liability_debt > 0`

- [ ] **Step 1: Write the failing tests in `frontend/src/__tests__/OverviewView.test.tsx`**

Add to `frontend/src/__tests__/OverviewView.test.tsx`:
```tsx
it('renders liability account capsule with rose accent, CreditCard icon, Tagihan label, and Lunasi button', () => {
  const handleOpenManualModal = vi.fn();
  const accountsWithLiability: Account[] = [
    { id: 'acc-1', name: 'BCA Utama', account_type: 'BANK', current_balance: 3000000, is_active: true },
    { id: 'acc-spaylater', name: 'Shopee PayLater', account_type: 'LIABILITY', current_balance: 450000, is_active: true },
  ];

  render(
    <OverviewView
      summary={mockSummary}
      vaults={mockVaults}
      accounts={accountsWithLiability}
      isLoading={false}
      refreshTrigger={0}
      onNavigateToVaults={vi.fn()}
      onOpenCreateAccount={vi.fn()}
      onOpenManualModal={handleOpenManualModal}
    />
  );

  const strip = screen.getByTestId('account-capsule-strip');
  expect(within(strip).getByText('Shopee PayLater:')).toBeInTheDocument();
  expect(within(strip).getByText(/Tagihan Rp\s*450\.000/i)).toBeInTheDocument();

  const lunasiBtn = within(strip).getByRole('button', { name: /Lunasi/i });
  expect(lunasiBtn).toBeInTheDocument();
  fireEvent.click(lunasiBtn);

  expect(handleOpenManualModal).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'TRANSFER',
      to_account_id: 'acc-spaylater',
    })
  );
});

it('hides Lunasi button when liability account balance is zero', () => {
  const accountsZeroLiability: Account[] = [
    { id: 'acc-cc', name: 'BCA Card', account_type: 'LIABILITY', current_balance: 0, is_active: true },
  ];

  render(
    <OverviewView
      summary={mockSummary}
      vaults={mockVaults}
      accounts={accountsZeroLiability}
      isLoading={false}
      refreshTrigger={0}
      onNavigateToVaults={vi.fn()}
      onOpenCreateAccount={vi.fn()}
    />
  );

  const strip = screen.getByTestId('account-capsule-strip');
  expect(within(strip).getByText('BCA Card:')).toBeInTheDocument();
  expect(within(strip).getByText(/Tagihan Rp\s*0/i)).toBeInTheDocument();
  expect(within(strip).queryByRole('button', { name: /Lunasi/i })).not.toBeInTheDocument();
});

it('renders Tagihan Berjalan subtitle in KPI Card 2 when total_liability_debt is greater than 0', () => {
  const summaryWithLiability: DashboardSummaryResponse = {
    ...mockSummary,
    total_liability_debt: 750000,
  };

  render(
    <OverviewView
      summary={summaryWithLiability}
      vaults={mockVaults}
      accounts={mockAccounts}
      isLoading={false}
      refreshTrigger={0}
      onNavigateToVaults={vi.fn()}
      onOpenCreateAccount={vi.fn()}
    />
  );

  expect(screen.getByText(/Tagihan Berjalan:/i)).toBeInTheDocument();
  expect(screen.getByText(/Rp\s*750\.000/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/OverviewView.test.tsx --run`
Expected: FAIL with `Unable to find text: /Tagihan Rp 450.000/i` or `Unable to find button: /Lunasi/i`.

- [ ] **Step 3: Implement OverviewView capsule and KPI badge updates**

1. In `frontend/src/components/OverviewView.tsx`:
   - Import `CreditCard` from `'lucide-react'`.
   - Update `OverviewViewProps` to accept optional payoff options:
     ```typescript
     onOpenManualModal?: (opts?: { type?: 'EXPENSE' | 'INCOME' | 'TRANSFER'; to_account_id?: string; amount?: number }) => void;
     ```
   - In Account Capsule Strip:
     - Update `getAccountIcon`:
       ```typescript
       const getAccountIcon = (type: string) => {
         if (type === 'LIABILITY') return CreditCard;
         if (type === 'EWALLET') return Smartphone;
         if (type === 'CASH') return Banknote;
         return Building2;
       };
       ```
     - For `acc.account_type === 'LIABILITY'`:
       - Use capsule class: `"flex items-center gap-2 px-3.5 py-1.5 min-h-[36px] rounded-full bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-200 shadow-xs shrink-0 transition-all hover:border-rose-400"`.
       - Render `<CreditCard className="w-3.5 h-3.5 text-rose-500 shrink-0" />`.
       - Render `<span className="font-semibold text-rose-700 dark:text-rose-300">{acc.name}:</span>`.
       - Render `<span className="font-mono font-bold text-rose-900 dark:text-rose-100 tabular-nums">Tagihan {formatRupiah(acc.current_balance)}</span>`.
       - If `acc.current_balance > 0`, render 1-tap "Lunasi" button:
         ```tsx
         <button
           type="button"
           onClick={() => onOpenManualModal?.({ type: 'TRANSFER', to_account_id: acc.id, amount: acc.current_balance })}
           className="ml-1 px-2 py-0.5 text-[10px] font-bold tracking-wide rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-all cursor-pointer"
         >
           Lunasi
         </button>
         ```
   - In Bento KPI Card 2 (`Uang Bebas Pakai`):
     - When `(summary?.total_liability_debt ?? 0) > 0`, render subtitle row:
       ```tsx
       <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-zinc-800/60 flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
         <CreditCard className="w-3.5 h-3.5 shrink-0" />
         <span>Tagihan Berjalan: <strong className="font-mono font-bold">{formatRupiah(summary!.total_liability_debt!)}</strong></span>
       </div>
       ```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/OverviewView.test.tsx --run`
Expected: PASS (all tests pass).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/OverviewView.tsx frontend/src/__tests__/OverviewView.test.tsx
git commit -m "feat(cockpit): add liability capsule with 1-tap payoff and kpi obligation subtitle"
```

---

### Task 4: Playwright E2E Browser Verification Suite in `frontend/e2e/liability-accounts.spec.ts`

**Files:**
- Create: `frontend/e2e/liability-accounts.spec.ts`

**Interfaces:**
- Consumes: Complete Cockpit UI with liability accounts, summary API, and AccountModal
- Produces: Playwright browser verification suite running in Chromium

- [ ] **Step 1: Write E2E test in `frontend/e2e/liability-accounts.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

// ponytail: static fixtures aligned with src/types/api.ts; upgrade to dynamic mock generator if scenario matrix grows.
const mockUser = {
  id: 'usr-e2e',
  email: 'test@rezekify.id',
  full_name: 'Tester',
  telegram_chat_id: null,
};

const mockSummaryWithLiability = {
  total_liquid_cash: 5000000,
  vault_locked_cash: 1000000,
  operational_free_cash: 3600000,
  total_liability_debt: 400000,
  days_remaining: 15,
  daily_safe_runway: 240000,
  health_status: 'HEALTHY',
  upcoming_bills: [],
};

const mockAccounts = [
  {
    id: 'acc-1',
    name: 'BCA Utama',
    account_type: 'BANK',
    current_balance: 5000000,
    is_active: true,
  },
  {
    id: 'acc-2',
    name: 'Shopee PayLater',
    account_type: 'LIABILITY',
    current_balance: 400000,
    is_active: true,
  },
];

const mockVaults = [
  {
    id: 'vault-1',
    name: 'Dana Darurat',
    vault_type: 'SAVINGS',
    target_amount: 10000000,
    allocated_amount: 1000000,
    is_locked: true,
  },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'mock-token-e2e');
    localStorage.setItem('rezekify_auth_token', 'mock-token-e2e');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ id: 'usr-e2e', email: 'test@rezekify.id', full_name: 'Tester' })
    );
  });

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockUser),
      });
    }

    if (path.endsWith('/dashboard/summary')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSummaryWithLiability),
      });
    }

    if (path.endsWith('/accounts')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAccounts),
      });
    }

    if (path.endsWith('/vaults')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockVaults),
      });
    }

    if (path.endsWith('/transactions')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    if (path.includes('/analytics/spending-breakdown')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          period: 'daily',
          daily_safe_runway: 240000,
          total_spent_in_period: 0,
          items: [],
        }),
      });
    }

    return route.fulfill({ status: 200, body: '{}' });
  });
});

test.describe('Liability Accounts & PayLater Tracking E2E Suite', () => {
  test('displays liability account capsule with rose accent, Tagihan label, and 1-tap Lunasi button', async ({ page }) => {
    await page.goto('/');

    const capsuleStrip = page.locator('[data-testid="account-capsule-strip"]');
    await expect(capsuleStrip).toBeVisible();

    await expect(capsuleStrip.getByText('Shopee PayLater:')).toBeVisible();
    await expect(capsuleStrip.getByText(/Tagihan Rp\s*400\.000/)).toBeVisible();

    const lunasiBtn = capsuleStrip.getByRole('button', { name: /Lunasi/i });
    await expect(lunasiBtn).toBeVisible();
  });

  test('displays Tagihan Berjalan in KPI Card 2', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('UANG BEBAS PAKAI')).toBeVisible();
    await expect(page.getByText(/Tagihan Berjalan:/i)).toBeVisible();
    await expect(page.getByText(/Rp\s*400\.000/)).toBeVisible();
  });

  test('clicking Lunasi button opens manual transaction modal with transfer payoff context', async ({ page }) => {
    await page.goto('/');

    const capsuleStrip = page.locator('[data-testid="account-capsule-strip"]');
    const lunasiBtn = capsuleStrip.getByRole('button', { name: /Lunasi/i });
    await lunasiBtn.click();

    // Verify manual transaction modal / payoff modal appears
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('account creation modal exposes PayLater / Kredit type with adapted label', async ({ page }) => {
    await page.goto('/');

    const tambahAkunBtn = page.getByRole('button', { name: /Tambah Akun/i });
    await tambahAkunBtn.click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('Tambah Akun Baru')).toBeVisible();

    const paylaterOption = page.getByRole('radio', { name: /PayLater \/ Kredit/i });
    await expect(paylaterOption).toBeVisible();

    await paylaterOption.click();
    await expect(page.getByText(/Saldo Tagihan Awal/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx playwright test e2e/liability-accounts.spec.ts`
Expected: PASS (4 passed in Chromium).

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/liability-accounts.spec.ts
git commit -m "test(e2e): add playwright browser suite for liability accounts and paylater tracking"
```
