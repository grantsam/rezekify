"""Pytest configuration and shared fixtures for rezekify tests."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from rezekify.core.rate_limit import RateLimiter
from rezekify.db.models import Base, User


@pytest.fixture(autouse=True)
def reset_rate_limiters_per_test():
    RateLimiter.reset_all()
    yield
    RateLimiter.reset_all()


@pytest.fixture(scope="function")
def db_engine():
    """In-memory SQLite engine for fast and isolated test runs."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(db_engine) -> Session:
    """Session fixture for unit tests with automatic rollback."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def sample_user(db_session: Session) -> User:
    """Sample user fixture for downstream tests."""
    user = User(
        email="sample_user@rezekify.local",
        password_hash="test_hash_abc",
        full_name="Mahasiswa Penguji",
        monthly_cycle_day=25,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user
