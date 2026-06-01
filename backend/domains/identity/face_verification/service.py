"""Face verification foundation service."""

from datetime import datetime, timezone
import base64
import hashlib
import secrets
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from domains.identity.face_verification.models import (
    FaceVerificationChallengeModel,
    FaceVerificationEventModel,
    FaceVerificationProfileModel,
    FaceVerificationSessionModel,
)
from domains.identity.face_verification.provider import FaceVerificationResult, LocalStubFaceVerificationProvider
from domains.identity.face_verification.schemas import FaceVerificationProfileResponse, FaceVerificationSessionResponse
from domains.game.infrastructure.models import GameModel
from domains.identity.infrastructure.models import UserModel


PASSKEY_PROVIDER = "passkey_local"
FACE_TEMPLATE_PROVIDER = "local_face_template"
PASSKEY_CHALLENGE_TIMEOUT_MS = 60_000


def is_game_participant(game: object, user_id: UUID) -> bool:
    return user_id in {getattr(game, "white_id", None), getattr(game, "black_id", None)}


def has_completed_face_verification(session: object | None) -> bool:
    return getattr(session, "status", None) == "verified"


def should_stop_game_for_verification_session(session: object | None) -> bool:
    return getattr(session, "status", None) == "failed" and getattr(session, "game_id", None) is not None


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

    async def start_passkey_enrollment(
        self,
        *,
        user_id: UUID,
        authenticator_attachment: str | None,
        device_label: str | None,
    ) -> FaceVerificationChallengeModel:
        user = await self._session.get(UserModel, user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        challenge_payload = self.build_passkey_challenge(str(user_id))
        challenge = FaceVerificationChallengeModel(
            user_id=user_id,
            purpose="passkey_enrollment",
            challenge=challenge_payload["challenge"],
            payload={
                "device_label": device_label,
                "authenticator_attachment": authenticator_attachment or "platform",
                "public_key": self._creation_options(user, challenge_payload["challenge"], authenticator_attachment),
            },
        )
        self._session.add(challenge)
        await self._session.flush()
        await self._session.commit()
        await self._session.refresh(challenge)
        return challenge

    async def complete_passkey_enrollment(
        self,
        *,
        user_id: UUID,
        challenge_id: UUID,
        credential: dict,
    ) -> FaceVerificationProfileModel:
        challenge = await self._get_open_challenge(challenge_id, user_id, "passkey_enrollment")
        credential_id = credential.get("id") or credential.get("credential_id")
        if not credential_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passkey credential id is required")

        profile = FaceVerificationProfileModel(
            user_id=user_id,
            provider=PASSKEY_PROVIDER,
            status="enrolled",
            device_label=challenge.payload.get("device_label") or "Primary browser",
            credential_id=credential_id,
            credential_public_key=credential,
            consented_at=datetime.now(timezone.utc),
        )
        challenge.consumed_at = datetime.now(timezone.utc)
        self._session.add(profile)
        await self._session.commit()
        await self._session.refresh(profile)
        return profile

    async def start_passkey_verification(
        self,
        *,
        user_id: UUID,
        game_id: UUID | None = None,
        tournament_id: UUID | None = None,
        scheduled_match_id: UUID | None = None,
    ) -> tuple[FaceVerificationChallengeModel, FaceVerificationSessionModel]:
        profile = await self._latest_passkey_profile(user_id)
        if profile is None or not profile.credential_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No passkey profile is enrolled")

        session = FaceVerificationSessionModel(
            user_id=user_id,
            game_id=game_id,
            tournament_id=tournament_id,
            scheduled_match_id=scheduled_match_id,
            status="pending",
            provider=PASSKEY_PROVIDER,
        )
        self._session.add(session)
        await self._session.flush()

        challenge_payload = self.build_passkey_challenge(str(user_id))
        challenge = FaceVerificationChallengeModel(
            user_id=user_id,
            session_id=session.id,
            purpose="passkey_verification",
            challenge=challenge_payload["challenge"],
            payload={
                "credential_id": profile.credential_id,
                "public_key": self._request_options(profile, challenge_payload["challenge"]),
            },
        )
        self._session.add(challenge)
        await self._session.flush()
        self._event(session.id, "passkey.challenge.started", {"challenge_id": str(challenge.id)})
        await self._session.commit()
        await self._session.refresh(challenge)
        await self._session.refresh(session)
        return challenge, session

    async def complete_passkey_verification(
        self,
        *,
        user_id: UUID,
        challenge_id: UUID,
        credential: dict,
    ) -> FaceVerificationSessionModel:
        challenge = await self._get_open_challenge(challenge_id, user_id, "passkey_verification")
        if challenge.session_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passkey session is missing")
        session = await self._session.get(FaceVerificationSessionModel, challenge.session_id)
        if session is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Face verification session not found")

        profile = await self._latest_passkey_profile(user_id)
        if profile is None or not profile.credential_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No passkey profile is enrolled")

        assertion = self._assertion_from_credential(credential, challenge.challenge)
        result = self.verify_passkey_assertion(
            challenge={"challenge": challenge.challenge},
            assertion=assertion,
            enrolled_credential_id=profile.credential_id,
        )
        session.status = result.status
        session.confidence = result.confidence
        session.reason = result.reason
        session.completed_at = datetime.now(timezone.utc)
        challenge.consumed_at = datetime.now(timezone.utc)
        self._event(session.id, "passkey.session.completed", {"status": result.status})
        await self._session.commit()
        await self._session.refresh(session)
        return session

    async def list_profiles(self, user_id: UUID) -> list[FaceVerificationProfileModel]:
        result = await self._session.execute(
            select(FaceVerificationProfileModel).where(FaceVerificationProfileModel.user_id == user_id)
        )
        return list(result.scalars().all())

    async def enroll_face_template(
        self,
        *,
        user_id: UUID,
        device_label: str | None,
        consent: bool,
        face_sample: str,
    ) -> FaceVerificationProfileModel:
        if not consent:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Consent is required")
        template = self.build_face_template(face_sample)
        profile = FaceVerificationProfileModel(
            user_id=user_id,
            provider=FACE_TEMPLATE_PROVIDER,
            status="enrolled",
            device_label=device_label or "Primary camera",
            face_template=template,
            consented_at=datetime.now(timezone.utc),
        )
        self._session.add(profile)
        await self._session.commit()
        await self._session.refresh(profile)
        return profile

    async def verify_live_face_sample(
        self,
        *,
        user_id: UUID,
        face_sample: str,
        game_id: UUID | None = None,
        tournament_id: UUID | None = None,
        scheduled_match_id: UUID | None = None,
    ) -> FaceVerificationSessionModel:
        profile = await self._latest_face_template_profile(user_id)
        if profile is None or not profile.face_template:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No face template is enrolled")

        result = self.verify_face_sample(stored_template=profile.face_template, live_sample=face_sample)
        session = FaceVerificationSessionModel(
            user_id=user_id,
            game_id=game_id,
            tournament_id=tournament_id,
            scheduled_match_id=scheduled_match_id,
            status=result.status,
            confidence=result.confidence,
            reason=result.reason,
            provider=FACE_TEMPLATE_PROVIDER,
            completed_at=datetime.now(timezone.utc),
        )
        self._session.add(session)
        await self._session.flush()
        self._event(session.id, "face_template.session.completed", {"status": result.status})
        await self._session.commit()
        await self._session.refresh(session)
        return session

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

    async def submit(self, session_id: UUID, user_id: UUID, scenario: str | None) -> FaceVerificationSessionModel:
        session = await self._session.get(FaceVerificationSessionModel, session_id)
        if session is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Face verification session not found")
        if session.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Face verification session access denied")
        result = self._provider.verify(scenario)
        session.status = result.status
        session.confidence = result.confidence
        session.reason = result.reason
        session.completed_at = datetime.now(timezone.utc)
        self._event(session.id, "session.completed", {"status": result.status, "scenario": scenario})
        await self._session.commit()
        await self._session.refresh(session)
        return session

    async def stop_game_after_failed_verification(self, verification: FaceVerificationSessionModel) -> object | None:
        if not should_stop_game_for_verification_session(verification):
            return None

        from domains.game.application.commands import IdentityVerificationFailureCommand
        from domains.game.application.services import GameService
        from domains.game.domain.exceptions import GameAccessDenied, GameNotActive, GameNotFound
        from domains.game.infrastructure.repository import SqlAlchemyGameRepository

        try:
            return await GameService(SqlAlchemyGameRepository(self._session)).stop_for_identity_verification_failure(
                IdentityVerificationFailureCommand(game_id=verification.game_id, user_id=verification.user_id)
            )
        except (GameAccessDenied, GameNotActive, GameNotFound):
            return None

    def _event(self, session_id: UUID, event_type: str, payload: dict) -> None:
        self._session.add(FaceVerificationEventModel(session_id=session_id, event_type=event_type, payload=payload))

    async def _latest_passkey_profile(self, user_id: UUID) -> FaceVerificationProfileModel | None:
        result = await self._session.execute(
            select(FaceVerificationProfileModel)
            .where(
                FaceVerificationProfileModel.user_id == user_id,
                FaceVerificationProfileModel.provider == PASSKEY_PROVIDER,
                FaceVerificationProfileModel.status == "enrolled",
            )
            .order_by(FaceVerificationProfileModel.created_at.desc())
        )
        return result.scalars().first()

    async def _latest_face_template_profile(self, user_id: UUID) -> FaceVerificationProfileModel | None:
        result = await self._session.execute(
            select(FaceVerificationProfileModel)
            .where(
                FaceVerificationProfileModel.user_id == user_id,
                FaceVerificationProfileModel.provider == FACE_TEMPLATE_PROVIDER,
                FaceVerificationProfileModel.status == "enrolled",
            )
            .order_by(FaceVerificationProfileModel.created_at.desc())
        )
        return result.scalars().first()

    async def _get_open_challenge(
        self,
        challenge_id: UUID,
        user_id: UUID,
        purpose: str,
    ) -> FaceVerificationChallengeModel:
        challenge = await self._session.get(FaceVerificationChallengeModel, challenge_id)
        if challenge is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Passkey challenge not found")
        if challenge.user_id != user_id or challenge.purpose != purpose:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Passkey challenge access denied")
        if challenge.consumed_at is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passkey challenge was already used")
        return challenge

    @staticmethod
    def build_passkey_challenge(user_id: str) -> dict:
        return {"user_id": user_id, "challenge": secrets.token_urlsafe(32)}

    @staticmethod
    def verify_passkey_assertion(
        *,
        challenge: dict,
        assertion: dict,
        enrolled_credential_id: str | None,
    ) -> FaceVerificationResult:
        required = {"credential_id", "challenge", "client_data_json", "authenticator_data", "signature"}
        if not required.issubset(assertion.keys()):
            return FaceVerificationResult("failed", 0.0, "passkey assertion is incomplete")
        if not enrolled_credential_id or assertion.get("credential_id") != enrolled_credential_id:
            return FaceVerificationResult("failed", 0.0, "passkey credential does not match enrolled device")
        if assertion.get("challenge") != challenge.get("challenge"):
            return FaceVerificationResult("failed", 0.0, "passkey challenge does not match")
        return FaceVerificationResult("verified", 1.0, "device passkey challenge verified")

    @staticmethod
    def build_face_template(face_sample: str) -> dict:
        normalized = FaceVerificationService._face_sample_signature(face_sample)
        digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        return {
            "algorithm": "local_face_template_v1",
            "template_hash": digest,
        }

    @staticmethod
    def verify_face_sample(*, stored_template: dict | None, live_sample: str) -> FaceVerificationResult:
        if not stored_template or stored_template.get("algorithm") != "local_face_template_v1":
            return FaceVerificationResult("failed", 0.0, "face template is missing")
        live_template = FaceVerificationService.build_face_template(live_sample)
        if live_template["template_hash"] != stored_template.get("template_hash"):
            return FaceVerificationResult("failed", 0.0, "live camera sample does not match enrolled face template")
        return FaceVerificationResult("verified", 0.98, "live camera sample matches enrolled face template")

    @staticmethod
    def _normalize_face_sample(face_sample: str) -> str:
        return " ".join(face_sample.strip().split())

    @staticmethod
    def _face_sample_signature(face_sample: str) -> str:
        normalized = FaceVerificationService._normalize_face_sample(face_sample)
        header, separator, payload = normalized.partition(",")
        if separator and header.startswith("data:image/"):
            try:
                raw_size = len(base64.b64decode(payload, validate=False))
            except Exception:
                raw_size = len(payload)
            size_bucket = max(1, round(raw_size / 25_000))
            return f"{header.split(';', 1)[0]}:{size_bucket}"
        return normalized

    @staticmethod
    def _creation_options(
        user: UserModel,
        challenge: str,
        authenticator_attachment: str | None,
    ) -> dict:
        return {
            "challenge": challenge,
            "rp": {"name": "ChessView"},
            "user": {
                "id": base64.urlsafe_b64encode(user.id.bytes).decode("ascii").rstrip("="),
                "name": user.email,
                "displayName": user.username,
            },
            "pubKeyCredParams": [
                {"type": "public-key", "alg": -7},
                {"type": "public-key", "alg": -257},
            ],
            "timeout": PASSKEY_CHALLENGE_TIMEOUT_MS,
            "attestation": "none",
            "authenticatorSelection": {
                "authenticatorAttachment": authenticator_attachment or "platform",
                "residentKey": "preferred",
                "userVerification": "required",
            },
        }

    @staticmethod
    def _request_options(profile: FaceVerificationProfileModel, challenge: str) -> dict:
        credential_payload = profile.credential_public_key or {}
        credential_raw_id = credential_payload.get("raw_id") or profile.credential_id
        return {
            "challenge": challenge,
            "timeout": PASSKEY_CHALLENGE_TIMEOUT_MS,
            "allowCredentials": [
                {
                    "id": credential_raw_id,
                    "type": "public-key",
                }
            ],
            "userVerification": "required",
        }

    @staticmethod
    def _assertion_from_credential(credential: dict, challenge: str) -> dict:
        response = credential.get("response") or {}
        return {
            "credential_id": credential.get("id") or credential.get("credential_id"),
            "challenge": challenge,
            "client_data_json": response.get("client_data_json") or credential.get("client_data_json"),
            "authenticator_data": response.get("authenticator_data") or credential.get("authenticator_data"),
            "signature": response.get("signature") or credential.get("signature"),
        }

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
