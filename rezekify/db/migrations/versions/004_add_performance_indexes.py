"""Add performance indexes.

Revision ID: 004_add_performance_indexes
Revises: 003_add_safe_runway_threshold
Create Date: 2026-09-24 00:00:00.000000
"""
from collections.abc import Sequence
from alembic import op

revision: str = "004_add_performance_indexes"
down_revision: str | None = "003_add_safe_runway_threshold"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("idx_transactions_user_date", "transactions", ["user_id", "transaction_date"])
    op.create_index("idx_ledger_account_type", "ledger_entries", ["account_id", "entry_type"])
    op.create_index("idx_ledger_category_type", "ledger_entries", ["category_id", "entry_type"])
    op.create_index("idx_vaults_user_due", "vaults", ["user_id", "target_date"])


def downgrade() -> None:
    op.drop_index("idx_vaults_user_due", table_name="vaults")
    op.drop_index("idx_ledger_category_type", table_name="ledger_entries")
    op.drop_index("idx_ledger_account_type", table_name="ledger_entries")
    op.drop_index("idx_transactions_user_date", table_name="transactions")
