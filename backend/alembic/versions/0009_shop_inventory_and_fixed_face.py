"""Add backend shop inventory and fixed face constraints."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0009_shop_inventory_and_fixed_face"
down_revision = "0008_face_templates"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("equipped_board_sku", sa.String(length=80), nullable=True))
    op.add_column("users", sa.Column("equipped_banner_sku", sa.String(length=80), nullable=True))

    op.create_table(
        "shop_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("sku", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=30), nullable=False),
        sa.Column("rarity", sa.String(length=30), nullable=False),
        sa.Column("description", sa.String(length=300), nullable=False),
        sa.Column("image_url", sa.String(length=500), nullable=True),
        sa.Column("asset_key", sa.String(length=80), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("consumable", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sku"),
    )
    op.create_table(
        "user_shop_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("item_id", sa.Integer(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["item_id"], ["shop_items.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "item_id", name="uq_user_shop_items_user_item"),
    )
    op.create_index("ix_user_shop_items_user_id", "user_shop_items", ["user_id"])
    op.execute(
        """
        DELETE FROM face_verification_profiles older
        USING face_verification_profiles newer
        WHERE older.user_id = newer.user_id
          AND older.provider = 'local_face_template'
          AND newer.provider = 'local_face_template'
          AND older.created_at < newer.created_at
        """
    )
    op.create_index(
        "uq_face_verification_profiles_fixed_face",
        "face_verification_profiles",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("provider = 'local_face_template'"),
    )


def downgrade() -> None:
    op.drop_index("uq_face_verification_profiles_fixed_face", table_name="face_verification_profiles")
    op.drop_index("ix_user_shop_items_user_id", table_name="user_shop_items")
    op.drop_table("user_shop_items")
    op.drop_table("shop_items")
    op.drop_column("users", "equipped_banner_sku")
    op.drop_column("users", "equipped_board_sku")
