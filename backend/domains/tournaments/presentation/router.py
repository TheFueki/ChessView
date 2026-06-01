"""Tournament REST router."""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user_id, get_db
from domains.game.application.services import GameService
from domains.game.infrastructure.repository import SqlAlchemyGameRepository
from domains.identity.infrastructure.repository import SqlAlchemyUserRepository
from domains.payments.presentation.schemas import PaymentIntentResponse
from domains.payments.service import PaymentService
from domains.tournaments.application.services import TournamentService
from domains.tournaments.domain.value_objects import TournamentStatus
from domains.scheduled_matches.tournament import ensure_scheduled_matches_for_round
from domains.tournaments.infrastructure.repository import SqlAlchemyTournamentRepository
from domains.tournaments.presentation.schemas import (
    OTBPlayerCreateRequest,
    TournamentCreateRequest,
    TournamentDetailResponse,
    TournamentPatchRequest,
    TournamentPlayerResponse,
    TournamentSummaryResponse,
    TournamentStandingResponse,
)
from domains.tournaments.presentation.serializers import (
    count_games_played,
    player_directory_from_users,
    to_tournament_detail_response,
    to_tournament_round_responses,
    to_tournament_standing_responses,
    to_tournament_summary_response,
)

router = APIRouter()


def _build_service(session: AsyncSession) -> TournamentService:
    game_repo = SqlAlchemyGameRepository(session)
    return TournamentService(
        tournament_repo=SqlAlchemyTournamentRepository(session),
        user_repo=SqlAlchemyUserRepository(session),
        game_repo=game_repo,
        game_service=GameService(game_repo),
    )


async def _resolve_players(
    session: AsyncSession,
    user_ids: set[UUID],
) -> object:
    users = await SqlAlchemyUserRepository(session).get_by_ids(user_ids)
    return player_directory_from_users(users)


async def _serialize_summary(
    session: AsyncSession,
    tournament,
    viewer_id: UUID,
    player_count: int,
) -> TournamentSummaryResponse:
    players = await _resolve_players(session, {tournament.owner_id})
    owner = players.get(tournament.owner_id)
    tournament_repo = SqlAlchemyTournamentRepository(session)
    viewer_player = await tournament_repo.get_player(tournament.id, viewer_id)
    return to_tournament_summary_response(
        tournament,
        owner,
        player_count=player_count,
        viewer_is_member=viewer_player is not None,
        viewer_is_owner=tournament.owner_id == viewer_id,
    )


@router.get("", response_model=list[TournamentSummaryResponse])
async def list_tournaments(
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    viewer_id = UUID(user_id)
    service = _build_service(session)
    tournaments = await service.list_tournaments()
    tournament_repo = SqlAlchemyTournamentRepository(session)
    players_by_tournament = {
        tournament.id: await tournament_repo.list_players(tournament.id)
        for tournament in tournaments
    }
    return [
        await _serialize_summary(session, tournament, viewer_id, len(players_by_tournament[tournament.id]))
        for tournament in tournaments
    ]


@router.post("", response_model=TournamentSummaryResponse, status_code=status.HTTP_201_CREATED)
async def create_tournament(
    request: TournamentCreateRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    viewer_id = UUID(user_id)
    service = _build_service(session)
    tournament = await service.create_tournament(
        viewer_id,
        request.name,
        request.time_control_name,
        request.tournament_type,
        request.entry_fee_cents,
        request.total_rounds,
        initial_time_ms=request.initial_time_ms,
        increment_ms=request.increment_ms,
    )
    return await _serialize_summary(session, tournament, viewer_id, 1)


@router.patch("/{tournament_id}", response_model=TournamentSummaryResponse)
async def update_tournament(
    tournament_id: UUID,
    request: TournamentPatchRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    viewer_id = UUID(user_id)
    tournament = await _build_service(session).update_tournament(
        tournament_id,
        viewer_id,
        **request.model_dump(exclude_unset=True),
    )
    player_count = len(await SqlAlchemyTournamentRepository(session).list_players(tournament_id))
    return await _serialize_summary(session, tournament, viewer_id, player_count)


async def _set_tournament_status(session: AsyncSession, tournament_id: UUID, user_id: str, status_value: TournamentStatus):
    viewer_id = UUID(user_id)
    tournament = await _build_service(session).set_status(tournament_id, viewer_id, status_value)
    player_count = len(await SqlAlchemyTournamentRepository(session).list_players(tournament_id))
    return await _serialize_summary(session, tournament, viewer_id, player_count)


@router.post("/{tournament_id}/publish", response_model=TournamentSummaryResponse)
async def publish_tournament(tournament_id: UUID, user_id: str = Depends(get_current_user_id), session: AsyncSession = Depends(get_db)):
    return await _set_tournament_status(session, tournament_id, user_id, TournamentStatus.PUBLISHED)


@router.post("/{tournament_id}/open-registration", response_model=TournamentSummaryResponse)
async def open_registration(tournament_id: UUID, user_id: str = Depends(get_current_user_id), session: AsyncSession = Depends(get_db)):
    return await _set_tournament_status(session, tournament_id, user_id, TournamentStatus.REGISTRATION)


@router.post("/{tournament_id}/close-registration", response_model=TournamentSummaryResponse)
async def close_registration(tournament_id: UUID, user_id: str = Depends(get_current_user_id), session: AsyncSession = Depends(get_db)):
    return await _set_tournament_status(session, tournament_id, user_id, TournamentStatus.REGISTRATION_CLOSED)


@router.post("/{tournament_id}/finish", response_model=TournamentSummaryResponse)
async def finish_tournament(tournament_id: UUID, user_id: str = Depends(get_current_user_id), session: AsyncSession = Depends(get_db)):
    return await _set_tournament_status(session, tournament_id, user_id, TournamentStatus.FINISHED)


@router.post("/{tournament_id}/cancel", response_model=TournamentSummaryResponse)
async def cancel_tournament(tournament_id: UUID, user_id: str = Depends(get_current_user_id), session: AsyncSession = Depends(get_db)):
    return await _set_tournament_status(session, tournament_id, user_id, TournamentStatus.CANCELLED)


@router.post("/{tournament_id}/players/{player_user_id}/withdraw", response_model=TournamentSummaryResponse)
async def withdraw_tournament_player(
    tournament_id: UUID,
    player_user_id: UUID,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    viewer_id = UUID(user_id)
    tournament = await _build_service(session).withdraw_player(tournament_id, viewer_id, player_user_id)
    player_count = len(await SqlAlchemyTournamentRepository(session).list_players(tournament_id))
    return await _serialize_summary(session, tournament, viewer_id, player_count)


@router.post("/{tournament_id}/entry-payment", response_model=PaymentIntentResponse)
async def create_entry_payment(
    tournament_id: UUID,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    payment = await PaymentService(session).create_entry_payment(tournament_id, UUID(user_id))
    return PaymentService.to_response(payment)


@router.post("/{tournament_id}/rounds/suggest-count")
async def suggest_round_count(
    tournament_id: UUID,
    session: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    from domains.tournaments.domain.services import swiss_round_count

    players = await SqlAlchemyTournamentRepository(session).list_players(tournament_id)
    active_count = len([player for player in players if player.status == "active"])
    return {"suggested_rounds": swiss_round_count(active_count), "active_players": active_count}


@router.post("/{tournament_id}/rounds/generate-swiss", response_model=TournamentSummaryResponse)
async def generate_swiss_round(
    tournament_id: UUID,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = _build_service(session)
    tournament = await service.advance_tournament(tournament_id, UUID(user_id))
    await ensure_scheduled_matches_for_round(
        session,
        tournament_id=tournament.id,
        round_number=tournament.current_round,
        creator_user_id=tournament.owner_id,
    )
    player_count = len(await SqlAlchemyTournamentRepository(session).list_players(tournament_id))
    return await _serialize_summary(session, tournament, UUID(user_id), player_count)


@router.get("/{tournament_id}/standings", response_model=list[TournamentStandingResponse])
async def get_standings(
    tournament_id: UUID,
    session: AsyncSession = Depends(get_db),
    _user_id: str = Depends(get_current_user_id),
):
    service = _build_service(session)
    tournament, players, _rounds, pairings = await service.get_tournament_detail(tournament_id)
    player_lookup = await _resolve_players(session, {player.user_id for player in players} | {tournament.owner_id})
    return to_tournament_standing_responses(service.standings(players), player_lookup, count_games_played(pairings))


@router.post("/{tournament_id}/join", response_model=TournamentSummaryResponse)
async def join_tournament(
    tournament_id: UUID,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    viewer_id = UUID(user_id)
    service = _build_service(session)
    tournament = await service.join_tournament(tournament_id, viewer_id)
    player_count = len(await SqlAlchemyTournamentRepository(session).list_players(tournament_id))
    return await _serialize_summary(session, tournament, viewer_id, player_count)


@router.delete("/{tournament_id}/join", response_model=TournamentSummaryResponse)
async def leave_tournament(
    tournament_id: UUID,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    viewer_id = UUID(user_id)
    service = _build_service(session)
    tournament = await service.leave_tournament(tournament_id, viewer_id)
    player_count = len(await SqlAlchemyTournamentRepository(session).list_players(tournament_id))
    return await _serialize_summary(session, tournament, viewer_id, player_count)


@router.post("/{tournament_id}/otb-players", response_model=TournamentPlayerResponse, status_code=status.HTTP_201_CREATED)
async def add_otb_player(
    tournament_id: UUID,
    request: OTBPlayerCreateRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = _build_service(session)
    player = await service.add_otb_player(
        tournament_id,
        UUID(user_id),
        display_name=request.display_name,
        seed_rating=request.seed_rating,
    )
    player_lookup = await _resolve_players(session, {player.user_id})
    return player_lookup.get(player.user_id, player.seed_rating)


@router.post("/{tournament_id}/start", response_model=TournamentSummaryResponse)
async def start_tournament(
    tournament_id: UUID,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    viewer_id = UUID(user_id)
    service = _build_service(session)
    tournament = await service.start_tournament(tournament_id, viewer_id)
    await ensure_scheduled_matches_for_round(
        session,
        tournament_id=tournament.id,
        round_number=tournament.current_round,
        creator_user_id=tournament.owner_id,
    )
    player_count = len(await SqlAlchemyTournamentRepository(session).list_players(tournament_id))
    return await _serialize_summary(session, tournament, viewer_id, player_count)


@router.post("/{tournament_id}/advance", response_model=TournamentSummaryResponse)
async def advance_tournament(
    tournament_id: UUID,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    viewer_id = UUID(user_id)
    service = _build_service(session)
    tournament = await service.advance_tournament(tournament_id, viewer_id)
    await ensure_scheduled_matches_for_round(
        session,
        tournament_id=tournament.id,
        round_number=tournament.current_round,
        creator_user_id=tournament.owner_id,
    )
    player_count = len(await SqlAlchemyTournamentRepository(session).list_players(tournament_id))
    return await _serialize_summary(session, tournament, viewer_id, player_count)


@router.get("/{tournament_id}", response_model=TournamentDetailResponse)
async def get_tournament(
    tournament_id: UUID,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    viewer_id = UUID(user_id)
    service = _build_service(session)
    tournament, players, rounds, pairings = await service.get_tournament_detail(tournament_id)
    summary = await _serialize_summary(session, tournament, viewer_id, len(players))

    player_ids = {tournament.owner_id} | {player.user_id for player in players}
    for pairing in pairings:
        player_ids.add(pairing.white_id)
        if pairing.black_id is not None:
            player_ids.add(pairing.black_id)

    player_lookup = await _resolve_players(session, player_ids)
    standings_players = service.standings(players)
    games_played = count_games_played(pairings)

    game_repo = SqlAlchemyGameRepository(session)
    game_statuses = {}
    for pairing in pairings:
        if pairing.game_id is None or pairing.game_id in game_statuses:
            continue
        game = await game_repo.get_by_id(pairing.game_id)
        game_statuses[pairing.game_id] = game.status if game is not None else None

    return to_tournament_detail_response(
        summary,
        standings=to_tournament_standing_responses(standings_players, player_lookup, games_played),
        rounds=to_tournament_round_responses(rounds, pairings, player_lookup, game_statuses),
    )
