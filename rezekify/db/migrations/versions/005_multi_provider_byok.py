"""Multi-provider BYOK: add ai_protocol/ai_base_url and remap legacy providers to CUSTOM.

Revision ID: 005_multi_provider_byok
Revises: 004_add_performance_indexes
Create Date: 2026-09-28 00:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "005_multi_provider_byok"
down_revision: str | None = "004_add_performance_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("user_settings", sa.Column("ai_protocol", sa.String(length=20), nullable=True))
    op.add_column("user_settings", sa.Column("ai_base_url", sa.String(length=512), nullable=True))

    op.execute(
        "UPDATE user_settings SET ai_provider='CUSTOM', ai_protocol='OPENAI', "
        "ai_base_url='https://generativelanguage.googleapis.com/v1beta/openai' "
        "WHERE ai_provider='GEMINI'"
    )
    op.execute(
        "UPDATE user_settings SET ai_provider='CUSTOM', ai_protocol='OPENAI', "
        "ai_base_url='https://api.groq.com/openai/v1' "
        "WHERE ai_provider='GROQ'"
    )


def downgrade() -> None:
    # Best-effort, lossy reversal: map CUSTOM rows back to GEMINI (protocol/base_url discarded).
    op.execute("UPDATE user_settings SET ai_provider='GEMINI' WHERE ai_provider='CUSTOM'")
    op.drop_column("user_settings", "ai_base_url")
    op.drop_column("user_settings", "ai_protocol")
