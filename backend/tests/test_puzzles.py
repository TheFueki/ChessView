from dataclasses import replace
from uuid import uuid4

import chess
import pytest

from domains.puzzles.application.services import PuzzleService
from domains.puzzles.domain.entities import Puzzle, PuzzleAttemptState
from domains.puzzles.domain.value_objects import PuzzleAttemptResult
from domains.puzzles.infrastructure.seed import STARTER_PUZZLES


class InMemoryPuzzleRepository:
    def __init__(self, puzzles: list[Puzzle]) -> None:
        self.puzzles = {puzzle.id: puzzle for puzzle in puzzles}
        self.attempts: dict[tuple, PuzzleAttemptState] = {}

    async def list_puzzles(self, page: int = 1, size: int = 20):
        puzzles = list(self.puzzles.values())
        return puzzles[(page - 1) * size:(page - 1) * size + size], len(puzzles)

    async def get_puzzle(self, puzzle_id):
        return self.puzzles.get(puzzle_id)

    async def get_random_puzzle(self, *, exclude_id=None):
        puzzles = [puzzle for puzzle in self.puzzles.values() if puzzle.id != exclude_id]
        return puzzles[0] if puzzles else next(iter(self.puzzles.values()), None)

    async def get_attempt(self, user_id, puzzle_id):
        return self.attempts.get((user_id, puzzle_id))

    async def list_attempts(self, user_id, puzzle_ids):
        return {
            puzzle_id: self.attempts[(user_id, puzzle_id)]
            for puzzle_id in puzzle_ids
            if (user_id, puzzle_id) in self.attempts
        }

    async def save_attempt(self, attempt):
        snapshot = replace(attempt)
        self.attempts[(attempt.user_id, attempt.puzzle_id)] = snapshot
        return replace(snapshot)


def test_starter_puzzles_have_legal_solution_lines():
    for puzzle in STARTER_PUZZLES:
        board = chess.Board(puzzle.fen)
        for uci in puzzle.solution_moves:
            move = chess.Move.from_uci(uci)
            assert move in board.legal_moves, f"Illegal move {uci} for puzzle {puzzle.id}"
            board.push(move)


@pytest.mark.asyncio
async def test_record_attempt_tracks_failures_and_solves():
    puzzle = Puzzle(
        fen="6k1/5Q2/6K1/8/8/8/8/8 w - - 0 1",
        solution_moves=["f7g7"],
        rating=600,
        themes=["mate-in-one"],
    )
    user_id = uuid4()
    service = PuzzleService(InMemoryPuzzleRepository([puzzle]))

    failed = await service.record_attempt(user_id, puzzle.id, PuzzleAttemptResult.FAILED)
    solved = await service.record_attempt(user_id, puzzle.id, PuzzleAttemptResult.SOLVED)

    assert failed.attempts_count == 1
    assert failed.solved is False
    assert failed.last_result == PuzzleAttemptResult.FAILED
    assert solved.attempts_count == 2
    assert solved.solved is True
    assert solved.last_result == PuzzleAttemptResult.SOLVED
