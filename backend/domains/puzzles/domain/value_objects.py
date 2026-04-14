"""Puzzle domain value objects."""

from enum import StrEnum


class PuzzleAttemptResult(StrEnum):
    SOLVED = "solved"
    FAILED = "failed"
