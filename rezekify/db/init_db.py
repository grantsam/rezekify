"""Database schema initialization and migration bootstrap runner."""

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
    cfg.attributes["connection"] = db_engine
    cfg.attributes["target_engine"] = db_engine
    return cfg


def init_db(
    target_engine: Optional[Engine] = None,
    max_retries: int = 30,
    retry_interval: float = 2.0,
) -> bool:
    """Connects to database with retry loop and applies Alembic migrations with hybrid fallback."""
    # ponytail: synchronous Alembic commands with retry loop. Upgrade to async runner when ASGI requires async migration hooks.
    db_engine = target_engine or default_engine

    for attempt in range(1, max_retries + 1):
        try:
            print(f"[Schema Boot] Connecting to database (Attempt {attempt}/{max_retries})...")
            with db_engine.connect() as conn:
                print("[Schema Boot] Database connection established successfully.")
                inspector = inspect(conn)
                table_names = set(inspector.get_table_names())

                try:
                    cfg = get_alembic_config(db_engine)
                    has_alembic = "alembic_version" in table_names
                    has_users = "users" in table_names

                    if not has_alembic and has_users:
                        print(
                            "[Schema Boot] Existing unversioned schema detected. Stamping alembic head..."
                        )
                        command.stamp(cfg, "head")
                        print("[Schema Boot] Database stamped with head revision.")
                    elif has_alembic:
                        print(
                            "[Schema Boot] Versioned database detected. Applying pending migrations ('upgrade head')..."
                        )
                        command.upgrade(cfg, "head")
                        print("[Schema Boot] Database migrations are up to date.")
                    else:
                        print(
                            "[Schema Boot] Fresh database detected. Applying alembic migrations to head..."
                        )
                        command.upgrade(cfg, "head")
                        print("[Schema Boot] Schema successfully initialized to head.")

                    return True

                except Exception as alembic_err:
                    logger.warning("Alembic execution encountered an error: %s", alembic_err)
                    print(
                        f"[Schema Boot] WARNING: Alembic migration encountered an error: {alembic_err}. "
                        "Falling back to Base.metadata.create_all()...",
                        file=sys.stderr,
                    )
                    Base.metadata.create_all(bind=db_engine)
                    print("[Schema Boot] Fallback Base.metadata.create_all() executed successfully.")
                    try:
                        cfg = get_alembic_config(db_engine)
                        command.stamp(cfg, "head")
                        print("[Schema Boot] Fallback stamped head successfully.")
                    except Exception as stamp_err:
                        logger.warning("Failed to stamp head during fallback: %s", stamp_err)
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

    return False


def bootstrap_database(
    target_engine: Optional[Engine] = None,
    max_retries: int = 30,
    retry_interval: float = 2.0,
) -> bool:
    """Alias for init_db."""
    return init_db(target_engine=target_engine, max_retries=max_retries, retry_interval=retry_interval)


if __name__ == "__main__":
    init_db()
