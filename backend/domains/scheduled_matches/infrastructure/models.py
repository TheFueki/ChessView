"""Scheduled match ORM models."""

from datetime import datetime
import uuid

from sqlalchemy import JSON, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.database import Base
from infrastructure.orm import created_at_column, utc_timestamp_column, uuid_primary_key, uuid_reference


class ScheduledMatchModel(Base):
    __tablename__ = "scheduled_matches"

    id: Mapped[uuid.UUID] = uuid_primary_key()
    tournament_id: Mapped[uuid.UUID | None] = uuid_reference("tournaments.id", nullable=True)
    round_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pairing_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    white_player_id: Mapped[uuid.UUID | None] = uuid_reference("users.id", nullable=True)
    black_player_id: Mapped[uuid.UUID | None] = uuid_reference("users.id", nullable=True)
    creator_user_id: Mapped[uuid.UUID] = uuid_reference("users.id")
    invited_user_id: Mapped[uuid.UUID | None] = uuid_reference("users.id", nullable=True)
    starts_at: Mapped[datetime] = utc_timestamp_column()
    expires_at: Mapped[datetime | None] = utc_timestamp_column(nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    game_id: Mapped[uuid.UUID | None] = uuid_reference("games.id", nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime | None] = utc_timestamp_column(nullable=True)
