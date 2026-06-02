"""Seed real Chess.com tournament/archive data for local demo environments."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from io import StringIO
from uuid import NAMESPACE_URL, UUID, uuid5

import chess.pgn
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from domains.game.infrastructure.models import GameModel, MoveModel
from domains.identity.infrastructure.models import UserModel
from domains.tournaments.infrastructure.models import (
    TournamentModel,
    TournamentPairingModel,
    TournamentPlayerModel,
    TournamentRoundModel,
)
from shared.time_controls import rating_speed_for_clock, rating_for_user


SEED_NAMESPACE = uuid5(NAMESPACE_URL, "https://api.chess.com/pub/chessview-seed")
CHESSCOM_USER_AGENT = "ChessViewSeed/1.0 (source: https://api.chess.com/pub)"


@dataclass(frozen=True, slots=True)
class RealPlayer:
    username: str
    display_name: str
    fallback_rating: int
    bio: str


@dataclass(frozen=True, slots=True)
class ArchivePick:
    archive_user: str
    year: int
    month: int
    opponent: str


REAL_PLAYERS = (
    RealPlayer("hikaru", "Hikaru Nakamura", 3290, "GM Hikaru Nakamura, Chess.com speed specialist and SCC legend."),
    RealPlayer("DanielNaroditsky", "Daniel Naroditsky", 3250, "GM Daniel Naroditsky, elite online bullet/blitz player and educator."),
    RealPlayer("Oleksandr_Bortnyk", "Oleksandr Bortnyk", 3150, "GM Oleksandr Bortnyk, frequent Bullet Brawl contender."),
    RealPlayer("Firouzja2003", "Alireza Firouzja", 3075, "GM Alireza Firouzja, world-class blitz and rapid player."),
    RealPlayer("FabianoCaruana", "Fabiano Caruana", 3085, "GM Fabiano Caruana, elite classical player active in online blitz."),
    RealPlayer("drnykterstein", "Magnus Carlsen", 3200, "GM Magnus Carlsen account from the Chess.com public API."),
)

ARCHIVE_PICKS = (
    ArchivePick("hikaru", 2023, 9, "DanielNaroditsky"),
    ArchivePick("hikaru", 2023, 9, "Oleksandr_Bortnyk"),
    ArchivePick("hikaru", 2023, 9, "Firouzja2003"),
    ArchivePick("hikaru", 2023, 9, "FabianoCaruana"),
)


def _stable_id(key: str) -> UUID:
    return uuid5(SEED_NAMESPACE, key)


async def seed_demo_tournaments(engine: AsyncEngine) -> None:
    """Populate clean local databases with real public Chess.com games."""
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        existing = await session.execute(select(TournamentModel.id).where(TournamentModel.name == "Chess.com Public Archive Showcase"))
        if existing.scalar_one_or_none() is not None:
            return

        players = await _ensure_real_players(session)
        games = await _fetch_seed_games()
        if not games:
            await session.commit()
            return

        tournament = _make_tournament(players["hikaru"])
        session.add(tournament)

        scores: dict[str, float] = {key: 0.0 for key in players}
        pairings: list[tuple[GameModel, str, str, str | None]] = []
        for index, game_payload in enumerate(games, start=1):
            game, white_username, black_username = _game_from_pgn(game_payload["pgn"], players, game_payload["url"], index)
            if game is None:
                continue
            session.add(game)
            pairings.append((game, white_username, black_username, game.result))
            if game.result == "1-0":
                scores[white_username] = scores.get(white_username, 0.0) + 1.0
            elif game.result == "0-1":
                scores[black_username] = scores.get(black_username, 0.0) + 1.0
            elif game.result == "1/2-1/2":
                scores[white_username] = scores.get(white_username, 0.0) + 0.5
                scores[black_username] = scores.get(black_username, 0.0) + 0.5

        await session.flush()

        active_usernames = {username for pairing in pairings for username in (pairing[1], pairing[2])}
        for username in sorted(active_usernames):
            player = players[username]
            session.add(
                TournamentPlayerModel(
                    tournament_id=tournament.id,
                    user_id=player.id,
                    seed_rating=player.rapid_rating,
                    score=scores.get(username, 0.0),
                    status="active",
                )
            )

        for round_number, (game, white_username, black_username, result) in enumerate(pairings, start=1):
            session.add(
                TournamentPairingModel(
                    tournament_id=tournament.id,
                    round_number=round_number,
                    white_id=players[white_username].id,
                    black_id=players[black_username].id,
                    game_id=game.id,
                    result=result,
                )
            )
            session.add(TournamentRoundModel(tournament_id=tournament.id, round_number=round_number))
            _add_moves(session, game)

        tournament.total_rounds = max(1, len(pairings))
        tournament.current_round = tournament.total_rounds
        await session.commit()


async def _ensure_real_players(session) -> dict[str, UserModel]:
    players: dict[str, UserModel] = {}
    for player in REAL_PLAYERS:
        email = f"{player.username.lower()}@chesscom.chessview.local"
        result = await session.execute(select(UserModel).where(UserModel.email == email))
        user = result.scalar_one_or_none()
        if user is None:
            user = UserModel(
                id=_stable_id(f"user:{player.username.lower()}"),
                username=player.username,
                email=email,
                password="seed:not-for-login",
                rating=player.fallback_rating,
                bullet_rating=player.fallback_rating,
                blitz_rating=max(800, player.fallback_rating - 30),
                rapid_rating=max(800, player.fallback_rating - 80),
                classical_rating=max(800, player.fallback_rating - 120),
                coins=5000,
                bio=f"{player.bio} Source: Chess.com PubAPI public player/archive data.",
                role="user",
            )
            session.add(user)
        players[player.username.lower()] = user
        players[player.username] = user
    await session.flush()
    return players


async def _fetch_seed_games() -> list[dict[str, str]]:
    found: list[dict[str, str]] = []
    headers = {"User-Agent": CHESSCOM_USER_AGENT}
    async with httpx.AsyncClient(headers=headers, timeout=8.0, follow_redirects=True) as client:
        for pick in ARCHIVE_PICKS:
            url = f"https://api.chess.com/pub/player/{pick.archive_user.lower()}/games/{pick.year}/{pick.month:02d}"
            try:
                response = await client.get(url)
                response.raise_for_status()
            except httpx.HTTPError:
                continue
            for game in response.json().get("games", []):
                white = game.get("white", {}).get("username", "")
                black = game.get("black", {}).get("username", "")
                if pick.opponent.lower() not in {white.lower(), black.lower()}:
                    continue
                pgn = game.get("pgn")
                game_url = game.get("url")
                if pgn and game_url:
                    found.append({"pgn": pgn, "url": game_url})
                    break
    return found


def _make_tournament(owner: UserModel) -> TournamentModel:
    now = datetime.now(timezone.utc)
    return TournamentModel(
        id=_stable_id("tournament:chesscom-public-archive-showcase"),
        owner_id=owner.id,
        name="Chess.com Public Archive Showcase",
        time_control_name="3+0",
        initial_time_ms=180_000,
        increment_ms=0,
        status="finished",
        tournament_type="arena",
        entry_fee_cents=0,
        current_round=1,
        total_rounds=1,
        created_at=now,
        started_at=datetime(2023, 9, 2, 16, 59, tzinfo=timezone.utc),
        finished_at=datetime(2023, 9, 23, 21, 13, tzinfo=timezone.utc),
    )


def _game_from_pgn(pgn: str, players: dict[str, UserModel], source_url: str, index: int) -> tuple[GameModel | None, str, str]:
    parsed = chess.pgn.read_game(StringIO(pgn))
    if parsed is None:
        return None, "", ""
    headers = parsed.headers
    white_username = str(headers.get("White", "")).strip()
    black_username = str(headers.get("Black", "")).strip()
    white = players.get(white_username) or players.get(white_username.lower())
    black = players.get(black_username) or players.get(black_username.lower())
    if white is None or black is None:
        return None, "", ""

    initial_time_ms, increment_ms, time_control_name = _time_control(headers.get("TimeControl", "180"))
    board = parsed.board()
    moves: list[str] = []
    for move in parsed.mainline_moves():
        moves.append(move.uci())
        board.push(move)

    result = headers.get("Result")
    status, termination_reason = _status_from_headers(headers)
    speed = rating_speed_for_clock(initial_time_ms, increment_ms)
    white_before = _header_int(headers, "WhiteElo", rating_for_user(white, speed))
    black_before = _header_int(headers, "BlackElo", rating_for_user(black, speed))
    white_after, black_after = _rating_after(result, white_before, black_before)
    started_at = _datetime_from_headers(headers, "UTCDate", "UTCTime")
    ended_at = _datetime_from_headers(headers, "EndDate", "EndTime") or started_at

    game = GameModel(
        id=_stable_id(f"game:{source_url}"),
        white_id=white.id,
        black_id=black.id,
        time_control_name=time_control_name,
        initial_time_ms=initial_time_ms,
        increment_ms=increment_ms,
        white_time_ms=0,
        black_time_ms=0,
        rated=True,
        white_rating_before=white_before,
        black_rating_before=black_before,
        white_rating_after=white_after,
        black_rating_after=black_after,
        status=status,
        result=result,
        fen=board.fen(),
        pgn=pgn,
        started_at=started_at,
        ended_at=ended_at,
        termination_reason=termination_reason,
        rating_applied_at=ended_at,
    )
    game._seed_moves = moves
    return game, white_username.lower(), black_username.lower()


def _add_moves(session, game: GameModel) -> None:
    board = chess.Board()
    for index, uci in enumerate(getattr(game, "_seed_moves", []), start=1):
        move = chess.Move.from_uci(uci)
        board.push(move)
        session.add(
            MoveModel(
                game_id=game.id,
                user_id=game.white_id if index % 2 == 1 else game.black_id,
                uci=uci,
                fen_after=board.fen(),
                move_number=index,
                created_at=game.started_at,
            )
        )


def _time_control(value: str) -> tuple[int, int, str]:
    initial, _, increment = value.partition("+")
    initial_seconds = int(initial) if initial.isdigit() else 180
    increment_seconds = int(increment) if increment.isdigit() else 0
    name = f"{max(1, initial_seconds // 60)}+{increment_seconds}"
    return initial_seconds * 1000, increment_seconds * 1000, name


def _header_int(headers, key: str, default: int) -> int:
    try:
        return int(headers.get(key, default))
    except (TypeError, ValueError):
        return default


def _datetime_from_headers(headers, date_key: str, time_key: str) -> datetime:
    try:
        return datetime.strptime(f"{headers.get(date_key)} {headers.get(time_key)}", "%Y.%m.%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return datetime.now(timezone.utc)


def _status_from_headers(headers) -> tuple[str, str]:
    termination = str(headers.get("Termination", "")).lower()
    if "time" in termination:
        return "timeout", "clock_timeout"
    if "resignation" in termination or "resigned" in termination:
        return "resigned", "resignation"
    if headers.get("Result") == "1/2-1/2":
        return "draw", "draw"
    return "checkmate", "checkmate"


def _rating_after(result: str | None, white_before: int, black_before: int) -> tuple[int | None, int | None]:
    if result == "1-0":
        return white_before + 8, black_before - 8
    if result == "0-1":
        return white_before - 8, black_before + 8
    if result == "1/2-1/2":
        return white_before, black_before
    return None, None
