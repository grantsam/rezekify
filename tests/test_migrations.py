"""Tests for Alembic database migrations and schema lifecycle."""

from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from sqlalchemy.pool import StaticPool


def test_upgrade_and_downgrade_cycle(tmp_path: Path):
    """Verify clean upgrade to head, inspection of tables/columns, downgrade to base, and re-upgrade idempotency."""
    db_path = tmp_path / "test_migration.db"
    db_url = f"sqlite:///{db_path.as_posix()}"

    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", db_url)

    # 1. Upgrade to head
    command.upgrade(cfg, "head")

    expected_tables = {
        "users",
        "accounts",
        "categories",
        "vaults",
        "transactions",
        "ledger_entries",
    }

    engine = sa.create_engine(db_url)
    try:
        inspector = sa.inspect(engine)
        table_names = set(inspector.get_table_names())
        assert expected_tables.issubset(table_names), f"Missing tables after upgrade: {expected_tables - table_names}"
        assert "alembic_version" in table_names

        # Verify ledger_entries.amount column exists and has numeric type
        columns = inspector.get_columns("ledger_entries")
        amount_col = next((col for col in columns if col["name"] == "amount"), None)
        assert amount_col is not None, "Column 'amount' not found in ledger_entries"
        assert isinstance(amount_col["type"], (sa.Numeric, sa.types.Numeric)) or "NUMERIC" in str(amount_col["type"]).upper()
    finally:
        engine.dispose()

    # 2. Downgrade to base
    command.downgrade(cfg, "base")

    engine = sa.create_engine(db_url)
    try:
        inspector = sa.inspect(engine)
        remaining_tables = set(inspector.get_table_names())
        for table in expected_tables:
            assert table not in remaining_tables, f"Table '{table}' still exists after downgrade"
    finally:
        engine.dispose()

    # 3. Upgrade to head again (idempotency)
    command.upgrade(cfg, "head")

    engine = sa.create_engine(db_url)
    try:
        inspector = sa.inspect(engine)
        recreated_tables = set(inspector.get_table_names())
        assert expected_tables.issubset(recreated_tables), f"Missing tables on re-upgrade: {expected_tables - recreated_tables}"
        assert "alembic_version" in recreated_tables
    finally:
        engine.dispose()


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
