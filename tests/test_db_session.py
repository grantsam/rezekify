"""Tests for database engine configuration and connection pool tuning."""

from rezekify.db.session import get_engine
from sqlalchemy.pool import StaticPool, QueuePool


def test_sqlite_engine_retains_static_pool():
    engine = get_engine("sqlite:///:memory:")
    assert isinstance(engine.pool, StaticPool)


def test_postgresql_engine_configures_queue_pool():
    engine = get_engine("postgresql+psycopg2://user:pass@localhost:5432/testdb")
    assert isinstance(engine.pool, QueuePool)
    assert engine.pool.size() == 3
    assert engine.pool._max_overflow == 2
    assert engine.pool._recycle == 1800
    assert engine.pool._pre_ping is True
    assert engine.pool._timeout == 10
