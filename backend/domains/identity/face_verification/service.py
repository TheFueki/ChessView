"""Face verification foundation service."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from domains.identity.face_verification.models import (
    FaceVerificationEventModel,
    FaceVerificationProfileModel,
    FaceVerificationSessionModel,
)
from domains.identity.face_verification.provider import LocalStubFaceVerificationProvider
from domains.identity.face_verification.schemas import FaceVerificationProfileResponse, FaceVerificationSessionResponse
from domains.game.infrastructure.models import GameModel
from domains.identity.infrastructure.models import UserModel


def is_game_participant(game: object, user_id: UUID) -> bool:
    return user_id in {getattr(game, "white_id", None), getattr(game, "black_id", None)}


async def require_game_face_verification_access(session: AsyncSession, game_id: UUID, user_id: UUID) -> GameModel:
    game = await session.get(GameModel, game_id)
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found")
    if is_game_participant(game, user_id):
        return game
    user = await session.get(UserModel, user_id)
    if user is not None and user.role == "admin" and user.banned_at is None:
        return game
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Game access denied")


class FaceVerificationService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._provider = LocalStubFaceVerificationProvider()

    async def enroll(self, user_id: UUID, device_label: str | None, consent: bool) -> FaceVerificationProfileModel:
        if not consent:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Consent is required")
        profile = FaceVerificationProfileModel(
            user_id=user_id,
            provider=self._provider.name,
            status="enrolled",
            device_label=device_label,
            consented_at=datetime.now(timezone.utc),
        )
        self._session.add(profile)
        await self._session.commit()
        await self._session.refresh(profile)
        return profile

    async def list_profiles(self, user_id: UUID) -> list[FaceVerificationProfileModel]:
        result = await self._session.execute(
            select(FaceVerificationProfileModel).where(FaceVerificationProfileModel.user_id == user_id)
        )
        return list(result.scalars().all())

    async def start_session(
        self,
        *,
        user_id: UUID,
        game_id: UUID | None,
        tournament_id: UUID | None,
        scheduled_match_id: UUID | None,
    ) -> FaceVerificationSessionModel:
        session = FaceVerificationSessionModel(
            user_id=user_id,
            game_id=game_id,
            tournament_id=tournament_id,
            scheduled_match_id=scheduled_match_id,
            status="pending",
            provider=self._provider.name,
        )
        self._session.add(session)
        await self._session.flush()
        self._event(session.id, "session.started", {"provider": self._provider.name})
        await self._session.commit()
        await self._session.refresh(session)
        return session

    async def submit(self, session_id: UUID, scenario: str | None) -> FaceVerificationSessionModel:
        session = await self._session.get(FaceVerificationSessionModel, session_id)
        if session is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Face verification session not found")
        result = self._provider.verify(scenario)
        session.status = result.status
        session.confidence = result.confidence
        session.reason = result.reason
        session.completed_at = datetime.now(timezone.utc)
        self._event(session.id, "session.completed", {"status": result.status, "scenario": scenario})
        await self._session.commit()
        await self._session.refresh(session)
        return session

    def _event(self, session_id: UUID, event_type: str, payload: dict) -> None:
        self._session.add(FaceVerificationEventModel(session_id=session_id, event_type=event_type, payload=payload))

    @staticmethod
    def profile_response(profile: FaceVerificationProfileModel) -> FaceVerificationProfileResponse:
        return FaceVerificationProfileResponse(
            id=profile.id,
            user_id=profile.user_id,
            provider=profile.provider,
            status=profile.status,
            device_label=profile.device_label,
            consented_at=profile.consented_at,
            created_at=profile.created_at,
            updated_at=profile.updated_at,
        )

    @staticmethod
    def session_response(session: FaceVerificationSessionModel) -> FaceVerificationSessionResponse:
        return FaceVerificationSessionResponse(
            id=session.id,
            user_id=session.user_id,
            game_id=session.game_id,
            tournament_id=session.tournament_id,
            scheduled_match_id=session.scheduled_match_id,
            status=session.status,
            confidence=session.confidence,
            reason=session.reason,
            provider=session.provider,
            created_at=session.created_at,
            completed_at=session.completed_at,
        )
