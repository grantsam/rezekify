# CSV Export & Bill Notifications (In-App & Telegram) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement CSV transaction export endpoint & UI button, Telegram on-demand `/tagihan` command with 08:00 WIB lifespan scheduler, and Web In-App Notification Bell popover for H-7 upcoming commitments.

**Architecture:** FastAPI streaming CSV with anti-injection escaping and database cursor batching, asyncio non-blocking lifespan notifier without Celery/Redis, and HeroUI popover notification bell in AppLayout with deterministic Rupiah formatting.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0, React 18, HeroUI, Lucide React, Pytest, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-13-export-csv-and-notifications-design.md`

## Global Constraints

- **Core Invariant 1 (Deterministic Financial Math):** Nominal amounts on CSV exports and Telegram messages must be rendered directly from database `Decimal` values without floating-point conversion; frontend currency displays must use `formatRupiah`.
- **Core Invariant 3 (Row-Level Tenant Isolation):** All CSV queries must enforce `WHERE user_id = current_user.id`; Telegram notifications must evaluate bills strictly per user ID.
- **Zero-Bloat Architecture:** Zero additional pip or npm dependencies. Export uses Python stdlib `csv` and `io.StringIO`; scheduler uses `asyncio.create_task` inside FastAPI lifespan; frontend uses already-installed `@heroui/react` and `lucide-react`.
- **Anti-CSV Injection (CWE-1236):** All free-text strings starting with `=`, `+`, `-`, `@`, `\t`, or `\r` must be escaped by prefixing with a single quote (`'`).
- **Telegram Rate-Limiting:** Bulk reminders must maintain a 50ms interval between messages (`await asyncio.sleep(0.05)`, maximum 20 messages/second) to stay within Telegram Bot API limits.

## Review Focus

1. **CSV Formula Injection:** Free-text descriptions or category names starting with formula characters (`=SUM(A1:A10)`, `@malicious`) are sanitized with a leading `'` (`test_export_csv_formula_injection_defense` in Task 1).
2. **Streaming Large Transaction Volumes:** Export generator yields chunks iteratively via `io.StringIO` and `yield_per(500)` without buffering the whole file in RAM (`test_export_csv_streaming_chunks` in Task 1).
3. **Invalid Date Filters:** Reversed date parameters (`start_date > end_date`) produce a valid empty CSV file with header rows rather than a 500 error (`test_export_csv_reversed_date_filters` in Task 1).
4. **Telegram User Without Upcoming Bills:** `/tagihan` command provides a polite reassurance message when no bills are due within 7 days (`test_telegram_bills_command_no_bills` in Task 3).
5. **Timezone Handling for 08:00 WIB:** Notification scheduler computes time explicitly with `UTC+7` (`Asia/Jakarta`) offset regardless of server host UTC clock (`test_scheduled_bills_notifier_wib_timezone` in Task 3).

---

### Task 1: Backend CSV Export Endpoint (`rezekify/api/v1/transactions_router.py`) & Tests (`tests/test_csv_export.py`)

**Files:**
- Create: `tests/test_csv_export.py`
- Modify: `rezekify/api/v1/transactions_router.py:1-234`

**Interfaces:**
- Consumes: `rezekify.db.models.Transaction`, `rezekify.db.models.LedgerEntry`, `rezekify.db.models.Account`, `rezekify.db.models.Category`, `rezekify.api.deps.get_current_user`, `rezekify.api.deps.get_db`
- Produces: `GET /api/v1/transactions/export` returning `StreamingResponse(media_type="text/csv")` with headers `Content-Disposition: attachment; filename="rezekify_transaksi_{YYYYMMDD_HHMMSS}.csv"` and `Cache-Control: no-cache, no-store, must-revalidate`

- [ ] **Step 1: Write failing tests in `tests/test_csv_export.py`**

```python
"""Tests for CSV transaction export streaming endpoint and anti-injection defenses."""

from datetime import datetime, timezone, timedelta
from decimal import Decimal
import io
import csv
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from rezekify.api.deps import get_current_user, get_db
from rezekify.api.main import app
from rezekify.db.models import (
    Account,
    AccountType,
    Base,
    Category,
    CategoryType,
    EntryType,
    LedgerEntry,
    Transaction,
    User,
)

# Isolated SQLite in-memory test database
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
Base.metadata.create_all(bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


current_test_user = None


def override_get_current_user():
    return current_test_user


app.dependency_overrides[get_db] = override_get_db
app.dependency_overrides[get_current_user] = override_get_current_user
client = TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def setup_clean_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield


@pytest.fixture
def test_users():
    db = TestingSessionLocal()
    user_a = User(
        email="user_a@rezekify.test",
        password_hash="hash_a",
        full_name="User Alpha",
    )
    user_b = User(
        email="user_b@rezekify.test",
        password_hash="hash_b",
        full_name="User Beta",
    )
    db.add_all([user_a, user_b])
    db.commit()
    db.refresh(user_a)
    db.refresh(user_b)
    db.close()
    return user_a, user_b


def test_export_csv_unauthorized():
    """Unauthenticated access must be rejected with HTTP 401."""
    global current_test_user
    current_test_user = None
    app.dependency_overrides.pop(get_current_user, None)
    res = client.get("/api/v1/transactions/export")
    assert res.status_code == 401
    app.dependency_overrides[get_current_user] = override_get_current_user


def test_export_csv_success_and_headers(test_users):
    """Authenticated user receives valid CSV with Excel UTF-8 BOM and correct columns."""
    global current_test_user
    user_a, _ = test_users
    current_test_user = user_a

    db = TestingSessionLocal()
    acc = Account(
        user_id=user_a.id,
        name="BCA Utama",
        account_type=AccountType.BANK,
        current_balance=Decimal("1500000.00"),
    )
    cat = Category(
        user_id=user_a.id,
        name="Makanan & Minuman",
        category_type=CategoryType.EXPENSE,
    )
    db.add_all([acc, cat])
    db.commit()
    db.refresh(acc)
    db.refresh(cat)

    now = datetime(2026, 10, 13, 14, 30, 0, tzinfo=timezone.utc)
    tx = Transaction(
        user_id=user_a.id,
        description="Nasi Padang + Es Teh",
        source_channel="WEB_MANUAL",
        transaction_date=now,
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)

    debit_entry = LedgerEntry(
        transaction_id=tx.id,
        user_id=user_a.id,
        category_id=cat.id,
        entry_type=EntryType.DEBIT,
        amount=Decimal("28000.00"),
    )
    credit_entry = LedgerEntry(
        transaction_id=tx.id,
        user_id=user_a.id,
        account_id=acc.id,
        entry_type=EntryType.CREDIT,
        amount=Decimal("28000.00"),
    )
    db.add_all([debit_entry, credit_entry])
    db.commit()
    db.close()

    res = client.get("/api/v1/transactions/export")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "Content-Disposition" in res.headers
    assert "attachment; filename=" in res.headers["Content-Disposition"]
    assert res.headers["Cache-Control"] == "no-cache, no-store, must-revalidate"

    content = res.content.decode("utf-8-sig")  # Decode BOM
    reader = list(csv.reader(io.StringIO(content)))
    assert len(reader) == 2  # Header + 1 row
    assert reader[0] == [
        "Tanggal",
        "Tipe",
        "Kategori",
        "Akun Sumber",
        "Akun Tujuan",
        "Deskripsi",
        "Nominal (IDR)",
        "Saldo Akun",
    ]
    assert reader[1] == [
        "2026-10-13 14:30:00",
        "PENGELUARAN",
        "Makanan & Minuman",
        "BCA Utama",
        "-",
        "Nasi Padang + Es Teh",
        "28000.00",
        "1500000.00",
    ]


def test_export_csv_tenant_isolation(test_users):
    """User A must never see User B's transactions in CSV export."""
    global current_test_user
    user_a, user_b = test_users

    db = TestingSessionLocal()
    tx_b = Transaction(
        user_id=user_b.id,
        description="Rahasia User B",
        source_channel="WEB_MANUAL",
        transaction_date=datetime.now(timezone.utc),
    )
    db.add(tx_b)
    db.commit()
    db.refresh(tx_b)
    db.add(
        LedgerEntry(
            transaction_id=tx_b.id,
            user_id=user_b.id,
            entry_type=EntryType.DEBIT,
            amount=Decimal("999999.00"),
        )
    )
    db.commit()
    db.close()

    current_test_user = user_a
    res = client.get("/api/v1/transactions/export")
    assert res.status_code == 200
    content = res.content.decode("utf-8-sig")
    assert "Rahasia User B" not in content
    assert "999999.00" not in content


def test_export_csv_formula_injection_defense(test_users):
    """CSV cells beginning with formula injection characters must be escaped with a single quote."""
    global current_test_user
    user_a, _ = test_users
    current_test_user = user_a

    db = TestingSessionLocal()
    tx1 = Transaction(
        user_id=user_a.id,
        description="=SUM(A1:A10)",
        source_channel="WEB_MANUAL",
        transaction_date=datetime.now(timezone.utc),
    )
    tx2 = Transaction(
        user_id=user_a.id,
        description="@malicious_link",
        source_channel="WEB_MANUAL",
        transaction_date=datetime.now(timezone.utc),
    )
    tx3 = Transaction(
        user_id=user_a.id,
        description="+cmd|' /C calc'!A0",
        source_channel="WEB_MANUAL",
        transaction_date=datetime.now(timezone.utc),
    )
    db.add_all([tx1, tx2, tx3])
    db.commit()
    db.close()

    res = client.get("/api/v1/transactions/export")
    assert res.status_code == 200
    content = res.content.decode("utf-8-sig")
    reader = list(csv.reader(io.StringIO(content)))

    descriptions = [row[5] for row in reader[1:]]
    assert "'=SUM(A1:A10)" in descriptions
    assert "'@malicious_link" in descriptions
    assert "'+cmd|' /C calc'!A0" in descriptions


def test_export_csv_reversed_date_filters(test_users):
    """When start_date is later than end_date, returns a valid empty CSV without crashing."""
    global current_test_user
    user_a, _ = test_users
    current_test_user = user_a

    start = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()
    end = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()

    res = client.get(f"/api/v1/transactions/export?start_date={start}&end_date={end}")
    assert res.status_code == 200
    content = res.content.decode("utf-8-sig")
    reader = list(csv.reader(io.StringIO(content)))
    assert len(reader) == 1  # Only header
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pytest tests/test_csv_export.py -v`
Expected: FAIL with HTTP 404 or missing route `/api/v1/transactions/export`.

- [ ] **Step 3: Implement CSV Export in `rezekify/api/v1/transactions_router.py`**

In `rezekify/api/v1/transactions_router.py`:
1. Add stdlib imports `csv`, `io` and `StreamingResponse` from `fastapi.responses`.
2. Add imports for `Account` and `Category` from `rezekify.db.models`.
3. Implement `sanitize_csv_cell` and `map_transaction_to_csv_row`.
4. Add route `GET /export` before dynamic `/{transaction_id}` routes.

```python
import csv
import io
from fastapi.responses import StreamingResponse
from rezekify.db.models import Account, Category


def sanitize_csv_cell(value: Optional[str]) -> str:
    """Escapes strings to prevent spreadsheet formula injection (CWE-1236)."""
    if not value:
        return "-"
    cleaned = str(value).strip()
    if cleaned.startswith(("=", "+", "-", "@", "\t", "\r")):
        return f"'{cleaned}"
    return cleaned


def map_transaction_to_csv_row(
    tx: Transaction,
    user_accounts: dict[UUID, str],
    user_categories: dict[UUID, str],
    account_balances: dict[UUID, Decimal],
) -> list[str]:
    """Deterministically maps a Transaction and its LedgerEntries into a CSV row."""
    debit_entries = [e for e in tx.ledger_entries if e.entry_type == EntryType.DEBIT]
    credit_entries = [e for e in tx.ledger_entries if e.entry_type == EntryType.CREDIT]

    debit_entry = debit_entries[0] if debit_entries else None
    credit_entry = credit_entries[0] if credit_entries else None

    tx_type = "PENGELUARAN"
    cat_name = "-"
    source_acc = "-"
    target_acc = "-"
    amount = Decimal("0.00")
    balance = Decimal("0.00")

    if credit_entry and credit_entry.account_id and debit_entry and debit_entry.category_id:
        # EXPENSE: Credit Account, Debit Category
        tx_type = "PENGELUARAN"
        source_acc = user_accounts.get(credit_entry.account_id, "-")
        target_acc = "-"
        cat_name = user_categories.get(debit_entry.category_id, "-")
        amount = debit_entry.amount
        balance = account_balances.get(credit_entry.account_id, Decimal("0.00"))
    elif debit_entry and debit_entry.account_id and credit_entry and credit_entry.category_id:
        # INCOME: Debit Account, Credit Category
        tx_type = "PEMASUKAN"
        source_acc = "-"
        target_acc = user_accounts.get(debit_entry.account_id, "-")
        cat_name = user_categories.get(credit_entry.category_id, "-")
        amount = debit_entry.amount
        balance = account_balances.get(debit_entry.account_id, Decimal("0.00"))
    elif credit_entry and credit_entry.account_id and debit_entry and debit_entry.account_id:
        # TRANSFER: Credit FromAccount, Debit ToAccount
        tx_type = "TRANSFER"
        source_acc = user_accounts.get(credit_entry.account_id, "-")
        target_acc = user_accounts.get(debit_entry.account_id, "-")
        cat_name = "-"
        amount = debit_entry.amount
        balance = account_balances.get(credit_entry.account_id, Decimal("0.00"))
    elif debit_entry:
        amount = debit_entry.amount
    elif credit_entry:
        amount = credit_entry.amount

    date_str = tx.transaction_date.strftime("%Y-%m-%d %H:%M:%S") if tx.transaction_date else "-"
    nominal_str = f"{amount:.2f}"
    saldo_str = f"{balance:.2f}"

    return [
        date_str,
        tx_type,
        sanitize_csv_cell(cat_name),
        sanitize_csv_cell(source_acc),
        sanitize_csv_cell(target_acc),
        sanitize_csv_cell(tx.description),
        nominal_str,
        saldo_str,
    ]


@transactions_router.get("/export")
def export_transactions_csv(
    start_date: Optional[datetime] = Query(default=None),
    end_date: Optional[datetime] = Query(default=None),
    account_id: Optional[UUID] = Query(default=None),
    category_id: Optional[UUID] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Streams transaction history in CSV format with formula injection defenses and tenant isolation."""
    query = (
        db.query(Transaction)
        .options(selectinload(Transaction.ledger_entries))
        .filter(Transaction.user_id == current_user.id)
    )

    if account_id is not None:
        query = query.filter(Transaction.ledger_entries.any(LedgerEntry.account_id == account_id))

    if category_id is not None:
        query = query.filter(Transaction.ledger_entries.any(LedgerEntry.category_id == category_id))

    if start_date is not None:
        query = query.filter(Transaction.transaction_date >= start_date)

    if end_date is not None:
        query = query.filter(Transaction.transaction_date <= end_date)

    query = query.distinct().order_by(Transaction.transaction_date.desc(), Transaction.id.desc())

    user_accounts = {a.id: a.name for a in db.query(Account).filter_by(user_id=current_user.id).all()}
    account_balances = {a.id: a.current_balance for a in db.query(Account).filter_by(user_id=current_user.id).all()}
    user_categories = {c.id: c.name for c in db.query(Category).filter_by(user_id=current_user.id).all()}

    def generate_csv_stream():
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
        # Write Excel UTF-8 BOM
        output.write("﻿")
        writer.writerow([
            "Tanggal", "Tipe", "Kategori", "Akun Sumber",
            "Akun Tujuan", "Deskripsi", "Nominal (IDR)", "Saldo Akun"
        ])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)

        for tx in query.yield_per(500):
            row = map_transaction_to_csv_row(tx, user_accounts, user_categories, account_balances)
            writer.writerow(row)
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    now_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"rezekify_transaksi_{now_str}.csv"
    return StreamingResponse(
        generate_csv_stream(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `pytest tests/test_csv_export.py -v`
Expected: 5 passed.

- [ ] **Step 5: Commit changes**

```bash
git add tests/test_csv_export.py rezekify/api/v1/transactions_router.py
git commit -m "feat(api): implement streaming csv transaction export with formula injection sanitization"
```

---

### Task 2: Frontend CSV Export Integration (`frontend/src/services/apiClient.ts` & `frontend/src/components/LedgerView.tsx`) & Tests (`frontend/src/__tests__/LedgerView.test.tsx`)

**Files:**
- Modify: `frontend/src/services/apiClient.ts:180-212`
- Modify: `frontend/src/components/LedgerView.tsx:1-110`
- Modify: `frontend/src/pages/DashboardPage.tsx:150-169`
- Create: `frontend/src/__tests__/LedgerView.test.tsx`

**Interfaces:**
- Consumes: `downloadTransactionsCSV(params?: TransactionFilterParams): Promise<void>` in `apiClient.ts`
- Produces: `LedgerViewProps.onExportCSV?: () => Promise<void> | void`, `LedgerViewProps.activeFilters?: TransactionFilterParams`, "Unduh CSV" button on `LedgerView` toolbar

- [ ] **Step 1: Write failing tests in `frontend/src/__tests__/LedgerView.test.tsx`**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LedgerView } from '../components/LedgerView';
import * as apiClient from '../services/apiClient';

describe('LedgerView CSV Export Integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const defaultProps = {
    transactions: [],
    accounts: [],
    categories: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    onParamsChange: vi.fn(),
    onPageChange: vi.fn(),
    onDeleteTransaction: vi.fn(),
    onEditTransaction: vi.fn(),
    onOpenManualModal: vi.fn(),
    onOpenSimulateModal: vi.fn(),
    onOpenCategoryModal: vi.fn(),
  };

  it('renders "Unduh CSV" button on toolbar', () => {
    render(<LedgerView {...defaultProps} />);
    const exportBtn = screen.getByRole('button', { name: /Unduh CSV/i });
    expect(exportBtn).toBeInTheDocument();
  });

  it('triggers downloadTransactionsCSV with activeFilters on click', async () => {
    const downloadSpy = vi.spyOn(apiClient, 'downloadTransactionsCSV').mockResolvedValue(undefined);
    const mockFilters = { account_id: 'acc-1', search: 'makan' };

    render(<LedgerView {...defaultProps} activeFilters={mockFilters} />);
    const exportBtn = screen.getByRole('button', { name: /Unduh CSV/i });

    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(downloadSpy).toHaveBeenCalledWith(mockFilters);
    });
  });

  it('disables button and displays loading state during export execution', async () => {
    let resolveExport: () => void = () => {};
    const exportPromise = new Promise<void>((resolve) => {
      resolveExport = resolve;
    });
    vi.spyOn(apiClient, 'downloadTransactionsCSV').mockReturnValue(exportPromise);

    render(<LedgerView {...defaultProps} />);
    const exportBtn = screen.getByRole('button', { name: /Unduh CSV/i });

    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(exportBtn).toBeDisabled();
    });

    resolveExport();

    await waitFor(() => {
      expect(exportBtn).not.toBeDisabled();
    });
  });

  it('invokes custom onExportCSV prop if supplied', async () => {
    const customExportMock = vi.fn().mockResolvedValue(undefined);
    render(<LedgerView {...defaultProps} onExportCSV={customExportMock} />);

    const exportBtn = screen.getByRole('button', { name: /Unduh CSV/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(customExportMock).toHaveBeenCalledTimes(1);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm --prefix frontend test -- --run src/__tests__/LedgerView.test.tsx`
Expected: FAIL with "Unable to find an accessible element with the role "button" and name `/Unduh CSV/i`".

- [ ] **Step 3: Implement `downloadTransactionsCSV` in `apiClient.ts` and `LedgerView.tsx`**

In `frontend/src/services/apiClient.ts`:
Add `downloadTransactionsCSV`:
```typescript
export async function downloadTransactionsCSV(params?: TransactionFilterParams): Promise<void> {
  const query = new URLSearchParams();
  if (params?.account_id) query.append('account_id', params.account_id);
  if (params?.category_id) query.append('category_id', params.category_id);
  if (params?.start_date) query.append('start_date', params.start_date);
  if (params?.end_date) query.append('end_date', params.end_date);

  const qs = query.toString();
  const endpoint = `/transactions/export${qs ? `?${qs}` : ''}`;
  const baseUrl = API_BASE_URL;

  let headers: Record<string, string> = { ...getAuthHeader() };

  let response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'GET',
    credentials: 'include',
    headers,
  });

  if (response.status === 401) {
    const newToken = await executeTokenRefresh();
    if (newToken) {
      headers = { ...headers, Authorization: `Bearer ${newToken}` };
      response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        credentials: 'include',
        headers,
      });
    }
  }

  if (!response.ok) {
    throw new Error(`Gagal mengunduh CSV: status ${response.status}`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  let filename = 'rezekify_transaksi.csv';
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
```

In `frontend/src/components/LedgerView.tsx`:
Add `Download` icon from `lucide-react`, add `downloadTransactionsCSV` import, and update toolbar:
```tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@heroui/react';
import { PlusCircle, Calculator, Tag, Download } from 'lucide-react';
import { Transaction, Account, Category, TransactionFilterParams } from '../types/api';
import { downloadTransactionsCSV } from '../services/apiClient';
import { TransactionsTable } from './TransactionsTable';

export interface LedgerViewProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  activeFilters?: TransactionFilterParams;
  onExportCSV?: () => Promise<void> | void;
  onParamsChange: (params: TransactionFilterParams) => void;
  onPageChange: (page: number) => void;
  onDeleteTransaction: (id: string) => Promise<void> | void;
  onEditTransaction: (tx: Transaction) => void;
  onOpenManualModal: () => void;
  onOpenSimulateModal: () => void;
  onOpenCategoryModal: () => void;
  isLoading?: boolean;
}

export const LedgerView: React.FC<LedgerViewProps> = ({
  transactions,
  accounts,
  categories,
  total,
  page,
  pageSize,
  totalPages,
  activeFilters,
  onExportCSV,
  onParamsChange,
  onPageChange,
  onDeleteTransaction,
  onEditTransaction,
  onOpenManualModal,
  onOpenSimulateModal,
  onOpenCategoryModal,
  isLoading = false,
}) => {
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handleExport = async () => {
    if (onExportCSV) {
      await onExportCSV();
      return;
    }
    try {
      setIsExporting(true);
      await downloadTransactionsCSV(activeFilters);
    } catch (err) {
      console.error('Failed to export transactions CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="space-y-6"
    >
      {/* Header with Title and Pro Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Buku Besar (Ledger)
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Pencatatan mutasi double-entry immutable dengan audit trail lengkap.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="flat"
            isLoading={isExporting}
            isDisabled={isExporting}
            onPress={handleExport}
            startContent={!isExporting ? <Download className="w-3.5 h-3.5 text-zinc-400" /> : undefined}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 min-h-[38px] rounded-xl text-xs font-semibold"
          >
            Unduh CSV
          </Button>

          <Button
            size="sm"
            variant="flat"
            onPress={onOpenCategoryModal}
            startContent={<Tag className="w-3.5 h-3.5 text-zinc-400" />}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 min-h-[38px] rounded-xl text-xs font-semibold"
          >
            + Kategori
          </Button>

          <Button
            size="sm"
            variant="flat"
            onPress={onOpenSimulateModal}
            startContent={<Calculator className="w-3.5 h-3.5 text-zinc-400" />}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/80 min-h-[38px] rounded-xl text-xs font-semibold"
          >
            Simulasi Belanja
          </Button>

          <Button
            size="sm"
            onPress={onOpenManualModal}
            startContent={<PlusCircle className="w-3.5 h-3.5" />}
            className="bg-white text-zinc-950 hover:bg-zinc-200 font-semibold min-h-[38px] rounded-xl text-xs"
          >
            + Catat Manual
          </Button>
        </div>
      </div>

      {/* High-density Ledger Table with Multi-filter Toolbar */}
      <TransactionsTable
        transactions={transactions}
        accounts={accounts}
        categories={categories}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        onParamsChange={onParamsChange}
        onPageChange={onPageChange}
        onDelete={onDeleteTransaction}
        onEdit={onEditTransaction}
        isLoading={isLoading}
      />
    </motion.div>
  );
};
```

In `frontend/src/pages/DashboardPage.tsx`:
Pass `activeFilters={ledger.filters}` to `<LedgerView>`:
```tsx
        {activeView === 'ledger' && (
          <LedgerView
            transactions={ledger.transactions}
            accounts={dashboard.accounts}
            categories={dashboard.categories}
            total={ledger.pagination.total}
            page={ledger.pagination.page}
            pageSize={ledger.filters.page_size ?? 20}
            totalPages={ledger.pagination.total_pages}
            activeFilters={ledger.filters}
            onParamsChange={ledger.handleParamsChange}
            onPageChange={ledger.handlePageChange}
            onDeleteTransaction={handleDeleteTransaction}
            onEditTransaction={modals.openEditTx}
            onOpenManualModal={modals.openManualModal}
            onOpenSimulateModal={modals.openSimulateModal}
            onOpenCategoryModal={modals.openCategoryModal}
            isLoading={ledger.isDeleting}
          />
        )}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npm --prefix frontend test -- --run src/__tests__/LedgerView.test.tsx`
Expected: 4 passed.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/services/apiClient.ts frontend/src/components/LedgerView.tsx frontend/src/pages/DashboardPage.tsx frontend/src/__tests__/LedgerView.test.tsx
git commit -m "feat(ui): add csv export download button and api client integration in ledger view"
```

---

### Task 3: Telegram Bot `/tagihan` Command & Scheduled Notifier (`rezekify/gateway/telegram_bot.py`, `rezekify/api/main.py`) & Tests (`tests/test_telegram_notifications.py`)

**Files:**
- Modify: `rezekify/gateway/telegram_bot.py:42-126`
- Modify: `rezekify/api/main.py:1-74`
- Create: `tests/test_telegram_notifications.py`

**Interfaces:**
- Consumes: `rezekify.services.runway.RunwayService.get_upcoming_bills`, `rezekify.core.config.settings.TELEGRAM_BOT_TOKEN`, `rezekify.db.session.SessionLocal`
- Produces: Telegram bot command handler for `/tagihan` and `/bills`, FastAPI lifespan task `scheduled_bills_notifier`, helper `dispatch_daily_bill_reminders(today: date)`

- [ ] **Step 1: Write failing tests in `tests/test_telegram_notifications.py`**

```python
"""Tests for Telegram /tagihan on-demand inquiry and scheduled 08:00 WIB bill reminders."""

import asyncio
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from rezekify.api.main import dispatch_daily_bill_reminders
from rezekify.db.models import Base, User, Vault, VaultType
from rezekify.gateway.telegram_bot import TelegramGateway

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
Base.metadata.create_all(bind=test_engine)


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    yield


@pytest.fixture
def linked_user():
    db = TestingSessionLocal()
    user = User(
        email="telegram_user@rezekify.test",
        password_hash="pw_hash",
        full_name="Raden Mas Danang",
        telegram_chat_id=12345678,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.close()
    return user


def test_telegram_bills_command_unlinked_user():
    """Unlinked chat ID typing /tagihan receives instructions to pair account."""
    db = TestingSessionLocal()
    gateway = TelegramGateway(db=db)
    res = gateway.process_text_message(chat_id=999999, text="/tagihan")
    assert "Akun Telegram Anda belum terhubung ke rezekify" in res
    db.close()


def test_telegram_bills_command_no_bills(linked_user):
    """Linked user with no pending bills receives reassuring confirmation."""
    db = TestingSessionLocal()
    gateway = TelegramGateway(db=db)
    res = gateway.process_text_message(chat_id=linked_user.telegram_chat_id, text="/tagihan")
    assert "✅ Tidak ada tagihan jatuh tempo dalam 7 hari ke depan" in res
    assert "Semua komitmen aman" in res
    db.close()


def test_telegram_bills_command_with_bills(linked_user):
    """Linked user with bills due within 7 days receives formatted breakdown."""
    db = TestingSessionLocal()
    today = date.today()
    vault = Vault(
        user_id=linked_user.id,
        name="Kost Bulanan",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("850000.00"),
        allocated_amount=Decimal("150000.00"),
        target_date=today + timedelta(days=3),
    )
    db.add(vault)
    db.commit()

    gateway = TelegramGateway(db=db)
    res = gateway.process_text_message(chat_id=linked_user.telegram_chat_id, text="/tagihan")
    assert "Daftar Tagihan Mendatang (H-7)" in res
    assert "Kost Bulanan" in res
    assert "3 hari lagi" in res
    assert "Rp 150,000" in res or "150.000" in res
    assert "Rp 850,000" in res or "850.000" in res
    db.close()


@pytest.mark.asyncio
async def test_dispatch_daily_bill_reminders_sends_notification(linked_user):
    """Dispatches Telegram notification for users with upcoming bills and respects token."""
    db = TestingSessionLocal()
    today = date.today()
    vault = Vault(
        user_id=linked_user.id,
        name="WiFi Indihome",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("320000.00"),
        allocated_amount=Decimal("100000.00"),
        target_date=today + timedelta(days=2),
    )
    db.add(vault)
    db.commit()
    db.close()

    mock_post = AsyncMock()
    mock_post.return_value.is_success = True

    with patch("httpx.AsyncClient.post", mock_post):
        count = await dispatch_daily_bill_reminders(
            today=today,
            session_factory=TestingSessionLocal,
            bot_token="test_bot_token_123",
        )
        assert count == 1
        assert mock_post.await_count == 1
        call_kwargs = mock_post.await_args.kwargs
        assert call_kwargs["json"]["chat_id"] == 12345678
        assert "Pengingat Pagi Rezekify (08:00 WIB)" in call_kwargs["json"]["text"]
        assert "WiFi Indihome" in call_kwargs["json"]["text"]


@pytest.mark.asyncio
async def test_dispatch_daily_bill_reminders_skips_when_no_token():
    """Scheduler silently skips dispatch when bot token is not configured."""
    count = await dispatch_daily_bill_reminders(
        today=date.today(),
        session_factory=TestingSessionLocal,
        bot_token="",
    )
    assert count == 0
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pytest tests/test_telegram_notifications.py -v`
Expected: FAIL with `ImportError: cannot import name 'dispatch_daily_bill_reminders'` or attribute errors.

- [ ] **Step 3: Implement `/tagihan` command and Lifespan Scheduler**

In `rezekify/gateway/telegram_bot.py`:
Add import `from rezekify.services.runway import RunwayService` and handle `/tagihan` / `/bills`:
```python
        if cmd in ("/tagihan", "/bills"):
            return self.handle_upcoming_bills_inquiry(user.id)
```
Add method:
```python
    def handle_upcoming_bills_inquiry(self, user_id: Any) -> str:
        """Answers on-demand inquiry for upcoming commitments due within 7 days."""
        runway = RunwayService(self.db)
        bills = runway.get_upcoming_bills(user_id=user_id)
        if not bills:
            return "✅ Tidak ada tagihan jatuh tempo dalam 7 hari ke depan. Semua komitmen aman!"

        lines = ["📋 *Daftar Tagihan Mendatang (H-7)*\n"]
        for idx, bill in enumerate(bills, 1):
            due_str = f"{bill.days_until_due} hari lagi" if bill.days_until_due > 0 else "hari ini"
            date_formatted = bill.target_date.strftime("%d %b %Y")
            lines.append(
                f"{idx}. *{bill.name}*\n"
                f"   ⏳ Jatuh tempo: {due_str} ({date_formatted})\n"
                f"   💰 Terkumpul: Rp {bill.allocated_amount:,.0f} dari target Rp {bill.target_amount:,.0f}\n"
            )
        lines.append("💡 Segera cukupi alokasi dana di brankas komitmen agar runway harian tetap aman!")
        return "\n".join(lines)
```

In `rezekify/api/main.py`:
Add scheduler logic and lifespan handler:
```python
import asyncio
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
import logging
from typing import Optional
import httpx

from rezekify.db.models import User
from rezekify.db.session import SessionLocal
from rezekify.services.runway import RunwayService

logger = logging.getLogger(__name__)


async def dispatch_daily_bill_reminders(
    today: date,
    session_factory=None,
    bot_token: Optional[str] = None,
) -> int:
    """Dispatches daily 08:00 WIB bill reminders to linked Telegram users."""
    token = bot_token if bot_token is not None else settings.TELEGRAM_BOT_TOKEN
    if not token:
        logger.debug("Telegram bot token not configured; skipping daily bill reminders.")
        return 0

    factory = session_factory or SessionLocal
    db = factory()
    dispatched_count = 0
    try:
        users = (
            db.query(User)
            .filter(User.telegram_chat_id.isnot(None))
            .all()
        )
        async with httpx.AsyncClient(timeout=10.0) as client:
            for user in users:
                runway = RunwayService(db)
                bills = runway.get_upcoming_bills(user_id=user.id, today=today)
                if not bills:
                    continue

                bullet_lines = []
                for b in bills:
                    due_str = f"sisa {b.days_until_due} hari" if b.days_until_due > 0 else "hari ini"
                    bullet_lines.append(f"• {b.name}: Rp {b.target_amount:,.0f} ({due_str})")
                bullets_text = "\n".join(bullet_lines)

                msg = (
                    f"⏰ *Pengingat Pagi Rezekify (08:00 WIB)*\n\n"
                    f"Halo {user.full_name}, Anda memiliki {len(bills)} tagihan jatuh tempo dalam 7 hari ke depan:\n"
                    f"{bullets_text}\n\n"
                    f"Cek status lengkap dengan ketik /tagihan atau buka web dashboard."
                )

                try:
                    res = await client.post(
                        f"https://api.telegram.org/bot{token}/sendMessage",
                        json={
                            "chat_id": user.telegram_chat_id,
                            "text": msg,
                            "parse_mode": "Markdown",
                        },
                    )
                    if res.is_success:
                        dispatched_count += 1
                except Exception as send_err:
                    logger.warning("Failed to send bill reminder to user %s: %s", user.id, send_err)

                # Rate limit: max 20 msgs/second
                await asyncio.sleep(0.05)
    finally:
        db.close()

    return dispatched_count


async def scheduled_bills_notifier():
    """Background loop checking for 08:00 WIB every 60s and triggering daily notifications."""
    last_dispatched_date: Optional[date] = None
    wib_tz = timezone(timedelta(hours=7))
    while True:
        try:
            await asyncio.sleep(60)
            now_wib = datetime.now(wib_tz)
            today_wib = now_wib.date()
            if now_wib.hour == 8 and now_wib.minute == 0 and last_dispatched_date != today_wib:
                last_dispatched_date = today_wib
                await dispatch_daily_bill_reminders(today_wib)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("Error in scheduled_bills_notifier: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    notifier_task = asyncio.create_task(scheduled_bills_notifier())
    try:
        yield
    finally:
        notifier_task.cancel()
        try:
            await notifier_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="rezekify Core API",
    version="1.0.0",
    description="Deterministic Double-Entry Personal Finance & Runway Engine",
    docs_url="/docs" if settings.SHOW_DOCS else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.SHOW_DOCS else None,
    lifespan=lifespan,
)
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `pytest tests/test_telegram_notifications.py -v`
Expected: 5 passed.

- [ ] **Step 5: Commit changes**

```bash
git add rezekify/gateway/telegram_bot.py rezekify/api/main.py tests/test_telegram_notifications.py
git commit -m "feat(telegram): add /tagihan command and 08:00 WIB daily bill reminder lifespan scheduler"
```

---

### Task 4: Frontend Web In-App Notification Bell & Popover (`frontend/src/components/AppLayout.tsx`, `frontend/src/components/Sidebar.tsx`, `frontend/src/components/BottomDock.tsx`) & Tests (`frontend/src/__tests__/NotificationBell.test.tsx`)

**Files:**
- Create: `frontend/src/components/NotificationBell.tsx`
- Modify: `frontend/src/components/AppLayout.tsx:1-63`
- Modify: `frontend/src/components/Sidebar.tsx:16-65`
- Modify: `frontend/src/components/BottomDock.tsx:5-88`
- Modify: `frontend/src/pages/DashboardPage.tsx:57-77`
- Create: `frontend/src/__tests__/NotificationBell.test.tsx`

**Interfaces:**
- Consumes: `UpcomingBill` from `frontend/src/types/api.ts`, `formatRupiah` from `frontend/src/utils/formatters.ts`
- Produces: `NotificationBell` component, badge indicator in `Sidebar` and `BottomDock`, global top header in `AppLayout`

- [ ] **Step 1: Write failing tests in `frontend/src/__tests__/NotificationBell.test.tsx`**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NotificationBell } from '../components/NotificationBell';
import { UpcomingBill } from '../types/api';

describe('NotificationBell Component & Popover', () => {
  const sampleBills: UpcomingBill[] = [
    {
      name: 'Kost Bulanan',
      target_amount: 850000,
      allocated_amount: 0,
      target_date: '2026-10-16',
      days_until_due: 3,
    },
    {
      name: 'WiFi Indihome',
      target_amount: 320000,
      allocated_amount: 150000,
      target_date: '2026-10-18',
      days_until_due: 5,
    },
  ];

  it('renders notification bell button without badge when upcomingBills is empty', () => {
    render(<NotificationBell upcomingBills={[]} onViewChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Notifikasi Tagihan/i })).toBeInTheDocument();
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
  });

  it('renders amber badge with count when bills exist', () => {
    render(<NotificationBell upcomingBills={sampleBills} onViewChange={vi.fn()} />);
    const badge = screen.getByTestId('notification-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('2');
    expect(badge.className).toContain('bg-amber-500');
  });

  it('opens popover showing list of impending bills on click', () => {
    render(<NotificationBell upcomingBills={sampleBills} onViewChange={vi.fn()} />);
    const bellBtn = screen.getByRole('button', { name: /Notifikasi Tagihan/i });
    fireEvent.click(bellBtn);

    expect(screen.getByText('Tagihan Mendatang (H-7)')).toBeInTheDocument();
    expect(screen.getByText('Kost Bulanan')).toBeInTheDocument();
    expect(screen.getByText('WiFi Indihome')).toBeInTheDocument();
    expect(screen.getByText(/Rp 850\.000/)).toBeInTheDocument();
  });

  it('triggers onViewChange("vaults") when clicking "Buka Komitmen & Vaults" shortcut', () => {
    const handleViewChange = vi.fn();
    render(<NotificationBell upcomingBills={sampleBills} onViewChange={handleViewChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Notifikasi Tagihan/i }));

    const shortcutBtn = screen.getByRole('button', { name: /Buka Komitmen & Vaults/i });
    fireEvent.click(shortcutBtn);

    expect(handleViewChange).toHaveBeenCalledWith('vaults');
  });

  it('displays reassurance empty state when opened with 0 upcoming bills', () => {
    render(<NotificationBell upcomingBills={[]} onViewChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Notifikasi Tagihan/i }));

    expect(screen.getByText('Semua Komitmen Aman')).toBeInTheDocument();
    expect(screen.getByText('Tidak ada tagihan mendesak dalam 7 hari ke depan.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm --prefix frontend test -- --run src/__tests__/NotificationBell.test.tsx`
Expected: FAIL with module not found `../components/NotificationBell`.

- [ ] **Step 3: Implement `NotificationBell.tsx` and integrate into Shell components**

Create `frontend/src/components/NotificationBell.tsx`:
```tsx
import React, { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent, Button } from '@heroui/react';
import { Bell, ShieldCheck, ArrowRight } from 'lucide-react';
import { UpcomingBill } from '../types/api';
import { formatRupiah } from '../utils/formatters';

export interface NotificationBellProps {
  upcomingBills?: UpcomingBill[];
  onViewChange: (view: 'overview' | 'ledger' | 'vaults' | 'chat' | 'settings') => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  upcomingBills = [],
  onViewChange,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const count = upcomingBills.length;

  const handleShortcutClick = () => {
    setIsOpen(false);
    onViewChange('vaults');
  };

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={(open) => setIsOpen(open)}
      placement="bottom-end"
      offset={10}
      showArrow
    >
      <PopoverTrigger>
        <Button
          isIconOnly
          variant="light"
          aria-label={
            count > 0
              ? `Notifikasi Tagihan: ${count} belum dibayar`
              : 'Notifikasi Tagihan: Tidak ada tagihan mendesak'
          }
          className="relative min-w-[38px] min-h-[38px] text-zinc-400 hover:text-white bg-transparent transition-colors"
        >
          <Bell className="w-5 h-5" />
          {count > 0 && (
            <span
              data-testid="notification-badge"
              className="absolute -top-1 -right-1 bg-amber-500 text-zinc-950 font-bold text-[10px] min-w-[18px] h-[18px] flex items-center justify-center rounded-full ring-2 ring-[#0c0c0e]"
            >
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-4 bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-2xl shadow-2xl">
        <div className="w-full space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <h3 className="font-semibold text-xs text-white">
              Tagihan Mendatang (H-7)
            </h3>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                count > 0
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}
            >
              {count > 0 ? `${count} Perlu Perhatian` : 'Semua Aman'}
            </span>
          </div>

          {/* Content */}
          {count === 0 ? (
            <div data-testid="notification-empty" className="flex flex-col items-center justify-center py-6 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-zinc-200">Semua Komitmen Aman</p>
              <p className="text-[11px] text-zinc-400">Tidak ada tagihan mendesak dalam 7 hari ke depan.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {upcomingBills.map((bill, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex items-start justify-between gap-2"
                >
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-white">{bill.name}</p>
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                      <span>Terkumpul: {formatRupiah(bill.allocated_amount)}</span>
                      <span>/</span>
                      <span>{formatRupiah(bill.target_amount)}</span>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border shrink-0 ${
                      bill.days_until_due <= 1
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}
                  >
                    {bill.days_until_due === 0 ? 'Hari ini' : `H-${bill.days_until_due}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Footer Shortcut */}
          <div className="pt-2 border-t border-zinc-800">
            <Button
              size="sm"
              onPress={handleShortcutClick}
              endContent={<ArrowRight className="w-3.5 h-3.5" />}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 min-h-[38px] rounded-xl text-xs font-semibold"
            >
              Buka Komitmen & Vaults
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
```

In `frontend/src/components/AppLayout.tsx`:
Add `NotificationBell` in global header bar and pass `upcomingBills`:
```tsx
import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { BottomDock } from './BottomDock';
import { NotificationBell } from './NotificationBell';
import { Account, UpcomingBill, User } from '../types/api';

export interface AppLayoutProps {
  activeView: 'overview' | 'ledger' | 'vaults' | 'chat' | 'settings';
  onViewChange: (view: 'overview' | 'ledger' | 'vaults' | 'chat' | 'settings') => void;
  accounts: Account[];
  transactionCount?: number;
  upcomingBills?: UpcomingBill[];
  user: User | null;
  onLogout: () => void;
  onOpenCreateAccount: () => void;
  onOpenSettings?: () => void;
  onQuickCapturePress?: () => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  activeView,
  onViewChange,
  accounts,
  transactionCount,
  upcomingBills = [],
  user,
  onLogout,
  onOpenCreateAccount,
  onOpenSettings,
  onQuickCapturePress,
  children,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const upcomingBillsCount = upcomingBills.length;

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-zinc-100 flex flex-col md:flex-row antialiased selection:bg-zinc-800 selection:text-white">
      {/* Desktop Collapsible Sidebar */}
      <Sidebar
        activeView={activeView}
        onViewChange={onViewChange}
        accounts={accounts}
        transactionCount={transactionCount}
        upcomingBillsCount={upcomingBillsCount}
        user={user}
        onLogout={onLogout}
        onOpenCreateAccount={onOpenCreateAccount}
        onOpenSettings={onOpenSettings}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-6">
        {/* Global Header Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8 py-3 bg-[#0c0c0e]/80 backdrop-blur-md border-b border-zinc-800/60">
          <div className="flex items-center gap-2 md:hidden">
            <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/80">
              <span className="font-mono font-bold text-white text-xs">R</span>
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-white">Rezekify</span>
          </div>

          <div className="hidden md:block">
            <span className="text-xs text-zinc-500 font-medium capitalize">{activeView}</span>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <NotificationBell upcomingBills={upcomingBills} onViewChange={onViewChange} />
          </div>
        </header>

        {children}
      </div>

      {/* Mobile Fixed Bottom Dock */}
      <BottomDock
        activeView={activeView}
        onViewChange={onViewChange}
        upcomingBillsCount={upcomingBillsCount}
        onQuickCapturePress={onQuickCapturePress}
      />
    </div>
  );
};
```

In `frontend/src/components/Sidebar.tsx`:
Add optional `upcomingBillsCount?: number` to `SidebarProps` and show badge on `vaults` menu item:
```tsx
export interface SidebarProps {
  activeView: 'overview' | 'ledger' | 'vaults' | 'chat' | 'settings';
  onViewChange: (view: 'overview' | 'ledger' | 'vaults' | 'chat' | 'settings') => void;
  accounts: Account[];
  transactionCount?: number;
  upcomingBillsCount?: number;
  user: User | null;
  onLogout: () => void;
  onOpenCreateAccount: () => void;
  onOpenSettings?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}
```
Update `navItems`:
```tsx
    {
      id: 'vaults' as const,
      label: 'Komitmen & Vaults',
      icon: ShieldCheck,
      badge: upcomingBillsCount !== undefined && upcomingBillsCount > 0 ? upcomingBillsCount : undefined,
    },
```

In `frontend/src/components/BottomDock.tsx`:
Add optional `upcomingBillsCount?: number` to `BottomDockProps` and add indicator dot on Vaults tab button:
```tsx
export interface BottomDockProps {
  activeView: 'overview' | 'ledger' | 'vaults' | 'chat' | 'settings';
  onViewChange: (view: 'overview' | 'ledger' | 'vaults' | 'chat' | 'settings') => void;
  upcomingBillsCount?: number;
  onQuickCapturePress?: () => void;
}
```
Update `Vaults` button in `BottomDock`:
```tsx
      <Button
        variant="light"
        onPress={() => onViewChange('vaults')}
        aria-label="Vaults"
        className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] h-auto p-1 gap-1 bg-transparent ${
          activeView === 'vaults' ? 'text-indigo-400 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
        }`}
      >
        <div className="relative">
          <ShieldCheck className="w-5 h-5" />
          {upcomingBillsCount !== undefined && upcomingBillsCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-zinc-950" />
          )}
        </div>
        <span className="text-[10px]">Vaults</span>
      </Button>
```

In `frontend/src/pages/DashboardPage.tsx`:
Pass `upcomingBills={dashboard.summary?.upcoming_bills}` to `AppLayout`:
```tsx
    <AppLayout
      activeView={activeView}
      onViewChange={(view) => {
        if (view === 'settings') {
          modals.openSettingsModal();
        } else {
          setActiveView(view);
        }
      }}
      accounts={dashboard.accounts}
      transactionCount={ledger.pagination.total}
      upcomingBills={dashboard.summary?.upcoming_bills}
      user={user}
      onLogout={logout}
      onOpenCreateAccount={modals.openCreateAccount}
      onOpenSettings={modals.openSettingsModal}
      onQuickCapturePress={() => {
        setChatPrompt('');
        setActiveView('chat');
      }}
    >
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npm --prefix frontend test -- --run src/__tests__/NotificationBell.test.tsx`
Expected: 5 passed.

- [ ] **Step 5: Commit changes**

```bash
git add frontend/src/components/NotificationBell.tsx frontend/src/components/AppLayout.tsx frontend/src/components/Sidebar.tsx frontend/src/components/BottomDock.tsx frontend/src/pages/DashboardPage.tsx frontend/src/__tests__/NotificationBell.test.tsx
git commit -m "feat(ui): add in-app notification bell popover and shell navigation badges for upcoming bills"
```

---

### Task 5: End-to-End Verification and Lint Check across Python (`pytest`, `ruff check`) and Frontend (`npm run build`, `npm run test`)

**Files:**
- Verification only

- [ ] **Step 1: Run comprehensive backend test suite**

Run: `pytest tests/test_csv_export.py tests/test_telegram_notifications.py tests/test_api_endpoints.py -v`
Expected: All tests pass with exit code 0.

- [ ] **Step 2: Run Python linting and code quality check**

Run: `ruff check rezekify tests`
Expected: Zero linting errors.

- [ ] **Step 3: Run full frontend test suite**

Run: `npm --prefix frontend test -- --run`
Expected: All test suites pass with exit code 0.

- [ ] **Step 4: Run frontend TypeScript compile and production build**

Run: `npm --prefix frontend run build`
Expected: Clean build (`dist/` generated with zero type errors).

- [ ] **Step 5: Commit any final formatting or cleanup**

```bash
git status
```
Expected: Clean working tree ready for branch completion.
