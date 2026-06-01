"""Seed realistic local tournament data for demo environments."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import NAMESPACE_DNS, UUID, uuid5

import chess

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from domains.game.infrastructure.models import GameModel, MoveModel
from domains.identity.infrastructure.models import UserModel
from domains.scheduled_matches.infrastructure.models import ScheduledMatchModel
from domains.tournaments.infrastructure.models import (
    TournamentModel,
    TournamentPairingModel,
    TournamentPlayerModel,
    TournamentRoundModel,
)


DEMO_NAMESPACE = uuid5(NAMESPACE_DNS, "chessview.local.demo")


@dataclass(frozen=True, slots=True)
class DemoPlayer:
    key: str
    username: str
    rating: int
    bio: str


DEMO_PLAYERS = (
    DemoPlayer("mira-sokolova", "MiraSokolova", 1842, "OTB regular with a sharp 1.e4 repertoire."),
    DemoPlayer("temir-zhangali", "TemirZhangali", 1776, "Rapid specialist from the city chess club."),
    DemoPlayer("aisha-karim", "AishaKarim", 1698, "Junior champion converting clean endgames."),
    DemoPlayer("danil-orlov", "DanilOrlov", 1625, "Tactical player, dangerous in messy middlegames."),
    DemoPlayer("leonid-kim", "LeonidKim", 1910, "Candidate master and club coach."),
    DemoPlayer("sara-volkova", "SaraVolkova", 1589, "New OTB entrant with a strong puzzle rating."),
    DemoPlayer("arman-ibrayev", "ArmanIbrayev", 1733, "Classical player who prefers slow positional games."),
    DemoPlayer("victor-novak", "VictorNovak", 1661, "Weekend blitz regular and tournament volunteer."),
)


def _stable_id(key: str) -> UUID:
    return uuid5(DEMO_NAMESPACE, key)


async def seed_demo_tournaments(engine: AsyncEngine) -> None:
    """Populate local databases with lifelike tournaments, games, and expected matches."""
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        existing = await session.execute(
            select(TournamentModel.id).where(TournamentModel.name == "Almaty Central Rapid Open")
        )
        if existing.scalar_one_or_none() is not None:
            return

        now = datetime.now(timezone.utc)
        players = await _ensure_demo_players(session)
        await _seed_finished_rapid_open(session, players, now)
        await _seed_active_classical_swiss(session, players, now)
        await _seed_registration_blitz(session, players, now)
        await session.commit()


async def _ensure_demo_players(session) -> dict[str, UserModel]:
    players: dict[str, UserModel] = {}
    for demo in DEMO_PLAYERS:
        email = f"{demo.key}@demo.chessview.local"
        result = await session.execute(select(UserModel).where(UserModel.email == email))
        user = result.scalar_one_or_none()
        if user is None:
            user = UserModel(
                id=_stable_id(f"user:{demo.key}"),
                username=demo.username,
                email=email,
                password="demo:not-for-login",
                rating=demo.rating,
                bullet_rating=max(800, demo.rating - 120),
                blitz_rating=demo.rating,
                rapid_rating=demo.rating + 25,
                classical_rating=demo.rating + 45,
                coins=4200,
                bio=demo.bio,
                role="user",
            )
            session.add(user)
        players[demo.key] = user
    await session.flush()
    return players


async def _seed_finished_rapid_open(session, players: dict[str, UserModel], now: datetime) -> None:
    tournament = TournamentModel(
        id=_stable_id("tournament:almaty-central-rapid-open"),
        owner_id=players["leonid-kim"].id,
        name="Almaty Central Rapid Open",
        time_control_name="15+10",
        initial_time_ms=900_000,
        increment_ms=10_000,
        status="finished",
        tournament_type="otb",
        entry_fee_cents=0,
        current_round=2,
        total_rounds=2,
        created_at=now - timedelta(days=16),
        started_at=now - timedelta(days=15, hours=5),
        finished_at=now - timedelta(days=15, hours=1),
    )
    session.add(tournament)
    field = ["leonid-kim", "mira-sokolova", "temir-zhangali", "aisha-karim"]
    scores = {"leonid-kim": 2.0, "mira-sokolova": 1.0, "temir-zhangali": 1.0, "aisha-karim": 0.0}
    _add_players(session, tournament.id, players, field, scores)
    round_one = _add_round(session, tournament.id, 1)
    round_two = _add_round(session, tournament.id, 2)

    game_a = _make_game(
        white=players["leonid-kim"],
        black=players["aisha-karim"],
        moves=["e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6", "h5f7"],
        result="1-0",
        status="checkmate",
        time_control_name="15+10",
        initial_time_ms=900_000,
        increment_ms=10_000,
        started_at=now - timedelta(days=15, hours=5),
    )
    game_b = _make_game(
        white=players["mira-sokolova"],
        black=players["temir-zhangali"],
        moves=["d2d4", "g8f6", "c2c4", "e7e6", "g1f3", "d7d5", "b1c3", "f8b4"],
        result="1/2-1/2",
        status="draw",
        time_control_name="15+10",
        initial_time_ms=900_000,
        increment_ms=10_000,
        started_at=now - timedelta(days=15, hours=5),
        termination_reason="draw_agreement",
    )
    game_c = _make_game(
        white=players["leonid-kim"],
        black=players["mira-sokolova"],
        moves=["c2c4", "e7e5", "b1c3", "g8f6", "g2g3", "d7d5", "c4d5", "f6d5"],
        result="1-0",
        status="resigned",
        time_control_name="15+10",
        initial_time_ms=900_000,
        increment_ms=10_000,
        started_at=now - timedelta(days=15, hours=3),
        termination_reason="resignation",
    )
    game_d = _make_game(
        white=players["temir-zhangali"],
        black=players["aisha-karim"],
        moves=["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4", "g8f6"],
        result="1-0",
        status="timeout",
        time_control_name="15+10",
        initial_time_ms=900_000,
        increment_ms=10_000,
        started_at=now - timedelta(days=15, hours=3),
        termination_reason="clock_timeout",
    )
    session.add_all([game_a, game_b, game_c, game_d])
    await session.flush()
    _add_pairing(session, tournament.id, round_one.round_number, players["leonid-kim"], players["aisha-karim"], game_a, "1-0")
    _add_pairing(session, tournament.id, round_one.round_number, players["mira-sokolova"], players["temir-zhangali"], game_b, "1/2-1/2")
    _add_pairing(session, tournament.id, round_two.round_number, players["leonid-kim"], players["mira-sokolova"], game_c, "1-0")
    _add_pairing(session, tournament.id, round_two.round_number, players["temir-zhangali"], players["aisha-karim"], game_d, "1-0")
    _add_moves(session, game_a)
    _add_moves(session, game_b)
    _add_moves(session, game_c)
    _add_moves(session, game_d)


async def _seed_active_classical_swiss(session, players: dict[str, UserModel], now: datetime) -> None:
    tournament = TournamentModel(
        id=_stable_id("tournament:astana-weekend-classical"),
        owner_id=players["arman-ibrayev"].id,
        name="Astana Weekend Classical",
        time_control_name="15+10",
        initial_time_ms=900_000,
        increment_ms=10_000,
        status="active",
        tournament_type="otb",
        entry_fee_cents=250,
        current_round=1,
        total_rounds=3,
        created_at=now - timedelta(days=3),
        started_at=now - timedelta(minutes=45),
    )
    session.add(tournament)
    field = ["arman-ibrayev", "victor-novak", "sara-volkova", "danil-orlov", "mira-sokolova", "temir-zhangali"]
    _add_players(session, tournament.id, players, field, {})
    round_one = _add_round(session, tournament.id, 1)
    pairings = [
        ("mira-sokolova", "sara-volkova"),
        ("temir-zhangali", "victor-novak"),
        ("arman-ibrayev", "danil-orlov"),
    ]
    for board, (white_key, black_key) in enumerate(pairings, start=1):
        game = _make_game(
            white=players[white_key],
            black=players[black_key],
            moves=[],
            result=None,
            status="active",
            time_control_name="15+10",
            initial_time_ms=900_000,
            increment_ms=10_000,
            started_at=now - timedelta(minutes=35),
        )
        session.add(game)
        await session.flush()
        pairing = _add_pairing(session, tournament.id, round_one.round_number, players[white_key], players[black_key], game, None)
        await session.flush()
        session.add(
            ScheduledMatchModel(
                id=_stable_id(f"scheduled:astana:{board}"),
                tournament_id=tournament.id,
                round_id=round_one.round_number,
                pairing_id=pairing.id,
                white_player_id=players[white_key].id,
                black_player_id=players[black_key].id,
                creator_user_id=tournament.owner_id,
                invited_user_id=players[black_key].id,
                starts_at=now + timedelta(minutes=15 * board),
                status="scheduled",
                game_id=game.id,
                metadata_json={"source": "demo_seed", "board": board, "venue": "Table zone A"},
            )
        )


async def _seed_registration_blitz(session, players: dict[str, UserModel], now: datetime) -> None:
    tournament = TournamentModel(
        id=_stable_id("tournament:saturday-blitz-ladder"),
        owner_id=players["mira-sokolova"].id,
        name="Saturday Blitz Ladder",
        time_control_name="5+3",
        initial_time_ms=300_000,
        increment_ms=3_000,
        status="registration",
        tournament_type="swiss",
        entry_fee_cents=100,
        current_round=0,
        total_rounds=4,
        created_at=now - timedelta(hours=8),
    )
    session.add(tournament)
    _add_players(session, tournament.id, players, ["mira-sokolova", "danil-orlov", "victor-novak"], {})


def _add_players(session, tournament_id: UUID, players: dict[str, UserModel], keys: list[str], scores: dict[str, float]) -> None:
    for key in keys:
        player = players[key]
        session.add(
            TournamentPlayerModel(
                tournament_id=tournament_id,
                user_id=player.id,
                seed_rating=player.rating,
                score=scores.get(key, 0.0),
                status="active",
            )
        )


def _add_round(session, tournament_id: UUID, round_number: int) -> TournamentRoundModel:
    tournament_round = TournamentRoundModel(tournament_id=tournament_id, round_number=round_number)
    session.add(tournament_round)
    return tournament_round


def _add_pairing(
    session,
    tournament_id: UUID,
    round_number: int,
    white: UserModel,
    black: UserModel,
    game: GameModel,
    result: str | None,
) -> TournamentPairingModel:
    pairing = TournamentPairingModel(
        tournament_id=tournament_id,
        round_number=round_number,
        white_id=white.id,
        black_id=black.id,
        game_id=game.id,
        result=result,
    )
    session.add(pairing)
    return pairing


def _make_game(
    *,
    white: UserModel,
    black: UserModel,
    moves: list[str],
    result: str | None,
    status: str,
    time_control_name: str,
    initial_time_ms: int,
    increment_ms: int,
    started_at: datetime,
    termination_reason: str | None = None,
) -> GameModel:
    board = chess.Board()
    for uci in moves:
        board.push(chess.Move.from_uci(uci))
    ended_at = None if status == "active" else started_at + timedelta(minutes=max(8, len(moves) * 2))
    game = GameModel(
        id=_stable_id(f"game:{white.username}:{black.username}:{started_at.isoformat()}"),
        white_id=white.id,
        black_id=black.id,
        time_control_name=time_control_name,
        initial_time_ms=initial_time_ms,
        increment_ms=increment_ms,
        white_time_ms=max(0, initial_time_ms - len(moves) * 18_000),
        black_time_ms=max(0, initial_time_ms - len(moves) * 16_000),
        last_clock_started_at=started_at if status == "active" else None,
        rated=True,
        white_rating_before=white.rating,
        black_rating_before=black.rating,
        white_rating_after=white.rating + _rating_delta(result, "white") if result else None,
        black_rating_after=black.rating + _rating_delta(result, "black") if result else None,
        status=status,
        result=result,
        fen=board.fen(),
        pgn=None,
        started_at=started_at,
        ended_at=ended_at,
        termination_reason=None if status == "active" else termination_reason or status,
        rating_applied_at=ended_at,
    )
    game._demo_moves = moves
    return game


def _add_moves(session, game: GameModel) -> None:
    board = chess.Board()
    for index, uci in enumerate(getattr(game, "_demo_moves", []), start=1):
        move = chess.Move.from_uci(uci)
        board.push(move)
        user_id = game.white_id if index % 2 == 1 else game.black_id
        session.add(
            MoveModel(
                game_id=game.id,
                user_id=user_id,
                uci=uci,
                fen_after=board.fen(),
                move_number=index,
                created_at=game.started_at + timedelta(seconds=index * 35),
            )
        )


def _rating_delta(result: str | None, color: str) -> int:
    if result == "1/2-1/2":
        return 0
    if result == "1-0":
        return 14 if color == "white" else -14
    if result == "0-1":
        return -14 if color == "white" else 14
    return 0
