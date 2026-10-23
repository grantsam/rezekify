# Category Monthly Budget Limits & Spending Progress Indicators Design

- **Date**: 2026-10-23
- **Scope**: Backend API & DB (`rezekify`), Frontend Cockpit & Charts (`frontend`)
- **Status**: Approved

---

## 1. Intent & Problem Statement

Rezekify's landing page promises a 5-step operational workflow. Step 4 explicitly states:
> **"Atur Anggaran — Kelola batas pengeluaran bulanan per kategori dan dapatkan peringatan otomatis sebelum melebihi limit."**

Currently, the category system only models descriptive taxonomy (`name`, `category_type`, `icon`, `color`). Users can tag expenses by category, and the analytics dashboard renders monthly spending distribution across categories, but users cannot set monthly financial limits per category. Without monthly budget thresholds:
1. Users lack proactive boundaries for variable discretionary spend (e.g. Dining, Entertainment, Shopping).
2. The Monthly Donut & category breakdown view in `ExpenseCharts.tsx` only shows retrospective percentage of total monthly outflow, with no indication of whether spending in a category is on track, near exhaustion, or exceeded.
3. The promise made on the landing page remains unfulfilled.

This specification designs optional monthly budget limits on categories, deterministic decimal budget tracking in the spending breakdown analytics engine, interactive budget management with nominal quick chips in `CategoryManagerModal`, and dual-meter progress indicators with friendly badges in `ExpenseCharts`.

---

## 2. Goals, Non-Goals, and Anti-Goals

### 2.1 Goals
- **Optional Category Budgeting**: Allow users to assign an optional `monthly_budget` (`Numeric(15, 2)`) to any category. If left null or zero, the category behaves as unbudgeted without penalization or clutter.
- **Deterministic Decimal Math**: Calculate spending vs. budget deterministically via Python `Decimal` in `rezekify/services/runway.py` to preserve financial integrity and prevent floating-point drift.
- **Dual-Meter Breakdown in Cockpit**: In the Monthly Spending view (`ExpenseCharts.tsx`), provide:
  - Existing share of total expenses (`percentage`).
  - Budget progress meter (`budget_spent_pct`).
  - Contextual status badges:
    - Under budget: `'Terkendali'` / `'Sisa Rp X'` (Emerald).
    - Near limit (>= 80% and <= 100%): `'Mendekati Limit'` / `'Sisa Rp X'` (Amber).
    - Over budget (> 100%): `'Lewat Rp Y'` (Rose).
- **Fast Input Ergonomics**: In `CategoryManagerModal.tsx`, equip the budget input with 1-tap quick nominal increment chips (`+500rb`, `+1jt`, `+2jt`) and instant Indonesian currency formatting.
- **Strict Vector Icons**: 100% Lucide React icons (`Target`, `CheckCircle2`, `AlertTriangle`, `TrendingUp`) — zero raw emojis.

### 2.2 Non-Goals
- **Hard Transaction Blocking**: Never prevent a user from recording real transactions. Rezekify reflects reality; budget exceedance informs and guides, never rejects.
- **Complex Multi-Tier Rollups**: No parent/child nested category rollups or sub-budgets. Each category evaluates independently.
- **Credit Card Rewards & Categorical Cashbacks**: No merchant rewards scoring or credit card optimization rules.

### 2.3 Anti-Goals
- **Guilt-Tripping / Alarming Copy**: Avoid dramatic or punitive language (e.g. *"Anggaran Anda Jebol!"* or *"Bahaya!"*). Use calm, objective Indonesian copy (*"Terkendali"*, *"Sisa Rp X"*, *"Lewat Rp Y"*).
- **Floating-Point Arithmetic**: Zero `float` usage in calculations on the backend; all budget math is quantized to exact decimal cents (`0.01` or `0.1` for percentages).

---

## 3. Database Schema & Migration

### 3.1 Migration Revision: `008_add_category_monthly_budget.py`
Located at `rezekify/db/migrations/versions/008_add_category_monthly_budget.py`.
Uses Alembic `batch_alter_table` to guarantee compatibility across SQLite and PostgreSQL.

```python
"""add category monthly budget

Revision ID: 008
Revises: 007
Create Date: 2026-10-23
"""
from alembic import op
import sqlalchemy as sa

revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('categories') as batch_op:
        batch_op.add_column(
            sa.Column('monthly_budget', sa.Numeric(precision=15, scale=2), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table('categories') as batch_op:
        batch_op.drop_column('monthly_budget')
```

---

## 4. Backend Service & API Layer

### 4.1 Model Update (`rezekify/db/models.py`)
Extend `Category` with `monthly_budget`:

```python
class Category(Base):
    __tablename__ = "categories"
    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    category_type = Column(SQLEnum(CategoryType, native_enum=False), nullable=False)
    icon = Column(String(50), default="tag")
    color = Column(String(20), default="#64748b")
    monthly_budget = Column(Numeric(15, 2), nullable=True)

    user = relationship("User", back_populates="categories")
```

### 4.2 Schemas & Routers (`rezekify/api/v1/categories_router.py`)
Update category request and response models:

```python
class CategoryCreateRequest(BaseModel):
    name: str
    category_type: CategoryType = CategoryType.EXPENSE
    icon: str = "tag"
    color: str = "#64748b"
    monthly_budget: Optional[Decimal] = None


class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = None
    category_type: Optional[CategoryType] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    monthly_budget: Optional[Decimal] = None


class CategoryResponse(BaseModel):
    id: UUID
    name: str
    category_type: CategoryType
    icon: Optional[str] = "tag"
    color: Optional[str] = "#64748b"
    monthly_budget: Optional[Decimal] = None

    model_config = ConfigDict(from_attributes=True)
```

In `create_category` and `update_category` endpoints, map `req.monthly_budget` directly to the `Category.monthly_budget` attribute.

### 4.3 Analytics Engine & Dashboard Response (`rezekify/services/runway.py` & `dashboard_router.py`)

#### 4.3.1 Runway NamedTuple Update
Enhance `CategoryBreakdownItem`:

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

#### 4.3.2 Query & Calculation Logic in `get_category_spending_breakdown`
Update the query to select `Category.monthly_budget`:

```python
rows = (
    self.db.query(
        Category.id.label("category_id"),
        Category.name.label("category_name"),
        Category.color.label("category_color"),
        Category.monthly_budget.label("monthly_budget"),
        func.coalesce(func.sum(LedgerEntry.amount), Decimal("0.00")).label("total_amount"),
    )
    .select_from(LedgerEntry)
    .join(Transaction, LedgerEntry.transaction_id == Transaction.id)
    .outerjoin(Category, LedgerEntry.category_id == Category.id)
    .filter(
        Transaction.user_id == user_id,
        LedgerEntry.entry_type == EntryType.DEBIT,
        or_(Category.category_type == CategoryType.EXPENSE, Category.id.is_(None)),
        func.date(Transaction.transaction_date) >= cycle_start.isoformat(),
        func.date(Transaction.transaction_date) <= cycle_end.isoformat(),
    )
    .group_by(Category.id, Category.name, Category.color, Category.monthly_budget)
    .order_by(func.sum(LedgerEntry.amount).desc())
    .all()
)
```

Calculate budget status and spent percentage per item:
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

# ponytail: category breakdown defaults to current month cycle; upgrade to historical budget snapshots if multi-month trends are needed.
```

#### 4.3.3 Dashboard Router Schema (`rezekify/api/v1/dashboard_router.py`)
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

---

## 5. Frontend UI/UX Design & Impeccable Craft

### 5.1 TypeScript Types (`frontend/src/types/api.ts`)
```typescript
export interface Category {
  id: string;
  name: string;
  category_type?: CategoryType | string;
  icon?: string;
  color?: string;
  monthly_budget?: number | null;
}

export interface CategoryCreateRequest {
  name: string;
  category_type?: CategoryType;
  icon?: string;
  color?: string;
  monthly_budget?: number | null;
}

export interface CategoryUpdateRequest {
  name?: string;
  category_type?: CategoryType;
  icon?: string;
  color?: string;
  monthly_budget?: number | null;
}

export type BudgetStatus = 'HEALTHY' | 'WARNING' | 'OVER_BUDGET';

export interface CategorySpendingItemModel {
  category_id?: string | null;
  category_name: string;
  amount: number;
  percentage: number;
  color: string;
  budget_limit?: number | null;
  budget_spent_pct?: number | null;
  budget_status?: BudgetStatus | null;
}
```

### 5.2 Category Management Modal (`CategoryManagerModal.tsx`)
In the category create/edit form:
1. **Budget Input Field**:
   - Number input with `Rp` prefix label.
   - Clean numeric state handling with Indonesian formatting (`1.000.000`).
   - Clear helper text: *"Batas pengeluaran per siklus bulanan (opsional)"*.
2. **Quick Nominal Increment Chips**:
   - Chips: `+500rb`, `+1jt`, `+2jt`, `Reset`.
   - Clicking a chip adds the specified amount to the current budget value (or resets to 0/empty).
   - Minimum 38px touch targets for mobile accessibility.
3. **Category List Display**:
   - Displays budget badge beside the category name (e.g., `Budget: Rp 1.500.000/bln` or `Tanpa limit`).

### 5.3 Expense Charts Component (`ExpenseCharts.tsx`)
In the Monthly Spending breakdown tab:
1. **Donut Breakdown Visuals**:
   - The outer ring continues to represent the distribution of spending across categories.
2. **Category List Dual-Meter Items**:
   - **Row Header**: Category color indicator, category name, and primary amount (`Rp X`) with percentage of total spend (`Y%`).
   - **Budget Progress Indicator**:
     - When `budget_limit` is set:
       - Displays a dual progress bar or highlighted fill reflecting `budget_spent_pct`.
       - Bar color changes dynamically:
         - Emerald (`bg-emerald-500`): `< 80%`
         - Amber (`bg-amber-500`): `80% - 100%`
         - Rose (`bg-rose-500`): `> 100%`
       - Status badge displayed on the right:
         - HEALTHY: `<CheckCircle2 className="w-3 h-3 text-emerald-500" /> Sisa Rp {formatCompactRupiah(budget_limit - amount)}`
         - WARNING: `<AlertTriangle className="w-3 h-3 text-amber-500" /> Sisa Rp {formatCompactRupiah(budget_limit - amount)}`
         - OVER_BUDGET: `<TrendingUp className="w-3 h-3 text-rose-500" /> Lewat Rp {formatCompactRupiah(amount - budget_limit)}`
     - When `budget_limit` is not set:
       - Displays single progress bar reflecting share of total expenditure, labeled `'Tanpa limit'`.
3. **Impeccable & Zero CLS Compliance**:
   - Height locked to prevent layout shifts.
   - Zero raw emojis: all visual markers use Lucide React vector icons.
   - High contrast ratios (>= 4.5:1) in both light and dark modes.

---

## 6. Testing Strategy

### 6.1 Backend Tests
- `tests/test_categories_api.py`:
  - `test_create_category_with_monthly_budget`: Verify creating an expense category with a `monthly_budget` returns the budget correctly formatted.
  - `test_update_category_monthly_budget`: Verify updating, clearing, and persisting `monthly_budget`.
  - `test_multi_tenant_isolation_category_budget`: Confirm tenant boundaries are strictly respected.
- `tests/test_runway_service.py`:
  - `test_category_breakdown_with_budgets`: Verify calculation of `budget_limit`, `budget_spent_pct`, and `budget_status` for:
    - Normal spend under 80% (`HEALTHY`).
    - Spend between 80% and 100% (`WARNING`).
    - Spend exceeding 100% (`OVER_BUDGET`).
    - Unbudgeted category (`budget_limit` is None, `budget_status` is None).
- `tests/test_migration_008.py`:
  - Verify migration upgrade and downgrade apply cleanly without schema corruption.

### 6.2 Frontend Unit Tests
- `frontend/src/__tests__/CategoryManagerModal.test.tsx`:
  - Verify rendering of budget input and quick nominal chips (`+500rb`, `+1jt`, `+2jt`).
  - Verify submitting form with `monthly_budget` dispatches correct payload to API.
  - Verify chip click increments budget input deterministically.
- `frontend/src/__tests__/ExpenseChartsLiving.test.tsx`:
  - Verify monthly breakdown renders budget badges (`Terkendali`, `Sisa Rp ...`, `Lewat Rp ...`).
  - Verify progress bar styling changes according to `budget_status` (Emerald, Amber, Rose).
- `frontend/src/__tests__/ZeroEmojiAudit.test.ts`:
  - Scan all category and chart components to confirm zero emoji Unicode literals.

### 6.3 E2E Tests (Playwright)
- `frontend/e2e/category-budget.spec.ts`:
  - Authenticate user.
  - Open Category Manager modal, create or update a category with a monthly budget limit (e.g. Rp 1.000.000).
  - Record a transaction in that category.
  - Switch to monthly spending breakdown chart and assert that the category displays the budget meter and status badge.

---

## 7. Delivery Plan & Verification Checklist

1. [ ] **Step 1: DB Migration**: Create `rezekify/db/migrations/versions/008_add_category_monthly_budget.py` and run alembic upgrade.
2. [ ] **Step 2: Backend Models & API**: Update `rezekify/db/models.py`, `rezekify/api/v1/categories_router.py`, `rezekify/services/runway.py`, and `rezekify/api/v1/dashboard_router.py`.
3. [ ] **Step 3: Backend Verification**: Execute `pytest tests/test_categories_api.py tests/test_runway_service.py`.
4. [ ] **Step 4: Frontend Types & Components**: Update `frontend/src/types/api.ts`, `CategoryManagerModal.tsx`, and `ExpenseCharts.tsx`.
5. [ ] **Step 5: Frontend Verification**: Execute `npm test -- --run` and verify all tests pass.
6. [ ] **Step 6: E2E Verification**: Run Playwright test suite for budget workflow.
