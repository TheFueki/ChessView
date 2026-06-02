"""Backend-driven player shop service."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from domains.identity.infrastructure.models import UserModel
from domains.shop.infrastructure.models import ShopItemModel, UserShopItemModel
from domains.shop.presentation.schemas import ShopItemResponse


EQUIPPABLE_TYPES = {"board", "banner"}


class ShopService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def catalog_for_user(self, user_id: UUID | None = None) -> tuple[UserModel | None, list[ShopItemResponse]]:
        user = await self._session.get(UserModel, user_id) if user_id is not None else None
        inventory = await self._inventory_by_sku(user_id) if user_id is not None else {}
        result = await self._session.execute(
            select(ShopItemModel).where(ShopItemModel.is_active.is_(True)).order_by(ShopItemModel.type, ShopItemModel.price, ShopItemModel.name)
        )
        items = [self._item_response(item, inventory.get(item.sku), user) for item in result.scalars().all()]
        return user, items

    async def purchase(self, user_id: UUID, item_id: int) -> tuple[UserModel, ShopItemResponse]:
        user = await self._required_user(user_id)
        item = await self._required_item(item_id)
        inventory = await self._inventory_by_item(user_id)
        owned = inventory.get(item.id)

        if owned is not None and not item.consumable:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Item is already owned")
        if user.coins < item.price:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Not enough coins")

        user.coins -= item.price
        if owned is None:
            owned = UserShopItemModel(user_id=user_id, item_id=item.id, quantity=1)
            self._session.add(owned)
        else:
            owned.quantity += 1
            owned.updated_at = datetime.now(timezone.utc)

        await self._session.commit()
        await self._session.refresh(user)
        await self._session.refresh(owned)
        return user, self._item_response(item, owned, user)

    async def equip(self, user_id: UUID, item_id: int) -> tuple[UserModel, ShopItemResponse]:
        user = await self._required_user(user_id)
        item = await self._required_item(item_id)
        if item.type not in EQUIPPABLE_TYPES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Item cannot be equipped")

        inventory = await self._inventory_by_item(user_id)
        owned = inventory.get(item.id)
        if owned is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Purchase the item before equipping it")

        if item.type == "board":
            user.equipped_board_sku = item.sku
        elif item.type == "banner":
            user.equipped_banner_sku = item.sku

        await self._session.commit()
        await self._session.refresh(user)
        return user, self._item_response(item, owned, user)

    async def _required_user(self, user_id: UUID) -> UserModel:
        user = await self._session.get(UserModel, user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    async def _required_item(self, item_id: int) -> ShopItemModel:
        item = await self._session.get(ShopItemModel, item_id)
        if item is None or not item.is_active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop item not found")
        return item

    async def _inventory_by_sku(self, user_id: UUID) -> dict[str, UserShopItemModel]:
        result = await self._session.execute(
            select(UserShopItemModel, ShopItemModel)
            .join(ShopItemModel, ShopItemModel.id == UserShopItemModel.item_id)
            .where(UserShopItemModel.user_id == user_id)
        )
        return {item.sku: owned for owned, item in result.all()}

    async def _inventory_by_item(self, user_id: UUID) -> dict[int, UserShopItemModel]:
        result = await self._session.execute(select(UserShopItemModel).where(UserShopItemModel.user_id == user_id))
        return {owned.item_id: owned for owned in result.scalars().all()}

    @staticmethod
    def _item_response(
        item: ShopItemModel,
        owned: UserShopItemModel | None,
        user: UserModel | None,
    ) -> ShopItemResponse:
        equipped = False
        if user is not None:
            equipped = (item.type == "board" and user.equipped_board_sku == item.sku) or (
                item.type == "banner" and user.equipped_banner_sku == item.sku
            )
        return ShopItemResponse(
            id=item.id,
            sku=item.sku,
            name=item.name,
            price=item.price,
            type=item.type,
            rarity=item.rarity,
            description=item.description,
            image_url=item.image_url,
            asset_key=item.asset_key,
            metadata=item.metadata_json or {},
            consumable=item.consumable,
            is_active=item.is_active,
            owned=owned is not None,
            quantity=owned.quantity if owned is not None else 0,
            equipped=equipped,
        )
