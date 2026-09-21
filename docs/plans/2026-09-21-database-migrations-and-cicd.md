# Database Migrations & CI/CD Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish enterprise-grade database schema lifecycle management with Alembic migrations (`001_initial_schema`), hybrid fallback database bootstrapping in `init_db.py`, and a complete multi-job GitHub Actions CI/CD pipeline covering PostgreSQL 16 migration verification, Python test & lint suites, and React Vite static compilation.

**Architecture:** A forward-compatible schema versioning architecture where Alembic manages explicit incremental revisions for all 6 double-entry domain models (`users`, `accounts`, `vaults`, `categories`, `transactions`, `ledger_entries`) while `rezekify.db.init_db` provides self-healing bootstrap logic (auto-upgrading fresh databases, stamping legacy unversioned tables, and falling back to `Base.metadata.create_all` upon unexpected migration failures). The GitHub Actions CI/CD pipeline orchestrates three matrix quality gates on push/PR to `main`: backend lint (`ruff`), typecheck (`mypy`), PostgreSQL 16 container migration execution and `pytest` suite; frontend Vitest test suite and TypeScript production asset build (`npm run build`); and Docker Compose manifest validation.

**Tech Stack:** Python 3.12+, Alembic 1.13+, SQLAlchemy 2.0, PostgreSQL 16 (psycopg2-binary / asyncpg), SQLite (in-memory test engine), PyYAML, Ruff, Mypy, Node.js 20, React 18, Vite, Vitest, Docker Compose, GitHub Actions.

**Spec:** `docs/specs/2026-09-21-database-migrations-and-cicd-design.md`

## Global Constraints

* **Deterministic Financial Math:** Zero floating-point arithmetic. All monetary balances, vault allocations, and ledger entry amounts enforce SQL `NUMERIC(15, 2)` and Python `decimal.Decimal`.
* **Balanced Ledger Invariant:** Every financial transaction must satisfy $\sum \text{Debit} = \sum \text{Credit}$. Unbalanced ledger postings must fail immediately.
* **Row-Level Tenant Isolation:** Every query, balance calculation, and foreign key constraint enforces multi-tenant boundaries (`WHERE user_id = current_user_id`).
* **Zero Secret Leakage:** No plaintext credentials, private keys, or API tokens in version control; `.env` must remain strictly ignored, and CI workflows must use mock dummy keys for non-production verification.
* **Windows PowerShell Compatibility:** All local shell invocations use Windows PowerShell syntax (statement terminators with semicolons `;` or distinct lines; never raw unescaped bash `&&`).
* **Conventional Commits:** All git commit messages must adhere strictly to Conventional Commits format (`feat:`, `fix:`, `build:`, `ci:`, `test:`, `refactor:`) followed by the mandatory Co-Authored-By attribution.
* **Zero Truncation Rule:** All code snippets in this plan must be 100% complete, fully compilable, and self-contained with zero placeholders, ellipsis comments, or `TODO` annotations.

---

### Task 1: Dependencies & Alembic Scaffolding

**Files:**
- Modify: `pyproject.toml`
- Create: `alembic.ini`
- Create: `rezekify/db/migrations/__init__.py`
- Create: `rezekify/db/migrations/env.py`
- Create: `rezekify/db/migrations/script.py.mako`
- Create: `rezekify/db/migrations/versions/__init__.py`
- Test: `tests/test_alembic_config.py`

**Interfaces:**
- Consumes: `Base.metadata` from `rezekify.db.models`, `settings` from `rezekify.core.config`.
- Produces:
  - `alembic.ini`: Root configuration pointing `script_location` to `rezekify/db/migrations`.
  - `rezekify/db/migrations/env.py`: Migration environment runner binding `target_metadata = Base.metadata`, configuring dynamic database connection injection, and enabling `render_as_batch=True` for SQLite test compatibility.
  - `rezekify/db/migrations/script.py.mako`: Standard revision template.
  - `tests/test_alembic_config.py`: Verification suite confirming Alembic configuration loading, migration directory resolution, and model table bindings.

- [ ] **Step 1: Write the failing test for Alembic configuration and scaffolding**

```python
# tests/test_alembic_config.py
"""Tests for Alembic configuration, directory structure, and metadata binding."""

from pathlib import Path
from alembic.config import Config
import pytest

from rezekify.db.migrations.env import target_metadata


def test_alembic_ini_exists_and_loads():
    """Verifies that alembic.ini exists and can be parsed by Alembic Config."""
    root_dir = Path(__file__).resolve().parent.parent
    ini_path = root_dir / "alembic.ini"
    assert ini_path.exists(), "alembic.ini must exist at project root"

    cfg = Config(str(ini_path))
    script_loc = cfg.get_main_option("script_location")
    assert script_loc is not None
    assert "rezekify/db/migrations" in script_loc or "migrations" in script_loc

    resolved_script_dir = root_dir / script_loc
    assert resolved_script_dir.exists(), f"Script location directory {resolved_script_dir} must exist"


def test_alembic_metadata_contains_all_models():
    """Verifies that target_metadata in env.py binds all 6 domain tables."""
    table_names = set(target_metadata.tables.keys())
    expected_tables = {
        "users",
        "accounts",
        "vaults",
        "categories",
        "transactions",
        "ledger_entries",
    }
    assert expected_tables.issubset(table_names), f"Missing tables in target_metadata: {expected_tables - table_names}"


def test_alembic_script_mako_template_exists():
    """Verifies that script.py.mako template exists and contains required upgrade/downgrade hooks."""
    root_dir = Path(__file__).resolve().parent.parent
    mako_path = root_dir / "rezekify" / "db" / "migrations" / "script.py.mako"
    assert mako_path.exists(), "script.py.mako must exist in migrations directory"

    content = mako_path.read_text(encoding="utf-8")
    assert "def upgrade() -> None:" in content
    assert "def downgrade() -> None:" in content
    assert "revision" in content
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_alembic_config.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'alembic'` or `No module named 'rezekify.db.migrations.env'`

- [ ] **Step 3: Update dependencies and implement Alembic scaffolding**

Modify `pyproject.toml` to add `alembic>=1.13.0` to dependencies:

```toml
# pyproject.toml
[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.build_meta"

[project]
name = "rezekify"
version = "0.1.0"
description = "Autonomous Multi-Modal Personal Finance Manager & Deterministic Runway Engine"
readme = "README.md"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn>=0.30.0",
    "sqlalchemy>=2.0.0",
    "alembic>=1.13.0",
    "asyncpg>=0.29.0",
    "psycopg2-binary>=2.9.9",
    "pydantic>=2.8.0",
    "pydantic-settings>=2.4.0",
    "python-jose[cryptography]>=3.3.0",
    "passlib[bcrypt]>=1.7.4",
    "google-genai>=0.1.0",
    "groq>=0.9.0",
    "python-telegram-bot>=21.4",
    "httpx>=0.27.0",
    "pillow>=10.4.0",
    "python-multipart>=0.0.9",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "ruff>=0.6.0",
    "mypy>=1.11.0",
    "types-PyYAML>=6.0.12",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

Install the newly added dependency in the environment:
```powershell
pip install alembic>=1.13.0
```

Create `alembic.ini`:

```ini
# alembic.ini
# ==============================================================================
# Rezekify Database Migration Configuration
# ==============================================================================

[alembic]
script_location = rezekify/db/migrations
prepend_sys_path = .
version_path_separator = os
sqlalchemy.url = postgresql+psycopg2://postgres:postgres@localhost:5432/rezekify

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

Create empty packages for migration discovery:
Create `rezekify/db/migrations/__init__.py`:
```python
"""Database migration scripts and environment runner."""
```

Create `rezekify/db/migrations/versions/__init__.py`:
```python
"""Alembic revision scripts."""
```

Create `rezekify/db/migrations/env.py`:

```python
"""Alembic migration environment configuration and runner."""

from logging.config import fileConfig
import os
from typing import Optional

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlalchemy.engine import Engine

from rezekify.core.config import settings
from rezekify.db.models import Base

# Alembic Config object
config = context.config

# Interpret the config file for Python logging if present
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Model metadata binding for autogenerate and schema verification
target_metadata = Base.metadata


def get_url() -> str:
    """Resolves target database URL with environment variable priority."""
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url
    ini_url = config.get_main_option("sqlalchemy.url")
    if ini_url and not ini_url.startswith("postgresql+psycopg2://postgres:postgres@localhost"):
        return ini_url
    return settings.DATABASE_URL


def run_migrations_offline() -> None:
    """Runs migrations in 'offline' mode without an active database engine."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Runs migrations in 'online' mode with a live database connection."""
    # Check for direct connection injected via programmatic runner (init_db / tests)
    connectable = config.attributes.get("connection", None)

    if connectable is None:
        target_engine = config.attributes.get("target_engine", None)
        if target_engine is not None:
            connectable = target_engine
        else:
            configuration = config.get_section(config.config_ini_section) or {}
            configuration["sqlalchemy.url"] = get_url()
            connectable = engine_from_config(
                configuration,
                prefix="sqlalchemy.",
                poolclass=pool.NullPool,
            )

    if isinstance(connectable, Engine):
        with connectable.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                render_as_batch=True,
            )
            with context.begin_transaction():
                context.run_migrations()
    else:
        context.configure(
            connection=connectable,
            target_metadata=target_metadata,
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

Create `rezekify/db/migrations/script.py.mako`:

```python
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_alembic_config.py -v`
Expected: PASS (all 3 tests passing).

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml alembic.ini rezekify/db/migrations tests/test_alembic_config.py
git commit -m "build(deps): scaffold alembic migration framework and configuration"
```

---

### Task 2: Initial Schema Migration Revision (`001_initial_schema.py`)

**Files:**
- Create: `rezekify/db/migrations/versions/001_initial_schema.py`
- Create: `tests/test_migrations.py`

**Interfaces:**
- Consumes: Alembic operations (`op.create_table`, `op.drop_table`, `op.create_index`, `op.drop_index`, `sa.Column`, `sa.Numeric`, `sa.ForeignKey`), `alembic.command` from `alembic`.
- Produces:
  - Revision `001_initial_schema`: Initial migration script creating all 6 domain tables (`users`, `accounts`, `vaults`, `categories`, `transactions`, `ledger_entries`) with exact constraints, indexes, foreign keys, and defaults.
  - `tests/test_migrations.py`: Full migration lifecycle test executing `upgrade("head")` to assert table and column structures, followed by `downgrade("base")` to assert clean teardown.

- [ ] **Step 1: Write the failing test for migration upgrade and downgrade lifecycle**

```python
# tests/test_migrations.py
"""Tests for Alembic database migration revisions."""

from pathlib import Path
from alembic import command
from alembic.config import Config
import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.pool import StaticPool


@pytest.fixture
def migration_engine():
    """Provides an isolated in-memory SQLite engine for migration tests."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    yield engine
    engine.dispose()


@pytest.fixture
def alembic_config(migration_engine):
    """Provides an Alembic Config pointing to alembic.ini bound to test engine."""
    root_dir = Path(__file__).resolve().parent.parent
    ini_path = root_dir / "alembic.ini"
    cfg = Config(str(ini_path))
    cfg.set_main_option("sqlalchemy.url", str(migration_engine.url))
    cfg.attributes["target_engine"] = migration_engine
    return cfg


def test_migration_upgrade_and_downgrade_lifecycle(alembic_config, migration_engine):
    """Verifies that upgrade('head') creates all 6 tables and downgrade('base') cleanly removes them."""
    # 1. Run upgrade to head
    command.upgrade(alembic_config, "head")

    inspector = inspect(migration_engine)
    tables = set(inspector.get_table_names())

    expected_tables = {
        "users",
        "accounts",
        "vaults",
        "categories",
        "transactions",
        "ledger_entries",
        "alembic_version",
    }
    assert expected_tables.issubset(tables), f"Missing tables after upgrade: {expected_tables - tables}"

    # Verify column definitions and types on accounts
    account_cols = {col["name"]: col for col in inspector.get_columns("accounts")}
    assert "current_balance" in account_cols
    assert "account_type" in account_cols
    assert "user_id" in account_cols

    # Verify column definitions on ledger_entries
    ledger_cols = {col["name"]: col for col in inspector.get_columns("ledger_entries")}
    assert "amount" in ledger_cols
    assert "entry_type" in ledger_cols
    assert "transaction_id" in ledger_cols

    # 2. Run downgrade to base
    command.downgrade(alembic_config, "base")

    inspector_after = inspect(migration_engine)
    remaining_tables = set(inspector_after.get_table_names())
    domain_tables = {
        "users",
        "accounts",
        "vaults",
        "categories",
        "transactions",
        "ledger_entries",
    }
    assert domain_tables.isdisjoint(remaining_tables), f"Tables not cleanly dropped: {domain_tables & remaining_tables}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_migrations.py -v`
Expected: FAIL with `alembic.util.exc.CommandError: Can't locate revision identified by 'head'` because revision 001 does not exist yet.

- [ ] **Step 3: Implement Initial Schema Migration Revision (`001_initial_schema.py`)**

Create `rezekify/db/migrations/versions/001_initial_schema.py`:

```python
"""001_initial_schema

Revision ID: 001_initial_schema
Revises: None
Create Date: 2026-09-21 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. users table
    op.create_table(
        "users",
        sa.Column("id", sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(100), nullable=False),
        sa.Column("telegram_chat_id", sa.BigInteger(), nullable=True),
        sa.Column("telegram_pairing_code", sa.String(32), nullable=True),
        sa.Column("pairing_code_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("monthly_cycle_day", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("currency", sa.String(3), nullable=False, server_default="IDR"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_telegram_chat_id", "users", ["telegram_chat_id"], unique=True)
    op.create_index("ix_users_telegram_pairing_code", "users", ["telegram_pairing_code"], unique=True)

    # 2. accounts table
    op.create_table(
        "accounts",
        sa.Column("id", sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column("user_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("account_type", sa.String(50), nullable=False),
        sa.Column("current_balance", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_accounts_user_id", "accounts", ["user_id"], unique=False)

    # 3. vaults table
    op.create_table(
        "vaults",
        sa.Column("id", sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column("user_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("vault_type", sa.String(50), nullable=False, server_default="SAVINGS"),
        sa.Column("target_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("allocated_amount", sa.Numeric(15, 2), nullable=False, server_default="0.00"),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("is_locked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_vaults_user_id", "vaults", ["user_id"], unique=False)

    # 4. categories table
    op.create_table(
        "categories",
        sa.Column("id", sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column("user_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("category_type", sa.String(50), nullable=False),
        sa.Column("icon", sa.String(50), nullable=False, server_default="tag"),
        sa.Column("color", sa.String(20), nullable=False, server_default="#64748b"),
    )
    op.create_index("ix_categories_user_id", "categories", ["user_id"], unique=False)

    # 5. transactions table
    op.create_table(
        "transactions",
        sa.Column("id", sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column("user_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("raw_input_text", sa.Text(), nullable=True),
        sa.Column("receipt_image_url", sa.String(512), nullable=True),
        sa.Column("source_channel", sa.String(20), nullable=False, server_default="WEB_AI"),
        sa.Column("transaction_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_transactions_user_id", "transactions", ["user_id"], unique=False)
    op.create_index("ix_transactions_transaction_date", "transactions", ["transaction_date"], unique=False)

    # 6. ledger_entries table
    op.create_table(
        "ledger_entries",
        sa.Column("id", sa.CHAR(36), primary_key=True, nullable=False),
        sa.Column("transaction_id", sa.CHAR(36), sa.ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.CHAR(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("account_id", sa.CHAR(36), sa.ForeignKey("accounts.id"), nullable=True),
        sa.Column("category_id", sa.CHAR(36), sa.ForeignKey("categories.id"), nullable=True),
        sa.Column("vault_id", sa.CHAR(36), sa.ForeignKey("vaults.id"), nullable=True),
        sa.Column("entry_type", sa.String(50), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
    )
    op.create_index("ix_ledger_entries_transaction_id", "ledger_entries", ["transaction_id"], unique=False)
    op.create_index("ix_ledger_entries_user_id", "ledger_entries", ["user_id"], unique=False)


def downgrade() -> None:
    # Drops in reverse dependency order
    op.drop_index("ix_ledger_entries_user_id", table_name="ledger_entries")
    op.drop_index("ix_ledger_entries_transaction_id", table_name="ledger_entries")
    op.drop_table("ledger_entries")

    op.drop_index("ix_transactions_transaction_date", table_name="transactions")
    op.drop_index("ix_transactions_user_id", table_name="transactions")
    op.drop_table("transactions")

    op.drop_index("ix_categories_user_id", table_name="categories")
    op.drop_table("categories")

    op.drop_index("ix_vaults_user_id", table_name="vaults")
    op.drop_table("vaults")

    op.drop_index("ix_accounts_user_id", table_name="accounts")
    op.drop_table("accounts")

    op.drop_index("ix_users_telegram_pairing_code", table_name="users")
    op.drop_index("ix_users_telegram_chat_id", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_migrations.py -v`
Expected: PASS (all migration assertions passing).

- [ ] **Step 5: Commit**

```bash
git add rezekify/db/migrations/versions/001_initial_schema.py tests/test_migrations.py
git commit -m "feat(db): implement initial alembic schema migration 001"
```

---

### Task 3: Hybrid Fallback Database Bootstrapping

**Files:**
- Modify: `rezekify/db/init_db.py`
- Modify: `tests/test_init_db.py`

**Interfaces:**
- Consumes: `alembic.command`, `alembic.config.Config`, `Base.metadata` from `rezekify.db.models`, `engine` from `rezekify.db.session`.
- Produces:
  - `rezekify.db.init_db.init_db(target_engine=None, max_retries=30, retry_interval=2.0) -> bool`: Robust, self-healing database bootstrap sequence handling:
    1. Fresh databases: applies Alembic `upgrade("head")`.
    2. Legacy unversioned databases (tables present but missing `alembic_version`): stamps `alembic_version` at `head` without altering or duplicating tables.
    3. Versioned databases: upgrades to latest revision (`head`).
    4. Resilient fallback: triggers `Base.metadata.create_all` if an unexpected non-connection Alembic error occurs, preventing application crashloops.

- [ ] **Step 1: Write the failing tests for hybrid fallback bootstrap**

Modify `tests/test_init_db.py` to add tests for fresh database migration, unversioned database stamping, versioned database upgrading, and fallback execution:

```python
# tests/test_init_db.py
"""Tests for database initialization script and entrypoint bootstrap."""

from pathlib import Path
from unittest.mock import MagicMock
import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import OperationalError
from sqlalchemy.pool import StaticPool

from rezekify.db.init_db import init_db
from rezekify.db.models import Base


def test_init_db_fresh_database_applies_alembic_migrations():
    """Verifies that init_db on a fresh empty database runs Alembic migrations and creates alembic_version."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    result = init_db(target_engine=engine, max_retries=3, retry_interval=0.01)
    assert result is True

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    assert "users" in table_names
    assert "accounts" in table_names
    assert "transactions" in table_names
    assert "ledger_entries" in table_names
    assert "alembic_version" in table_names


def test_init_db_unversioned_database_stamps_head():
    """Verifies that an existing unversioned database (created via create_all) is safely stamped without errors."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Pre-populate tables without Alembic (simulating legacy database)
    Base.metadata.create_all(bind=engine)
    inspector_before = inspect(engine)
    assert "users" in inspector_before.get_table_names()
    assert "alembic_version" not in inspector_before.get_table_names()

    result = init_db(target_engine=engine, max_retries=3, retry_interval=0.01)
    assert result is True

    inspector_after = inspect(engine)
    assert "alembic_version" in inspector_after.get_table_names()
    assert "users" in inspector_after.get_table_names()


def test_init_db_fallback_to_create_all_on_alembic_exception(monkeypatch):
    """Verifies that if Alembic command raises an unexpected exception, init_db falls back to Base.metadata.create_all."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    import alembic.command
    monkeypatch.setattr(alembic.command, "upgrade", MagicMock(side_effect=Exception("Simulated Alembic failure")))

    result = init_db(target_engine=engine, max_retries=3, retry_interval=0.01)
    assert result is True

    inspector = inspect(engine)
    assert "users" in inspector.get_table_names()


def test_init_db_retries_on_operational_error(monkeypatch):
    """Verifies that init_db retries on transient operational error."""
    mock_engine = MagicMock()
    mock_conn = MagicMock()

    # Fail on first attempt, succeed on second attempt
    mock_engine.connect.side_effect = [
        OperationalError("connection failed", {}, Exception("Database starting")),
        mock_conn,
    ]

    monkeypatch.setattr(Base.metadata, "create_all", MagicMock())

    result = init_db(target_engine=mock_engine, max_retries=3, retry_interval=0.01)
    assert result is True
    assert mock_engine.connect.call_count == 2


def test_init_db_exhausts_retries_raises():
    """Verifies that init_db raises OperationalError when max_retries exceeded."""
    mock_engine = MagicMock()
    mock_engine.connect.side_effect = OperationalError(
        "connection refused", {}, Exception("Database offline")
    )

    with pytest.raises(OperationalError):
        init_db(target_engine=mock_engine, max_retries=2, retry_interval=0.01)

    assert mock_engine.connect.call_count == 2


def test_entrypoint_script_executable():
    """Verifies entrypoint shell script structure, invocations, and UNIX LF line endings."""
    script_path = Path("docker/backend/docker-entrypoint.sh")
    assert script_path.exists(), "docker-entrypoint.sh must exist"
    raw_bytes = script_path.read_bytes()
    assert b"\r\n" not in raw_bytes, "docker-entrypoint.sh must use UNIX LF line endings"

    content = raw_bytes.decode("utf-8")
    assert content.startswith("#!/usr/bin/env bash")
    assert "set -eo pipefail" in content
    assert "python -m rezekify.db.init_db" in content
    assert "exec uvicorn rezekify.api.main:app" in content
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_init_db.py -v`
Expected: FAIL on `test_init_db_fresh_database_applies_alembic_migrations` because `init_db.py` currently only calls `Base.metadata.create_all` and does not generate `alembic_version`.

- [ ] **Step 3: Implement hybrid fallback database bootstrapping**

Modify `rezekify/db/init_db.py`:

```python
# rezekify/db/init_db.py
"""Database schema initialization and migration bootstrap."""

import logging
from pathlib import Path
import sys
import time
from typing import Optional

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError

from rezekify.db.models import Base
from rezekify.db.session import engine as default_engine

logger = logging.getLogger(__name__)


def get_alembic_config(db_engine: Engine) -> Config:
    """Creates and configures an Alembic Config instance bound to the target engine."""
    current_path = Path(__file__).resolve()
    root_dir = current_path.parent.parent.parent
    ini_path = root_dir / "alembic.ini"

    if not ini_path.exists():
        ini_path = Path("alembic.ini").resolve()

    cfg = Config(str(ini_path))
    cfg.set_main_option("sqlalchemy.url", str(db_engine.url))
    cfg.attributes["target_engine"] = db_engine
    return cfg


def init_db(
    target_engine: Optional[Engine] = None,
    max_retries: int = 30,
    retry_interval: float = 2.0,
) -> bool:
    """Connects to database with retry loop and applies Alembic migrations with hybrid fallback."""
    db_engine = target_engine or default_engine
    for attempt in range(1, max_retries + 1):
        try:
            print(f"[Schema Boot] Connecting to database (Attempt {attempt}/{max_retries})...")
            with db_engine.connect() as conn:
                print("[Schema Boot] Database connection established successfully.")
                inspector = inspect(conn)
                existing_tables = set(inspector.get_table_names())

                try:
                    cfg = get_alembic_config(db_engine)
                    # Case 1: Database has alembic_version table -> upgrade to head
                    if "alembic_version" in existing_tables:
                        print("[Schema Boot] alembic_version found. Upgrading migrations to head...")
                        command.upgrade(cfg, "head")
                    # Case 2: Database has existing domain tables (users) but no alembic_version -> stamp head
                    elif "users" in existing_tables:
                        print("[Schema Boot] Existing unversioned schema detected. Stamping alembic head...")
                        command.stamp(cfg, "head")
                    # Case 3: Fresh database (empty) -> run migrations to head
                    else:
                        print("[Schema Boot] Fresh database detected. Applying alembic migrations to head...")
                        command.upgrade(cfg, "head")

                    print("[Schema Boot] Database migrations completed successfully.")
                    return True

                except Exception as alembic_err:
                    print(
                        f"[Schema Boot] WARNING: Alembic migration encountered an error: {alembic_err}. "
                        "Falling back to Base.metadata.create_all()...",
                        file=sys.stderr,
                    )
                    Base.metadata.create_all(bind=db_engine)
                    print("[Schema Boot] Fallback Base.metadata.create_all() executed successfully.")
                    return True

        except OperationalError as exc:
            if attempt == max_retries:
                print(
                    f"[Schema Boot] CRITICAL: Failed to connect to database after {max_retries} attempts.",
                    file=sys.stderr,
                )
                raise exc
            print(f"[Schema Boot] Database not ready yet: {exc}. Retrying in {retry_interval}s...")
            time.sleep(retry_interval)
    return False


if __name__ == "__main__":
    init_db()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_init_db.py -v`
Expected: PASS (all 6 tests passing).

- [ ] **Step 5: Commit**

```bash
git add rezekify/db/init_db.py tests/test_init_db.py
git commit -m "feat(db): implement hybrid alembic migration and stamping bootstrapper in init_db"
```

---

### Task 4: GitHub Actions CI/CD Pipeline

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `tests/test_ci_workflow.py`

**Interfaces:**
- Consumes: Backend Python 3.12 workspace, Frontend Node 20 workspace, Docker Compose packaging.
- Produces:
  - `.github/workflows/ci.yml`: Automated CI pipeline running on push/PR to `main` with 3 parallel jobs (`backend-test-and-lint`, `frontend-test-and-build`, `docker-syntax-check`).
  - `tests/test_ci_workflow.py`: Test suite validating YAML integrity, required triggers, container healthchecks, and command declarations.

- [ ] **Step 1: Write the failing test for CI workflow configuration**

```python
# tests/test_ci_workflow.py
"""Tests for GitHub Actions CI/CD workflow configuration and structure."""

from pathlib import Path
import pytest
import yaml


def test_ci_workflow_file_exists():
    """Verifies that .github/workflows/ci.yml exists."""
    workflow_path = Path(".github/workflows/ci.yml")
    assert workflow_path.exists(), ".github/workflows/ci.yml must exist"


def test_ci_workflow_yaml_syntax():
    """Verifies that .github/workflows/ci.yml is valid YAML and parses correctly."""
    workflow_path = Path(".github/workflows/ci.yml")
    content = workflow_path.read_text(encoding="utf-8")
    data = yaml.safe_load(content)
    assert isinstance(data, dict), "Workflow must parse into a valid YAML dictionary"


def test_ci_workflow_triggers():
    """Verifies that CI workflow triggers on push and pull_request against main branch."""
    workflow_path = Path(".github/workflows/ci.yml")
    content = workflow_path.read_text(encoding="utf-8")
    data = yaml.safe_load(content)

    triggers = data.get("on", {})
    assert "push" in triggers, "Workflow must trigger on push"
    assert "pull_request" in triggers, "Workflow must trigger on pull_request"
    assert "main" in triggers["push"].get("branches", [])
    assert "main" in triggers["pull_request"].get("branches", [])


def test_ci_workflow_jobs_and_quality_gates():
    """Verifies that CI workflow contains backend, frontend, and docker verification jobs."""
    workflow_path = Path(".github/workflows/ci.yml")
    content = workflow_path.read_text(encoding="utf-8")
    data = yaml.safe_load(content)

    jobs = data.get("jobs", {})
    assert "backend-test-and-lint" in jobs, "Must have backend-test-and-lint job"
    assert "frontend-test-and-build" in jobs, "Must have frontend-test-and-build job"
    assert "docker-syntax-check" in jobs, "Must have docker-syntax-check job"

    # Verify backend job has postgres service and python 3.12
    backend_job = jobs["backend-test-and-lint"]
    assert "services" in backend_job
    assert "postgres" in backend_job["services"]
    assert "postgres:16-alpine" in backend_job["services"]["postgres"]["image"]

    backend_steps_str = yaml.dump(backend_job.get("steps", []))
    assert "actions/setup-python@v5" in backend_steps_str
    assert "3.12" in backend_steps_str
    assert "ruff check" in backend_steps_str
    assert "mypy" in backend_steps_str
    assert "alembic upgrade head" in backend_steps_str
    assert "pytest" in backend_steps_str

    # Verify frontend job has node 20 and vitest/build steps
    frontend_job = jobs["frontend-test-and-build"]
    frontend_steps_str = yaml.dump(frontend_job.get("steps", []))
    assert "actions/setup-node@v4" in frontend_steps_str
    assert "20" in frontend_steps_str
    assert "npm ci" in frontend_steps_str
    assert "npm run test" in frontend_steps_str
    assert "npm run build" in frontend_steps_str
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_ci_workflow.py -v`
Expected: FAIL with `AssertionError: .github/workflows/ci.yml must exist`

- [ ] **Step 3: Implement GitHub Actions CI/CD Pipeline (`.github/workflows/ci.yml`)**

Create `.github/workflows/ci.yml`:

```yaml
# .github/workflows/ci.yml
# ==============================================================================
# Rezekify Continuous Integration & Quality Gate Pipeline
# ==============================================================================

name: CI Pipeline

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ----------------------------------------------------------------------------
  # 1. Backend: Lint, Typecheck, PostgreSQL 16 Migrations & Pytest
  # ----------------------------------------------------------------------------
  backend-test-and-lint:
    name: Backend Test, Lint & Migrations
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres_ci_secure_password_123
          POSTGRES_DB: rezekify_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Python 3.12
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"

      - name: Install Backend Dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -e ".[dev]" alembic ruff mypy

      - name: Run Ruff Linter
        run: ruff check .

      - name: Run Ruff Format Check
        run: ruff format --check .

      - name: Run Mypy Static Type Analysis
        run: mypy rezekify --ignore-missing-imports

      - name: Verify Live Alembic Migrations on PostgreSQL
        env:
          DATABASE_URL: postgresql+psycopg2://postgres:postgres_ci_secure_password_123@localhost:5432/rezekify_test
        run: alembic upgrade head

      - name: Execute Pytest Test Suite
        env:
          DATABASE_URL: postgresql+psycopg2://postgres:postgres_ci_secure_password_123@localhost:5432/rezekify_test
          SECRET_KEY: ci-test-secret-key-for-github-actions-only-12345
          ENVIRONMENT: test
        run: pytest -v --maxfail=1

  # ----------------------------------------------------------------------------
  # 2. Frontend: Vitest Suite & TypeScript Production Build
  # ----------------------------------------------------------------------------
  frontend-test-and-build:
    name: Frontend Test & Production Build
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: frontend/package.json

      - name: Install Frontend Dependencies
        working-directory: ./frontend
        run: npm ci

      - name: Run Vitest Unit Tests
        working-directory: ./frontend
        run: npm run test

      - name: Run TypeScript Check & Vite Production Build
        working-directory: ./frontend
        run: npm run build

  # ----------------------------------------------------------------------------
  # 3. Docker: Compose Manifest & Dockerfile Syntax Validation
  # ----------------------------------------------------------------------------
  docker-syntax-check:
    name: Docker Syntax & Manifest Validation
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: actions/setup-buildx-action@v3

      - name: Validate Docker Compose Configuration
        env:
          SECRET_KEY: ci-docker-secret-validation-dummy-key
        run: docker compose config
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_ci_workflow.py -v`
Expected: PASS (all 4 tests passing).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml tests/test_ci_workflow.py
git commit -m "ci: add github actions workflow for backend and frontend quality gates"
```

---

### Task 5: End-to-End System Verification & Quality Gates

**Files:**
- Test: `pytest`
- Test: `npm run test --prefix frontend`
- Build: `npm run build --prefix frontend`

**Interfaces:**
- Consumes: Complete repository code, database migrations, hybrid bootstrapping, and CI configuration.
- Produces: Definitive proof of exit code 0 across all quality gates with zero regressions.

- [ ] **Step 1: Execute complete backend test suite**

Run:
```powershell
python -m pytest -v
```
Expected: PASS with 100% pass rate (all tests passing with exit code 0).

- [ ] **Step 2: Execute frontend Vitest test suite**

Run:
```powershell
npm run test --prefix frontend
```
Expected: PASS (all 74 tests passing across 12 test suites).

- [ ] **Step 3: Execute frontend static build and typecheck**

Run:
```powershell
npm run build --prefix frontend
```
Expected: PASS (TypeScript compiles cleanly; Vite builds production bundle in `frontend/dist/`).

- [ ] **Step 4: Verify working tree clean state**

Run:
```powershell
git status
```
Expected: `nothing to commit, working tree clean`.

- [ ] **Step 5: Final completion commit if any polishing was needed**

```bash
git status
```
