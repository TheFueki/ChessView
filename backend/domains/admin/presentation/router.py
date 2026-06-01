"""Admin REST router."""

import json
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.dependencies import get_db, require_admin
from domains.admin.infrastructure.models import AdminAuditLogModel
from domains.admin.presentation.schemas import (
    AdminAuditLogResponse,
    AdminGamePatchRequest,
    AdminGameResponse,
    AdminRoleRequest,
    AdminScheduledMatchPatchRequest,
    AdminScheduledMatchResponse,
    AdminShopItem,
    AdminShopItemPatchRequest,
    AdminTournamentCreateRequest,
    AdminTournamentPatchRequest,
    AdminTournamentResponse,
    AdminUserCreateRequest,
    AdminUserPatchRequest,
    AdminUserResponse,
)
from domains.game.infrastructure.models import GameModel
from domains.identity.face_verification.models import FaceVerificationSessionModel
from domains.identity.face_verification.schemas import FaceVerificationSessionResponse
from domains.identity.face_verification.service import FaceVerificationService
from domains.identity.infrastructure.models import UserModel
from domains.payments.infrastructure.models import PaymentIntentModel
from domains.payments.presentation.schemas import PaymentIntentResponse
from domains.payments.service import PaymentService
from domains.scheduled_matches.infrastructure.models import ScheduledMatchModel
from domains.tournaments.infrastructure.models import TournamentModel
from infrastructure.security import hash_password

router = APIRouter()

SHOP_CATALOG_PATH = settings.resolved_storage_dir / "shop_catalog.json"
DEFAULT_SHOP_ITEMS = [
    {"id": 1, "name": "Tournament Board", "price": 500, "type": "board", "rarity": "rare", "description": "A restrained green board tuned for long rated sessions.", "image_url": None, "consumable": False},
    {"id": 2, "name": "Profile Frame", "price": 1200, "type": "avatar", "rarity": "epic", "description": "A metallic profile frame for leaderboard and lobby surfaces.", "image_url": None, "consumable": False},
    {"id": 3, "name": "Classic Pieces", "price": 150, "type": "board", "rarity": "common", "description": "Readable pieces for rapid games and review.", "image_url": None, "consumable": False},
    {"id": 4, "name": "Victory Accent", "price": 5000, "type": "effect", "rarity": "legendary", "description": "A subtle win-state accent for post-game overlays.", "image_url": None, "consumable": False},
    {"id": 5, "name": "Opening Lab Pass", "price": 900, "type": "training", "rarity": "rare", "description": "Unlocks a focused opening prep pack in the analysis hub.", "image_url": None, "consumable": True},
    {"id": 6, "name": "Blunder Shield", "price": 650, "type": "boost", "rarity": "epic", "description": "Adds one extra review hint to the next training game.", "image_url": None, "consumable": True},
    {"id": 7, "name": "Neon Move Trail", "price": 1800, "type": "effect", "rarity": "epic", "description": "Highlights your last move with a sharper animated trail.", "image_url": None, "consumable": False},
    {"id": 8, "name": "Coach Review Token", "price": 750, "type": "training", "rarity": "rare", "description": "Marks one completed game for deeper review.", "image_url": None, "consumable": True},
]


async def _audit(session: AsyncSession, actor_user_id: UUID, action: str, target_type: str, target_id: str, payload: dict) -> None:
    session.add(AdminAuditLogModel(actor_user_id=actor_user_id, action=action, target_type=target_type, target_id=target_id, payload=payload))
    await session.commit()


def _to_user_response(user: UserModel) -> AdminUserResponse:
    return AdminUserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        rating=user.rating,
        role=user.role,
        banned_at=user.banned_at,
        created_at=user.created_at,
    )


def _read_shop_items() -> list[dict]:
    if not SHOP_CATALOG_PATH.exists():
        return [dict(item) for item in DEFAULT_SHOP_ITEMS]
    try:
        raw = json.loads(SHOP_CATALOG_PATH.read_text(encoding="utf-8"))
        return raw if isinstance(raw, list) else [dict(item) for item in DEFAULT_SHOP_ITEMS]
    except Exception:
        return [dict(item) for item in DEFAULT_SHOP_ITEMS]


def _write_shop_items(items: list[dict]) -> None:
    SHOP_CATALOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    SHOP_CATALOG_PATH.write_text(json.dumps(items, indent=2), encoding="utf-8")


@router.get("/users", response_model=list[AdminUserResponse])
async def list_users(limit: int = Query(50, ge=1, le=200), session: AsyncSession = Depends(get_db), _admin_id: str = Depends(require_admin)):
    result = await session.execute(select(UserModel).order_by(UserModel.created_at.desc()).limit(limit))
    return [_to_user_response(user) for user in result.scalars().all()]


@router.post("/users", response_model=AdminUserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(body: AdminUserCreateRequest, session: AsyncSession = Depends(get_db), admin_id: str = Depends(require_admin)):
    user = UserModel(
        id=uuid4(),
        username=body.username,
        email=body.email,
        password=hash_password(body.password),
        rating=body.rating,
        bullet_rating=body.rating,
        blitz_rating=body.rating,
        rapid_rating=body.rating,
        classical_rating=body.rating,
        coins=body.coins,
        role=body.role,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    await _audit(session, UUID(admin_id), "user.create", "user", str(user.id), body.model_dump(exclude={"password"}))
    return _to_user_response(user)


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
async def patch_user(user_id: UUID, body: AdminUserPatchRequest, session: AsyncSession = Depends(get_db), admin_id: str = Depends(require_admin)):
    user = await session.get(UserModel, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    payload = body.model_dump(exclude_unset=True)
    for key, value in payload.items():
        setattr(user, key, value)
    await session.commit()
    await session.refresh(user)
    await _audit(session, UUID(admin_id), "user.patch", "user", str(user_id), payload)
    return _to_user_response(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: UUID, session: AsyncSession = Depends(get_db), admin_id: str = Depends(require_admin)):
    user = await session.get(UserModel, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await session.delete(user)
    await session.commit()
    await _audit(session, UUID(admin_id), "user.delete", "user", str(user_id), {})


@router.post("/users/{user_id}/ban", response_model=AdminUserResponse)
async def ban_user(user_id: UUID, session: AsyncSession = Depends(get_db), admin_id: str = Depends(require_admin)):
    user = await session.get(UserModel, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.banned_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(user)
    await _audit(session, UUID(admin_id), "user.ban", "user", str(user_id), {})
    return _to_user_response(user)


@router.post("/users/{user_id}/unban", response_model=AdminUserResponse)
async def unban_user(user_id: UUID, session: AsyncSession = Depends(get_db), admin_id: str = Depends(require_admin)):
    user = await session.get(UserModel, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.banned_at = None
    await session.commit()
    await session.refresh(user)
    await _audit(session, UUID(admin_id), "user.unban", "user", str(user_id), {})
    return _to_user_response(user)


@router.post("/users/{user_id}/role", response_model=AdminUserResponse)
async def change_role(user_id: UUID, body: AdminRoleRequest, session: AsyncSession = Depends(get_db), admin_id: str = Depends(require_admin)):
    user = await session.get(UserModel, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.role = body.role
    await session.commit()
    await session.refresh(user)
    await _audit(session, UUID(admin_id), "user.role", "user", str(user_id), {"role": body.role})
    return _to_user_response(user)


@router.get("/tournaments", response_model=list[AdminTournamentResponse])
async def list_tournaments(limit: int = Query(100, ge=1, le=500), session: AsyncSession = Depends(get_db), _admin_id: str = Depends(require_admin)):
    result = await session.execute(select(TournamentModel).order_by(TournamentModel.created_at.desc()).limit(limit))
    return [AdminTournamentResponse.model_validate(item, from_attributes=True) for item in result.scalars().all()]


@router.post("/tournaments", response_model=AdminTournamentResponse, status_code=status.HTTP_201_CREATED)
async def create_tournament(body: AdminTournamentCreateRequest, session: AsyncSession = Depends(get_db), admin_id: str = Depends(require_admin)):
    tournament = TournamentModel(
        id=uuid4(),
        owner_id=body.owner_id or UUID(admin_id),
        name=body.name,
        time_control_name=body.time_control_name,
        initial_time_ms=body.initial_time_ms,
        increment_ms=body.increment_ms,
        status=body.status,
        tournament_type=body.tournament_type,
        entry_fee_cents=body.entry_fee_cents,
        current_round=0,
        total_rounds=body.total_rounds,
    )
    session.add(tournament)
    await session.commit()
    await session.refresh(tournament)
    await _audit(session, UUID(admin_id), "tournament.create", "tournament", str(tournament.id), body.model_dump(mode="json"))
    return AdminTournamentResponse.model_validate(tournament, from_attributes=True)


@router.patch("/tournaments/{tournament_id}", response_model=AdminTournamentResponse)
async def patch_tournament(tournament_id: UUID, body: AdminTournamentPatchRequest, session: AsyncSession = Depends(get_db), admin_id: str = Depends(require_admin)):
    tournament = await session.get(TournamentModel, tournament_id)
    if tournament is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
    payload = body.model_dump(exclude_unset=True)
    for key, value in payload.items():
        setattr(tournament, key, value)
    await session.commit()
    await session.refresh(tournament)
    await _audit(session, UUID(admin_id), "tournament.patch", "tournament", str(tournament_id), payload)
    return AdminTournamentResponse.model_validate(tournament, from_attributes=True)


@router.delete("/tournaments/{tournament_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tournament(tournament_id: UUID, session: AsyncSession = Depends(get_db), admin_id: str = Depends(require_admin)):
    tournament = await session.get(TournamentModel, tournament_id)
    if tournament is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")
    await session.delete(tournament)
    await session.commit()
    await _audit(session, UUID(admin_id), "tournament.delete", "tournament", str(tournament_id), {})


@router.get("/scheduled-matches", response_model=list[AdminScheduledMatchResponse])
async def list_scheduled_matches(limit: int = Query(100, ge=1, le=500), session: AsyncSession = Depends(get_db), _admin_id: str = Depends(require_admin)):
    result = await session.execute(select(ScheduledMatchModel).order_by(ScheduledMatchModel.created_at.desc()).limit(limit))
    return [AdminScheduledMatchResponse.model_validate(item, from_attributes=True) for item in result.scalars().all()]


@router.patch("/scheduled-matches/{match_id}", response_model=AdminScheduledMatchResponse)
async def patch_scheduled_match(match_id: UUID, body: AdminScheduledMatchPatchRequest, session: AsyncSession = Depends(get_db), admin_id: str = Depends(require_admin)):
    match = await session.get(ScheduledMatchModel, match_id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled match not found")
    payload = body.model_dump(exclude_unset=True)
    for key, value in payload.items():
        setattr(match, key, value)
    match.updated_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(match)
    await _audit(session, UUID(admin_id), "scheduled_match.patch", "scheduled_match", str(match_id), body.model_dump(exclude_unset=True, mode="json"))
    return AdminScheduledMatchResponse.model_validate(match, from_attributes=True)


@router.delete("/scheduled-matches/{match_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scheduled_match(match_id: UUID, session: AsyncSession = Depends(get_db), admin_id: str = Depends(require_admin)):
    match = await session.get(ScheduledMatchModel, match_id)
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled match not found")
    await session.delete(match)
    await session.commit()
    await _audit(session, UUID(admin_id), "scheduled_match.delete", "scheduled_match", str(match_id), {})


@router.get("/games", response_model=list[AdminGameResponse])
async def list_games(limit: int = Query(100, ge=1, le=500), session: AsyncSession = Depends(get_db), _admin_id: str = Depends(require_admin)):
    result = await session.execute(select(GameModel).order_by(GameModel.started_at.desc()).limit(limit))
    return [AdminGameResponse.model_validate(item, from_attributes=True) for item in result.scalars().all()]


@router.patch("/games/{game_id}", response_model=AdminGameResponse)
async def patch_game(game_id: UUID, body: AdminGamePatchRequest, session: AsyncSession = Depends(get_db), admin_id: str = Depends(require_admin)):
    game = await session.get(GameModel, game_id)
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    payload = body.model_dump(exclude_unset=True)
    for key, value in payload.items():
        setattr(game, key, value)
    if payload.get("status") in {"finished", "aborted"} and game.ended_at is None:
        game.ended_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(game)
    await _audit(session, UUID(admin_id), "game.patch", "game", str(game_id), payload)
    return AdminGameResponse.model_validate(game, from_attributes=True)


@router.delete("/games/{game_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_game(game_id: UUID, session: AsyncSession = Depends(get_db), admin_id: str = Depends(require_admin)):
    game = await session.get(GameModel, game_id)
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    await session.delete(game)
    await session.commit()
    await _audit(session, UUID(admin_id), "game.delete", "game", str(game_id), {})


@router.get("/logs", response_model=list[AdminAuditLogResponse])
async def list_logs(limit: int = Query(100, ge=1, le=500), session: AsyncSession = Depends(get_db), _admin_id: str = Depends(require_admin)):
    result = await session.execute(select(AdminAuditLogModel).order_by(AdminAuditLogModel.created_at.desc()).limit(limit))
    return result.scalars().all()


@router.get("/payments", response_model=list[PaymentIntentResponse])
async def list_payments(limit: int = Query(100, ge=1, le=500), session: AsyncSession = Depends(get_db), _admin_id: str = Depends(require_admin)):
    result = await session.execute(select(PaymentIntentModel).order_by(PaymentIntentModel.created_at.desc()).limit(limit))
    return [PaymentService.to_response(payment) for payment in result.scalars().all()]


@router.post("/payments/{payment_id}/refund", response_model=PaymentIntentResponse)
async def refund_payment(payment_id: UUID, session: AsyncSession = Depends(get_db), admin_id: str = Depends(require_admin)):
    payment = await PaymentService(session).simulate(payment_id, "refunded")
    await _audit(session, UUID(admin_id), "payment.refund", "payment", str(payment_id), {})
    return PaymentService.to_response(payment)


@router.get("/face-verification/sessions", response_model=list[FaceVerificationSessionResponse])
async def list_face_verification_sessions(
    limit: int = Query(100, ge=1, le=500),
    status_filter: str | None = Query(None, alias="status"),
    session: AsyncSession = Depends(get_db),
    _admin_id: str = Depends(require_admin),
):
    stmt = select(FaceVerificationSessionModel).order_by(FaceVerificationSessionModel.created_at.desc()).limit(limit)
    if status_filter is not None:
        stmt = stmt.where(FaceVerificationSessionModel.status == status_filter)
    result = await session.execute(stmt)
    service = FaceVerificationService(session)
    return [service.session_response(item) for item in result.scalars().all()]


@router.get("/shop-items/public", response_model=list[AdminShopItem])
async def public_shop_items():
    return _read_shop_items()


@router.get("/shop-items", response_model=list[AdminShopItem])
async def list_shop_items(_admin_id: str = Depends(require_admin)):
    return _read_shop_items()


@router.post("/shop-items", response_model=AdminShopItem, status_code=status.HTTP_201_CREATED)
async def create_shop_item(body: AdminShopItem, admin_id: str = Depends(require_admin), session: AsyncSession = Depends(get_db)):
    items = _read_shop_items()
    if any(item["id"] == body.id for item in items):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Shop item id already exists")
    item = body.model_dump()
    items.append(item)
    _write_shop_items(items)
    await _audit(session, UUID(admin_id), "shop_item.create", "shop_item", str(body.id), item)
    return item


@router.patch("/shop-items/{item_id}", response_model=AdminShopItem)
async def patch_shop_item(item_id: int, body: AdminShopItemPatchRequest, admin_id: str = Depends(require_admin), session: AsyncSession = Depends(get_db)):
    items = _read_shop_items()
    for item in items:
        if item["id"] == item_id:
            payload = body.model_dump(exclude_unset=True)
            item.update(payload)
            _write_shop_items(items)
            await _audit(session, UUID(admin_id), "shop_item.patch", "shop_item", str(item_id), payload)
            return item
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop item not found")


@router.delete("/shop-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_shop_item(item_id: int, admin_id: str = Depends(require_admin), session: AsyncSession = Depends(get_db)):
    items = _read_shop_items()
    next_items = [item for item in items if item["id"] != item_id]
    if len(next_items) == len(items):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shop item not found")
    _write_shop_items(next_items)
    await _audit(session, UUID(admin_id), "shop_item.delete", "shop_item", str(item_id), {})
