"""Add local face template storage."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0008_face_templates"
down_revision = "0007_face_verification_passkeys"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "face_verification_profiles",
        sa.Column("face_template", postgresql.JSON(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("face_verification_profiles", "face_template")
