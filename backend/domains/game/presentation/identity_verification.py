"""Presentation helpers for game-bound identity verification outcomes."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


async def broadcast_identity_verification_forfeit(game_id: UUID, stopped_game: object, session: AsyncSession) -> None:
    from domains.game.presentation.ws_handler import _apply_ratings_if_needed, _game_over_payload, _sync_tournament_if_needed
    from shared.events import EventType
    from shared.ws_manager import manager

    rating_update = await _apply_ratings_if_needed(game_id, session)
    await _sync_tournament_if_needed(game_id, session)
    await manager.broadcast_to_room(
        str(game_id),
        EventType.GAME_OVER,
        _game_over_payload(stopped_game, rating_update, "identity_verification_failed"),
    )
