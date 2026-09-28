"""Add chat_messages table for persistent AI Copilot Hub conversations.

Revision ID: 006_ai_chat_messages
Revises: 005_multi_provider_byok
Create Date: 2026-09-29 00:00:00.000000
"""
from collections.abc import Sequence
import sqlalchemy as sa
from alembic import op
from rezekify.db.models import GUID

revision: str = "006_ai_chat_messages"
down_revision: str | None = "005_multi_provider_byok"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "chat_messages",
        sa.Column("id", GUID(), nullable=False),
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("transaction_id", GUID(), nullable=True),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_messages_user_id", "chat_messages", ["user_id"], unique=False)
    op.create_index("ix_chat_messages_transaction_id", "chat_messages", ["transaction_id"], unique=False)
    op.create_index("idx_chat_messages_user_created", "chat_messages", ["user_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_chat_messages_user_created", table_name="chat_messages")
    op.drop_index("ix_chat_messages_transaction_id", table_name="chat_messages")
    op.drop_index("ix_chat_messages_user_id", table_name="chat_messages")
    op.drop_table("chat_messages")
