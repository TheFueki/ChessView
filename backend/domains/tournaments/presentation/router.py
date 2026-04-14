"""Tournament REST router."""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user_id, get_db
from domains.game.application.services import GameService
from domains.game.infrastructure.repository import SqlAlchemyGameRepository
from domains.identity.infrastructure.repository import SqlAlchemyUserRepository
from domains.tournaments.application.services import TournamentService
from domains.tournaments.infrastructure.repository import SqlAlchemyTournamentRepository
from domains.tournaments.presentation.schemas import TournamentCreateRequest, TournamentDetailResponse, TournamentSummaryResponse
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
    tournament = await service.create_tournament(viewer_id, request.name, request.time_control_name)
    return await _serialize_summary(session, tournament, viewer_id, 1)


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


@router.post("/{tournament_id}/start", response_model=TournamentSummaryResponse)
async def start_tournament(
    tournament_id: UUID,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    viewer_id = UUID(user_id)
    service = _build_service(session)
    tournament = await service.start_tournament(tournament_id, viewer_id)
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
