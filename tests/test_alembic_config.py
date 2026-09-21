"""Tests for Alembic configuration, directory structure, and metadata binding."""

from pathlib import Path

from alembic.config import Config

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
