from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from domains.admin.infrastructure.models import AdminAuditLogModel
from domains.admin.presentation import router as admin_router
from domains.identity.domain.exceptions import (
    DuplicateEmail,
    InvalidCredentials,
    UserNotFound,
)
from domains.identity.infrastructure.models import UserModel
from domains.identity.presentation import router as identity_router
from domains.profiles.presentation import router as profiles_router
from domains.puzzles.application.services import PuzzleOverview
from domains.puzzles.domain.entities import Puzzle, PuzzleAttemptState
from domains.puzzles.domain.exceptions import PuzzleNotFound
from domains.puzzles.domain.value_objects import PuzzleAttemptResult
from domains.puzzles.presentation import router as puzzles_router
from tests.support.api import MemorySession, app_with_router


def _user_payload(user_id: UUID) -> SimpleNamespace:
    return SimpleNamespace(
        id=user_id,
        username="alice",
        email="alice@example.com",
        rating=1510,
        role="user",
        banned_at=None,
        bio="sharp player",
        avatar_path="alice.png",
        created_at=datetime(2026, 6, 10, tzinfo=timezone.utc),
    )


def _profile_payload(profile_id: UUID, username: str = "alice") -> SimpleNamespace:
    return SimpleNamespace(
        id=profile_id,
        username=username,
        rating=1510,
        avatar_url="/media/avatars/alice.png",
        created_at=datetime(2026, 6, 10, tzinfo=timezone.utc),
        games_played=12,
        wins=7,
        losses=3,
        draws=2,
        win_rate=58.3,
        ratings={"bullet": 1400, "blitz": 1510, "rapid": 1600},
        global_rank=4,
        coins=2100,
        recent_games=[],
    )


def test_identity_router_auth_profile_and_avatar_validation(monkeypatch, tmp_path):
    user_id = uuid4()

    class IdentityService:
        def __init__(self) -> None:
            self.updated_avatar_path = None

        async def register(self, command):
            assert command.username == "alice"
            return {
                "access_token": "access-token",
                "refresh_token": "refresh-token",
                "token_type": "bearer",
                "user": identity_router._serialize_user_profile(_user_payload(user_id)).model_dump(mode="json"),
            }

        async def login(self, command):
            assert command.email == "alice@example.com"
            return {
                "access_token": "access-token",
                "refresh_token": "refresh-token",
                "token_type": "bearer",
                "user": identity_router._serialize_user_profile(_user_payload(user_id)).model_dump(mode="json"),
            }

        async def refresh(self, command):
            assert command.refresh_token == "refresh-token"
            return {
                "access_token": "new-access-token",
                "refresh_token": "new-refresh-token",
                "token_type": "bearer",
            }

        async def get_profile(self, requested_user_id):
            assert requested_user_id == user_id
            return _user_payload(user_id)

        async def update_profile(self, command):
            assert command.user_id == user_id
            assert command.username == "alice2"
            user = _user_payload(user_id)
            user.username = "alice2"
            user.bio = "new bio"
            return user

        async def update_avatar(self, requested_user_id, avatar_path):
            assert requested_user_id == user_id
            self.updated_avatar_path = avatar_path
            user = _user_payload(user_id)
            user.avatar_path = avatar_path
            return user

    service = IdentityService()
    monkeypatch.setattr(identity_router, "_build_service", lambda _session: service)
    monkeypatch.setattr(identity_router, "AVATAR_STORAGE_DIR", tmp_path)

    client = TestClient(
        app_with_router(
            identity_router.router,
            prefix="/api/v1/identity",
            user_id=str(user_id),
            session=object(),
        )
    )

    assert client.post(
        "/api/v1/identity/register",
        json={"username": "alice", "email": "alice@example.com", "password": "secret1"},
    ).status_code == 201
    assert client.post(
        "/api/v1/identity/login",
        json={"email": "alice@example.com", "password": "secret1"},
    ).json()["user"]["role"] == "user"
    assert client.post(
        "/api/v1/identity/refresh",
        json={"refresh_token": "refresh-token"},
    ).json()["access_token"] == "new-access-token"
    assert client.get("/api/v1/identity/me").json()["avatar_url"] == "/media/avatars/alice.png"
    assert client.put(
        "/api/v1/identity/profile",
        json={"username": "alice2", "bio": "new bio"},
    ).json()["username"] == "alice2"

    assert client.post(
        "/api/v1/identity/register",
        json={"username": "al", "email": "not-email", "password": "tiny"},
    ).status_code == 422
    assert client.post(
        "/api/v1/identity/me/avatar",
        files={"file": ("avatar.txt", b"plain text", "text/plain")},
    ).status_code == 400
    assert client.post(
        "/api/v1/identity/me/avatar",
        files={"file": ("avatar.png", b"x" * (identity_router.MAX_AVATAR_SIZE_BYTES + 1), "image/png")},
    ).status_code == 400
    uploaded = client.post(
        "/api/v1/identity/me/avatar",
        files={"file": ("avatar.webp", b"image-bytes", "image/webp")},
    )
    assert uploaded.status_code == 200
    assert uploaded.json()["avatar_url"].startswith("/media/avatars/")
    assert service.updated_avatar_path is not None
    assert (tmp_path / service.updated_avatar_path).read_bytes() == b"image-bytes"


def test_identity_router_maps_service_auth_errors(monkeypatch):
    class IdentityService:
        async def register(self, _command):
            raise DuplicateEmail()

        async def login(self, _command):
            raise InvalidCredentials()

        async def refresh(self, _command):
            raise InvalidCredentials()

        async def get_profile(self, _user_id):
            raise UserNotFound()

    monkeypatch.setattr(identity_router, "_build_service", lambda _session: IdentityService())
    client = TestClient(
        app_with_router(
            identity_router.router,
            prefix="/api/v1/identity",
            user_id=str(uuid4()),
            session=object(),
        )
    )

    assert client.post(
        "/api/v1/identity/register",
        json={"username": "alice", "email": "alice@example.com", "password": "secret1"},
    ).status_code == 409
    assert client.post(
        "/api/v1/identity/login",
        json={"email": "alice@example.com", "password": "bad"},
    ).status_code == 401
    assert client.post(
        "/api/v1/identity/refresh",
        json={"refresh_token": "expired"},
    ).status_code == 401
    assert client.get("/api/v1/identity/me").status_code == 404


def test_profiles_router_leaderboard_search_and_head_to_head(monkeypatch):
    user_id = uuid4()
    opponent_id = uuid4()

    class ProfileService:
        async def get_top_players(self, limit, category):
            assert limit == 2
            assert str(category) == "blitz"
            return [_profile_payload(user_id)]

        async def search_players(self, query, limit):
            assert query == "alice"
            assert limit == 3
            return [
                SimpleNamespace(
                    id=user_id,
                    username="alice",
                    avatar_url="/media/avatars/alice.png",
                    ratings={"blitz": 1510, "classical": 1700},
                )
            ]

        async def get_profile(self, requested_user_id, recent_game_limit):
            assert requested_user_id == user_id
            assert recent_game_limit == 2
            return _profile_payload(user_id)

    class HeadToHeadService:
        def __init__(self, _session) -> None:
            pass

        async def get(self, requested_user_id, requested_opponent_id):
            assert requested_user_id == user_id
            assert requested_opponent_id == opponent_id
            return {
                "user_id": str(user_id),
                "opponent_id": str(opponent_id),
                "total_games": 3,
                "wins": 1,
                "draws": 1,
                "losses": 1,
                "white_games": 2,
                "white_wins": 1,
                "white_draws": 0,
                "white_losses": 1,
                "black_games": 1,
                "black_wins": 0,
                "black_draws": 1,
                "black_losses": 0,
                "average_moves": 32.0,
                "tournament_breakdown": [],
                "recent_games": [],
            }

    monkeypatch.setattr(profiles_router, "_build_service", lambda _session: ProfileService())
    monkeypatch.setattr(profiles_router, "HeadToHeadService", HeadToHeadService)
    client = TestClient(
        app_with_router(profiles_router.router, prefix="/api/v1/profiles", session=object())
    )

    leaderboard = client.get("/api/v1/profiles/leaderboard?limit=2&speed=blitz")
    assert leaderboard.status_code == 200
    assert leaderboard.json()[0]["ratings"] == {"bullet": 1400, "blitz": 1510, "rapid": 1600}

    search = client.get("/api/v1/profiles/search?query=alice&limit=3")
    assert search.status_code == 200
    assert search.json()[0]["ratings"] == {"blitz": 1510}

    profile = client.get(f"/api/v1/profiles/{user_id}?recent_games=2")
    assert profile.status_code == 200
    assert profile.json()["coins"] == 2100

    h2h = client.get(f"/api/v1/profiles/{user_id}/head-to-head/{opponent_id}")
    assert h2h.status_code == 200
    assert h2h.json()["average_moves"] == 32.0


def test_puzzles_router_lists_details_attempts_and_maps_missing_to_404(monkeypatch):
    user_id = uuid4()
    puzzle = Puzzle(
        fen="6k1/5Q2/6K1/8/8/8/8/8 w - - 0 1",
        solution_moves=["f7g7"],
        rating=600,
        themes=["mate-in-one"],
    )
    attempt = PuzzleAttemptState(
        puzzle_id=puzzle.id,
        user_id=user_id,
        attempts_count=1,
        solved=False,
        last_result=PuzzleAttemptResult.FAILED,
        last_attempted_at=datetime(2026, 6, 10, tzinfo=timezone.utc),
    )

    class PuzzleService:
        async def list_puzzles(self, requested_user_id, page, size):
            assert requested_user_id == user_id
            assert (page, size) == (2, 5)
            return [PuzzleOverview(puzzle, attempt)], 11

        async def get_random_puzzle(self, requested_user_id, exclude_id=None):
            assert requested_user_id == user_id
            assert exclude_id == puzzle.id
            return PuzzleOverview(puzzle, None)

        async def get_puzzle(self, _requested_user_id, puzzle_id):
            if puzzle_id != puzzle.id:
                raise PuzzleNotFound()
            return PuzzleOverview(puzzle, attempt)

        async def record_attempt(self, requested_user_id, puzzle_id, result):
            assert requested_user_id == user_id
            assert puzzle_id == puzzle.id
            assert result == PuzzleAttemptResult.SOLVED
            attempt.record(result, datetime(2026, 6, 10, tzinfo=timezone.utc))
            return attempt

    monkeypatch.setattr(puzzles_router, "_build_service", lambda _session: PuzzleService())
    client = TestClient(
        app_with_router(
            puzzles_router.router,
            prefix="/api/v1/puzzles",
            user_id=str(user_id),
            session=object(),
        ),
        raise_server_exceptions=False,
    )

    listed = client.get("/api/v1/puzzles?page=2&size=5")
    assert listed.status_code == 200
    assert listed.json()["items"][0]["attempt"]["last_result"] == "failed"

    random = client.get(f"/api/v1/puzzles/random?exclude_id={puzzle.id}")
    assert random.status_code == 200
    assert random.json()["solution_moves"] == ["f7g7"]

    detail = client.get(f"/api/v1/puzzles/{puzzle.id}")
    assert detail.status_code == 200
    assert detail.json()["attempt"]["attempts_count"] == 1

    recorded = client.post(f"/api/v1/puzzles/{puzzle.id}/attempts", json={"result": "solved"})
    assert recorded.status_code == 200
    assert recorded.json()["solved"] is True

    invalid_attempt = client.post(f"/api/v1/puzzles/{puzzle.id}/attempts", json={"result": "partial"})
    assert invalid_attempt.status_code == 422

    missing = client.get(f"/api/v1/puzzles/{uuid4()}")
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Puzzle not found"


def test_admin_router_requires_admin_and_updates_user_roles():
    admin_id = uuid4()
    target_id = uuid4()
    session = MemorySession()
    session.store[(UserModel, target_id)] = UserModel(
        id=target_id,
        username="target",
        email="target@example.com",
        password="hashed",
        rating=1200,
        role="user",
        created_at=datetime(2026, 6, 10, tzinfo=timezone.utc),
    )

    unauthenticated = TestClient(
        app_with_router(admin_router.router, prefix="/api/v1/admin", session=session)
    )
    assert unauthenticated.post(
        f"/api/v1/admin/users/{target_id}/role", json={"role": "admin"}
    ).status_code == 401

    client = TestClient(
        app_with_router(
            admin_router.router,
            prefix="/api/v1/admin",
            session=session,
            admin_id=str(admin_id),
        )
    )
    invalid = client.post(f"/api/v1/admin/users/{target_id}/role", json={"role": "owner"})
    assert invalid.status_code == 422

    response = client.post(f"/api/v1/admin/users/{target_id}/role", json={"role": "admin"})
    assert response.status_code == 200
    assert response.json()["role"] == "admin"
    assert session.store[(UserModel, target_id)].role == "admin"
    audit = next(item for item in session.added if isinstance(item, AdminAuditLogModel))
    assert audit.action == "user.role"
    assert audit.payload == {"role": "admin"}


def test_admin_router_refund_endpoint_audits_payment_refunds(monkeypatch):
    admin_id = uuid4()
    payment_id = uuid4()
    user_id = uuid4()
    session = MemorySession()

    class PaymentService:
        def __init__(self, provided_session) -> None:
            assert provided_session is session

        async def simulate(self, requested_payment_id, scenario):
            assert requested_payment_id == payment_id
            assert scenario == "refunded"
            return SimpleNamespace(
                id=payment_id,
                user_id=user_id,
                tournament_id=None,
                scheduled_match_id=None,
                amount_cents=250,
                currency="CVC",
                status="refunded",
                scenario="refunded",
                reserved_until=None,
                metadata_json={"reason": "admin"},
                created_at=datetime(2026, 6, 10, tzinfo=timezone.utc),
                updated_at=datetime(2026, 6, 10, tzinfo=timezone.utc),
            )

        @staticmethod
        def to_response(payment):
            return {
                "id": payment.id,
                "user_id": payment.user_id,
                "tournament_id": payment.tournament_id,
                "scheduled_match_id": payment.scheduled_match_id,
                "subject_type": "wallet",
                "amount_cents": payment.amount_cents,
                "currency": payment.currency,
                "status": payment.status,
                "scenario": payment.scenario,
                "reserved_until": payment.reserved_until,
                "metadata": payment.metadata_json,
                "created_at": payment.created_at,
                "updated_at": payment.updated_at,
            }

    monkeypatch.setattr(admin_router, "PaymentService", PaymentService)
    client = TestClient(
        app_with_router(
            admin_router.router,
            prefix="/api/v1/admin",
            session=session,
            admin_id=str(admin_id),
        )
    )

    response = client.post(f"/api/v1/admin/payments/{payment_id}/refund")

    assert response.status_code == 200
    assert response.json()["status"] == "refunded"
    audit = next(item for item in session.added if isinstance(item, AdminAuditLogModel))
    assert audit.action == "payment.refund"
    assert audit.target_id == str(payment_id)
