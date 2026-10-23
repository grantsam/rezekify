"""add category monthly budget column

Revision ID: 008
Revises: 007
Create Date: 2026-10-23
"""
from alembic import op
import sqlalchemy as sa

revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('categories') as batch_op:
        batch_op.add_column(sa.Column('monthly_budget', sa.Numeric(precision=15, scale=2), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('categories') as batch_op:
        batch_op.drop_column('monthly_budget')
