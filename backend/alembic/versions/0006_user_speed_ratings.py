"""Add per-speed user ratings."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0006_user_speed_ratings"
down_revision = "0005_wallet"
branch_labels = None
depends_on = None


RATING_COLUMNS = ("bullet_rating", "blitz_rating", "rapid_rating", "classical_rating")


def upgrade() -> None:
    for column_name in RATING_COLUMNS:
        op.add_column("users", sa.Column(column_name, sa.Integer(), nullable=False, server_default="1200"))
        op.execute(sa.text(f"UPDATE users SET {column_name} = rating WHERE rating IS NOT NULL"))


def downgrade() -> None:
    for column_name in reversed(RATING_COLUMNS):
        op.drop_column("users", column_name)
