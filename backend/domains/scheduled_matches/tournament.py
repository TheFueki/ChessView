"""Tournament scheduled-match helpers."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from domains.scheduled_matches.infrastructure.models import ScheduledMatchModel
from domains.tournaments.infrastructure.repository import SqlAlchemyTournamentRepository


async def ensure_scheduled_matches_for_round(
    session: AsyncSession,
    *,
    tournament_id: UUID,
    round_number: int,
    creator_user_id: UUID,
) -> None:
    pairings = await SqlAlchemyTournamentRepository(session).list_pairings(tournament_id, round_number)
    pairing_ids = [pairing.id for pairing in pairings if pairing.id is not None and pairing.black_id is not None]
    if not pairing_ids:
        return

    result = await session.execute(
        select(ScheduledMatchModel.pairing_id).where(ScheduledMatchModel.pairing_id.in_(pairing_ids))
    )
    existing_pairing_ids = set(result.scalars().all())
    starts_at = datetime.now(timezone.utc)

    for pairing in pairings:
        if pairing.id is None or pairing.black_id is None or pairing.id in existing_pairing_ids:
            continue
        session.add(
            ScheduledMatchModel(
                tournament_id=tournament_id,
                round_id=round_number,
                pairing_id=pairing.id,
                white_player_id=pairing.white_id,
                black_player_id=pairing.black_id,
                creator_user_id=creator_user_id,
                invited_user_id=pairing.black_id,
                starts_at=starts_at,
                status="pending_acceptance",
                game_id=pairing.game_id,
                metadata_json={"source": "tournament_swiss_pairing"},
            )
        )
    await session.commit()
