"""Tests for database initialization script and entrypoint bootstrap."""

from pathlib import Path
from unittest.mock import MagicMock
import pytest
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import OperationalError
from sqlalchemy.pool import StaticPool

from rezekify.db.init_db import init_db
from rezekify.db.models import Base


def test_init_db_creates_tables():
    """Verifies that init_db initializes all tables cleanly."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    result = init_db(target_engine=engine, max_retries=3, retry_interval=0.01)
    assert result is True

    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    assert "users" in table_names
    assert "accounts" in table_names
    assert "transactions" in table_names
    assert "ledger_entries" in table_names


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
