"""Tests for User model password reset OTP fields and migration 007."""

from datetime import datetime, timezone
from pathlib import Path
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from rezekify.db.models import User


def test_user_model_has_password_reset_fields():
    inspector = inspect(User)
    # Check User model attributes
    assert hasattr(User, "password_reset_otp_hash")
    assert hasattr(User, "password_reset_expires_at")
    assert hasattr(User, "password_reset_attempts")
    assert "password_reset_otp_hash" in inspector.columns
    assert "password_reset_expires_at" in inspector.columns
    assert "password_reset_attempts" in inspector.columns


def test_user_instance_default_password_reset_values(db_session):
    user = User(
        email="otp_model_test@example.com",
        password_hash="fakehash123",
        full_name="Model Tester",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    assert user.password_reset_otp_hash is None
    assert user.password_reset_expires_at is None
    assert user.password_reset_attempts == 0


def test_migration_007_upgrade_downgrade(tmp_path: Path):
    """Test Alembic migration 007 upgrade and downgrade on users table."""
    db_path = tmp_path / "test_007.db"
    db_url = f"sqlite:///{db_path.as_posix()}"

    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", db_url)

    command.upgrade(cfg, "007")

    eng = sa.create_engine(db_url)
    try:
        inspector = sa.inspect(eng)
        columns = {c["name"] for c in inspector.get_columns("users")}
        assert "password_reset_otp_hash" in columns
        assert "password_reset_expires_at" in columns
        assert "password_reset_attempts" in columns
    finally:
        eng.dispose()

    # Downgrade 1 revision back
    command.downgrade(cfg, "006")

    eng = sa.create_engine(db_url)
    try:
        inspector = sa.inspect(eng)
        columns = {c["name"] for c in inspector.get_columns("users")}
        assert "password_reset_otp_hash" not in columns
        assert "password_reset_expires_at" not in columns
        assert "password_reset_attempts" not in columns
    finally:
        eng.dispose()
