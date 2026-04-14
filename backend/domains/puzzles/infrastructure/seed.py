"""Starter puzzle seed data for local development and v1 productization."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker

from domains.puzzles.infrastructure.models import PuzzleModel


@dataclass(frozen=True, slots=True)
class SeedPuzzle:
    id: UUID
    fen: str
    solution_moves: tuple[str, ...]
    rating: int
    themes: tuple[str, ...]
    source_game_id: UUID | None = None


STARTER_PUZZLES: tuple[SeedPuzzle, ...] = (
    SeedPuzzle(
        id=UUID("9f46679b-5b47-4a92-a6fb-2c99f8182b41"),
        fen="6k1/5Q2/6K1/8/8/8/8/8 w - - 0 1",
        solution_moves=("f7g7",),
        rating=600,
        themes=("mate-in-one", "queen", "endgame"),
    ),
    SeedPuzzle(
        id=UUID("388d8de0-f836-4a3b-8204-57aef808e87b"),
        fen="k7/2K5/8/8/8/8/8/1R6 w - - 0 1",
        solution_moves=("b1b8",),
        rating=650,
        themes=("mate-in-one", "rook", "ladder"),
    ),
    SeedPuzzle(
        id=UUID("bc89e5de-f78c-48ab-9fef-f89f69a1b125"),
        fen="k7/8/1QK5/8/8/8/8/8 w - - 0 1",
        solution_moves=("b6b7",),
        rating=700,
        themes=("mate-in-one", "queen", "box"),
    ),
    SeedPuzzle(
        id=UUID("86859168-71d8-4ff8-8227-f267ef0f5437"),
        fen="8/8/8/8/8/2K5/5Q2/2k5 w - - 0 1",
        solution_moves=("f2c2",),
        rating=750,
        themes=("mate-in-one", "queen", "endgame"),
    ),
    SeedPuzzle(
        id=UUID("f789a26f-ad3a-4f5f-90ba-b80e95d07146"),
        fen="7k/5K2/8/8/8/8/8/6R1 w - - 0 1",
        solution_moves=("g1g8",),
        rating=800,
        themes=("mate-in-one", "rook", "back-rank"),
    ),
)


async def seed_starter_puzzles(engine: AsyncEngine) -> None:
    """Insert a small starter puzzle catalog when the table is empty."""
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        existing_count = await session.scalar(select(func.count()).select_from(PuzzleModel)) or 0
        if existing_count:
            return

        session.add_all(
            [
                PuzzleModel(
                    id=puzzle.id,
                    fen=puzzle.fen,
                    solution_moves=list(puzzle.solution_moves),
                    rating=puzzle.rating,
                    themes=list(puzzle.themes),
                    source_game_id=puzzle.source_game_id,
                )
                for puzzle in STARTER_PUZZLES
            ]
        )
        await session.commit()
