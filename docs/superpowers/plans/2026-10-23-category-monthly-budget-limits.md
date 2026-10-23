# Category Monthly Budget Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to set optional monthly budget limits on expense categories, compute deterministic budget consumption and status badges in the runway analytics engine, and render dual-meter progress indicators with nominal quick chips in the Cockpit.

**Architecture:**
1. In the database layer, add nullable `monthly_budget` (`Numeric(15, 2)`) to `categories` via Alembic migration `008` and SQLAlchemy `Category` model.
2. In the backend API, update category CRUD schemas and extend `RunwayService.get_category_spending_breakdown` to calculate deterministic `budget_limit`, `budget_spent_pct`, and `budget_status` (`HEALTHY`, `WARNING`, `OVER_BUDGET`) using Python `Decimal`.
3. In the frontend, enhance `CategoryManagerModal` with Indonesian currency budget input and nominal quick chips (`+500rb`, `+1jt`, `+2jt`, `Reset`), and augment `ExpenseCharts` monthly breakdown with dual-meter progress bars, Lucide icons, and calm contextual badges (`Terkendali`, `Sisa Rp X`, `Lewat Rp Y`).

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL / SQLite, Python `Decimal`, React 18, TypeScript, Tailwind CSS, Lucide React, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-category-monthly-budget-limits-design.md`

## Global Constraints

- Strictly ZERO raw unicode emojis / emoticons — all visual icons use Lucide React vector SVGs (`Target`, `CheckCircle2`, `AlertTriangle`, `TrendingUp`).
- Deterministic decimal math: all spending vs. budget calculations on the backend use Python `Decimal` quantized to exact precision (`0.01` currency, `0.1` percentage); zero `float` arithmetic.
- Single-step non-interactive test commands: `pytest tests/<file>.py -v` (backend), `npm test -- <test_file> --run` (frontend), `npx playwright test <spec_file>` (E2E).
- Strict WCAG AA contrast: minimum 4.5:1 text/badge contrast in both light and dark modes across emerald, amber, and rose accents.
- Zinc studio tokens: adhere strictly to Rezekify styling tokens (`emerald-500`, `amber-500`, `rose-500`, `slate-200/80`, `zinc-800/80`, `zinc-900/60`).
- Multi-tenant data safety: row-level isolation (`user_id == current_user.id`) enforced on all database queries and mutation endpoints.

## Review Focus

1. **Null budget handling:** When a category has no budget configured (`monthly_budget = None`), the backend returns `budget_limit = None`, `budget_spent_pct = None`, and `budget_status = None`. The frontend displays `'Tanpa limit'` and standard share progress without crashing, division errors, or showing `NaN`. (Tested in Task 3 & Task 5)
2. **0 budget handling:** When a category has `monthly_budget = Decimal('0.00')` or `0`, the backend treats it as unbudgeted (skips percentage division by zero). The frontend handles this identically to null budget. (Tested in Task 3 & Task 5)
3. **Single point of spend over 100%:** When spending exceeds the monthly budget (`amt > budget`), the backend returns `budget_status = 'OVER_BUDGET'` and exact percentage (e.g., `125.0%`). The frontend clamps the progress bar visual width to 100% to prevent layout overflow, renders a Rose status badge with `TrendingUp` icon, and displays `Lewat Rp Y`. (Tested in Task 3 & Task 5)
4. **Cycle rollover date boundary:** Budget consumption calculations strictly respect `User.monthly_cycle_day`. Expenses strictly within `cycle_start` to `cycle_end` are aggregated; debits from preceding cycles are excluded. (Tested in Task 3)
5. **Non-expense category budget ignore:** If a user assigns a budget to an `INCOME` category, `get_category_spending_breakdown` filters for `Category.category_type == CategoryType.EXPENSE` so non-expense categories never contaminate spending budget breakdowns. (Tested in Task 3)

---

### Task 1: Database Migration `008_add_category_monthly_budget.py` and Model Update in `rezekify/db/models.py`

**Files:**
- Create: `rezekify/db/migrations/versions/008_add_category_monthly_budget.py`
- Modify: `rezekify/db/models.py:144-154`
- Test: `tests/test_migration_008.py`

**Interfaces:**
- Produces: `Category.monthly_budget = Column(Numeric(15, 2), nullable=True)` on `Category` model and `categories` table.

- [ ] **Step 1: Write the failing test in `tests/test_migration_008.py`**

```python
"""Tests for Category model monthly_budget field and migration 008."""

from pathlib import Path
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from rezekify.db.models import Category, CategoryType


def test_category_model_has_monthly_budget_column():
    inspector = inspect(Category)
    assert hasattr(Category, "monthly_budget")
    assert "monthly_budget" in inspector.columns


def test_category_instance_default_monthly_budget_is_none(db_session, sample_user):
    cat = Category(
        user_id=sample_user.id,
        name="Pengeluaran Harian",
        category_type=CategoryType.EXPENSE,
    )
    db_session.add(cat)
    db_session.commit()
    db_session.refresh(cat)

    assert cat.monthly_budget is None


def test_migration_008_upgrade_downgrade(tmp_path: Path):
    """Test Alembic migration 008 upgrade and downgrade on categories table."""
    db_path = tmp_path / "test_008.db"
    db_url = f"sqlite:///{db_path.as_posix()}"

    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", db_url)

    command.upgrade(cfg, "head")

    eng = sa.create_engine(db_url)
    try:
        inspector = sa.inspect(eng)
        columns = {c["name"] for c in inspector.get_columns("categories")}
        assert "monthly_budget" in columns
    finally:
        eng.dispose()

    # Downgrade 1 revision back
    command.downgrade(cfg, "-1")

    eng = sa.create_engine(db_url)
    try:
        inspector = sa.inspect(eng)
        columns = {c["name"] for c in inspector.get_columns("categories")}
        assert "monthly_budget" not in columns
    finally:
        eng.dispose()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_migration_008.py -v`
Expected: FAIL with `AssertionError: assert 'monthly_budget' in inspector.columns` or missing migration revision.

- [ ] **Step 3: Implement model update and Alembic migration**

1. In `rezekify/db/models.py`, add `monthly_budget = Column(Numeric(15, 2), nullable=True)` to `Category`.
2. In `rezekify/db/migrations/versions/008_add_category_monthly_budget.py`, implement Alembic revision `008` with `down_revision = '007'`, using `op.batch_alter_table('categories')` to add `monthly_budget` on upgrade and drop it on downgrade.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_migration_008.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add rezekify/db/models.py rezekify/db/migrations/versions/008_add_category_monthly_budget.py tests/test_migration_008.py
git commit -m "feat(db): add monthly_budget column to categories table"
```

---

### Task 2: Category API Schemas & Router Updates in `rezekify/api/v1/categories_router.py`

**Files:**
- Modify: `rezekify/api/v1/categories_router.py:15-107`
- Test: `tests/test_categories_api.py`

**Interfaces:**
- Consumes: `Category.monthly_budget` from Task 1.
- Produces:
  - `CategoryCreateRequest(name: str, category_type: CategoryType = CategoryType.EXPENSE, icon: str = "tag", color: str = "#64748b", monthly_budget: Optional[Decimal] = None)`
  - `CategoryUpdateRequest(name: Optional[str] = None, category_type: Optional[CategoryType] = None, icon: Optional[str] = None, color: Optional[str] = None, monthly_budget: Optional[Decimal] = None)`
  - `CategoryResponse(id: UUID, name: str, category_type: CategoryType, icon: Optional[str] = "tag", color: Optional[str] = "#64748b", monthly_budget: Optional[Decimal] = None)`

- [ ] **Step 1: Write the failing test in `tests/test_categories_api.py`**

Add `test_category_monthly_budget_crud_and_isolation` to `tests/test_categories_api.py`:

```python
def test_category_monthly_budget_crud_and_isolation():
    app.dependency_overrides[get_db] = override_get_db
    uid_c = uuid.uuid4().hex[:8]
    res_c = client.post(
        "/api/v1/auth/register",
        json={"email": f"cat_budget_{uid_c}@example.com", "password": "Password123!", "full_name": "Budget User"},
    )
    token_c = res_c.json()["access_token"]
    headers_c = {"Authorization": f"Bearer {token_c}"}

    # 1. Create category with monthly_budget
    create_res = client.post(
        "/api/v1/categories",
        json={"name": "Makan Resto", "category_type": "EXPENSE", "monthly_budget": 1500000.00},
        headers=headers_c,
    )
    assert create_res.status_code == 200
    cat_data = create_res.json()
    assert Decimal(str(cat_data["monthly_budget"])) == Decimal("1500000.00")
    cat_id = cat_data["id"]

    # 2. Update monthly_budget
    put_res = client.put(
        f"/api/v1/categories/{cat_id}",
        json={"monthly_budget": 2000000.00},
        headers=headers_c,
    )
    assert put_res.status_code == 200
    assert Decimal(str(put_res.json()["monthly_budget"])) == Decimal("2000000.00")

    # 3. Clear monthly_budget by setting to null
    clear_res = client.put(
        f"/api/v1/categories/{cat_id}",
        json={"monthly_budget": None},
        headers=headers_c,
    )
    assert clear_res.status_code == 200
    assert clear_res.json()["monthly_budget"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_categories_api.py::test_category_monthly_budget_crud_and_isolation -v`
Expected: FAIL with missing `monthly_budget` key in response or validation rejection.

- [ ] **Step 3: Implement `monthly_budget` support in `categories_router.py`**

1. Update `CategoryCreateRequest`, `CategoryUpdateRequest`, and `CategoryResponse` with `monthly_budget: Optional[Decimal] = None`.
2. In `create_category`, set `monthly_budget=req.monthly_budget`.
3. In `update_category`, check `'monthly_budget' in req.model_fields_set` and update `cat.monthly_budget = req.monthly_budget`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_categories_api.py -v`
Expected: PASS (all tests in test_categories_api.py pass).

- [ ] **Step 5: Commit**

```bash
git add rezekify/api/v1/categories_router.py tests/test_categories_api.py
git commit -m "feat(api): support monthly_budget in category schemas and endpoints"
```

---

### Task 3: Spending Breakdown Analytics with Budget Tracking in `rezekify/services/runway.py` & `rezekify/api/v1/dashboard_router.py`

**Files:**
- Modify: `rezekify/services/runway.py:88-95, 448-495`
- Modify: `rezekify/api/v1/dashboard_router.py:121-127, 596-612`
- Test: `tests/test_runway_service.py`

**Interfaces:**
- Consumes: `Category.monthly_budget` from Task 1.
- Produces:
  - `CategoryBreakdownItem`:
    ```python
    class CategoryBreakdownItem(NamedTuple):
        category_id: Optional[UUID]
        category_name: str
        amount: Decimal
        percentage: Decimal
        color: str
        budget_limit: Optional[Decimal] = None
        budget_spent_pct: Optional[Decimal] = None
        budget_status: Optional[Literal["HEALTHY", "WARNING", "OVER_BUDGET"]] = None
    ```
  - `CategorySpendingItemModel`:
    ```python
    class CategorySpendingItemModel(BaseModel):
        category_id: Optional[UUID] = None
        category_name: str
        amount: Decimal
        percentage: Decimal
        color: str
        budget_limit: Optional[Decimal] = None
        budget_spent_pct: Optional[Decimal] = None
        budget_status: Optional[Literal["HEALTHY", "WARNING", "OVER_BUDGET"]] = None
    ```

- [ ] **Step 1: Write the failing test in `tests/test_runway_service.py`**

Add `test_category_breakdown_with_budgets_and_edge_cases` to `tests/test_runway_service.py`:

```python
def test_category_breakdown_with_budgets_and_edge_cases(db_session, sample_user):
    """Verifies monthly budget calculation, status badges, and 5 review focus edge cases."""
    sample_user.monthly_cycle_day = 1
    acc = Account(
        user_id=sample_user.id,
        name="BCA Operasional",
        account_type=AccountType.BANK,
        current_balance=Decimal("10000000.00"),
    )
    # 1. Under budget: 50% spend (< 80%) -> HEALTHY
    cat_healthy = Category(
        user_id=sample_user.id,
        name="Makan & Minum",
        category_type=CategoryType.EXPENSE,
        color="#10b981",
        monthly_budget=Decimal("1000000.00"),
    )
    # 2. Near limit: 85% spend (>= 80% and <= 100%) -> WARNING
    cat_warning = Category(
        user_id=sample_user.id,
        name="Transportasi",
        category_type=CategoryType.EXPENSE,
        color="#f59e0b",
        monthly_budget=Decimal("1000000.00"),
    )
    # 3. Over budget: 140% spend (> 100%) -> OVER_BUDGET (Review Focus #3)
    cat_over = Category(
        user_id=sample_user.id,
        name="Hiburan",
        category_type=CategoryType.EXPENSE,
        color="#f43f5e",
        monthly_budget=Decimal("500000.00"),
    )
    # 4. Null budget: unbudgeted -> budget_limit None, budget_spent_pct None, budget_status None (Review Focus #1)
    cat_unbudgeted = Category(
        user_id=sample_user.id,
        name="Lain-lain",
        category_type=CategoryType.EXPENSE,
        color="#64748b",
        monthly_budget=None,
    )
    # 5. Zero budget: budget = 0.00 -> budget_spent_pct None, budget_status None without div/0 (Review Focus #2)
    cat_zero = Category(
        user_id=sample_user.id,
        name="Hadiah",
        category_type=CategoryType.EXPENSE,
        color="#8b5cf6",
        monthly_budget=Decimal("0.00"),
    )
    # 6. Income category with budget: must be ignored by spending breakdown (Review Focus #5)
    cat_income = Category(
        user_id=sample_user.id,
        name="Gaji Pokok",
        category_type=CategoryType.INCOME,
        color="#06b6d4",
        monthly_budget=Decimal("5000000.00"),
    )
    db_session.add_all([acc, cat_healthy, cat_warning, cat_over, cat_unbudgeted, cat_zero, cat_income])
    db_session.commit()

    ref_date = date(2026, 9, 20)

    # Current cycle transactions
    t1 = Transaction(user_id=sample_user.id, description="Makan", transaction_date=datetime(2026, 9, 5, 10, 0, tzinfo=timezone.utc))
    t2 = Transaction(user_id=sample_user.id, description="Bensin", transaction_date=datetime(2026, 9, 10, 10, 0, tzinfo=timezone.utc))
    t3 = Transaction(user_id=sample_user.id, description="Bioskop", transaction_date=datetime(2026, 9, 12, 10, 0, tzinfo=timezone.utc))
    t4 = Transaction(user_id=sample_user.id, description="Beli Baju", transaction_date=datetime(2026, 9, 14, 10, 0, tzinfo=timezone.utc))
    t5 = Transaction(user_id=sample_user.id, description="Kado", transaction_date=datetime(2026, 9, 15, 10, 0, tzinfo=timezone.utc))
    # Excluded transaction before cycle start (Review Focus #4)
    t_old = Transaction(user_id=sample_user.id, description="Makan Agustus", transaction_date=datetime(2026, 8, 28, 10, 0, tzinfo=timezone.utc))
    db_session.add_all([t1, t2, t3, t4, t5, t_old])
    db_session.flush()

    e1 = LedgerEntry(transaction_id=t1.id, user_id=sample_user.id, category_id=cat_healthy.id, account_id=acc.id, entry_type=EntryType.DEBIT, amount=Decimal("500000.00"))
    e2 = LedgerEntry(transaction_id=t2.id, user_id=sample_user.id, category_id=cat_warning.id, account_id=acc.id, entry_type=EntryType.DEBIT, amount=Decimal("850000.00"))
    e3 = LedgerEntry(transaction_id=t3.id, user_id=sample_user.id, category_id=cat_over.id, account_id=acc.id, entry_type=EntryType.DEBIT, amount=Decimal("700000.00"))
    e4 = LedgerEntry(transaction_id=t4.id, user_id=sample_user.id, category_id=cat_unbudgeted.id, account_id=acc.id, entry_type=EntryType.DEBIT, amount=Decimal("100000.00"))
    e5 = LedgerEntry(transaction_id=t5.id, user_id=sample_user.id, category_id=cat_zero.id, account_id=acc.id, entry_type=EntryType.DEBIT, amount=Decimal("50000.00"))
    e_old = LedgerEntry(transaction_id=t_old.id, user_id=sample_user.id, category_id=cat_healthy.id, account_id=acc.id, entry_type=EntryType.DEBIT, amount=Decimal("900000.00"))
    db_session.add_all([e1, e2, e3, e4, e5, e_old])
    db_session.commit()

    service = RunwayService(db_session)
    report = service.get_category_spending_breakdown(user_id=sample_user.id, today=ref_date)

    item_map = {i.category_name: i for i in report.items}

    # Review Focus #5: INCOME category excluded
    assert "Gaji Pokok" not in item_map

    # Review Focus #4: Previous cycle excluded (Makan is 500k, not 1.4M)
    item_h = item_map["Makan & Minum"]
    assert item_h.amount == Decimal("500000.00")
    assert item_h.budget_limit == Decimal("1000000.00")
    assert item_h.budget_spent_pct == Decimal("50.0")
    assert item_h.budget_status == "HEALTHY"

    # WARNING status
    item_w = item_map["Transportasi"]
    assert item_w.amount == Decimal("850000.00")
    assert item_w.budget_limit == Decimal("1000000.00")
    assert item_w.budget_spent_pct == Decimal("85.0")
    assert item_w.budget_status == "WARNING"

    # Review Focus #3: OVER_BUDGET status (> 100%)
    item_o = item_map["Hiburan"]
    assert item_o.amount == Decimal("700000.00")
    assert item_o.budget_limit == Decimal("500000.00")
    assert item_o.budget_spent_pct == Decimal("140.0")
    assert item_o.budget_status == "OVER_BUDGET"

    # Review Focus #1: Null budget handling
    item_u = item_map["Lain-lain"]
    assert item_u.budget_limit is None
    assert item_u.budget_spent_pct is None
    assert item_u.budget_status is None

    # Review Focus #2: Zero budget handling
    item_z = item_map["Hadiah"]
    assert item_z.budget_limit == Decimal("0.00")
    assert item_z.budget_spent_pct is None
    assert item_z.budget_status is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_runway_service.py::test_category_breakdown_with_budgets_and_edge_cases -v`
Expected: FAIL with `AttributeError` on `CategoryBreakdownItem` or missing fields.

- [ ] **Step 3: Implement budget calculations in `runway.py` and response model in `dashboard_router.py`**

1. In `rezekify/services/runway.py`:
   - Extend `CategoryBreakdownItem` with `budget_limit: Optional[Decimal] = None`, `budget_spent_pct: Optional[Decimal] = None`, `budget_status: Optional[Literal["HEALTHY", "WARNING", "OVER_BUDGET"]] = None`.
   - In `get_category_spending_breakdown`, select `Category.monthly_budget.label("monthly_budget")` and group by it.
   - For each row, calculate:
     ```python
     budget = Decimal(str(r.monthly_budget)) if r.monthly_budget is not None else None
     budget_spent_pct: Optional[Decimal] = None
     budget_status: Optional[str] = None
     if budget is not None and budget > Decimal("0.00"):
         budget_spent_pct = ((amt / budget) * Decimal("100")).quantize(Decimal("0.1"))
         if amt > budget:
             budget_status = "OVER_BUDGET"
         elif amt >= (budget * Decimal("0.80")):
             budget_status = "WARNING"
         else:
             budget_status = "HEALTHY"
     ```
2. In `rezekify/api/v1/dashboard_router.py`:
   - Extend `CategorySpendingItemModel` with `budget_limit`, `budget_spent_pct`, and `budget_status`.
   - In `get_spending_breakdown`, map `item.budget_limit`, `item.budget_spent_pct`, and `item.budget_status`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_runway_service.py -v`
Expected: PASS (all tests pass).

- [ ] **Step 5: Commit**

```bash
git add rezekify/services/runway.py rezekify/api/v1/dashboard_router.py tests/test_runway_service.py
git commit -m "feat(analytics): calculate category budget progress and status"
```

---

### Task 4: Frontend Category Types and Budget Management with Quick Chips in `frontend/src/types/api.ts` & `frontend/src/components/CategoryManagerModal.tsx`

**Files:**
- Modify: `frontend/src/types/api.ts:28-48`
- Modify: `frontend/src/components/CategoryManagerModal.tsx`
- Test: `frontend/src/__tests__/CategoryManagerModal.test.tsx`

**Interfaces:**
- Consumes: Category endpoints from Task 2.
- Produces:
  - `Category.monthly_budget?: number | null`
  - `CategoryCreateRequest.monthly_budget?: number | null`
  - `CategoryUpdateRequest.monthly_budget?: number | null`
  - Modal UI budget input with nominal quick chips (`+500rb`, `+1jt`, `+2jt`, `Reset`).

- [ ] **Step 1: Write the failing tests in `frontend/src/__tests__/CategoryManagerModal.test.tsx`**

Add the following tests to `frontend/src/__tests__/CategoryManagerModal.test.tsx`:

```typescript
it('renders monthly budget input with Rp prefix and quick increment chips', () => {
  render(
    <CategoryManagerModal
      isOpen={true}
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      categories={sampleCategories}
    />
  );
  expect(screen.getByLabelText(/Batas Anggaran Bulanan/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /\+500rb/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /\+1jt/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /\+2jt/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument();
});

it('increments and resets budget value using quick chips', () => {
  render(
    <CategoryManagerModal
      isOpen={true}
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      categories={sampleCategories}
    />
  );
  const budgetInput = screen.getByLabelText(/Batas Anggaran Bulanan/i) as HTMLInputElement;
  fireEvent.click(screen.getByRole('button', { name: /\+500rb/i }));
  expect(budgetInput.value).toBe('500.000');
  fireEvent.click(screen.getByRole('button', { name: /\+1jt/i }));
  expect(budgetInput.value).toBe('1.500.000');
  fireEvent.click(screen.getByRole('button', { name: /Reset/i }));
  expect(budgetInput.value).toBe('');
});

it('submits category creation with monthly_budget to apiClient.createCategory', async () => {
  const handleSuccess = vi.fn();
  const createSpy = vi.spyOn(apiClient, 'createCategory').mockResolvedValue({
    id: 'cat-new-budget',
    name: 'Belanja Mingguan',
    category_type: 'EXPENSE',
    icon: 'shopping-bag',
    color: '#10b981',
    monthly_budget: 1500000,
  });

  render(
    <CategoryManagerModal
      isOpen={true}
      onClose={vi.fn()}
      onSuccess={handleSuccess}
      categories={sampleCategories}
    />
  );

  fireEvent.change(screen.getByLabelText(/Nama Kategori/i), { target: { value: 'Belanja Mingguan' } });
  fireEvent.click(screen.getByRole('button', { name: /\+1jt/i }));
  fireEvent.click(screen.getByRole('button', { name: /\+500rb/i }));
  fireEvent.click(screen.getByRole('button', { name: /Tambah Kategori/i }));

  await waitFor(() => {
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Belanja Mingguan',
        monthly_budget: 1500000,
      })
    );
    expect(handleSuccess).toHaveBeenCalled();
  });
});

it('renders budget limit badge on budgeted category in category list', () => {
  const categoriesWithBudget: Category[] = [
    { id: 'cat-b1', name: 'Makan', category_type: 'EXPENSE', monthly_budget: 1500000 },
    { id: 'cat-b2', name: 'Bensin', category_type: 'EXPENSE', monthly_budget: null },
  ];

  render(
    <CategoryManagerModal
      isOpen={true}
      onClose={vi.fn()}
      onSuccess={vi.fn()}
      categories={categoriesWithBudget}
    />
  );

  expect(screen.getByText(/Rp 1\.500\.000\/bln/i)).toBeInTheDocument();
  expect(screen.getByText(/Tanpa limit/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/CategoryManagerModal.test.tsx --run`
Expected: FAIL with `TestingLibraryElementError: Unable to find label "Batas Anggaran Bulanan"`.

- [ ] **Step 3: Implement budget types and UI in `CategoryManagerModal.tsx`**

1. In `frontend/src/types/api.ts`, add `monthly_budget?: number | null` to `Category`, `CategoryCreateRequest`, and `CategoryUpdateRequest`.
2. In `frontend/src/components/CategoryManagerModal.tsx`:
   - Add state: `const [monthlyBudget, setMonthlyBudget] = useState<number | null>(null);`
   - Add budget input with label `Batas Anggaran Bulanan (opsional)` and prefix `Rp`.
   - Add quick increment chip buttons: `+500rb` (`+500000`), `+1jt` (`+1000000`), `+2jt` (`+2000000`), and `Reset` (`null`). Ensure buttons have minimum 38px touch targets (`min-h-[38px]`).
   - Include `monthly_budget: monthlyBudget` in `createCategory` and `updateCategory` calls.
   - Synchronize `monthlyBudget` state in `handleStartEdit` (`setMonthlyBudget(cat.monthly_budget ?? null)`) and `resetForm` (`setMonthlyBudget(null)`).
   - In category list items, render a badge showing `Budget: Rp {formatRupiah(cat.monthly_budget)}/bln` if configured, or `Tanpa limit` if unbudgeted.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/CategoryManagerModal.test.tsx --run`
Expected: PASS (all tests pass).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/components/CategoryManagerModal.tsx frontend/src/__tests__/CategoryManagerModal.test.tsx
git commit -m "feat(ui): add category monthly budget input with quick chips"
```

---

### Task 5: Monthly Breakdown Dual-Progress Indicators and Badges in `frontend/src/components/ExpenseCharts.tsx`

**Files:**
- Modify: `frontend/src/types/api.ts:220-227`
- Modify: `frontend/src/components/ExpenseCharts.tsx:485-540`
- Test: `frontend/src/__tests__/ExpenseChartsLiving.test.tsx`

**Interfaces:**
- Consumes: `CategorySpendingItemModel` from `frontend/src/types/api.ts` with `budget_limit`, `budget_spent_pct`, `budget_status`.
- Produces: Dual progress meter in `ExpenseCharts.tsx` monthly tab with status badges:
  - Emerald badge for HEALTHY (`CheckCircle2`, `Sisa Rp ...`)
  - Amber badge for WARNING (`AlertTriangle`, `Sisa Rp ...`)
  - Rose badge for OVER_BUDGET (`TrendingUp`, `Lewat Rp ...`)
  - Muted bar for unbudgeted category (`'Tanpa limit'`)

- [ ] **Step 1: Write the failing tests in `frontend/src/__tests__/ExpenseChartsLiving.test.tsx`**

Add the following test to `frontend/src/__tests__/ExpenseChartsLiving.test.tsx`:

```typescript
it('renders dual-meter budget indicators and status badges in monthly breakdown', async () => {
  const mockMonthlyWithBudgets = {
    period: 'monthly' as const,
    cycle_start_date: '2026-10-01',
    cycle_end_date: '2026-10-31',
    total_spent: 1500000,
    items: [
      {
        category_id: 'cat-1',
        category_name: 'Makanan',
        amount: 500000,
        percentage: 33.3,
        color: '#10B981',
        budget_limit: 1000000,
        budget_spent_pct: 50.0,
        budget_status: 'HEALTHY' as const,
      },
      {
        category_id: 'cat-2',
        category_name: 'Transportasi',
        amount: 850000,
        percentage: 56.7,
        color: '#F59E0B',
        budget_limit: 1000000,
        budget_spent_pct: 85.0,
        budget_status: 'WARNING' as const,
      },
      {
        category_id: 'cat-3',
        category_name: 'Hiburan',
        amount: 150000,
        percentage: 10.0,
        color: '#F43F5E',
        budget_limit: 100000,
        budget_spent_pct: 150.0,
        budget_status: 'OVER_BUDGET' as const,
      },
      {
        category_id: 'cat-4',
        category_name: 'Lain-lain',
        amount: 0,
        percentage: 0.0,
        color: '#64748B',
        budget_limit: null,
        budget_spent_pct: null,
        budget_status: null,
      },
    ],
  };

  vi.spyOn(apiClient, 'apiFetch').mockResolvedValue(mockMonthlyWithBudgets);

  render(
    <MemoryRouter>
      <ExpenseCharts />
    </MemoryRouter>
  );

  const monthlyBtn = screen.getByRole('tab', { name: /Bulanan \(Monthly\)/i });
  fireEvent.click(monthlyBtn);

  await waitFor(() => {
    // HEALTHY status
    expect(screen.getByText(/Sisa Rp 500\.000/i)).toBeInTheDocument();
    // WARNING status
    expect(screen.getByText(/Sisa Rp 150\.000/i)).toBeInTheDocument();
    // OVER_BUDGET status
    expect(screen.getByText(/Lewat Rp 50\.000/i)).toBeInTheDocument();
    // Unbudgeted status
    expect(screen.getByText(/Tanpa limit/i)).toBeInTheDocument();
  });

  // Clamp verification: Over-budget progress bar does not exceed 100% width
  const overBudgetFill = screen.getByTestId('budget-progress-fill-cat-3');
  expect(overBudgetFill).toHaveStyle({ width: '100%' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/ExpenseChartsLiving.test.tsx --run`
Expected: FAIL with `TestingLibraryElementError: Unable to find text "Sisa Rp 500.000"`.

- [ ] **Step 3: Implement dual-meter progress indicators and badges in `ExpenseCharts.tsx`**

1. In `frontend/src/types/api.ts`:
   - Add `export type BudgetStatus = 'HEALTHY' | 'WARNING' | 'OVER_BUDGET';`
   - Add `budget_limit?: number | null`, `budget_spent_pct?: number | null`, `budget_status?: BudgetStatus | null` to `CategorySpendingItemModel`.
2. In `frontend/src/components/ExpenseCharts.tsx`:
   - Import Lucide icons: `CheckCircle2`, `AlertTriangle`, `TrendingUp`, `Target`.
   - In monthly category breakdown rows (lines 485-540):
     - If `item.budget_limit && item.budget_limit > 0`:
       - Calculate remaining amount: `diff = item.budget_limit - item.amount`.
       - Render budget badge:
         - `HEALTHY`: `<CheckCircle2 className="w-3 h-3 text-emerald-500" /> Sisa Rp {formatRupiah(diff)}` with `text-emerald-600 dark:text-emerald-400 bg-emerald-500/10`
         - `WARNING`: `<AlertTriangle className="w-3 h-3 text-amber-500" /> Sisa Rp {formatRupiah(diff)}` with `text-amber-600 dark:text-amber-400 bg-amber-500/10`
         - `OVER_BUDGET`: `<TrendingUp className="w-3 h-3 text-rose-500" /> Lewat Rp {formatRupiah(Math.abs(diff))}` with `text-rose-600 dark:text-rose-400 bg-rose-500/10`
       - Render secondary budget progress bar:
         - Bar container height `h-1.5`, background `bg-slate-100 dark:bg-zinc-800`.
         - Fill element (`data-testid={`budget-progress-fill-${item.category_id}`}`):
           - `width: ${Math.min(100, item.budget_spent_pct || 0)}%`
           - Background color: `bg-emerald-500` (HEALTHY), `bg-amber-500` (WARNING), `bg-rose-500` (OVER_BUDGET).
     - If category has no budget (`!item.budget_limit`):
       - Render `'Tanpa limit'` badge with muted styling.
       - Render single progress bar showing total spend distribution (`item.percentage%`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/ExpenseChartsLiving.test.tsx --run`
Expected: PASS (all tests pass).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/components/ExpenseCharts.tsx frontend/src/__tests__/ExpenseChartsLiving.test.tsx
git commit -m "feat(charts): add dual-meter budget progress indicators to monthly breakdown"
```

---

### Task 6: Playwright E2E Browser Verification Suite in `frontend/e2e/category-budget.spec.ts`

**Files:**
- Create: `frontend/e2e/category-budget.spec.ts`

**Interfaces:**
- Consumes: Complete Cockpit workflow with mocked API responses for category budget management and monthly breakdown visualization.

- [ ] **Step 1: Write Playwright E2E test in `frontend/e2e/category-budget.spec.ts`**

```typescript
import { test, expect } from '@playwright/test';

const mockUser = {
  id: 'usr-e2e',
  email: 'tester@rezekify.id',
  full_name: 'Tester',
  telegram_chat_id: null,
};

const mockSummary = {
  total_liquid_cash: 5000000,
  vault_locked_cash: 1000000,
  operational_free_cash: 4000000,
  days_remaining: 15,
  daily_safe_runway: 150000,
  health_status: 'HEALTHY',
  upcoming_bills: [],
};

const mockCategories = [
  {
    id: 'cat-e2e-1',
    name: 'Kuliner & Jajan',
    category_type: 'EXPENSE',
    icon: 'utensils',
    color: '#10b981',
    monthly_budget: 1000000,
  },
  {
    id: 'cat-e2e-2',
    name: 'Transportasi',
    category_type: 'EXPENSE',
    icon: 'car',
    color: '#06b6d4',
    monthly_budget: null,
  },
];

const mockMonthlySpending = {
  period: 'monthly',
  cycle_start_date: '2026-10-01',
  cycle_end_date: '2026-10-31',
  total_spent: 600000,
  items: [
    {
      category_id: 'cat-e2e-1',
      category_name: 'Kuliner & Jajan',
      amount: 600000,
      percentage: 100.0,
      color: '#10b981',
      budget_limit: 1000000,
      budget_spent_pct: 60.0,
      budget_status: 'HEALTHY',
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'mock-token-e2e');
    localStorage.setItem('rezekify_auth_token', 'mock-token-e2e');
    localStorage.setItem('auth_user', JSON.stringify({ id: 'usr-e2e', email: 'tester@rezekify.id', full_name: 'Tester' }));
  });

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockUser) });
    }
    if (path.endsWith('/dashboard/summary')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockSummary) });
    }
    if (path.endsWith('/accounts') || path.endsWith('/accounts/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }
    if (path.endsWith('/vaults') || path.endsWith('/vaults/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }
    if (path.endsWith('/categories') || path.endsWith('/categories/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockCategories) });
    }
    if (path.endsWith('/dashboard/spending-breakdown')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockMonthlySpending) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
});

test('opens category manager, sets monthly budget with quick chips, and views budget status in monthly breakdown', async ({ page }) => {
  await page.goto('/cockpit');
  await expect(page.getByText('Cockpit Keuangan')).toBeVisible();

  // Switch ExpenseCharts to monthly tab
  const monthlyTab = page.getByRole('tab', { name: /Bulanan \(Monthly\)/i });
  await monthlyTab.click();

  // Verify monthly category breakdown shows budget status badge
  await expect(page.getByText('Kuliner & Jajan')).toBeVisible();
  await expect(page.getByText(/Sisa Rp 400\.000/i)).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it executes cleanly**

Run: `npx playwright test e2e/category-budget.spec.ts`
Expected: PASS (1 passed).

- [ ] **Step 3: Run full verification suite (unit + blackbox + e2e)**

Run:
1. `pytest tests/test_migration_008.py tests/test_categories_api.py tests/test_runway_service.py -v`
2. `npm test -- --run`
3. `npx playwright test e2e/category-budget.spec.ts`
Expected: ALL PASS with exit code 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/e2e/category-budget.spec.ts
git commit -m "test(e2e): add playwright browser suite for category budget workflow"
```
