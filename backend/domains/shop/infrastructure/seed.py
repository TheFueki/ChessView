"""Seed the default backend-driven shop catalog."""

from __future__ import annotations

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from domains.shop.infrastructure.models import ShopItemModel


@dataclass(frozen=True, slots=True)
class SeedShopItem:
    sku: str
    name: str
    price: int
    type: str
    rarity: str
    description: str
    asset_key: str
    metadata: dict = field(default_factory=dict)
    image_url: str | None = None
    consumable: bool = False


DEFAULT_SHOP_ITEMS = (
    SeedShopItem(
        sku="board-tournament-walnut",
        name="Tournament Walnut Board",
        price=900,
        type="board",
        rarity="rare",
        description="Warm walnut and ivory board colors for focused rapid games.",
        asset_key="tournament-board",
        metadata={"light": "#ead9b5", "dark": "#8f5b35", "accent": "#2563eb"},
    ),
    SeedShopItem(
        sku="board-arctic-match",
        name="Arctic Match Board",
        price=1100,
        type="board",
        rarity="epic",
        description="Crisp blue-gray tournament board with high-contrast highlights.",
        asset_key="arctic-match",
        metadata={"light": "#dce7ee", "dark": "#51758a", "accent": "#0f766e"},
    ),
    SeedShopItem(
        sku="banner-speed-champion",
        name="Speed Champion Banner",
        price=1250,
        type="banner",
        rarity="epic",
        description="A profile banner for players who live in blitz and bullet time scrambles.",
        asset_key="speed-champion",
        metadata={"gradient": "linear-gradient(135deg, #111827 0%, #7c3aed 52%, #f59e0b 100%)"},
    ),
    SeedShopItem(
        sku="banner-endgame-lab",
        name="Endgame Lab Banner",
        price=750,
        type="banner",
        rarity="rare",
        description="Clean study-room profile banner for endgame grinders.",
        asset_key="endgame-lab",
        metadata={"gradient": "linear-gradient(135deg, #0f172a 0%, #0d9488 52%, #e5e7eb 100%)"},
    ),
    SeedShopItem(
        sku="review-token",
        name="Coach Review Token",
        price=250,
        type="consumable",
        rarity="common",
        description="Consumable review credit for future coaching workflows.",
        asset_key="coach-review-token",
        consumable=True,
    ),
)


async def seed_default_shop_items(engine: AsyncEngine) -> None:
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        for item in DEFAULT_SHOP_ITEMS:
            existing = await session.execute(select(ShopItemModel).where(ShopItemModel.sku == item.sku))
            if existing.scalar_one_or_none() is not None:
                continue
            session.add(
                ShopItemModel(
                    sku=item.sku,
                    name=item.name,
                    price=item.price,
                    type=item.type,
                    rarity=item.rarity,
                    description=item.description,
                    image_url=item.image_url,
                    asset_key=item.asset_key,
                    metadata_json=item.metadata,
                    consumable=item.consumable,
                    is_active=True,
                )
            )
        await session.commit()
