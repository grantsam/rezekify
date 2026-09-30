# Actionable Daily Financial Overview Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Rezekify's dashboard from a redundant, technical dashboard into an actionable daily financial overview that clearly shows today's spending vs daily safe runway, recent transactions, 7-day spending trends, upcoming bills, and priority vaults using natural Indonesian financial vocabulary without jargon.

**Architecture:** Extend backend `RunwayService` and `DashboardSummaryResponse` to deterministically calculate `today_spent`. Create `RecentTransactionsCard` component. Rebuild `OverviewView` into a clean 3-tier structure eliminating duplicate metric cards and overly technical jargon.

**Tech Stack:** Python 3.12+, FastAPI, SQLAlchemy 2.0, React 18, TypeScript, Tailwind CSS, HeroUI, Lucide React, Framer Motion, Vitest, Pytest.

**Spec:** `docs/superpowers/specs/2026-10-01-dashboard-redesign.md`

## Global Constraints
- Core Invariant 1: All balances, runway formulas, and `today_spent` calculations run in Python using `decimal.Decimal`.
- Core Invariant 2: Double-entry balanced ledger integrity is preserved.
- Core Invariant 3: Row-level tenant isolation: `WHERE user_id = current_user_id` enforced on all queries.
- Vocabulary Standard: Simple, natural Indonesian financial terms:
  - "Jatah Belanja Hari Ini"
  - "Pengeluaran Hari Ini"
  - "Sisa Jatah Hari Ini"
  - "Saldo Bebas Pakai"
  - "Transaksi Terakhir"
  - "Tagihan 7 Hari ke Depan"
  - "Tabungan & Dana Khusus"
- Impeccable Design: Dark slate background (`#0c0c0e`, card surface `#141417`, borders `#27272a`), minimum 38px/44px touch targets, mobile responsiveness (360px up to 4K), accessible contrast (`tabular-nums font-mono` for numbers).

## Review Focus
1. `today_spent` accuracy across timezones: Ensure `today_spent` aggregates debit expense entries for `today` strictly scoped to `user_id`.
2. Negative or zero daily allowance: When `today_spent` exceeds `daily_safe_runway`, display clear over-budget indication (in rose) without negative formatting errors.
3. Empty state resilience: When user has 0 transactions or 0 accounts, ensure `RecentTransactionsCard` and `OverviewView` render clean, actionable onboarding prompts instead of crashing.
4. Duplicate removal: Ensure no duplicate cards (like the old `RunwayMetricCard`) are rendered on `OverviewView`.
5. Mobile layout ergonomics: Ensure 3-tier layout stacks cleanly on small mobile viewports (single-column) with >= 38px buttons and clear spacing.

---

### Task 1: Backend `RunwayService` & API Endpoint Enhancement (`today_spent`)

**Files:**
- Modify: `rezekify/services/runway.py:35-80, 200-240`
- Modify: `rezekify/api/v1/dashboard_router.py:50-70, 120-155`
- Test: `tests/test_runway_service.py`
- Test: `tests/test_api_endpoints.py`

**Interfaces:**
- Consumes: `Transaction`, `LedgerEntry`, `Category`, `user_id`.
- Produces:
  - `RunwayReport.today_spent: Decimal`
  - `DashboardSummaryResponse.today_spent: Decimal`

- [ ] **Step 1: Write failing test in `tests/test_runway_service.py` and `tests/test_api_endpoints.py`**

```python
# In tests/test_runway_service.py:
def test_calculate_runway_includes_today_spent(db_session, sample_user):
    from datetime import date
    from decimal import Decimal
    from rezekify.services.ledger import LedgerService
    from rezekify.services.runway import RunwayService
    from rezekify.db.models import Account, AccountType

    acc = Account(user_id=sample_user.id, name="Kas", account_type=AccountType.CASH, current_balance=Decimal("500000.00"))
    db_session.add(acc)
    db_session.commit()

    ledger = LedgerService(db_session)
    ledger.record_expense(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=None,
        amount=Decimal("45000.00"),
        description="Makan siang",
    )

    runway_service = RunwayService(db_session)
    report = runway_service.calculate_runway(user_id=sample_user.id, today=date.today())
    assert hasattr(report, "today_spent")
    assert report.today_spent == Decimal("45000.00")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --no-project pytest tests/test_runway_service.py -k test_calculate_runway_includes_today_spent -v`
Expected: FAIL (no `today_spent` on RunwayReport).

- [ ] **Step 3: Implement `today_spent` calculation in `rezekify/services/runway.py` and `rezekify/api/v1/dashboard_router.py`**

In `rezekify/services/runway.py`:
- Add `today_spent: Decimal` to `RunwayReport` NamedTuple.
- In `calculate_runway(user_id, today=None)`:
  ```python
  if today is None:
      today = date.today()
  today_str = today.isoformat()
  today_spent = (
      self.db.query(func.coalesce(func.sum(LedgerEntry.amount), Decimal("0.00")))
      .join(Transaction, LedgerEntry.transaction_id == Transaction.id)
      .outerjoin(Category, LedgerEntry.category_id == Category.id)
      .filter(
          Transaction.user_id == user_id,
          LedgerEntry.entry_type == EntryType.DEBIT,
          or_(Category.category_type == CategoryType.EXPENSE, Category.id.is_(None)),
          func.date(Transaction.transaction_date) == today_str,
      )
      .scalar()
  ) or Decimal("0.00")
  ```
- Pass `today_spent=today_spent` into `RunwayReport(...)`.

In `rezekify/api/v1/dashboard_router.py`:
- Add `today_spent: Decimal = Decimal("0.00")` to `DashboardSummaryResponse`.
- Map `today_spent=report.today_spent` in `get_dashboard_summary`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `uv run --no-project pytest tests/test_runway_service.py tests/test_api_endpoints.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/services/runway.py rezekify/api/v1/dashboard_router.py tests/test_runway_service.py
git commit -m "feat(api): compute and expose today_spent in dashboard summary"
```

---

### Task 2: Frontend Types & `RecentTransactionsCard` Component

**Files:**
- Modify: `frontend/src/types/api.ts:85-110`
- Create: `frontend/src/components/RecentTransactionsCard.tsx`
- Test: `frontend/src/__tests__/RecentTransactionsCard.test.tsx`

**Interfaces:**
- Consumes: `transactions: Transaction[]`, `isLoading: boolean`, `onViewAll: () => void`.
- Produces: Rendered card displaying up to 5 latest transactions with formatted amounts, dates, accounts, and category badges.

- [ ] **Step 1: Write failing test in `frontend/src/__tests__/RecentTransactionsCard.test.tsx`**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RecentTransactionsCard } from '../components/RecentTransactionsCard';
import { Transaction } from '../types/api';

describe('RecentTransactionsCard Component', () => {
  const sampleTransactions: Transaction[] = [
    {
      id: 'tx-1',
      description: 'Makan Nasi Padang',
      amount: 35000,
      type: 'EXPENSE',
      category_name: 'Makanan',
      account_name: 'BCA',
      transaction_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    {
      id: 'tx-2',
      description: 'Transfer Gaji',
      amount: 5000000,
      type: 'INCOME',
      category_name: 'Gaji',
      account_name: 'BCA',
      transaction_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ];

  it('renders title, transaction list with formatted amounts, and view all button', () => {
    const handleViewAll = vi.fn();
    render(<RecentTransactionsCard transactions={sampleTransactions} isLoading={false} onViewAll={handleViewAll} />);

    expect(screen.getByText('Transaksi Terakhir')).toBeInTheDocument();
    expect(screen.getByText('Makan Nasi Padang')).toBeInTheDocument();
    expect(screen.getByText('Transfer Gaji')).toBeInTheDocument();
    expect(screen.getByText(/- Rp\s*35[.,]000/)).toBeInTheDocument();
    expect(screen.getByText(/\+ Rp\s*5[.,]000[.,]000/)).toBeInTheDocument();

    const viewAllBtn = screen.getByRole('button', { name: /lihat semua di buku besar/i });
    fireEvent.click(viewAllBtn);
    expect(handleViewAll).toHaveBeenCalledTimes(1);
  });

  it('renders friendly empty state when no transactions exist', () => {
    render(<RecentTransactionsCard transactions={[]} isLoading={false} onViewAll={vi.fn()} />);
    expect(screen.getByText(/belum ada transaksi/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- -t "RecentTransactionsCard Component"`
Expected: FAIL (Component does not exist).

- [ ] **Step 3: Update `frontend/src/types/api.ts` and implement `RecentTransactionsCard.tsx`**

In `frontend/src/types/api.ts`:
- Add `today_spent: number;` to `DashboardSummaryResponse`.

In `frontend/src/components/RecentTransactionsCard.tsx`:
- Dark slate card `#141417`, border `border-zinc-800/80`, rounded-2xl.
- Header: Title "Transaksi Terakhir" + receipt icon + "Lihat Semua di Buku Besar" button (min 38px touch target).
- List up to 5 items:
  - Description, Account name pill, Category badge.
  - Formatted date (`Hari ini, 12:30` or `DD MMM`).
  - Amount formatted with `Intl.NumberFormat('id-ID')`, colored `- Rp ...` in rose-400 for `EXPENSE`, `+ Rp ...` in emerald-400 for `INCOME`.
- Empty state: clean icon + text "Belum ada transaksi tercatat. Mulai catat via AI atau tombol tambah."

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- -t "RecentTransactionsCard Component"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/components/RecentTransactionsCard.tsx frontend/src/__tests__/RecentTransactionsCard.test.tsx
git commit -m "feat(frontend): implement RecentTransactionsCard component"
```

---

### Task 3: Redesign `OverviewView.tsx` into 3-Tier Actionable Cockpit

**Files:**
- Modify: `frontend/src/components/OverviewView.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Test: `frontend/src/__tests__/OverviewView.test.tsx`
- Test: `frontend/src/__tests__/DashboardPage.test.tsx`

**Interfaces:**
- Consumes:
  - `summary: DashboardSummaryResponse | null` (with `today_spent`)
  - `vaults: Vault[]`
  - `accounts: Account[]`
  - `transactions: Transaction[]`
  - `onNavigateToLedger: () => void`
  - `onNavigateToVaults: () => void`
  - `onOpenChat: (prompt?: string) => void`
  - `onOpenSimulateModal: () => void`
  - `onOpenCreateAccount: () => void`

- [ ] **Step 1: Write/update tests in `frontend/src/__tests__/OverviewView.test.tsx` and `DashboardPage.test.tsx`**

Test expectations:
- Top Tier: Renders "Jatah Belanja Hari Ini", "Pengeluaran Hari Ini", "Sisa Jatah Hari Ini", "Saldo Bebas Pakai", and cycle days remaining.
- Middle Tier: Renders `ExpenseCharts` side-by-side with `RecentTransactionsCard`.
- Bottom Tier: Renders `UpcomingBillsCard` side-by-side with Priority Vaults & "Simulasi Belanja" button.
- Verifies absence of duplicate `RunwayMetricCard` in `OverviewView`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- src/__tests__/OverviewView.test.tsx`
Expected: FAIL on new field/component checks.

- [ ] **Step 3: Implement new layout in `frontend/src/components/OverviewView.tsx` & wire in `DashboardPage.tsx`**

In `OverviewView.tsx`:
1. **Tier 1: Status Keuangan Hari Ini (Hero Card)**:
   - Jatah Belanja Hari Ini: `Rp {daily_safe_runway}/hari` with health badge (`Aman Terkendali`, `Waspada`, `Hemat Ketat`).
   - Progress Bar & Sub-indicators:
     - Pengeluaran Hari Ini: `Rp {today_spent}`.
     - Sisa Jatah Hari Ini: `Rp {daily_safe_runway - today_spent}` (emerald if >= 0, rose if < 0 with label "Melebihi jatah").
   - Saldo Bebas Pakai: `Rp {operational_free_cash}`.
   - Sisa Hari Siklus: `{days_remaining} hari lagi`.
   - Compact AI Prompt Bar (`AISpotlightHero` or compact strip with quick chips).
2. **Tier 2: Tren & Aktivitas (Grid 12-col: 7 cols chart, 5 cols recent transactions)**:
   - Left: `<ExpenseCharts refreshTrigger={refreshTrigger} />`.
   - Right: `<RecentTransactionsCard transactions={recentTransactions} isLoading={isLoading} onViewAll={onNavigateToLedger} />`.
3. **Tier 3: Kewajiban & Rencana (Grid 12-col: 6 cols bills, 6 cols vaults)**:
   - Left: `<UpcomingBillsCard bills={summary?.upcoming_bills} isLoading={isLoading} />`.
   - Right: Priority Vaults Card with progress bars and "Simulasi Belanja" button.
4. Completely remove duplicate `RunwayMetricCard` from `OverviewView`.

In `DashboardPage.tsx`:
- Pass `transactions={ledger.transactions}` and `onNavigateToLedger={() => setActiveView('ledger')}` to `OverviewView`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm --prefix frontend test -- src/__tests__/OverviewView.test.tsx src/__tests__/DashboardPage.test.tsx`
Run: `npx --prefix frontend tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/OverviewView.tsx frontend/src/pages/DashboardPage.tsx frontend/src/__tests__/OverviewView.test.tsx frontend/src/__tests__/DashboardPage.test.tsx
git commit -m "feat(dashboard): rebuild OverviewView into 3-tier actionable daily overview"
```

---

### Task 4: End-to-End Verification & Impeccable Quality Polish

**Files:**
- Run full backend test suite (`pytest`)
- Run full frontend test suite (`vitest`)
- Run typecheck & build (`tsc`, `vite build`, `mypy`, `ruff`)

- [ ] **Step 1: Run backend test suite and linters**

Run: `uv run --no-project pytest`
Run: `uv run --no-project ruff check rezekify tests`
Run: `uv run --no-project mypy rezekify`
Expected: 319+ passed, 0 failures.

- [ ] **Step 2: Run frontend test suite, typecheck, and build**

Run: `npx --prefix frontend tsc --noEmit`
Run: `npm --prefix frontend run build`
Run: `npm --prefix frontend test -- --run`
Expected: All test files passing, 0 errors.

- [ ] **Step 3: Commit verification**

```bash
git commit --allow-empty -m "chore: verify end-to-end full test suite for redesigned dashboard"
```
