"""Add user_settings table for Telegram management and AI BYOK.

Revision ID: 002_user_settings_and_byok
Revises: 001_initial_schema
Create Date: 2026-09-22 12:00:00.000000
"""
from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op
from rezekify.db.models import GUID

revision: str = "002_user_settings_and_byok"
down_revision: str | None = "001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_settings",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("ai_provider", sa.String(length=20), nullable=False, server_default="SYSTEM"),
        sa.Column("ai_model", sa.String(length=100), nullable=False, server_default="gemini-2.5-flash"),
        sa.Column("encrypted_api_key", sa.Text(), nullable=True),
        sa.Column("key_hint", sa.String(length=16), nullable=True),
        sa.Column("is_custom_ai_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", name="uq_user_settings_user_id"),
    )
    op.create_index(
        "ix_user_settings_user_id", "user_settings", ["user_id"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_user_settings_user_id", table_name="user_settings")
    op.drop_table("user_settings")
