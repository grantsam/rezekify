"""SQLAlchemy database models for rezekify."""

from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
import uuid

from sqlalchemy import (
    BigInteger, Boolean, Column, Date, DateTime,
    Enum as SQLEnum, ForeignKey, Index, Integer, Numeric, String, Text
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.types import TypeDecorator, CHAR

Base = declarative_base()


class GUID(TypeDecorator):
    """Platform-independent GUID/UUID type.
    Uses PostgreSQL's native UUID type, otherwise uses CHAR(36).
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PGUUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == "postgresql":
            return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
        else:
            return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if not isinstance(value, uuid.UUID):
            return uuid.UUID(str(value))
        return value


class AccountType(str, Enum):
    CASH = "CASH"
    BANK = "BANK"
    EWALLET = "EWALLET"
    LIABILITY = "LIABILITY"


class CategoryType(str, Enum):
    EXPENSE = "EXPENSE"
    INCOME = "INCOME"


class EntryType(str, Enum):
    DEBIT = "DEBIT"
    CREDIT = "CREDIT"


class VaultType(str, Enum):
    SAVINGS = "SAVINGS"
    FIXED_BILL = "FIXED_BILL"


class AIProvider(str, Enum):
    SYSTEM = "SYSTEM"
    GEMINI = "GEMINI"
    GROQ = "GROQ"


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    telegram_chat_id = Column(BigInteger, unique=True, nullable=True, index=True)
    telegram_pairing_code = Column(String(32), unique=True, nullable=True, index=True)
    pairing_code_expires_at = Column(DateTime(timezone=True), nullable=True)
    monthly_cycle_day = Column(Integer, nullable=False, default=1)
    safe_runway_threshold = Column(Numeric(15, 2), nullable=False, default=Decimal("30000.00"))
    currency = Column(String(3), nullable=False, default="IDR")
    created_at = Column(DateTime(timezone=True), default=utc_now)

    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")
    vaults = relationship("Vault", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    categories = relationship("Category", back_populates="user", cascade="all, delete-orphan")
    settings = relationship(
        "UserSettings",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )


class Account(Base):
    __tablename__ = "accounts"
    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    account_type = Column(SQLEnum(AccountType, native_enum=False), nullable=False)
    current_balance = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User", back_populates="accounts")


class Vault(Base):
    __tablename__ = "vaults"
    __table_args__ = (Index("idx_vaults_user_due", "user_id", "target_date"),)
    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    vault_type = Column(SQLEnum(VaultType, native_enum=False), nullable=False, default=VaultType.SAVINGS)
    target_amount = Column(Numeric(15, 2), nullable=False)
    allocated_amount = Column(Numeric(15, 2), nullable=False, default=Decimal("0.00"))
    target_date = Column(Date, nullable=True)
    is_locked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User", back_populates="vaults")


class Category(Base):
    __tablename__ = "categories"
    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    category_type = Column(SQLEnum(CategoryType, native_enum=False), nullable=False)
    icon = Column(String(50), default="tag")
    color = Column(String(20), default="#64748b")

    user = relationship("User", back_populates="categories")


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (Index("idx_transactions_user_date", "user_id", "transaction_date"),)
    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(Text, nullable=False)
    raw_input_text = Column(Text, nullable=True)
    receipt_image_url = Column(String(512), nullable=True)
    source_channel = Column(String(20), nullable=False, default="WEB_AI")
    transaction_date = Column(DateTime(timezone=True), default=utc_now, index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    user = relationship("User", back_populates="transactions")
    ledger_entries = relationship("LedgerEntry", back_populates="transaction", cascade="all, delete-orphan")


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    __table_args__ = (
        Index("idx_ledger_account_type", "account_id", "entry_type"),
        Index("idx_ledger_category_type", "category_id", "entry_type"),
    )
    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    transaction_id = Column(GUID, ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(GUID, ForeignKey("accounts.id"), nullable=True)
    category_id = Column(GUID, ForeignKey("categories.id"), nullable=True)
    vault_id = Column(GUID, ForeignKey("vaults.id"), nullable=True)
    entry_type = Column(SQLEnum(EntryType, native_enum=False), nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)

    transaction = relationship("Transaction", back_populates="ledger_entries")


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(
        GUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    ai_provider = Column(
        SQLEnum(AIProvider, native_enum=False),
        nullable=False,
        default=AIProvider.SYSTEM,
    )
    ai_model = Column(String(100), nullable=False, default="gemini-2.5-flash")
    encrypted_api_key = Column(Text, nullable=True)
    key_hint = Column(String(16), nullable=True)
    is_custom_ai_enabled = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="settings")

