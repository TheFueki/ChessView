"""SQLAlchemy models for tournaments."""

from datetime import datetime
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.database import Base
from infrastructure.orm import created_at_column, utc_timestamp_column, uuid_primary_key, uuid_reference

if TYPE_CHECKING:
    from domains.game.infrastructure.models import GameModel


TIME_CONTROL_NAME_LENGTH = 20
TOURNAMENT_NAME_LENGTH = 120
TOURNAMENT_STATUS_LENGTH = 20
PAIRING_RESULT_LENGTH = 10


class TournamentModel(Base):
    __tablename__ = "tournaments"

    id: Mapped[uuid.UUID] = uuid_primary_key()
    owner_id: Mapped[uuid.UUID] = uuid_reference("users.id")
    name: Mapped[str] = mapped_column(String(TOURNAMENT_NAME_LENGTH), nullable=False)
    time_control_name: Mapped[str] = mapped_column(String(TIME_CONTROL_NAME_LENGTH), nullable=False)
    initial_time_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    increment_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(TOURNAMENT_STATUS_LENGTH), nullable=False)
    current_round: Mapped[int] = mapped_column(Integer, nullable=False)
    total_rounds: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = created_at_column()
    started_at: Mapped[datetime | None] = utc_timestamp_column(nullable=True)
    finished_at: Mapped[datetime | None] = utc_timestamp_column(nullable=True)

    players: Mapped[list["TournamentPlayerModel"]] = relationship(
        "TournamentPlayerModel",
        back_populates="tournament",
        order_by="TournamentPlayerModel.joined_at",
    )
    rounds: Mapped[list["TournamentRoundModel"]] = relationship(
        "TournamentRoundModel",
        back_populates="tournament",
        order_by="TournamentRoundModel.round_number",
    )
    pairings: Mapped[list["TournamentPairingModel"]] = relationship(
        "TournamentPairingModel",
        back_populates="tournament",
        order_by=lambda: (TournamentPairingModel.round_number, TournamentPairingModel.id),
    )


class TournamentPlayerModel(Base):
    __tablename__ = "tournament_players"

    tournament_id: Mapped[uuid.UUID] = uuid_reference("tournaments.id", primary_key=True)
    user_id: Mapped[uuid.UUID] = uuid_reference("users.id", primary_key=True)
    seed_rating: Mapped[int] = mapped_column(Integer, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    joined_at: Mapped[datetime] = created_at_column()

    tournament: Mapped[TournamentModel] = relationship("TournamentModel", back_populates="players")


class TournamentRoundModel(Base):
    __tablename__ = "tournament_rounds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tournament_id: Mapped[uuid.UUID] = uuid_reference("tournaments.id")
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = created_at_column()

    tournament: Mapped[TournamentModel] = relationship("TournamentModel", back_populates="rounds")


class TournamentPairingModel(Base):
    __tablename__ = "tournament_pairings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tournament_id: Mapped[uuid.UUID] = uuid_reference("tournaments.id")
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)
    white_id: Mapped[uuid.UUID] = uuid_reference("users.id")
    black_id: Mapped[uuid.UUID | None] = uuid_reference("users.id", nullable=True)
    game_id: Mapped[uuid.UUID | None] = uuid_reference("games.id", nullable=True, unique=True)
    result: Mapped[str | None] = mapped_column(String(PAIRING_RESULT_LENGTH), nullable=True)
    created_at: Mapped[datetime] = created_at_column()

    tournament: Mapped[TournamentModel] = relationship("TournamentModel", back_populates="pairings")
    game: Mapped["GameModel | None"] = relationship("GameModel")
