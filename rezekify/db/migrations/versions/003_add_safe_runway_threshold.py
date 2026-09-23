"""Add safe_runway_threshold to users table.

Revision ID: 003_add_safe_runway_threshold
Revises: 002_user_settings_and_byok
Create Date: 2026-09-24 00:00:00.000000
"""
from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op

revision: str = "003_add_safe_runway_threshold"
down_revision: str | None = "002_user_settings_and_byok"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("safe_runway_threshold", sa.Numeric(15, 2), nullable=False, server_default="30000.00"),
    )


def downgrade() -> None:
    op.drop_column("users", "safe_runway_threshold")
