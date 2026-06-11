from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from tests.support.api import app_with_router


class InMemoryClubRepository:
    def __init__(self) -> None:
        self.clubs = {}
        self.members = {}
        self.next_member_id = 1

    async def create_club(self, club):
        self.clubs[club.id] = club
        self.members[club.id] = {}
        return club

    async def get_club(self, club_id):
        return self.clubs.get(club_id)

    async def get_club_by_slug(self, slug):
        return next((club for club in self.clubs.values() if club.slug == slug), None)

    async def list_clubs(self, query=None):
        clubs = list(self.clubs.values())
        if query:
            needle = query.lower()
            clubs = [
                club
                for club in clubs
                if needle in club.name.lower() or needle in club.description.lower()
            ]
        return clubs

    async def update_club(self, club):
        self.clubs[club.id] = club
        return club

    async def add_member(self, member):
        member.id = self.next_member_id
        self.next_member_id += 1
        self.members[member.club_id][member.user_id] = member
        return member

    async def get_member(self, club_id, user_id):
        return self.members.get(club_id, {}).get(user_id)

    async def list_members(self, club_id):
        return list(self.members.get(club_id, {}).values())

    async def remove_member(self, club_id, user_id):
        self.members.get(club_id, {}).pop(user_id, None)


class InMemoryUserDirectory:
    def __init__(self, users) -> None:
        self.users = {user.id: user for user in users}

    async def get_by_ids(self, user_ids):
        return {user_id: self.users[user_id] for user_id in user_ids if user_id in self.users}


def _user(user_id: UUID, username: str, rating: int = 1500):
    return SimpleNamespace(id=user_id, username=username, rating=rating, avatar_path=None)


@pytest.mark.asyncio
async def test_club_service_creates_owner_membership_and_searchable_summary():
    from domains.clubs.application.services import ClubService

    owner_id = uuid4()
    repo = InMemoryClubRepository()
    users = InMemoryUserDirectory([_user(owner_id, "owner", 1700)])
    service = ClubService(repo, users)

    club = await service.create_club(
        owner_id,
        name="Night Knights",
        description="Late blitz study group",
        visibility="public",
    )
    listed = await service.list_clubs(owner_id, query="blitz")

    assert club.name == "Night Knights"
    assert club.slug == "night-knights"
    assert club.member_count == 1
    assert club.viewer_is_member is True
    assert club.viewer_role == "owner"
    assert listed == [club]
    owner_member = await repo.get_member(club.id, owner_id)
    assert owner_member.role == "owner"


@pytest.mark.asyncio
async def test_club_service_join_leave_and_private_access_rules():
    from domains.clubs.application.services import ClubService

    owner_id = uuid4()
    guest_id = uuid4()
    repo = InMemoryClubRepository()
    users = InMemoryUserDirectory([_user(owner_id, "owner"), _user(guest_id, "guest")])
    service = ClubService(repo, users)
    public_club = await service.create_club(owner_id, name="Open Club", description="", visibility="public")
    private_club = await service.create_club(owner_id, name="Invite Room", description="", visibility="private")

    joined = await service.join_club(public_club.id, guest_id)
    assert joined.member_count == 2
    assert joined.viewer_is_member is True
    assert joined.viewer_role == "member"

    with pytest.raises(HTTPException) as duplicate:
        await service.join_club(public_club.id, guest_id)
    assert duplicate.value.status_code == 409

    left = await service.leave_club(public_club.id, guest_id)
    assert left.member_count == 1
    assert left.viewer_is_member is False

    with pytest.raises(HTTPException) as private_join:
        await service.join_club(private_club.id, guest_id)
    assert private_join.value.status_code == 403

    with pytest.raises(HTTPException) as owner_leave:
        await service.leave_club(public_club.id, owner_id)
    assert owner_leave.value.status_code == 400


@pytest.mark.asyncio
async def test_club_service_allows_only_owner_to_edit_club():
    from domains.clubs.application.services import ClubService

    owner_id = uuid4()
    guest_id = uuid4()
    repo = InMemoryClubRepository()
    users = InMemoryUserDirectory([_user(owner_id, "owner"), _user(guest_id, "guest")])
    service = ClubService(repo, users)
    club = await service.create_club(owner_id, name="Study Hall", description="", visibility="public")

    with pytest.raises(HTTPException) as denied:
        await service.update_club(club.id, guest_id, description="takeover")
    assert denied.value.status_code == 403

    updated = await service.update_club(
        club.id,
        owner_id,
        description="Daily tactics and weekend arenas",
        visibility="private",
    )

    assert updated.description == "Daily tactics and weekend arenas"
    assert updated.visibility == "private"


def test_clubs_router_exposes_collection_detail_and_membership(monkeypatch):
    from domains.clubs.presentation import router as clubs_router

    owner_id = uuid4()
    club_id = uuid4()
    calls = []

    response = SimpleNamespace(
        id=club_id,
        name="Night Knights",
        slug="night-knights",
        description="Late blitz study group",
        visibility="public",
        owner_id=owner_id,
        owner=SimpleNamespace(id=owner_id, username="owner", rating=1700, avatar_url=None),
        member_count=1,
        viewer_is_member=True,
        viewer_role="owner",
        created_at=datetime(2026, 6, 11, tzinfo=timezone.utc),
        updated_at=None,
    )

    class ClubService:
        def __init__(self, *_args):
            pass

        async def list_clubs(self, viewer_id, query=None):
            calls.append(("list", viewer_id, query))
            return [response]

        async def create_club(self, viewer_id, **kwargs):
            calls.append(("create", viewer_id, kwargs))
            return response

        async def get_club(self, requested_club_id, viewer_id):
            calls.append(("detail", requested_club_id, viewer_id))
            return response

        async def update_club(self, requested_club_id, viewer_id, **kwargs):
            calls.append(("update", requested_club_id, viewer_id, kwargs))
            return response

        async def join_club(self, requested_club_id, viewer_id):
            calls.append(("join", requested_club_id, viewer_id))
            return response

        async def leave_club(self, requested_club_id, viewer_id):
            calls.append(("leave", requested_club_id, viewer_id))
            return response

    monkeypatch.setattr(clubs_router, "ClubService", ClubService)
    client = TestClient(
        app_with_router(
            clubs_router.router,
            prefix="/api/v1/clubs",
            user_id=str(owner_id),
            session=object(),
        )
    )

    assert client.get("/api/v1/clubs?query=night").json()[0]["slug"] == "night-knights"
    assert client.post(
        "/api/v1/clubs",
        json={"name": "Night Knights", "description": "Late blitz study group", "visibility": "public"},
    ).status_code == 201
    assert client.get(f"/api/v1/clubs/{club_id}").json()["viewer_role"] == "owner"
    assert client.patch(f"/api/v1/clubs/{club_id}", json={"visibility": "private"}).status_code == 200
    assert client.post(f"/api/v1/clubs/{club_id}/join").status_code == 200
    assert client.delete(f"/api/v1/clubs/{club_id}/join").status_code == 200
    assert [call[0] for call in calls] == ["list", "create", "detail", "update", "join", "leave"]
