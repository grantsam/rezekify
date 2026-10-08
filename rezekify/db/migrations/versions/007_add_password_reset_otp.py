"""add password reset otp fields

Revision ID: 007
Revises: 006_ai_chat_messages
Create Date: 2026-10-09
"""
from alembic import op
import sqlalchemy as sa

revision = '007'
down_revision = '006_ai_chat_messages'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(sa.Column('password_reset_otp_hash', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('password_reset_expires_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('password_reset_attempts', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('password_reset_attempts')
        batch_op.drop_column('password_reset_expires_at')
        batch_op.drop_column('password_reset_otp_hash')
