"""Add user wallet balance for local payment emulator."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0005_wallet"
down_revision = "0004_match_payments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("coins", sa.Integer(), nullable=False, server_default="2000"))


def downgrade() -> None:
    op.drop_column("users", "coins")
