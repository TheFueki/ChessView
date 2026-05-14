"""Allow payment intents for scheduled matches."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0004_match_payments"
down_revision = "0003_platform_expansion"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("payment_intents", sa.Column("scheduled_match_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.alter_column("payment_intents", "tournament_id", nullable=True)
    op.create_foreign_key(
        "fk_payment_intents_scheduled_match_id_scheduled_matches",
        "payment_intents",
        "scheduled_matches",
        ["scheduled_match_id"],
        ["id"],
    )
    op.create_index("ix_payment_intents_scheduled_match_id", "payment_intents", ["scheduled_match_id"])


def downgrade() -> None:
    op.drop_index("ix_payment_intents_scheduled_match_id", table_name="payment_intents")
    op.drop_constraint("fk_payment_intents_scheduled_match_id_scheduled_matches", "payment_intents", type_="foreignkey")
    op.alter_column("payment_intents", "tournament_id", nullable=False)
    op.drop_column("payment_intents", "scheduled_match_id")
