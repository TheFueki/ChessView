"""Face verification ORM models."""

from datetime import datetime
import uuid

from sqlalchemy import Float, Index, JSON, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.database import Base
from infrastructure.orm import created_at_column, utc_timestamp_column, uuid_primary_key, uuid_reference


class FaceVerificationProfileModel(Base):
    __tablename__ = "face_verification_profiles"
    __table_args__ = (
        Index("ix_face_verification_profiles_user_id", "user_id"),
        Index(
            "uq_face_verification_profiles_fixed_face",
            "user_id",
            unique=True,
            postgresql_where=text("provider = 'local_face_template'"),
        ),
    )

    id: Mapped[uuid.UUID] = uuid_primary_key()
    user_id: Mapped[uuid.UUID] = uuid_reference("users.id")
    provider: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    device_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    credential_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    credential_public_key: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    face_template: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    consented_at: Mapped[datetime] = utc_timestamp_column()
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime | None] = utc_timestamp_column(nullable=True)


class FaceVerificationSessionModel(Base):
    __tablename__ = "face_verification_sessions"
    __table_args__ = (
        Index("ix_face_verification_sessions_user_id", "user_id"),
        Index("ix_face_verification_sessions_game_id", "game_id"),
        Index("ix_face_verification_sessions_scheduled_match_id", "scheduled_match_id"),
    )

    id: Mapped[uuid.UUID] = uuid_primary_key()
    user_id: Mapped[uuid.UUID] = uuid_reference("users.id")
    game_id: Mapped[uuid.UUID | None] = uuid_reference("games.id", nullable=True)
    tournament_id: Mapped[uuid.UUID | None] = uuid_reference("tournaments.id", nullable=True)
    scheduled_match_id: Mapped[uuid.UUID | None] = uuid_reference("scheduled_matches.id", nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    reason: Mapped[str | None] = mapped_column(String(240), nullable=True)
    provider: Mapped[str] = mapped_column(String(40), nullable=False)
    created_at: Mapped[datetime] = created_at_column()
    completed_at: Mapped[datetime | None] = utc_timestamp_column(nullable=True)

    events: Mapped[list["FaceVerificationEventModel"]] = relationship(
        "FaceVerificationEventModel",
        back_populates="session",
        order_by="FaceVerificationEventModel.created_at",
    )


class FaceVerificationEventModel(Base):
    __tablename__ = "face_verification_events"
    __table_args__ = (Index("ix_face_verification_events_session_id", "session_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[uuid.UUID] = uuid_reference("face_verification_sessions.id")
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = created_at_column()

    session: Mapped[FaceVerificationSessionModel] = relationship(
        "FaceVerificationSessionModel",
        back_populates="events",
    )


class FaceVerificationChallengeModel(Base):
    __tablename__ = "face_verification_challenges"

    id: Mapped[uuid.UUID] = uuid_primary_key()
    user_id: Mapped[uuid.UUID] = uuid_reference("users.id")
    session_id: Mapped[uuid.UUID | None] = uuid_reference("face_verification_sessions.id", nullable=True)
    purpose: Mapped[str] = mapped_column(String(40), nullable=False)
    challenge: Mapped[str] = mapped_column(String(255), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    consumed_at: Mapped[datetime | None] = utc_timestamp_column(nullable=True)
    created_at: Mapped[datetime] = created_at_column()
