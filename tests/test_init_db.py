"""Tests for database initialization script and entrypoint bootstrap."""

from pathlib import Path
from unittest.mock import MagicMock
import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import OperationalError
from sqlalchemy.pool import StaticPool

from rezekify.db.init_db import init_db
from rezekify.db.models import Base


def test_init_db_fresh_database():
    """Verifies that init_db on a fresh empty database runs Alembic migrations and creates all 6 tables + alembic_version."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    result = init_db(target_engine=engine, max_retries=3, retry_interval=0.01)
    assert result is True

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    expected_tables = {
        "users",
        "accounts",
        "vaults",
        "categories",
        "transactions",
        "ledger_entries",
        "alembic_version",
    }
    assert expected_tables.issubset(table_names), f"Missing tables after init_db: {expected_tables - table_names}"


def test_init_db_unversioned_existing_tables():
    """Verifies that an existing unversioned database (created via create_all) is safely stamped with head."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # Pre-populate tables without Alembic (simulating legacy unversioned database)
    Base.metadata.create_all(bind=engine)
    inspector_before = inspect(engine)
    assert "users" in inspector_before.get_table_names()
    assert "alembic_version" not in inspector_before.get_table_names()

    result = init_db(target_engine=engine, max_retries=3, retry_interval=0.01)
    assert result is True

    inspector_after = inspect(engine)
    table_names = set(inspector_after.get_table_names())
    assert "alembic_version" in table_names
    assert "users" in table_names
    assert "accounts" in table_names


def test_init_db_idempotency():
    """Verifies that calling init_db twice on the same database succeeds without errors."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    # First execution: fresh database
    first_result = init_db(target_engine=engine, max_retries=3, retry_interval=0.01)
    assert first_result is True

    # Second execution: versioned database
    second_result = init_db(target_engine=engine, max_retries=3, retry_interval=0.01)
    assert second_result is True

    inspector = inspect(engine)
    assert "alembic_version" in inspector.get_table_names()
    assert "users" in inspector.get_table_names()


def test_init_db_retry_on_operational_error(monkeypatch):
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


def test_init_db_fallback_to_create_all_on_alembic_exception(monkeypatch):
    """Verifies that if Alembic upgrade raises an exception, init_db falls back to Base.metadata.create_all."""
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
    assert "accounts" in inspector.get_table_names()


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
