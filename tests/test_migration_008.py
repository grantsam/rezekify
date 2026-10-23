"""Tests for Category monthly_budget field and Alembic migration 008."""

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


def test_category_instance_default_monthly_budget_none(db_session, sample_user):
    cat = Category(
        user_id=sample_user.id,
        name="Groceries",
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

    command.upgrade(cfg, "008")

    eng = sa.create_engine(db_url)
    try:
        inspector = sa.inspect(eng)
        columns = {c["name"] for c in inspector.get_columns("categories")}
        assert "monthly_budget" in columns
    finally:
        eng.dispose()

    # Downgrade 1 revision back
    command.downgrade(cfg, "007")

    eng = sa.create_engine(db_url)
    try:
        inspector = sa.inspect(eng)
        columns = {c["name"] for c in inspector.get_columns("categories")}
        assert "monthly_budget" not in columns
    finally:
        eng.dispose()
