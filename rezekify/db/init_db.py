"""Database schema initialization and migration bootstrap."""

import sys
import time
from typing import Optional
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError

from rezekify.db.models import Base
from rezekify.db.session import engine as default_engine


def init_db(
    target_engine: Optional[Engine] = None,
    max_retries: int = 30,
    retry_interval: float = 2.0,
) -> bool:
    """Connects to database with retry loop and applies Base.metadata.create_all."""
    db_engine = target_engine or default_engine
    for attempt in range(1, max_retries + 1):
        try:
            print(f"[Schema Boot] Connecting to database (Attempt {attempt}/{max_retries})...")
            with db_engine.connect() as conn:
                print("[Schema Boot] Database connection established successfully.")
                print("[Schema Boot] Applying Base.metadata.create_all()...")
                Base.metadata.create_all(bind=db_engine)
                print("[Schema Boot] Database tables verified/created successfully.")
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
