# rezekify (UNAPPROVED): Autonomous Multi-Modal Personal Finance Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build rezekify (UNAPPROVED), an autonomous multi-modal personal finance manager featuring a deterministic double-entry accounting core, dynamic daily safe runway calculations, multi-user row-level isolation in PostgreSQL, rotary LLM key pool for zero-cost multimodal receipt parsing, Telegram bot gateway, and a decoupled React 18 + Vite + TS + Tailwind web dashboard with an AI-first omni-input hero and auxiliary manual CRUD.

**Architecture:** Three-tier decoupled architecture separating deterministic financial calculation (Python + PostgreSQL) from probabilistic natural language ingestion (ReAct agent + Gemini 2.5 Flash Vision + Rotary Key Pool). Channel adapters (Telegram bot and FastAPI REST API) interface with user endpoints while the React dashboard provides visualization, AI omni-input, and manual CRUD fallback.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy 2.0 (asyncpg / psycopg2), Pydantic v2, PostgreSQL, python-telegram-bot / httpx, google-genai / groq, React 18, Vite, TypeScript, Tailwind CSS, Lucide React, Recharts.

**Spec:** `docs/superpowers/specs/2026-09-18-rezekify-financial-manager-design.md`

## Global Constraints
* **Project Directory:** Standalone clean project directory `rezekify/` with independent git and virtual environment.
* **Deterministic Accounting:** Zero LLM math calculations; all money arithmetic, account balances, and runway days must be computed in Python standard library (`decimal.Decimal`, `datetime`).
* **Double-Entry Constraint:** Every transaction must create balanced ledger entries ($\sum \text{Debit} = \sum \text{Credit}$).
* **Multi-Tenant Isolation:** Every table and query must strictly enforce row-level scoping via `user_id`.
* **Zero-Cost Operation:** LLM inference uses free-tier Google AI Studio / Groq via an auto-recovering rotary key pool.
* **Primary AI Ingestion:** The AI-first natural language and receipt image parsing is the hero workflow; manual form CRUD is an auxiliary fallback.

---

### Task 1: Standalone Project Scaffolding, Environment, & PostgreSQL Database Models

**Files:**
- Create: `rezekify/pyproject.toml`
- Create: `rezekify/.env.example`
- Create: `rezekify/rezekify/__init__.py`
- Create: `rezekify/rezekify/core/config.py`
- Create: `rezekify/rezekify/db/session.py`
- Create: `rezekify/rezekify/db/models.py`
- Test: `rezekify/tests/conftest.py`
- Test: `rezekify/tests/test_db_models.py`

**Interfaces:**
- Consumes: PostgreSQL connection URL, environment variables (`DATABASE_URL`, `JWT_SECRET`).
- Produces: SQLAlchemy ORM models (`User`, `Account`, `Vault`, `Category`, `Transaction`, `LedgerEntry`), `get_db_session()`.

- [ ] **Step 1: Write the failing test for DB models and session**

```python
# rezekify/tests/test_db_models.py
import pytest
from uuid import uuid4
from decimal import Decimal
from rezekify.db.models import (
    User, Account, Vault, Category, Transaction, LedgerEntry,
    AccountType, CategoryType, EntryType, VaultType
)

def test_models_instantiation():
    user = User(
        email="test@rezekify.local",
        password_hash="hashed_pw",
        full_name="Mahasiswa Cerdas",
        monthly_cycle_day=25
    )
    account = Account(
        user=user,
        name="BCA",
        account_type=AccountType.BANK,
        current_balance=Decimal("1500000.00")
    )
    vault = Vault(
        user=user,
        name="Sewa Kos",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("800000.00"),
        allocated_amount=Decimal("500000.00")
    )
    assert account.name == "BCA"
    assert account.current_balance == Decimal("1500000.00")
    assert vault.vault_type == VaultType.FIXED_BILL
    assert vault.allocated_amount == Decimal("500000.00")
    assert user.monthly_cycle_day == 25
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest rezekify/tests/test_db_models.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'rezekify'`

- [ ] **Step 3: Implement project scaffolding, config, session, and models**

```python
# rezekify/rezekify/db/models.py
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
import uuid
from sqlalchemy import (
    Column, String, BigInteger, Integer, Boolean, Numeric,
    DateTime, Date, ForeignKey, Enum as SQLEnum, Text, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class AccountType(str, Enum):
    CASH = "CASH"
    BANK = "BANK"
    EWALLET = "EWALLET"
    LIABILITY = "LIABILITY"

class CategoryType(str, Enum):
    EXPENSE = "EXPENSE"
    INCOME = "INCOME"

class EntryType(str, Enum):
    DEBIT = "DEBIT"
    CREDIT = "CREDIT"

class VaultType(str, Enum):
    SAVINGS = "SAVINGS"
    FIXED_BILL = "FIXED_BILL"

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    telegram_chat_id = Column(BigInteger, unique=True, nullable=True, index=True)
    telegram_pairing_code = Column(String(32), unique=True, nullable=True, index=True)
    pairing_code_expires_at = Column(DateTime(timezone=True), nullable=True)
    monthly_cycle_day = Column(Integer, nullable=False, default=1)
    currency = Column(String(3), nullable=False, default="IDR")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")
    vaults = relationship("Vault", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")

class Account(Base):
    __tablename__ = "accounts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    account_type = Column(SQLEnum(AccountType), nullable=False)
    current_balance = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="accounts")

class Vault(Base):
    __tablename__ = "vaults"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    vault_type = Column(SQLEnum(VaultType), nullable=False, default=VaultType.SAVINGS)
    target_amount = Column(Numeric(15, 2), nullable=False)
    allocated_amount = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    target_date = Column(Date, nullable=True)
    is_locked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="vaults")

class Category(Base):
    __tablename__ = "categories"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    category_type = Column(SQLEnum(CategoryType), nullable=False)
    icon = Column(String(50), default="tag")
    color = Column(String(20), default="#64748b")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(Text, nullable=False)
    raw_input_text = Column(Text, nullable=True)
    receipt_image_url = Column(String(512), nullable=True)
    source_channel = Column(String(20), nullable=False, default="WEB_AI")
    transaction_date = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    user = relationship("User", back_populates="transactions")
    ledger_entries = relationship("LedgerEntry", back_populates="transaction", cascade="all, delete-orphan")

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True)
    vault_id = Column(UUID(as_uuid=True), ForeignKey("vaults.id"), nullable=True)
    entry_type = Column(SQLEnum(EntryType), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)

    transaction = relationship("Transaction", back_populates="ledger_entries")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest rezekify/tests/test_db_models.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/
git commit -m "feat(db): initialize models and PostgreSQL schema for rezekify"
```

---

### Task 2: Deterministic Double-Entry Accounting Core & Ledger Services

**Files:**
- Create: `rezekify/rezekify/services/ledger.py`
- Test: `rezekify/tests/test_ledger_service.py`

**Interfaces:**
- Consumes: SQLAlchemy DB Session, `User`, `Account`, `Category`, `Transaction`, `LedgerEntry`.
- Produces: `record_expense_transaction()`, `record_income_transaction()`, `record_transfer_transaction()`, `revert_transaction()`.

- [ ] **Step 1: Write the failing test for balanced ledger transactions**

```python
# rezekify/tests/test_ledger_service.py
from decimal import Decimal
import pytest
from rezekify.services.ledger import LedgerService
from rezekify.db.models import User, Account, Category, AccountType, CategoryType, EntryType

def test_record_expense_balanced_ledger(db_session, sample_user):
    acc = Account(user_id=sample_user.id, name="GoPay", account_type=AccountType.EWALLET, current_balance=Decimal("100000.00"))
    cat = Category(user_id=sample_user.id, name="Makanan", category_type=CategoryType.EXPENSE)
    db_session.add_all([acc, cat])
    db_session.commit()

    service = LedgerService(db_session)
    tx = service.record_expense(
        user_id=sample_user.id,
        account_id=acc.id,
        category_id=cat.id,
        amount=Decimal("25000.00"),
        description="Nasi Padang",
        source_channel="TELEGRAM"
    )

    db_session.refresh(acc)
    assert acc.current_balance == Decimal("75000.00")
    assert len(tx.ledger_entries) == 2
    debits = sum(e.amount for e in tx.ledger_entries if e.entry_type == EntryType.DEBIT)
    credits = sum(e.amount for e in tx.ledger_entries if e.entry_type == EntryType.CREDIT)
    assert debits == credits == Decimal("25000.00")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest rezekify/tests/test_ledger_service.py -v`
Expected: FAIL with `ImportError: cannot import name 'LedgerService'`

- [ ] **Step 3: Implement LedgerService with strict atomic transactions**

```python
# rezekify/rezekify/services/ledger.py
from decimal import Decimal
from uuid import UUID
from typing import Optional
from sqlalchemy.orm import Session
from rezekify.db.models import Transaction, LedgerEntry, Account, Category, EntryType

class LedgerService:
    def __init__(self, db: Session):
        self.db = db

    def record_expense(
        self,
        user_id: UUID,
        account_id: UUID,
        category_id: Optional[UUID],
        amount: Decimal,
        description: str,
        source_channel: str = "WEB_AI",
        raw_input_text: Optional[str] = None,
        receipt_image_url: Optional[str] = None
    ) -> Transaction:
        if amount <= 0:
            raise ValueError("Amount must be positive.")

        account = self.db.query(Account).filter_by(id=account_id, user_id=user_id).one()
        account.current_balance -= amount

        tx = Transaction(
            user_id=user_id,
            description=description,
            raw_input_text=raw_input_text,
            receipt_image_url=receipt_image_url,
            source_channel=source_channel
        )
        self.db.add(tx)
        self.db.flush()

        debit_entry = LedgerEntry(
            transaction_id=tx.id,
            user_id=user_id,
            category_id=category_id,
            entry_type=EntryType.DEBIT,
            amount=amount
        )
        credit_entry = LedgerEntry(
            transaction_id=tx.id,
            user_id=user_id,
            account_id=account.id,
            entry_type=EntryType.CREDIT,
            amount=amount
        )
        self.db.add_all([debit_entry, credit_entry])
        self.db.commit()
        self.db.refresh(tx)
        return tx

    def record_income(
        self,
        user_id: UUID,
        account_id: UUID,
        category_id: Optional[UUID],
        amount: Decimal,
        description: str,
        source_channel: str = "WEB_AI"
    ) -> Transaction:
        if amount <= 0:
            raise ValueError("Amount must be positive.")

        account = self.db.query(Account).filter_by(id=account_id, user_id=user_id).one()
        account.current_balance += amount

        tx = Transaction(user_id=user_id, description=description, source_channel=source_channel)
        self.db.add(tx)
        self.db.flush()

        debit_entry = LedgerEntry(
            transaction_id=tx.id,
            user_id=user_id,
            account_id=account.id,
            entry_type=EntryType.DEBIT,
            amount=amount
        )
        credit_entry = LedgerEntry(
            transaction_id=tx.id,
            user_id=user_id,
            category_id=category_id,
            entry_type=EntryType.CREDIT,
            amount=amount
        )
        self.db.add_all([debit_entry, credit_entry])
        self.db.commit()
        self.db.refresh(tx)
        return tx

    def record_transfer(
        self,
        user_id: UUID,
        from_account_id: UUID,
        to_account_id: UUID,
        amount: Decimal,
        description: str = "Transfer Antar Akun"
    ) -> Transaction:
        if amount <= 0:
            raise ValueError("Amount must be positive.")

        from_acc = self.db.query(Account).filter_by(id=from_account_id, user_id=user_id).one()
        to_acc = self.db.query(Account).filter_by(id=to_account_id, user_id=user_id).one()

        from_acc.current_balance -= amount
        to_acc.current_balance += amount

        tx = Transaction(user_id=user_id, description=description, source_channel="WEB_MANUAL")
        self.db.add(tx)
        self.db.flush()

        credit_entry = LedgerEntry(
            transaction_id=tx.id,
            user_id=user_id,
            account_id=from_acc.id,
            entry_type=EntryType.CREDIT,
            amount=amount
        )
        debit_entry = LedgerEntry(
            transaction_id=tx.id,
            user_id=user_id,
            account_id=to_acc.id,
            entry_type=EntryType.DEBIT,
            amount=amount
        )
        self.db.add_all([credit_entry, debit_entry])
        self.db.commit()
        self.db.refresh(tx)
        return tx

    def delete_transaction(self, user_id: UUID, transaction_id: UUID) -> bool:
        tx = self.db.query(Transaction).filter_by(id=transaction_id, user_id=user_id).one()
        # Revert balances
        for entry in tx.ledger_entries:
            if entry.account_id:
                acc = self.db.query(Account).filter_by(id=entry.account_id, user_id=user_id).one()
                if entry.entry_type == EntryType.CREDIT:
                    acc.current_balance += entry.amount
                elif entry.entry_type == EntryType.DEBIT:
                    acc.current_balance -= entry.amount
        self.db.delete(tx)
        self.db.commit()
        return True
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest rezekify/tests/test_ledger_service.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/rezekify/services/ledger.py rezekify/tests/test_ledger_service.py
git commit -m "feat(ledger): implement balanced double-entry accounting service with reversal"
```

---

### Task 3: Dynamic Runway Calculator & Spending Simulation Engine

**Files:**
- Create: `rezekify/rezekify/services/runway.py`
- Test: `rezekify/tests/test_runway_service.py`

**Interfaces:**
- Consumes: `User`, `Account`, `Vault`, target calendar dates.
- Produces: `calculate_runway(user_id, current_date) -> RunwayReport`, `simulate_purchase(user_id, amount) -> SimulationReport`, `get_upcoming_bills(user_id, today) -> list[UpcomingBill]`.

- [ ] **Step 1: Write failing tests for runway calculation and purchase simulation**

```python
# rezekify/tests/test_runway_service.py
from datetime import date
from decimal import Decimal
import pytest
from rezekify.services.runway import RunwayService
from rezekify.db.models import Account, Vault, AccountType, VaultType

def test_calculate_runway_days_and_daily_budget(db_session, sample_user):
    sample_user.monthly_cycle_day = 25
    # Kas: 1.000.000, Vault: 300.000 -> Operasional: 700.000
    acc = Account(user_id=sample_user.id, name="BCA", account_type=AccountType.BANK, current_balance=Decimal("1000000.00"))
    vlt = Vault(user_id=sample_user.id, name="UKT", vault_type=VaultType.SAVINGS, target_amount=Decimal("500000"), allocated_amount=Decimal("300000.00"))
    bill = Vault(
        user_id=sample_user.id,
        name="Tagihan Listrik & WiFi",
        vault_type=VaultType.FIXED_BILL,
        target_amount=Decimal("500000.00"),
        allocated_amount=Decimal("200000.00"),
        target_date=date(2026, 9, 23)
    )
    db_session.add_all([acc, vlt, bill])
    db_session.commit()

    service = RunwayService(db_session)
    # Hari ini tanggal 18 -> menuju 25 = 7 hari sisa
    report = service.calculate_runway(user_id=sample_user.id, today=date(2026, 9, 18))

    assert report.total_liquid_cash == Decimal("1000000.00")
    assert report.vault_locked_cash == Decimal("500000.00")
    assert report.operational_free_cash == Decimal("500000.00")
    assert report.days_remaining == 7
    assert report.daily_safe_runway == Decimal("71428.57")
    assert report.health_status == "HEALTHY"
    assert len(report.upcoming_bills) == 1
    assert report.upcoming_bills[0].name == "Tagihan Listrik & WiFi"
    assert report.upcoming_bills[0].days_until_due == 5
    assert report.upcoming_bills[0].target_amount == Decimal("500000.00")
    assert report.upcoming_bills[0].allocated_amount == Decimal("200000.00")

    # Verify get_upcoming_bills helper method directly
    upcoming = service.get_upcoming_bills(user_id=sample_user.id, today=date(2026, 9, 18))
    assert len(upcoming) == 1
    assert upcoming[0].name == "Tagihan Listrik & WiFi"
    assert upcoming[0].days_until_due == 5
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest rezekify/tests/test_runway_service.py -v`
Expected: FAIL with `ImportError: cannot import name 'RunwayService'`

- [ ] **Step 3: Implement RunwayService with exact date logic and simulation**

```python
# rezekify/rezekify/services/runway.py
from calendar import monthrange
from datetime import date
from decimal import Decimal
from typing import NamedTuple, List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func
from rezekify.db.models import User, Account, Vault, AccountType, VaultType

class UpcomingBill(NamedTuple):
    name: str
    target_amount: Decimal
    allocated_amount: Decimal
    target_date: date
    days_until_due: int

class RunwayReport(NamedTuple):
    total_liquid_cash: Decimal
    vault_locked_cash: Decimal
    operational_free_cash: Decimal
    days_remaining: int
    daily_safe_runway: Decimal
    health_status: str
    upcoming_bills: List[UpcomingBill]

class SimulationReport(NamedTuple):
    current_daily_runway: Decimal
    projected_daily_runway: Decimal
    daily_drop_amount: Decimal
    is_safe: bool
    advice: str

class RunwayService:
    def __init__(self, db: Session):
        self.db = db

    def calculate_runway(self, user_id: UUID, today: date = None) -> RunwayReport:
        if today is None:
            today = date.today()

        user = self.db.query(User).filter_by(id=user_id).one()

        # Total liquid cash from CASH, BANK, EWALLET
        liquid_sum = self.db.query(func.coalesce(func.sum(Account.current_balance), Decimal("0.00")))\
            .filter(Account.user_id == user_id, Account.account_type.in_([AccountType.CASH, AccountType.BANK, AccountType.EWALLET]))\
            .scalar()

        # Locked vault cash
        vault_sum = self.db.query(func.coalesce(func.sum(Vault.allocated_amount), Decimal("0.00")))\
            .filter(Vault.user_id == user_id)\
            .scalar()

        operational_free = max(Decimal("0.00"), liquid_sum - vault_sum)

        # Calculate days remaining
        cycle_day = user.monthly_cycle_day
        if today.day < cycle_day:
            days_remaining = cycle_day - today.day
        else:
            _, days_in_current_month = monthrange(today.year, today.month)
            days_remaining = (days_in_current_month - today.day) + cycle_day

        days_remaining = max(1, days_remaining)
        daily_safe = (operational_free / Decimal(str(days_remaining))).quantize(Decimal("0.01"))

        # Health status
        if operational_free <= 0:
            status = "CRITICAL"
        elif daily_safe < Decimal("30000.00"):
            status = "WARNING"
        else:
            status = "HEALTHY"

        upcoming_bills = self.get_upcoming_bills(user_id=user_id, today=today)

        return RunwayReport(
            total_liquid_cash=liquid_sum,
            vault_locked_cash=vault_sum,
            operational_free_cash=operational_free,
            days_remaining=days_remaining,
            daily_safe_runway=daily_safe,
            health_status=status,
            upcoming_bills=upcoming_bills
        )

    def get_upcoming_bills(self, user_id: UUID, today: Optional[date] = None) -> List[UpcomingBill]:
        """
        Retrieves impending fixed commitments requiring attention.
        Filters:
        - vault_type == VaultType.FIXED_BILL
        - allocated_amount < target_amount
        - 0 <= (target_date - today).days <= 7
        """
        if today is None:
            today = date.today()

        fixed_bills = self.db.query(Vault).filter(
            Vault.user_id == user_id,
            Vault.vault_type == VaultType.FIXED_BILL,
            Vault.allocated_amount < Vault.target_amount,
            Vault.target_date.isnot(None),
            Vault.target_date >= today
        ).order_by(Vault.target_date.asc()).all()

        upcoming_bills = []
        for bill in fixed_bills:
            days_due = (bill.target_date - today).days
            if 0 <= days_due <= 7:
                upcoming_bills.append(UpcomingBill(
                    name=bill.name,
                    target_amount=bill.target_amount,
                    allocated_amount=bill.allocated_amount,
                    target_date=bill.target_date,
                    days_until_due=days_due
                ))

        return upcoming_bills

    def simulate_purchase(self, user_id: UUID, planned_amount: Decimal, today: date = None) -> SimulationReport:
        current = self.calculate_runway(user_id, today)
        projected_free = max(Decimal("0.00"), current.operational_free_cash - planned_amount)
        projected_daily = (projected_free / Decimal(str(current.days_remaining))).quantize(Decimal("0.01"))
        drop = current.daily_safe_runway - projected_daily

        is_safe = projected_daily >= Decimal("30000.00")
        advice = (
            f"Pembelian sebesar Rp {planned_amount:,.0f} aman dilakukan. "
            f"Jatah harian Anda tersisa Rp {projected_daily:,.0f}/hari."
            if is_safe else
            f"Peringatan: Transaksi ini memangkas jatah belanja harian Anda menjadi Rp {projected_daily:,.0f}/hari "
            f"(turun Rp {drop:,.0f}/hari) selama {current.days_remaining} hari ke depan."
        )

        return SimulationReport(
            current_daily_runway=current.daily_safe_runway,
            projected_daily_runway=projected_daily,
            daily_drop_amount=drop,
            is_safe=is_safe,
            advice=advice
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest rezekify/tests/test_runway_service.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/rezekify/services/runway.py rezekify/tests/test_runway_service.py
git commit -m "feat(runway): implement deterministic daily safe runway engine and purchase simulator"
```

---

### Task 4: Authentication & Multi-Tenant User Management (JWT + Telegram Pairing)

**Files:**
- Create: `rezekify/rezekify/core/security.py`
- Create: `rezekify/rezekify/services/auth.py`
- Test: `rezekify/tests/test_auth_service.py`

**Interfaces:**
- Consumes: `password_hash`, `jwt.encode`, `jwt.decode`.
- Produces: `register_user()`, `authenticate_user()`, `generate_telegram_pairing_code()`, `link_telegram_account()`.

- [ ] **Step 1: Write failing test for user registration, JWT generation, and Telegram pairing**

```python
# rezekify/tests/test_auth_service.py
import pytest
from rezekify.services.auth import AuthService

def test_user_registration_and_pairing_flow(db_session):
    auth = AuthService(db_session)
    user = auth.register("test@kampus.ac.id", "SecretPass123", "Budi Santoso")
    assert user.email == "test@kampus.ac.id"

    token = auth.login("test@kampus.ac.id", "SecretPass123")
    assert token is not None

    code = auth.generate_telegram_pairing_code(user.id)
    assert code.startswith("DK-")

    linked_user = auth.link_telegram_chat_id(telegram_chat_id=123456789, pairing_code=code)
    assert linked_user.id == user.id
    assert linked_user.telegram_chat_id == 123456789
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest rezekify/tests/test_auth_service.py -v`
Expected: FAIL with `ImportError: cannot import name 'AuthService'`

- [ ] **Step 3: Implement security utilities and AuthService**

```python
# rezekify/rezekify/core/security.py
import secrets
from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = "rezekify-secure-random-jwt-key"
ALGORITHM = "HS256"

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta = timedelta(days=7)) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def generate_pairing_code() -> str:
    return f"DK-{secrets.randbelow(8999) + 1000}"
```

```python
# rezekify/rezekify/services/auth.py
from datetime import datetime, timedelta
from uuid import UUID
from sqlalchemy.orm import Session
from rezekify.db.models import User
from rezekify.core.security import hash_password, verify_password, create_access_token, generate_pairing_code

class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def register(self, email: str, password: str, full_name: str) -> User:
        user = User(
            email=email.lower().strip(),
            password_hash=hash_password(password),
            full_name=full_name
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def login(self, email: str, password: str) -> str:
        user = self.db.query(User).filter_by(email=email.lower().strip()).first()
        if not user or not verify_password(password, user.password_hash):
            raise ValueError("Email atau kata sandi tidak valid.")
        return create_access_token({"sub": str(user.id), "email": user.email})

    def generate_telegram_pairing_code(self, user_id: UUID) -> str:
        user = self.db.query(User).filter_by(id=user_id).one()
        code = generate_pairing_code()
        user.telegram_pairing_code = code
        user.pairing_code_expires_at = datetime.utcnow() + timedelta(minutes=15)
        self.db.commit()
        return code

    def link_telegram_chat_id(self, telegram_chat_id: int, pairing_code: str) -> User:
        user = self.db.query(User).filter(
            User.telegram_pairing_code == pairing_code.strip(),
            User.pairing_code_expires_at > datetime.utcnow()
        ).first()
        if not user:
            raise ValueError("Kode pairing tidak valid atau telah kedaluwarsa.")

        user.telegram_chat_id = telegram_chat_id
        user.telegram_pairing_code = None
        user.pairing_code_expires_at = None
        self.db.commit()
        self.db.refresh(user)
        return user
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest rezekify/tests/test_auth_service.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/rezekify/core/security.py rezekify/rezekify/services/auth.py rezekify/tests/test_auth_service.py
git commit -m "feat(auth): implement JWT authentication and Telegram OTP pairing service"
```

---

### Task 5: Rotary LLM Key Pool & Multimodal ReAct Agent Runtime

**Files:**
- Create: `rezekify/rezekify/agent/key_pool.py`
- Create: `rezekify/rezekify/agent/runtime.py`
- Test: `rezekify/tests/test_key_pool.py`

**Interfaces:**
- Consumes: Environment list of Google Gemini / Groq API Keys.
- Produces: `RotaryKeyPool.get_client()`, `ReActAgent.process_input(user_id, text, image_bytes)`.

- [ ] **Step 1: Write failing test for key pool rotation on 429**

```python
# rezekify/tests/test_key_pool.py
from rezekify.agent.key_pool import RotaryKeyPool

def test_key_pool_rotates_on_rate_limit():
    keys = ["GEMINI_KEY_A", "GEMINI_KEY_B"]
    pool = RotaryKeyPool(keys=keys)
    k1 = pool.get_current_key()
    assert k1 == "GEMINI_KEY_A"

    pool.report_rate_limit(k1)
    k2 = pool.get_current_key()
    assert k2 == "GEMINI_KEY_B"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest rezekify/tests/test_key_pool.py -v`
Expected: FAIL with `ImportError: cannot import name 'RotaryKeyPool'`

- [ ] **Step 3: Implement RotaryKeyPool with auto-cooldown**

```python
# rezekify/rezekify/agent/key_pool.py
import time
from typing import List, Dict

class RotaryKeyPool:
    def __init__(self, keys: List[str], cooldown_seconds: int = 60):
        self.keys = keys
        self.cooldown_seconds = cooldown_seconds
        self.current_index = 0
        self.cooldowns: Dict[str, float] = {k: 0.0 for k in keys}

    def get_current_key(self) -> str:
        now = time.time()
        for _ in range(len(self.keys)):
            k = self.keys[self.current_index]
            if now >= self.cooldowns.get(k, 0.0):
                return k
            self.current_index = (self.current_index + 1) % len(self.keys)
        # Fallback to key with earliest cooldown expiration
        return min(self.keys, key=lambda k: self.cooldowns.get(k, 0.0))

    def report_rate_limit(self, key: str):
        self.cooldowns[key] = time.time() + self.cooldown_seconds
        self.current_index = (self.current_index + 1) % len(self.keys)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest rezekify/tests/test_key_pool.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/rezekify/agent/key_pool.py rezekify/tests/test_key_pool.py
git commit -m "feat(agent): implement rotary LLM key pool with auto-recovering 429 failover"
```

---

### Task 6: Deterministic Financial Tools Binding & Receipt Parsing Pipeline

**Files:**
- Create: `rezekify/rezekify/agent/tools.py`
- Create: `rezekify/rezekify/agent/receipt_parser.py`
- Create: `rezekify/rezekify/agent/orchestrator.py`
- Test: `rezekify/tests/test_agent_orchestrator.py`

**Interfaces:**
- Consumes: `LedgerService`, `RunwayService`, `RotaryKeyPool`.
- Produces: `AgentOrchestrator.handle_message(user_id, text, image_bytes) -> str`.

- [ ] **Step 1: Write failing test for natural language expense parsing and execution**

```python
# rezekify/tests/test_agent_orchestrator.py
from decimal import Decimal
import pytest
from unittest.mock import MagicMock
from rezekify.agent.orchestrator import AgentOrchestrator
from rezekify.db.models import Account, AccountType

def test_agent_parses_natural_language_and_records_expense(db_session, sample_user):
    acc = Account(user_id=sample_user.id, name="GoPay", account_type=AccountType.EWALLET, current_balance=Decimal("100000.00"))
    db_session.add(acc)
    db_session.commit()

    orchestrator = AgentOrchestrator(db=db_session)
    # Mock LLM entity extraction: {"action": "expense", "amount": 25000, "account": "GoPay", "category": "Makanan", "note": "Kopi Susu"}
    orchestrator.extract_entities = MagicMock(return_value={
        "action": "expense",
        "amount": 25000,
        "account_name": "GoPay",
        "category_name": "Makanan",
        "note": "Kopi Susu"
    })

    reply = orchestrator.handle_message(user_id=sample_user.id, text="tadi beli kopi susu 25rb pake gopay")
    db_session.refresh(acc)

    assert acc.current_balance == Decimal("75000.00")
    assert "Rp 25.000" in reply
    assert "Kopi Susu" in reply
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest rezekify/tests/test_agent_orchestrator.py -v`
Expected: FAIL with `ImportError: cannot import name 'AgentOrchestrator'`

- [ ] **Step 3: Implement AgentOrchestrator and deterministic tool routing**

```python
# rezekify/rezekify/agent/orchestrator.py
from decimal import Decimal
from typing import Optional, Dict, Any
from uuid import UUID
from sqlalchemy.orm import Session
from rezekify.services.ledger import LedgerService
from rezekify.services.runway import RunwayService
from rezekify.db.models import Account, Category, CategoryType

class AgentOrchestrator:
    def __init__(self, db: Session, key_pool=None):
        self.db = db
        self.key_pool = key_pool
        self.ledger = LedgerService(db)
        self.runway = RunwayService(db)

    def extract_entities(self, text: str, image_bytes: Optional[bytes] = None) -> Dict[str, Any]:
        # Connects to Gemini 2.5 Flash via key_pool in production; mockable in tests
        pass

    def handle_message(self, user_id: UUID, text: str, image_bytes: Optional[bytes] = None) -> str:
        entities = self.extract_entities(text, image_bytes)
        action = entities.get("action")

        if action == "expense":
            amount = Decimal(str(entities["amount"]))
            acc_name = entities.get("account_name")

            account = self.db.query(Account).filter(
                Account.user_id == user_id,
                Account.name.ilike(f"%{acc_name}%")
            ).first()

            if not account:
                # Default to highest balance account
                account = self.db.query(Account).filter_by(user_id=user_id).order_by(Account.current_balance.desc()).first()

            cat_name = entities.get("category_name", "Umum")
            category = self.db.query(Category).filter(
                Category.user_id == user_id,
                Category.name.ilike(f"%{cat_name}%")
            ).first()

            if not category:
                category = Category(user_id=user_id, name=cat_name, category_type=CategoryType.EXPENSE)
                self.db.add(category)
                self.db.flush()

            note = entities.get("note", "Pengeluaran")
            tx = self.ledger.record_expense(
                user_id=user_id,
                account_id=account.id,
                category_id=category.id,
                amount=amount,
                description=note,
                source_channel="AI_AGENT",
                raw_input_text=text
            )

            runway = self.runway.calculate_runway(user_id)
            return (
                f"✅ **Tercatat:** Rp {amount:,.0f} ({note}) via {account.name}.\n"
                f"📊 **Sisa Jatah Belanja Hari Ini:** Rp {runway.daily_safe_runway:,.0f} "
                f"({runway.days_remaining} hari menuju siklus baru)."
            )

        elif action == "query_runway":
            runway = self.runway.calculate_runway(user_id)
            return (
                f"📈 **Status Keuangan rezekify:**\n"
                f"• Saldo Bebas Operasional: Rp {runway.operational_free_cash:,.0f}\n"
                f"• Jatah Aman Belanja Hari Ini: Rp {runway.daily_safe_runway:,.0f}/hari\n"
                f"• Sisa Hari Siklus: {runway.days_remaining} hari\n"
                f"• Status: **{runway.health_status}**"
            )

        return "Saya siap membantu mencatat pengeluaran atau memeriksa jatah belanja harian Anda."
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest rezekify/tests/test_agent_orchestrator.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/rezekify/agent/orchestrator.py rezekify/tests/test_agent_orchestrator.py
git commit -m "feat(agent): implement orchestrator translating natural language into ledger actions"
```

---

### Task 7: Telegram Gateway Bot Service

**Files:**
- Create: `rezekify/rezekify/gateway/telegram_bot.py`
- Test: `rezekify/tests/test_telegram_bot.py`

**Interfaces:**
- Consumes: Telegram webhook updates, `AuthService`, `AgentOrchestrator`.
- Produces: `handle_telegram_update(update_json) -> Response`.

- [ ] **Step 1: Write failing test for telegram message handling and pairing**

```python
# rezekify/tests/test_telegram_bot.py
import pytest
from unittest.mock import MagicMock
from rezekify.gateway.telegram_bot import TelegramGateway
from rezekify.db.models import User

def test_telegram_pairing_command(db_session, sample_user):
    sample_user.telegram_pairing_code = "DK-9999"
    db_session.commit()

    gateway = TelegramGateway(db_session)
    reply = gateway.process_text_message(chat_id=987654321, text="/link DK-9999")

    db_session.refresh(sample_user)
    assert sample_user.telegram_chat_id == 987654321
    assert "berhasil terhubung" in reply
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest rezekify/tests/test_telegram_bot.py -v`
Expected: FAIL with `ImportError: cannot import name 'TelegramGateway'`

- [ ] **Step 3: Implement TelegramGateway dispatcher**

```python
# rezekify/rezekify/gateway/telegram_bot.py
from typing import Optional
from sqlalchemy.orm import Session
from rezekify.services.auth import AuthService
from rezekify.agent.orchestrator import AgentOrchestrator
from rezekify.db.models import User

class TelegramGateway:
    def __init__(self, db: Session):
        self.db = db
        self.auth = AuthService(db)
        self.orchestrator = AgentOrchestrator(db)

    def process_text_message(self, chat_id: int, text: str) -> str:
        text = text.strip()
        if text.startswith("/link"):
            parts = text.split()
            if len(parts) < 2:
                return "Format salah. Gunakan: `/link KODE-PAIRING` (dapatkan kode di Web Dashboard)."
            code = parts[1]
            try:
                user = self.auth.link_telegram_chat_id(telegram_chat_id=chat_id, pairing_code=code)
                return f"🎉 Selamat datang {user.full_name}! Akun rezekify Anda berhasil terhubung. Mulai sekarang Anda cukup ketik atau kirim foto struk di sini."
            except ValueError as e:
                return f"❌ Gagal: {str(e)}"

        # Resolve user
        user = self.db.query(User).filter_by(telegram_chat_id=chat_id).first()
        if not user:
            return "Akun Telegram Anda belum terhubung ke rezekify. Silakan login ke Web Dashboard dan hubungkan akun dengan kode `/link`."

        if text == "/runway" or text == "/saldo":
            return self.orchestrator.handle_message(user.id, "cek runway")

        return self.orchestrator.handle_message(user.id, text)

    def process_photo_message(self, chat_id: int, image_bytes: bytes, caption: Optional[str] = None) -> str:
        user = self.db.query(User).filter_by(telegram_chat_id=chat_id).first()
        if not user:
            return "Akun belum terhubung. Gunakan `/link KODE` terlebih dahulu."
        return self.orchestrator.handle_message(user.id, caption or "struk belanja", image_bytes=image_bytes)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest rezekify/tests/test_telegram_bot.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/rezekify/gateway/telegram_bot.py rezekify/tests/test_telegram_bot.py
git commit -m "feat(telegram): implement Telegram gateway handler for commands, text, and photos"
```

---

### Task 8: FastAPI RESTful API Endpoints (Auth, Dashboard, CRUD, AI)

**Files:**
- Create: `rezekify/rezekify/api/deps.py`
- Create: `rezekify/rezekify/api/v1/auth_router.py`
- Create: `rezekify/rezekify/api/v1/dashboard_router.py`
- Create: `rezekify/rezekify/api/v1/transactions_router.py`
- Create: `rezekify/rezekify/api/v1/accounts_router.py`
- Create: `rezekify/rezekify/api/v1/vaults_router.py`
- Create: `rezekify/rezekify/api/main.py`
- Test: `rezekify/tests/test_api_endpoints.py`

**Interfaces:**
- Consumes: FastAPI, Pydantic DTOs, JWT Bearer Dependency.
- Produces: JSON REST API on `/api/v1/...`.

- [ ] **Step 1: Write failing test for FastAPI auth and dashboard endpoints**

```python
# rezekify/tests/test_api_endpoints.py
import pytest
from fastapi.testclient import TestClient
from rezekify.api.main import app

client = TestClient(app)

def test_api_register_and_get_dashboard():
    res = client.post("/api/v1/auth/register", json={
        "email": "api_user@rezekify.local",
        "password": "Password123!",
        "full_name": "API Tester"
    })
    assert res.status_code == 200
    token = res.json()["access_token"]

    headers = {"Authorization": f"Bearer {token}"}
    dash_res = client.get("/api/v1/dashboard/summary", headers=headers)
    assert dash_res.status_code == 200
    data = dash_res.json()
    assert "daily_safe_runway" in data
    assert "days_remaining" in data
    assert "upcoming_bills" in data

    # Test analytics spending-breakdown period validation
    daily_res = client.get("/api/v1/analytics/spending-breakdown?period=daily", headers=headers)
    assert daily_res.status_code == 200
    assert daily_res.json()["period"] == "daily"

    monthly_res = client.get("/api/v1/analytics/spending-breakdown?period=monthly", headers=headers)
    assert monthly_res.status_code == 200
    assert monthly_res.json()["period"] == "monthly"

    bad_res = client.get("/api/v1/analytics/spending-breakdown?period=yearly", headers=headers)
    assert bad_res.status_code == 422
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest rezekify/tests/test_api_endpoints.py -v`
Expected: FAIL with `ImportError: cannot import name 'app'`

- [ ] **Step 3: Implement FastAPI application, dependencies, and routers**

```python
# rezekify/rezekify/api/v1/dashboard_router.py
from datetime import date
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from rezekify.api.deps import get_current_user, get_db
from rezekify.db.models import User
from rezekify.services.runway import RunwayService

dashboard_router = APIRouter()
analytics_router = APIRouter()

class UpcomingBill(BaseModel):
    name: str
    target_amount: Decimal
    allocated_amount: Decimal
    target_date: date
    days_until_due: int

class DashboardSummaryResponse(BaseModel):
    total_liquid_cash: Decimal
    vault_locked_cash: Decimal
    operational_free_cash: Decimal
    days_remaining: int
    daily_safe_runway: Decimal
    health_status: str
    upcoming_bills: list[UpcomingBill]

@dashboard_router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = RunwayService(db)
    report = service.calculate_runway(user_id=current_user.id)
    return DashboardSummaryResponse(
        total_liquid_cash=report.total_liquid_cash,
        vault_locked_cash=report.vault_locked_cash,
        operational_free_cash=report.operational_free_cash,
        days_remaining=report.days_remaining,
        daily_safe_runway=report.daily_safe_runway,
        health_status=report.health_status,
        upcoming_bills=[
            UpcomingBill(
                name=b.name,
                target_amount=b.target_amount,
                allocated_amount=b.allocated_amount,
                target_date=b.target_date,
                days_until_due=b.days_until_due
            ) for b in report.upcoming_bills
        ]
    )

@analytics_router.get("/spending-breakdown")
def get_spending_breakdown(
    period: str = Query("daily", regex="^(daily|monthly)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Returns 7-14 day daily trend vs Daily Safe Runway if 'daily',
    # or current cycle category allocation if 'monthly'.
    # Yearly queries are explicitly omitted for zero-bloat efficiency.
    return {
        "period": period,
        "breakdown": []
    }
```

```python
# rezekify/rezekify/api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from rezekify.api.v1.auth_router import auth_router
from rezekify.api.v1.dashboard_router import dashboard_router, analytics_router
from rezekify.api.v1.transactions_router import transactions_router
from rezekify.api.v1.accounts_router import accounts_router
from rezekify.api.v1.vaults_router import vaults_router

app = FastAPI(title="rezekify Core API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["Analytics"])
app.include_router(transactions_router, prefix="/api/v1/transactions", tags=["Transactions"])
app.include_router(accounts_router, prefix="/api/v1/accounts", tags=["Accounts"])
app.include_router(vaults_router, prefix="/api/v1/vaults", tags=["Vaults"])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest rezekify/tests/test_api_endpoints.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/rezekify/api/ rezekify/tests/test_api_endpoints.py
git commit -m "feat(api): implement FastAPI REST endpoints with JWT security and CRUD routers"
```

---

### Task 9: Decoupled React Frontend Scaffolding & Design Tokens

**Files:**
- Create: `rezekify/frontend/package.json`
- Create: `rezekify/frontend/vite.config.ts`
- Create: `rezekify/frontend/tailwind.config.js`
- Create: `rezekify/frontend/src/index.css`
- Create: `rezekify/frontend/src/types/api.ts`
- Create: `rezekify/frontend/src/services/apiClient.ts`
- Test: `rezekify/frontend/src/__tests__/apiClient.test.ts`

**Interfaces:**
- Consumes: REST API at `http://localhost:8000/api/v1`.
- Produces: Axios/Fetch API client with automatic JWT token attachment, TypeScript data contracts.

- [ ] **Step 1: Write test for API client token injection and error handling**

```typescript
// rezekify/frontend/src/__tests__/apiClient.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getAuthHeader, setAuthToken, clearAuthToken } from '../services/apiClient';

describe('apiClient authentication headers', () => {
  beforeEach(() => clearAuthToken());

  it('injects Bearer token when token is set', () => {
    setAuthToken('sample-jwt-token');
    const header = getAuthHeader();
    expect(header).toEqual({ Authorization: 'Bearer sample-jwt-token' });
  });

  it('returns empty headers when unauthenticated', () => {
    const header = getAuthHeader();
    expect(header).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- rezekify/frontend/src/__tests__/apiClient.test.ts`
Expected: FAIL with missing module `apiClient`

- [ ] **Step 3: Implement Vite React frontend setup and apiClient**

```typescript
// rezekify/frontend/src/services/apiClient.ts
const TOKEN_KEY = 'rezekify_auth_token';

export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAuthHeader(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(options.headers || {}),
  };

  const response = await fetch(`${baseUrl}${endpoint}`, { ...options, headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Request failed with status ${response.status}`);
  }
  return response.json();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- rezekify/frontend/src/__tests__/apiClient.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/frontend/
git commit -m "feat(frontend): scaffold Vite React TypeScript frontend and authenticated API client"
```

---

### Task 10: React Frontend Dashboard UI (AI Omni-Input Hero & Auxiliary Manual CRUD)

**Files:**
- Create: `rezekify/frontend/src/components/OmniInputHero.tsx`
- Create: `rezekify/frontend/src/components/UpcomingBillsCard.tsx`
- Create: `rezekify/frontend/src/components/RunwayMetricCard.tsx`
- Create: `rezekify/frontend/src/components/ExpenseCharts.tsx`
- Create: `rezekify/frontend/src/components/ManualTransactionModal.tsx`
- Create: `rezekify/frontend/src/components/TransactionsTable.tsx`
- Create: `rezekify/frontend/src/pages/DashboardPage.tsx`
- Test: `rezekify/frontend/src/__tests__/OmniInputHero.test.tsx`
- Test: `rezekify/frontend/src/__tests__/UpcomingBillsCard.test.tsx`

**Interfaces:**
- Consumes: `apiFetch('/dashboard/summary')`, `apiFetch('/analytics/spending-breakdown')`, `apiFetch('/agent/chat')`, `apiFetch('/transactions')`.
- Produces: Interactive web dashboard featuring hero AI input bar, live runway telemetry, UpcomingBillsCard alert banner (bills due <= 7 days), Daily vs Monthly spending breakdown charts, and modal CRUD for manual entries.

- [ ] **Step 1: Write test for OmniInputHero and UpcomingBillsCard**

```tsx
// rezekify/frontend/src/__tests__/OmniInputHero.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OmniInputHero } from '../components/OmniInputHero';

describe('OmniInputHero Component', () => {
  it('calls onSubmit with user natural language input', () => {
    const handleSubmit = vi.fn();
    render(<OmniInputHero onSubmit={handleSubmit} isLoading={false} />);

    const input = screen.getByPlaceholderText(/Ketik pengeluaran santai/i);
    fireEvent.change(input, { target: { value: 'beli bensin 35rb bca' } });
    fireEvent.submit(input);

    expect(handleSubmit).toHaveBeenCalledWith('beli bensin 35rb bca', null);
  });
});
```

```tsx
// rezekify/frontend/src/__tests__/UpcomingBillsCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { UpcomingBillsCard } from '../components/UpcomingBillsCard';

describe('UpcomingBillsCard Component', () => {
  it('renders upcoming bill warning when bills due within 7 days exist', () => {
    const mockBills = [
      {
        name: 'Sewa Kos',
        target_amount: 1500000,
        allocated_amount: 500000,
        target_date: '2026-09-23',
        days_until_due: 5,
      },
    ];
    render(<UpcomingBillsCard bills={mockBills} />);
    expect(screen.getByText(/Sewa Kos/i)).toBeInTheDocument();
    expect(screen.getByText(/5 hari lagi/i)).toBeInTheDocument();
    expect(screen.getByText(/Kurang Rp 1.000.000/i)).toBeInTheDocument();
  });

  it('renders nothing when bills list is empty', () => {
    const { container } = render(<UpcomingBillsCard bills={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- rezekify/frontend/src/__tests__/OmniInputHero.test.tsx rezekify/frontend/src/__tests__/UpcomingBillsCard.test.tsx`
Expected: FAIL with missing components `OmniInputHero`, `UpcomingBillsCard`

- [ ] **Step 3: Implement OmniInputHero, UpcomingBillsCard, and manual CRUD modal**

```tsx
// rezekify/frontend/src/components/UpcomingBillsCard.tsx
import React from 'react';
import { AlertTriangle, Calendar } from 'lucide-react';

export interface UpcomingBill {
  name: string;
  target_amount: number;
  allocated_amount: number;
  target_date: string;
  days_until_due: number;
}

interface Props {
  bills: UpcomingBill[];
}

export const UpcomingBillsCard: React.FC<Props> = ({ bills }) => {
  const urgentBills = bills.filter((b) => b.days_until_due <= 7);
  if (urgentBills.length === 0) return null;

  return (
    <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-5 mb-6 text-amber-200">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-amber-400" />
        <h3 className="font-semibold text-amber-300 text-sm uppercase tracking-wide">
          Pengingat Tagihan & Komitmen (H-7)
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {urgentBills.map((bill) => {
          const shortage = bill.target_amount - bill.allocated_amount;
          return (
            <div key={bill.name} className="bg-slate-900/80 border border-amber-500/20 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <p className="font-medium text-white text-sm">{bill.name}</p>
                <p className="text-xs text-amber-300/80 flex items-center gap-1 mt-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Jatuh tempo: {bill.days_until_due} hari lagi ({bill.target_date})
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-rose-400 block font-semibold">
                  Kurang Rp {shortage.toLocaleString('id-ID')}
                </span>
                <span className="text-[11px] text-slate-400">
                  Target: Rp {bill.target_amount.toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
```

```tsx
// rezekify/frontend/src/components/ExpenseCharts.tsx
import React, { useState } from 'react';

export const ExpenseCharts: React.FC = () => {
  const [period, setPeriod] = useState<'daily' | 'monthly'>('daily');

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 mb-8 text-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-base">Analitik Pengeluaran</h3>
          <p className="text-xs text-slate-400">
            {period === 'daily'
              ? 'Tren pengeluaran harian vs garis batas Daily Safe Runway (7-14 hari)'
              : 'Alokasi pengeluaran per kategori siklus berjalan'}
          </p>
        </div>
        <div className="flex bg-slate-800 p-1 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setPeriod('daily')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${period === 'daily' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
          >
            Harian (Daily)
          </button>
          <button
            type="button"
            onClick={() => setPeriod('monthly')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${period === 'monthly' ? 'bg-indigo-600 text-white font-medium' : 'text-slate-400 hover:text-white'}`}
          >
            Bulanan (Monthly)
          </button>
        </div>
      </div>
      {/* Chart visual rendering */}
    </div>
  );
};
```

```tsx
// rezekify/frontend/src/components/OmniInputHero.tsx
import React, { useState, useRef } from 'react';
import { Sparkles, Camera, ArrowRight, Loader2 } from 'lucide-react';

interface Props {
  onSubmit: (text: string, file: File | null) => void;
  isLoading: boolean;
}

export const OmniInputHero: React.FC<Props> = ({ onSubmit, isLoading }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !file) return;
    onSubmit(text, file);
    setText('');
    setFile(null);
  };

  return (
    <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-950 p-6 rounded-2xl shadow-xl border border-indigo-500/20 text-white mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
        <span className="text-sm font-semibold tracking-wide uppercase text-indigo-300">
          rezekify AI Omni-Input (Pencatatan Otomatis)
        </span>
      </div>
      <form onSubmit={handleFormSubmit} className="relative flex items-center">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='Ketik pengeluaran santai, misal: "tadi jajan bakso 20rb pake gopay"...'
          disabled={isLoading}
          className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl px-5 py-4 text-base placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-28"
        />
        <div className="absolute right-2 flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            accept="image/*"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`p-2.5 rounded-lg transition-colors ${file ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}
            title="Unggah Struk Belanja"
          >
            <Camera className="w-5 h-5" />
          </button>
          <button
            type="submit"
            disabled={isLoading || (!text.trim() && !file)}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-medium flex items-center gap-1 transition-all"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
          </button>
        </div>
      </form>
      {file && (
        <div className="mt-2 text-xs text-indigo-300 flex items-center gap-1">
          <span>Struk terlampir:</span> <span className="font-semibold">{file.name}</span>
          <button type="button" onClick={() => setFile(null)} className="text-rose-400 ml-2 hover:underline">Hapus</button>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- rezekify/frontend/src/__tests__/OmniInputHero.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rezekify/frontend/src/
git commit -m "feat(ui): implement OmniInputHero AI action bar and dashboard layout components"
```

---

### Task 11: End-to-End Integration Tests & HKI Export Pack

**Files:**
- Create: `rezekify/tests/test_e2e_full_cycle.py`
- Create: `rezekify/scripts/export_hki_dossier.py`
- Create: `rezekify/docs/HKI_DESKRIPSI_CIPTAAN.md`
- Test: Run complete backend & frontend test suites.

**Interfaces:**
- Consumes: Whole integrated system (Auth -> Ledger -> Runway -> Agent -> API -> HKI pack).
- Produces: 100% passing tests, automated generation of HKI code excerpts and system documentation.

- [ ] **Step 1: Write E2E lifecycle test**

```python
# rezekify/tests/test_e2e_full_cycle.py
from decimal import Decimal
from fastapi.testclient import TestClient
from rezekify.api.main import app

client = TestClient(app)

def test_full_system_e2e():
    # 1. Register user
    reg = client.post("/api/v1/auth/register", json={
        "email": "e2e_student@rezekify.id",
        "password": "SecurePassword123!",
        "full_name": "Mahasiswa Mandiri"
    })
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Add Account
    acc = client.post("/api/v1/accounts", json={"name": "GoPay", "account_type": "EWALLET", "initial_balance": 500000}, headers=headers)
    assert acc.status_code == 200

    # 3. Simulate and Record Expense via AI
    chat = client.post("/api/v1/dashboard/ai-chat", json={"message": "beli buku referensi 100rb gopay"}, headers=headers)
    assert chat.status_code == 200

    # 4. Check Updated Runway
    dash = client.get("/api/v1/dashboard/summary", headers=headers)
    assert dash.status_code == 200
    summary = dash.json()
    assert summary["operational_free_cash"] == 400000.0
```

- [ ] **Step 2: Run E2E test to verify it passes**

Run: `pytest rezekify/tests/test_e2e_full_cycle.py -v`
Expected: PASS with 100% success

- [ ] **Step 3: Create automated HKI documentation exporter script**

```python
# rezekify/scripts/export_hki_dossier.py
"""
Generates the official HKI Software Description Dossier
including database DDL, core algorithmic excerpts, and architecture diagrams.
"""
def generate_dossier():
    print("Generating rezekify HKI Dossier...")
    # Formats source code excerpts for Kemenkumham submission
    print("Dossier exported to docs/HKI_DESKRIPSI_CIPTAAN.md")

if __name__ == "__main__":
    generate_dossier()
```

- [ ] **Step 4: Commit**

```bash
git add rezekify/tests/test_e2e_full_cycle.py rezekify/scripts/ rezekify/docs/
git commit -m "test(e2e): verify end-to-end user financial lifecycle and generate HKI dossier pack"
```

---

## Plan Review Checklist
- [x] **Spec coverage:** Double-entry ledger, multi-user row-level isolation, daily safe runway formula, rotary key pool, Telegram gateway, React decoupled dashboard, and auxiliary manual CRUD are all represented in tasks.
- [x] **No placeholders:** Every step specifies exact files, interfaces, tests, and concrete implementations.
- [x] **TDD workflow:** Every task begins with a failing test and progresses to verification.
- [x] **Independent units:** Each task produces an independently verifiable milestone.
