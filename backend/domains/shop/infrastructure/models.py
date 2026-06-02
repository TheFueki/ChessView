"""Shop catalog and player inventory ORM models."""

from datetime import datetime
import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.database import Base
from infrastructure.orm import created_at_column, utc_timestamp_column, uuid_reference


SHOP_SKU_LENGTH = 80
SHOP_NAME_LENGTH = 100
SHOP_TYPE_LENGTH = 30
SHOP_RARITY_LENGTH = 30
SHOP_URL_LENGTH = 500


class ShopItemModel(Base):
    __tablename__ = "shop_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sku: Mapped[str] = mapped_column(String(SHOP_SKU_LENGTH), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(SHOP_NAME_LENGTH), nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    type: Mapped[str] = mapped_column(String(SHOP_TYPE_LENGTH), nullable=False)
    rarity: Mapped[str] = mapped_column(String(SHOP_RARITY_LENGTH), nullable=False)
    description: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    image_url: Mapped[str | None] = mapped_column(String(SHOP_URL_LENGTH), nullable=True)
    asset_key: Mapped[str | None] = mapped_column(String(SHOP_SKU_LENGTH), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    consumable: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime | None] = utc_timestamp_column(nullable=True)


class UserShopItemModel(Base):
    __tablename__ = "user_shop_items"
    __table_args__ = (UniqueConstraint("user_id", "item_id", name="uq_user_shop_items_user_item"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID] = uuid_reference("users.id")
    item_id: Mapped[int] = mapped_column(Integer, ForeignKey("shop_items.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime | None] = utc_timestamp_column(nullable=True)
