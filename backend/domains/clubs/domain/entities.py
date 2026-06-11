"""Club domain entities."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4


def _now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class Club:
    name: str
    slug: str
    description: str
    visibility: str
    owner_id: UUID
    id: UUID = field(default_factory=uuid4)
    created_at: datetime = field(default_factory=_now)
    updated_at: datetime | None = None


@dataclass
class ClubMember:
    club_id: UUID
    user_id: UUID
    role: str = "member"
    id: int | None = None
    joined_at: datetime = field(default_factory=_now)


@dataclass
class ClubOwnerView:
    id: UUID
    username: str
    rating: int
    avatar_url: str | None = None


@dataclass
class ClubView:
    id: UUID
    name: str
    slug: str
    description: str
    visibility: str
    owner_id: UUID
    owner: ClubOwnerView | None
    member_count: int
    viewer_is_member: bool
    viewer_role: str | None
    created_at: datetime
    updated_at: datetime | None = None
