"""Player shop API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user_id, get_db
from domains.shop.application import ShopService
from domains.shop.presentation.schemas import ShopEquipmentResponse, ShopInventoryResponse, ShopItemResponse, ShopPurchaseResponse


router = APIRouter()


@router.get("/items", response_model=list[ShopItemResponse])
async def list_shop_items(session: AsyncSession = Depends(get_db)):
    _user, items = await ShopService(session).catalog_for_user(None)
    return items


@router.get("/me", response_model=ShopInventoryResponse)
async def get_my_shop_inventory(
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    user, items = await ShopService(session).catalog_for_user(UUID(user_id))
    return ShopInventoryResponse(
        coins=user.coins if user else 0,
        equipped_board_sku=user.equipped_board_sku if user else None,
        equipped_banner_sku=user.equipped_banner_sku if user else None,
        items=items,
    )


@router.post("/items/{item_id}/purchase", response_model=ShopPurchaseResponse)
async def purchase_shop_item(
    item_id: int,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    user, item = await ShopService(session).purchase(UUID(user_id), item_id)
    return ShopPurchaseResponse(coins=user.coins, item=item)


@router.post("/items/{item_id}/equip", response_model=ShopEquipmentResponse)
async def equip_shop_item(
    item_id: int,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    user, item = await ShopService(session).equip(UUID(user_id), item_id)
    return ShopEquipmentResponse(
        equipped_board_sku=user.equipped_board_sku,
        equipped_banner_sku=user.equipped_banner_sku,
        item=item,
    )
