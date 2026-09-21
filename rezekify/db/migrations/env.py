"""Alembic migration environment configuration and runner."""

from logging.config import fileConfig
import os

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlalchemy.engine import Engine

from rezekify.core.config import settings
from rezekify.db.models import Base

# Model metadata binding for autogenerate and schema verification
target_metadata = Base.metadata

# Alembic Config object (present when executed via Alembic runner)
config = getattr(context, "config", None)

# Interpret the config file for Python logging if present
if config is not None and config.config_file_name is not None:
    fileConfig(config.config_file_name)


def get_url() -> str:
    """Resolves target database URL with environment variable priority."""
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        return env_url
    if config is not None:
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
    connectable = config.attributes.get("connection", None) if config is not None else None

    if connectable is None and config is not None:
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
    elif connectable is not None:
        context.configure(
            connection=connectable,
            target_metadata=target_metadata,
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if config is not None:
    if context.is_offline_mode():
        run_migrations_offline()
    else:
        run_migrations_online()
