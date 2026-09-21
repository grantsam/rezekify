# REZEKIFY: Database Migration Engine & CI/CD Quality Gate Architecture

**Document Type:** Architectural & Technical Design Specification (Spec)  
**Document ID:** `SPEC-2026-09-21-DB-MIGRATIONS-CICD`  
**Target File:** `docs/specs/2026-09-21-database-migrations-and-cicd-design.md`  
**Author:** Principal System Architect  
**Status:** Approved for Implementation  
**Project Classification:** Program Komputer / Rekayasa Perangkat Lunak Berbasis Kecerdasan Buatan (HKI)  

---

## 1. Executive Summary & Objective

### 1.1 Context & Phase 2 Evaluation Review
During Phases 1 and 2, Rezekify established its deterministic double-entry financial core (`LedgerService`), daily safe runway simulation engine (`RunwayService`), zero-cost rotary LLM key pool (`RotaryKeyPool`), multimodal ingestion pipeline (Gemini 2.5 Flash Vision OCR, Groq Whisper audio transcription, and Groq Llama 4 Scout Vision fallback), unified Nginx edge proxy, and responsive web client.

However, an evaluation of operational readiness and platform stability revealed two structural vulnerabilities:
1. **Unversioned Database Schema Initialization:**
   Database schema initialization in `rezekify/db/init_db.py` relies exclusively on `Base.metadata.create_all(bind=db_engine)`. While functional for initial zero-data local setups, `create_all()` is static and non-versioned. It cannot alter existing columns, add constraints, migrate data types, or perform zero-downtime upgrades. Furthermore, it leaves the database without migration version metadata (`alembic_version`), making subsequent migrations fail when colliding with pre-existing tables.
2. **Absence of Automated CI/CD Quality Gates:**
   The repository lacks continuous integration pipelines (`.github/workflows/ci.yml`). Code formatting, static type checking (`mypy`), linting (`ruff`), database schema synchronicity (`alembic check`), and unit/integration test suites are executed only through manual developer discipline. This exposes the production branch to regressions, subtle type mismatches, and broken database contracts.

### 1.2 Phase 3 Objectives
This specification designs and standardizes Phase 3 infrastructure across two tightly integrated domains:
* **Component 1: Alembic Schema Migration Engine:**
  Establish an industrial-grade, reversible database migration framework using Alembic. Provide dual-dialect support for PostgreSQL 16 (production/staging) and SQLite 3 (in-memory test isolation), dynamic engine binding via `rezekify.core.config.settings.DATABASE_URL`, and complete initial revision `001_initial_schema.py` capturing all 6 relational tables, foreign key constraints, cascading rules, and B-tree indexes.
* **Component 2: Hybrid Fallback Database Bootstrapping:**
  Modernize `rezekify/db/init_db.py` into an intelligent programmatic bootstrapping runner. The bootstrapper inspects the target database state:
  - If the database is completely empty: applies Alembic `upgrade head`.
  - If the database possesses legacy unversioned tables: stamps the schema with `head` without destructive recreation.
  - If the database is already versioned: applies pending incremental migrations up to `head`.
  - Guarantees seamless container startup in `docker/backend/docker-entrypoint.sh` across development, staging, and production environments with zero manual CLI intervention.
* **Component 3: GitHub Actions CI/CD Quality Gates:**
  Deploy `.github/workflows/ci.yml` orchestrating parallel jobs for backend (`backend-ci`) and frontend (`frontend-ci`). Enforce strict quality gates (`ruff check`, `mypy rezekify`, `alembic check`, `pytest`, `tsc`, `vitest run`, `vite build`) using an isolated zero-secret architecture where tests execute against in-memory SQLite and mock key pools.

---

## 2. Architectural Context & Invariants Enforcement

All database migration logic and automated testing workflows must strictly enforce Rezekify's core architectural invariants:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       REZEKIFY ARCHITECTURAL INVARIANTS                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Deterministic Math      │ Python decimal.Decimal & SQL NUMERIC(15, 2).   │
│                            │ Zero IEEE 754 floats in financial columns.     │
├────────────────────────────┼────────────────────────────────────────────────┤
│ 2. Balanced Ledger         │ Strict Double-Entry: Sum(Debit) = Sum(Credit). │
│                            │ Atomically enforced across ledger_entries.     │
├────────────────────────────┼────────────────────────────────────────────────┤
│ 3. Tenant Isolation        │ Strict Row-Level Scoping: WHERE user_id = :uid │
│                            │ B-tree index on user_id across all tables.     │
├────────────────────────────┼────────────────────────────────────────────────┤
│ 4. Zero Secrets in CI/CD   │ CI pipelines execute without production keys.  │
│                            │ In-memory SQLite & mocked LLM credentials only.│
├────────────────────────────┼────────────────────────────────────────────────┤
│ 5. Zero-Bloat Operation    │ Native Alembic + standard library tools.       │
│                            │ Minimal surface area, idempotent automation.   │
└────────────────────────────┴────────────────────────────────────────────────┘
```

### 2.1 Invariant 1: Deterministic Precision via `NUMERIC(15, 2)`
Financial amounts must never use floating-point types (`REAL`, `FLOAT`, `DOUBLE PRECISION`) due to binary rounding inaccuracies. The migration engine strictly defines all monetary columns (`current_balance`, `target_amount`, `allocated_amount`, `amount`) as `sa.Numeric(15, 2)`. In Python application logic, these map exclusively to `decimal.Decimal`.

### 2.2 Invariant 2: Balanced Ledger Guarantee
Every financial movement requires balanced debit and credit entries:
$$\sum \text{Debit} - \sum \text{Credit} = 0$$
The database schema enforces this through relational integrity: `ledger_entries` references `transactions.id` with `ON DELETE CASCADE`. Unbalanced transactions fail application-level verification in `LedgerService` and are rolled back atomically before committing to PostgreSQL.

### 2.3 Invariant 3: Row-Level Tenant Isolation
Multi-tenant isolation is enforced at the database level. Every relational entity (`accounts`, `vaults`, `categories`, `transactions`, `ledger_entries`) maintains a non-nullable `user_id` foreign key referencing `users.id` with `ON DELETE CASCADE`. The migration script creates explicit B-tree indexes on `user_id` across all tables to optimize tenant-scoped queries (`WHERE user_id = :user_id`).

### 2.4 Invariant 4: Zero Secrets in CI/CD Testing
The CI pipeline must never require access to production database credentials, Telegram bot tokens, or paid third-party API keys. All automated backend tests execute against ephemeral in-memory SQLite instances (`sqlite:///:memory:`) using mocked LLM key pools. Frontend tests compile with zero external network dependencies.

---

## 3. System Architecture & Topology

The Phase 3 architecture integrates Alembic schema management and GitHub Actions quality gates into the existing containerized topology:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             DEVELOPER WORKFLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Git Commit -> Push / Pull Request                                         │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GITHUB ACTIONS CI/CD PIPELINE (ci.yml)                   │
├──────────────────────────────────────┬──────────────────────────────────────┤
│  JOB: backend-ci                     │  JOB: frontend-ci                    │
│  • Python 3.12 Environment           │  • Node 20 Environment               │
│  • ruff check & ruff format          │  • npm ci                            │
│  • mypy rezekify (Strict Typing)     │  • tsc --noEmit (Typecheck)          │
│  • Alembic In-Memory Upgrade & Check │  • vitest run (Unit Testing)         │
│  • pytest (Full Suite, SQLite/Mock)  │  • vite build (Static Compilation)   │
└──────────────────────────────────────┴──────────────────────────────────────┘
                                       │ (All Gates Return Code 0)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONTAINER RUNTIME DEPLOYMENT (Docker)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. docker-entrypoint.sh executes: python -m rezekify.db.init_db            │
│  2. Programmatic Bootstrapper inspects PostgreSQL database state:           │
│     ├── Empty DB? --------> Runs alembic upgrade head                       │
│     ├── Legacy Schema? ---> Runs alembic stamp head                         │
│     └── Versioned DB? ----> Runs alembic upgrade head (incremental)         │
│  3. Starts Uvicorn ASGI Application Server (Port 8000)                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Component 1: Alembic Schema Migration Engine

### 4.1 Directory & File Layout
Alembic is organized within the standard Rezekify package structure to allow seamless programmatic imports and CLI invocation:

```
rezekify/
├── alembic.ini                          # Root migration configuration
├── rezekify/
│   ├── db/
│   │   ├── __init__.py
│   │   ├── models.py                    # SQLAlchemy declarative models
│   │   ├── session.py                   # Engine & sessionmaker factories
│   │   ├── init_db.py                   # Programmatic bootstrap runner
│   │   └── migrations/                  # Alembic script directory
│   │       ├── env.py                   # Migration environment script
│   │       ├── script.py.mako           # Revision template
│   │       └── versions/                # Version scripts directory
│   │           └── 001_initial_schema.py # Initial baseline migration
```

### 4.2 Configuration File (`alembic.ini`)
The root configuration file specifies the migration script location, logging format, and file naming templates:

```ini
[alembic]
script_location = rezekify/db/migrations
file_template = %%(rev)s_%%(slug)s
prepend_sys_path = .
timezone = UTC
truncate_slug_length = 40
version_locations = rezekify/db/migrations/versions

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

### 4.3 Migration Runtime Environment (`rezekify/db/migrations/env.py`)
`env.py` manages dynamic engine creation from application settings, sets up SQLite batch mode for test compatibility, and binds SQLAlchemy declarative metadata:

```python
"""Alembic environment configuration for rezekify."""

import sys
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Append current working directory to sys.path
sys.path.insert(0, ".")

from rezekify.core.config import settings
from rezekify.db.models import Base

# Interpret the config file for Python logging
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set target metadata for 'autogenerate' support
target_metadata = Base.metadata


def get_url() -> str:
    """Retrieve database connection URL dynamically from application settings."""
    url = settings.DATABASE_URL
    # Ensure standard psycopg2 driver dialect prefix for synchronous Alembic operations
    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    return url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    Configures the context with just a URL and not an Engine, though an
    Engine is acceptable here as well. By skipping the Engine creation
    we don't even need a DBAPI to be available.
    """
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
    """Run migrations in 'online' mode.

    Creates an Engine and associates a connection with the context.
    Enables render_as_batch=True when running against SQLite.
    """
    configuration = config.get_section(config.config_ini_section) or {}
    configuration["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        is_sqlite = connection.dialect.name == "sqlite"
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=is_sqlite,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

### 4.4 Migration Revision Template (`rezekify/db/migrations/script.py.mako`)
The standard Mako template for generating future migration revisions:

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

### 4.5 Initial Baseline Migration (`001_initial_schema.py`)
This migration establishes the complete relational baseline for all six domain entities. It features dual-dialect compatibility via a platform-independent `GUID` type decorator that resolves to native `UUID` on PostgreSQL and `CHAR(36)` on SQLite:

```python
"""Initial baseline schema migration covering users, accounts, vaults, categories, transactions, and ledger_entries.

Revision ID: 001_initial_schema
Revises: None
Create Date: 2026-09-21 00:00:00.000000

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PGUUID

# Revision identifiers, used by Alembic
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


class GUID(sa.TypeDecorator):
    """Platform-independent GUID/UUID type.
    Uses PostgreSQL native UUID, otherwise uses CHAR(36).
    """
    impl = sa.CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PGUUID(as_uuid=True))
        else:
            return dialect.type_descriptor(sa.CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == "postgresql":
            return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
        else:
            return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if not isinstance(value, uuid.UUID):
            return uuid.UUID(str(value))
        return value


def upgrade() -> None:
    # 1. Create table: users
    op.create_table(
        "users",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=100), nullable=False),
        sa.Column("telegram_chat_id", sa.BigInteger(), nullable=True),
        sa.Column("telegram_pairing_code", sa.String(length=32), nullable=True),
        sa.Column("pairing_code_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("monthly_cycle_day", sa.Integer(), server_default="1", nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="IDR", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_telegram_chat_id", "users", ["telegram_chat_id"], unique=True)
    op.create_index("ix_users_telegram_pairing_code", "users", ["telegram_pairing_code"], unique=True)

    # 2. Create table: accounts
    op.create_table(
        "accounts",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("account_type", sa.String(length=20), nullable=False),
        sa.Column("current_balance", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_accounts_user_id", "accounts", ["user_id"], unique=False)

    # 3. Create table: vaults
    op.create_table(
        "vaults",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("vault_type", sa.String(length=20), server_default="SAVINGS", nullable=False),
        sa.Column("target_amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("allocated_amount", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("is_locked", sa.Boolean(), server_default=sa.text("false"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vaults_user_id", "vaults", ["user_id"], unique=False)

    # 4. Create table: categories
    op.create_table(
        "categories",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("category_type", sa.String(length=20), nullable=False),
        sa.Column("icon", sa.String(length=50), server_default="tag", nullable=True),
        sa.Column("color", sa.String(length=20), server_default="#64748b", nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_categories_user_id", "categories", ["user_id"], unique=False)

    # 5. Create table: transactions
    op.create_table(
        "transactions",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("raw_input_text", sa.Text(), nullable=True),
        sa.Column("receipt_image_url", sa.String(length=512), nullable=True),
        sa.Column("source_channel", sa.String(length=20), server_default="WEB_AI", nullable=False),
        sa.Column("transaction_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transactions_user_id", "transactions", ["user_id"], unique=False)
    op.create_index("ix_transactions_transaction_date", "transactions", ["transaction_date"], unique=False)

    # 6. Create table: ledger_entries
    op.create_table(
        "ledger_entries",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("transaction_id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("account_id", GUID(), nullable=True),
        sa.Column("category_id", GUID(), nullable=True),
        sa.Column("vault_id", GUID(), nullable=True),
        sa.Column("entry_type", sa.String(length=10), nullable=False),
        sa.Column("amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"]),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vault_id"], ["vaults.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ledger_entries_transaction_id", "ledger_entries", ["transaction_id"], unique=False)
    op.create_index("ix_ledger_entries_user_id", "ledger_entries", ["user_id"], unique=False)


def downgrade() -> None:
    # Drop in reverse dependency order to respect foreign key constraints
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

---

## 5. Component 2: Hybrid Fallback Database Bootstrapping

### 5.1 Problem Analysis & Inspection State Machine
A primary failure mode in containerized microservices is database startup race conditions and unversioned schema collisions:
* **Empty Database State:** The database exists but has no tables. Running `Base.metadata.create_all()` creates tables but leaves Alembic tracking absent, breaking future migrations.
* **Unversioned Legacy State:** A pre-existing database was populated with `create_all()`. Running `alembic upgrade head` immediately fails with `DuplicateTable: relation "users" already exists`.
* **Versioned Up-to-Date State:** The database contains `alembic_version` matching head. Running `upgrade head` is a clean no-op.
* **Versioned Behind State:** The database contains an older revision. Running `upgrade head` executes incremental migrations.

To handle all environments deterministically, Rezekify implements an inspection state machine in `rezekify/db/init_db.py`:

```
                           [ Connect to Engine ]
                                     │
                     Retry Loop (Max 30, Interval 2.0s)
                                     │
                                     ▼
                      [ Inspect Table Names via DBAPI ]
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                       │
     "alembic_version" Exists?              "alembic_version" Absent?
                 │                                       │
                 ▼                                       ▼
       [ Versioned Database ]                ┌───────────┴───────────┐
                 │                           │                       │
      Run alembic upgrade head         "users" Exists?        "users" Absent?
                 │                           │                       │
                 ▼                           ▼                       ▼
      [ Incremental Upgrades       [ Legacy Unversioned ]     [ Fresh Database ]
         Applied to Head ]                   │                       │
                                   Run alembic stamp head    Run alembic upgrade head
                                             │                       │
                                             ▼                       ▼
                                   [ Schema Synchronized    [ Schema Initialized
                                        to Head ]                 to Head ]
```

### 5.2 Implementation of `rezekify/db/init_db.py`
The programmatic bootstrapper encapsulates connection retry resilience, metadata inspection, and Alembic command orchestration:

```python
"""Database schema initialization and migration bootstrap runner."""

import os
import sys
import time
from typing import Optional

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError

from rezekify.db.session import engine as default_engine


def get_alembic_config(db_engine: Engine) -> Config:
    """Construct an Alembic Config object pointing to the application migration tree."""
    ini_path = os.path.abspath("alembic.ini")
    if not os.path.exists(ini_path):
        # Fallback search if executed from a subfolder
        parent_ini = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../alembic.ini"))
        if os.path.exists(parent_ini):
            ini_path = parent_ini

    cfg = Config(ini_path)
    # Ensure URL dynamically points to target engine
    cfg.set_main_option("sqlalchemy.url", str(db_engine.url))
    return cfg


def bootstrap_database(
    target_engine: Optional[Engine] = None,
    max_retries: int = 30,
    retry_interval: float = 2.0,
) -> bool:
    """Connects to the database with retry resilience and synchronizes Alembic migrations."""
    db_engine = target_engine or default_engine
    alembic_cfg = get_alembic_config(db_engine)

    for attempt in range(1, max_retries + 1):
        try:
            print(f"[Schema Boot] Connecting to database (Attempt {attempt}/{max_retries})...")
            with db_engine.connect() as conn:
                print("[Schema Boot] Database connection established.")
                inspector = inspect(conn)
                table_names = inspector.get_table_names()

                has_alembic = "alembic_version" in table_names
                has_users = "users" in table_names

                if not has_alembic and not has_users:
                    print("[Schema Boot] Fresh database detected. Executing 'alembic upgrade head'...")
                    command.upgrade(alembic_cfg, "head")
                    print("[Schema Boot] Schema successfully initialized to head.")
                elif not has_alembic and has_users:
                    print(
                        "[Schema Boot] Unversioned legacy database detected with existing tables. "
                        "Stamping database with 'alembic stamp head'..."
                    )
                    command.stamp(alembic_cfg, "head")
                    print("[Schema Boot] Database successfully stamped with head revision.")
                else:
                    print("[Schema Boot] Versioned database detected. Applying any pending migrations ('upgrade head')...")
                    command.upgrade(alembic_cfg, "head")
                    print("[Schema Boot] Database migrations are up to date.")

                return True
        except OperationalError as exc:
            if attempt == max_retries:
                print(
                    f"[Schema Boot] CRITICAL: Failed to connect to database after {max_retries} attempts: {exc}",
                    file=sys.stderr,
                )
                raise exc
            print(f"[Schema Boot] Database not ready yet: {exc}. Retrying in {retry_interval}s...")
            time.sleep(retry_interval)
        except Exception as exc:
            print(f"[Schema Boot] CRITICAL: Migration bootstrap failed: {exc}", file=sys.stderr)
            raise exc

    return False


def init_db(
    target_engine: Optional[Engine] = None,
    max_retries: int = 30,
    retry_interval: float = 2.0,
) -> bool:
    """Backward-compatible entrypoint for database initialization."""
    return bootstrap_database(target_engine, max_retries, retry_interval)


if __name__ == "__main__":
    bootstrap_database()
```

### 5.3 Docker Entrypoint Integration (`docker/backend/docker-entrypoint.sh`)
The container startup sequence seamlessly integrates the bootstrapper:

```bash
#!/usr/bin/env bash
set -eo pipefail

echo "===================================================="
echo " Starting Rezekify Backend Initialization Sequence"
echo "===================================================="

# Run database schema migration / bootstrap via programmatic Alembic runner
echo "[Entrypoint] Initializing database schema via Alembic..."
python -m rezekify.db.init_db

echo "[Entrypoint] Starting Uvicorn server (workers=${WEB_CONCURRENCY:-2}, port=8000)..."
exec uvicorn rezekify.api.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers "${WEB_CONCURRENCY:-2}" \
    --proxy-headers \
    --forwarded-allow-ips "*"
```

---

## 6. Component 3: GitHub Actions CI/CD Quality Gates

### 6.1 Workflow Topology & Matrix
The GitHub Actions workflow executes on every `push` and `pull_request` targeting `main`. The pipeline runs two parallel jobs on `ubuntu-latest`:
1. `backend-ci`: Validates code style (`ruff`), type correctness (`mypy`), migration schema sync (`alembic check`), and executes the complete `pytest` suite.
2. `frontend-ci`: Validates TypeScript static types (`tsc`), executes frontend unit tests (`vitest run`), and compiles the production Vite bundle (`vite build`).

```
                              [ GitHub Event ]
                           (push / pull_request)
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
      ┌───────────────────────────┐     ┌───────────────────────────┐
      │      JOB: backend-ci      │     │      JOB: frontend-ci     │
      ├───────────────────────────┤     ├───────────────────────────┤
      │ • actions/checkout@v4     │     │ • actions/checkout@v4     │
      │ • actions/setup-python@v5 │     │ • actions/setup-node@v4   │
      │ • pip install -e .[dev]   │     │ • npm ci                  │
      │ • ruff check & format     │     │ • npx tsc --noEmit        │
      │ • mypy rezekify           │     │ • npm run test (vitest)   │
      │ • alembic upgrade & check │     │ • npm run build           │
      │ • pytest                  │     └─────────────┬─────────────┘
      └─────────────┬─────────────┘                   │
                    │                                 │
                    └────────────────┬────────────────┘
                                     │
                                     ▼
                         [ PR Merge Approved ]
```

### 6.2 Workflow Specification (`.github/workflows/ci.yml`)

```yaml
name: CI Quality Gate

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  backend-ci:
    name: Backend Lint, Typecheck, Migrations & Tests
    runs-on: ubuntu-latest

    env:
      ENVIRONMENT: test
      DEBUG: "true"
      SECRET_KEY: "ci-mock-secret-key-for-testing-only-32-chars-long"
      DATABASE_URL: "sqlite:///./ci_test.db"
      TEST_DATABASE_URL: "sqlite:///:memory:"
      GEMINI_API_KEYS: "ci_mock_gemini_key_1,ci_mock_gemini_key_2"
      GROQ_API_KEYS: "ci_mock_groq_key_1"
      TELEGRAM_BOT_TOKEN: "123456:CI_MOCK_TELEGRAM_BOT_TOKEN"

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up Python 3.12
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"

      - name: Install Dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -e .[dev]
          pip install ruff mypy alembic types-passlib types-python-jose

      - name: Check Code Formatting and Linting (Ruff)
        run: |
          ruff check rezekify tests
          ruff format --check rezekify tests

      - name: Static Type Checking (Mypy)
        run: |
          mypy rezekify

      - name: Validate Database Schema Migration Integrity
        run: |
          # 1. Run migrations against temporary SQLite database
          alembic upgrade head
          # 2. Verify models and migration history are in perfect synchronization
          alembic check

      - name: Run Pytest Test Suite
        run: |
          pytest -v --maxfail=1 --disable-warnings

  frontend-ci:
    name: Frontend Typecheck, Tests & Production Build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
          cache-dependency-path: frontend/package-lock.json

      - name: Install NPM Dependencies
        run: npm ci

      - name: TypeScript Static Typecheck
        run: npx tsc --noEmit

      - name: Run Vitest Unit Tests
        run: npm run test

      - name: Compile Production Bundle (Vite Build)
        run: npm run build
```

### 6.3 Zero-Secret Design & Isolation Principles
1. **Mock Key Isolation:**
   All external API keys defined in `backend-ci` environment variables are synthetic (`ci_mock_gemini_key_1`, etc.). Unit tests use dependency injection or test mock fixtures to verify `RotaryKeyPool`, `AgentOrchestrator`, and `TelegramGateway` without dispatching external HTTP requests.
2. **Ephemeral SQLite Storage:**
   The `DATABASE_URL` is set to a local file (`sqlite:///./ci_test.db`) during Alembic migration validation and `sqlite:///:memory:` during test execution. No external database server or service container (e.g., PostgreSQL service container) is required for quality gating, minimizing runner spin-up latency to under 30 seconds.
3. **Hermetic Builds:**
   Frontend compilation (`npm run build`) operates purely on checked-in TypeScript/React files without requiring an active backend server.

---

## 7. Security, Performance & Operational Considerations

### 7.1 Reversible Migrations & Zero-Downtime Schema Evolution
To ensure data safety across production releases, all future database alterations must adhere to the **Expand and Contract** pattern:
1. **Step 1 (Expand):** Add new columns as nullable (`nullable=True`) or with non-destructive server defaults. Deploy code that writes to both old and new columns.
2. **Step 2 (Backfill):** Run asynchronous backfill scripts for historical data.
3. **Step 3 (Contract):** Enforce non-nullable constraints or drop deprecated columns in a subsequent release.
4. **Strict Downgrade Verification:** Every migration script committed to `rezekify/db/migrations/versions/` must provide a fully implemented, mathematically non-destructive `downgrade()` function tested in staging before production deployment.

### 7.2 Transactional DDL in PostgreSQL
PostgreSQL supports transactional Data Definition Language (DDL). Alembic executes migrations inside a database transaction (`with context.begin_transaction():`). If an `ALTER TABLE` statement or index creation fails mid-execution, PostgreSQL rolls back the entire migration transaction atomically, preventing partial schema corruption.

### 7.3 Indexing & Query Performance
All foreign keys in Rezekify enforce tenant isolation:
* `ix_accounts_user_id` on `accounts(user_id)`
* `ix_vaults_user_id` on `vaults(user_id)`
* `ix_categories_user_id` on `categories(user_id)`
* `ix_transactions_user_id` on `transactions(user_id)`
* `ix_ledger_entries_user_id` on `ledger_entries(user_id)`
* `ix_transactions_transaction_date` on `transactions(transaction_date)`

These B-tree indexes prevent sequential table scans when executing double-entry ledger reconciliations and daily runway aggregations.

### 7.4 Secret Blast-Shield Discipline
* `.env` files are permanently excluded from version control via `.gitignore`.
* `alembic.ini` contains no hardcoded database passwords; credentials are read dynamically at runtime via `rezekify.core.config.settings`.
* Container images run as an unprivileged non-root user (`rezekify`, UID 1000).

---

## 8. Verification & Definition of Done

### 8.1 Verification Protocol

#### Step 1: Local Alembic Migration Execution
Execute the full migration lifecycle against SQLite and verify bidirectional consistency:
```powershell
# Upgrade to head
alembic upgrade head

# Verify current revision
alembic current

# Verify zero model drift
alembic check

# Downgrade schema completely
alembic downgrade base

# Re-upgrade to head
alembic upgrade head
```

#### Step 2: Programmatic Bootstrapper Verification
Execute the bootstrap runner directly and confirm idempotent behavior:
```powershell
python -m rezekify.db.init_db
```
*Output must confirm:*
- Detection of current database state.
- Successful application of `upgrade head` or `stamp head`.
- Exit code `0`.

#### Step 3: Backend Quality Suite
Execute backend linting, type checks, and test runner:
```powershell
ruff check rezekify tests
ruff format --check rezekify tests
mypy rezekify
pytest
```
*All commands must return exit code `0`.*

#### Step 4: Frontend Quality Suite
Execute frontend type checking, testing, and production compilation:
```powershell
cd frontend
npx tsc --noEmit
npm run test
npm run build
cd ..
```
*All commands must return exit code `0`.*

#### Step 5: Docker Packaging Verification
Validate that Docker containers boot cleanly without schema errors:
```powershell
docker compose up --build -d backend
docker compose logs backend
```
*Logs must display:*
```text
[Entrypoint] Initializing database schema via Alembic...
[Schema Boot] Connecting to database...
[Schema Boot] Database migrations are up to date.
[Entrypoint] Starting Uvicorn server...
```

### 8.2 Definition of Done Checklist
- [x] Comprehensive architectural design specification created at `docs/specs/2026-09-21-database-migrations-and-cicd-design.md`.
- [x] All 6 relational tables (`users`, `accounts`, `vaults`, `categories`, `transactions`, `ledger_entries`) specified with dual-dialect `GUID` and `NUMERIC(15, 2)` precision.
- [x] Reversible `upgrade()` and `downgrade()` routines fully defined with zero placeholders.
- [x] Programmatic Alembic bootstrapping runner designed with 3-state inspection logic (empty, unversioned legacy, versioned).
- [x] CI/CD workflow `.github/workflows/ci.yml` fully specified with parallel `backend-ci` and `frontend-ci` pipelines and zero-secret isolation.
- [x] Strict adherence to all 5 Rezekify architectural invariants.
