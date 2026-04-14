"""SQLAlchemy models for puzzle storage."""

from datetime import datetime
import uuid

from sqlalchemy import Boolean, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.database import Base
from infrastructure.orm import created_at_column, utc_timestamp_column, uuid_primary_key, uuid_reference

ATTEMPT_RESULT_LENGTH = 20


class PuzzleModel(Base):
    __tablename__ = "puzzles"

    id: Mapped[uuid.UUID] = uuid_primary_key()
    fen: Mapped[str] = mapped_column(Text, nullable=False)
    solution_moves: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    themes: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    source_game_id: Mapped[uuid.UUID | None] = uuid_reference("games.id", nullable=True)
    created_at: Mapped[datetime] = created_at_column()


class PuzzleAttemptModel(Base):
    __tablename__ = "puzzle_attempts"

    puzzle_id: Mapped[uuid.UUID] = uuid_reference("puzzles.id", primary_key=True)
    user_id: Mapped[uuid.UUID] = uuid_reference("users.id", primary_key=True)
    attempts_count: Mapped[int] = mapped_column(Integer, nullable=False)
    solved: Mapped[bool] = mapped_column(Boolean, nullable=False)
    last_result: Mapped[str | None] = mapped_column(String(ATTEMPT_RESULT_LENGTH), nullable=True)
    last_attempted_at: Mapped[datetime | None] = utc_timestamp_column(nullable=True)
