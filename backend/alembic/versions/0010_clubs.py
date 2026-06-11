"""Add clubs and club memberships."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0010_clubs"
down_revision = "0009_shop_inventory_face"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "clubs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("visibility", sa.String(length=20), nullable=False, server_default="public"),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_clubs_owner_id", "clubs", ["owner_id"])
    op.create_index("ix_clubs_visibility", "clubs", ["visibility"])

    op.create_table(
        "club_members",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("club_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="member"),
        sa.Column("joined_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["club_id"], ["clubs.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("club_id", "user_id", name="uq_club_members_club_user"),
    )
    op.create_index("ix_club_members_club_id", "club_members", ["club_id"])
    op.create_index("ix_club_members_user_id", "club_members", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_club_members_user_id", table_name="club_members")
    op.drop_index("ix_club_members_club_id", table_name="club_members")
    op.drop_table("club_members")
    op.drop_index("ix_clubs_visibility", table_name="clubs")
    op.drop_index("ix_clubs_owner_id", table_name="clubs")
    op.drop_table("clubs")
