"""Initial baseline schema migration covering users, accounts, vaults, categories, transactions, and ledger_entries.

Revision ID: 001_initial_schema
Revises: None
Create Date: 2026-09-21 00:00:00.000000

"""
import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PGUUID

# Revision identifiers, used by Alembic
revision: str = "001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


class GUID(sa.TypeDecorator):
    """Platform-independent GUID/UUID type.
    Uses PostgreSQL native UUID, otherwise uses CHAR(36).
    """
    impl = sa.CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PGUUID(as_uuid=True))
        else:
            return dialect.type_descriptor(sa.CHAR(36))

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


def upgrade() -> None:
    # 1. Create table: users
    op.create_table(
        "users",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=100), nullable=False),
        sa.Column("telegram_chat_id", sa.BigInteger(), nullable=True),
        sa.Column("telegram_pairing_code", sa.String(length=32), nullable=True),
        sa.Column("pairing_code_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("monthly_cycle_day", sa.Integer(), server_default="1", nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="IDR", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_telegram_chat_id", "users", ["telegram_chat_id"], unique=True)
    op.create_index("ix_users_telegram_pairing_code", "users", ["telegram_pairing_code"], unique=True)

    # 2. Create table: accounts
    op.create_table(
        "accounts",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("account_type", sa.Enum("CASH", "BANK", "EWALLET", "LIABILITY", name="accounttype", native_enum=False), nullable=False),
        sa.Column("current_balance", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_accounts_user_id", "accounts", ["user_id"], unique=False)

    # 3. Create table: vaults
    op.create_table(
        "vaults",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("vault_type", sa.Enum("SAVINGS", "FIXED_BILL", name="vaulttype", native_enum=False), server_default="SAVINGS", nullable=False),
        sa.Column("target_amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column("allocated_amount", sa.Numeric(precision=15, scale=2), server_default="0.00", nullable=False),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("is_locked", sa.Boolean(), server_default=sa.text("false"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_vaults_user_id", "vaults", ["user_id"], unique=False)

    # 4. Create table: categories
    op.create_table(
        "categories",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("category_type", sa.Enum("EXPENSE", "INCOME", name="categorytype", native_enum=False), nullable=False),
        sa.Column("icon", sa.String(length=50), server_default="tag", nullable=True),
        sa.Column("color", sa.String(length=20), server_default="#64748b", nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_categories_user_id", "categories", ["user_id"], unique=False)

    # 5. Create table: transactions
    op.create_table(
        "transactions",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("raw_input_text", sa.Text(), nullable=True),
        sa.Column("receipt_image_url", sa.String(length=512), nullable=True),
        sa.Column("source_channel", sa.String(length=20), server_default="WEB_AI", nullable=False),
        sa.Column("transaction_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transactions_user_id", "transactions", ["user_id"], unique=False)
    op.create_index("ix_transactions_transaction_date", "transactions", ["transaction_date"], unique=False)

    # 6. Create table: ledger_entries
    op.create_table(
        "ledger_entries",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("transaction_id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("account_id", GUID(), nullable=True),
        sa.Column("category_id", GUID(), nullable=True),
        sa.Column("vault_id", GUID(), nullable=True),
        sa.Column("entry_type", sa.Enum("DEBIT", "CREDIT", name="entrytype", native_enum=False), nullable=False),
        sa.Column("amount", sa.Numeric(precision=15, scale=2), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"]),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"]),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["vault_id"], ["vaults.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ledger_entries_transaction_id", "ledger_entries", ["transaction_id"], unique=False)
    op.create_index("ix_ledger_entries_user_id", "ledger_entries", ["user_id"], unique=False)


def downgrade() -> None:
    # Drop in reverse dependency order to respect foreign key constraints:
    # ledger_entries -> transactions -> vaults -> categories -> accounts -> users
    op.drop_index("ix_ledger_entries_user_id", table_name="ledger_entries")
    op.drop_index("ix_ledger_entries_transaction_id", table_name="ledger_entries")
    op.drop_table("ledger_entries")

    op.drop_index("ix_transactions_transaction_date", table_name="transactions")
    op.drop_index("ix_transactions_user_id", table_name="transactions")
    op.drop_table("transactions")

    op.drop_index("ix_vaults_user_id", table_name="vaults")
    op.drop_table("vaults")

    op.drop_index("ix_categories_user_id", table_name="categories")
    op.drop_table("categories")

    op.drop_index("ix_accounts_user_id", table_name="accounts")
    op.drop_table("accounts")

    op.drop_index("ix_users_telegram_pairing_code", table_name="users")
    op.drop_index("ix_users_telegram_chat_id", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
