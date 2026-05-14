"""Add passkey-backed face verification records."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0007_face_verification_passkeys"
down_revision = "0006_user_speed_ratings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("face_verification_profiles", sa.Column("credential_id", sa.String(length=255), nullable=True))
    op.add_column(
        "face_verification_profiles",
        sa.Column("credential_public_key", postgresql.JSON(astext_type=sa.Text()), nullable=True),
    )
    op.create_table(
        "face_verification_challenges",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("purpose", sa.String(length=40), nullable=False),
        sa.Column("challenge", sa.String(length=255), nullable=False),
        sa.Column("payload", postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column("consumed_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["face_verification_sessions.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("face_verification_challenges")
    op.drop_column("face_verification_profiles", "credential_public_key")
    op.drop_column("face_verification_profiles", "credential_id")
