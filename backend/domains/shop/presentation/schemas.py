"""Shop API DTOs."""

from datetime import datetime

from pydantic import BaseModel, Field


class ShopItemResponse(BaseModel):
    id: int
    sku: str
    name: str
    price: int
    type: str
    rarity: str
    description: str
    image_url: str | None = None
    asset_key: str | None = None
    metadata: dict = Field(default_factory=dict)
    consumable: bool = False
    is_active: bool = True
    owned: bool = False
    quantity: int = 0
    equipped: bool = False


class ShopInventoryResponse(BaseModel):
    coins: int
    equipped_board_sku: str | None = None
    equipped_banner_sku: str | None = None
    items: list[ShopItemResponse]


class ShopPurchaseResponse(BaseModel):
    coins: int
    item: ShopItemResponse


class ShopEquipmentResponse(BaseModel):
    equipped_board_sku: str | None = None
    equipped_banner_sku: str | None = None
    item: ShopItemResponse


class AdminShopItemUpsertRequest(BaseModel):
    sku: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=100)
    price: int = Field(ge=0)
    type: str = Field(pattern="^(board|banner|piece_set|effect|consumable)$")
    rarity: str = Field(default="common", max_length=30)
    description: str = Field(default="", max_length=300)
    image_url: str | None = None
    asset_key: str | None = None
    metadata: dict = Field(default_factory=dict)
    consumable: bool = False
    is_active: bool = True


class ShopAuditResponse(BaseModel):
    id: int
    sku: str
    created_at: datetime
