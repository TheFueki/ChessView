"""SQLAlchemy models for clubs."""

from datetime import datetime
import uuid

from sqlalchemy import Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.database import Base
from infrastructure.orm import created_at_column, utc_timestamp_column, uuid_primary_key, uuid_reference


CLUB_NAME_LENGTH = 80
CLUB_SLUG_LENGTH = 100
CLUB_DESCRIPTION_LENGTH = 500
CLUB_VISIBILITY_LENGTH = 20
CLUB_ROLE_LENGTH = 20


class ClubModel(Base):
    __tablename__ = "clubs"
    __table_args__ = (
        Index("ix_clubs_owner_id", "owner_id"),
        Index("ix_clubs_visibility", "visibility"),
    )

    id: Mapped[uuid.UUID] = uuid_primary_key()
    name: Mapped[str] = mapped_column(String(CLUB_NAME_LENGTH), nullable=False)
    slug: Mapped[str] = mapped_column(String(CLUB_SLUG_LENGTH), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(CLUB_DESCRIPTION_LENGTH), nullable=False, default="")
    visibility: Mapped[str] = mapped_column(String(CLUB_VISIBILITY_LENGTH), nullable=False, default="public")
    owner_id: Mapped[uuid.UUID] = uuid_reference("users.id")
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime | None] = utc_timestamp_column(nullable=True)

    members: Mapped[list["ClubMemberModel"]] = relationship(
        "ClubMemberModel",
        back_populates="club",
        order_by="ClubMemberModel.joined_at",
    )


class ClubMemberModel(Base):
    __tablename__ = "club_members"
    __table_args__ = (
        UniqueConstraint("club_id", "user_id", name="uq_club_members_club_user"),
        Index("ix_club_members_club_id", "club_id"),
        Index("ix_club_members_user_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    club_id: Mapped[uuid.UUID] = uuid_reference("clubs.id")
    user_id: Mapped[uuid.UUID] = uuid_reference("users.id")
    role: Mapped[str] = mapped_column(String(CLUB_ROLE_LENGTH), nullable=False, default="member")
    joined_at: Mapped[datetime] = created_at_column()

    club: Mapped[ClubModel] = relationship("ClubModel", back_populates="members")
