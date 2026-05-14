import httpx
import logging
import aiofiles
import re
from pathlib import Path
from urllib.parse import urlencode, urlparse
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings 

from app.dependencies import get_current_user_id, get_db
from domains.identity.application.commands import (
    LoginUserCommand,
    RefreshTokenCommand,
    RegisterUserCommand,
    UpdateProfileCommand,
    OAuthUserCommand,
)
from domains.identity.application.services import IdentityService
from domains.identity.domain.exceptions import (
    DuplicateEmail,
    DuplicateUsername,
    InvalidCredentials,
    UserNotFound,
)
from domains.identity.infrastructure.repository import SqlAlchemyUserRepository
from domains.identity.face_verification.schemas import (
    FaceVerificationEnrollRequest,
    FaceVerificationProfileResponse,
    FaceVerificationSessionResponse,
    FaceVerificationStartRequest,
    FaceVerificationSubmitRequest,
    FaceTemplateEnrollRequest,
    FaceTemplateVerifyRequest,
    PasskeyChallengeResponse,
    PasskeyEnrollmentChallengeRequest,
    PasskeyEnrollmentCompleteRequest,
    PasskeyVerificationCompleteRequest,
)
from domains.identity.face_verification.service import FaceVerificationService
from domains.identity.presentation.schemas import (
    LoginRequest,
    PublicProfileResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserProfileResponse,
    UpdateProfileRequest,
)
from infrastructure.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter()
logger = logging.getLogger(__name__)

AVATAR_STORAGE_DIR = settings.resolved_storage_dir / "avatars"
MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024
ALLOWED_AVATAR_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _safe_redirect_target(value: str | None) -> str:
    fallback = f"{settings.FRONTEND_URL.rstrip('/')}/login"
    if not value:
        return fallback
    parsed = urlparse(value)
    allowed = urlparse(settings.FRONTEND_URL)
    if parsed.scheme in {"http", "https"} and parsed.netloc == allowed.netloc:
        return value
    if value.startswith("/"):
        return f"{settings.FRONTEND_URL.rstrip('/')}{value}"
    return fallback


def _sanitize_oauth_username(value: str | None, email: str) -> str:
    base = value or email.split("@")[0]
    base = re.sub(r"[^a-zA-Z0-9_-]+", "-", base).strip("-_").lower()
    return (base or "player")[:28]

def _build_service(session: AsyncSession) -> IdentityService:
    return IdentityService(
        user_repo=SqlAlchemyUserRepository(session),
        hash_password=hash_password,
        verify_password=verify_password,
        create_access_token=create_access_token,
        create_refresh_token=create_refresh_token,
        decode_token=decode_token,
    )

def _serialize_user_profile(user) -> UserProfileResponse:
    avatar_url = f"/media/avatars/{user.avatar_path}" if user.avatar_path else None
    
    return UserProfileResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        rating=user.rating,
        role=user.role,
        banned_at=user.banned_at,
        bio=user.bio,
        avatar_url=avatar_url, 
        created_at=user.created_at,
        global_rank=0
    )

async def _delete_avatar_file(avatar_name: str | None) -> None:
    if not avatar_name:
        return
    file_path = AVATAR_STORAGE_DIR / avatar_name
    
    try:
        if file_path.exists():
            file_path.unlink()
    except Exception as e:
        logger.error(f"Failed to delete avatar file: {e}")

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, session: AsyncSession = Depends(get_db)):
    service = _build_service(session)
    try:
        return await service.register(
            RegisterUserCommand(username=body.username, email=body.email, password=body.password)
        )
    except DuplicateEmail:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    except DuplicateUsername:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")

@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_db)):
    service = _build_service(session)
    try:
        return await service.login(LoginUserCommand(email=body.email, password=body.password))
    except InvalidCredentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, session: AsyncSession = Depends(get_db)):
    service = _build_service(session)
    try:
        return await service.refresh(RefreshTokenCommand(refresh_token=body.refresh_token))
    except (InvalidCredentials, Exception):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

@router.get("/me", response_model=UserProfileResponse)
async def get_me(
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = _build_service(session)
    try:
        user = await service.get_profile(UUID(user_id))
        return _serialize_user_profile(user)
    except UserNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

@router.put("/profile", response_model=UserProfileResponse)
async def update_profile(
    body: UpdateProfileRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = _build_service(session)
    try:
        user = await service.update_profile(
            UpdateProfileCommand(
                user_id=UUID(user_id),
                username=body.username,
                bio=body.bio
            )
        )
        return _serialize_user_profile(user)
    except DuplicateUsername:
        raise HTTPException(status_code=409, detail="Username already taken")
    except UserNotFound:
        raise HTTPException(status_code=404, detail="User not found")

@router.get("/users/{user_id}", response_model=PublicProfileResponse)
async def get_user(user_id: UUID, session: AsyncSession = Depends(get_db)):
    service = _build_service(session)
    try:
        user = await service.get_profile(user_id)
        return PublicProfileResponse(
            id=str(user.id), 
            username=user.username, 
            rating=user.rating, 
            avatar_url=user.avatar_path,
            global_rank=0 
        )
    except UserNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

@router.get("/auth/{provider}")
async def oauth_login(provider: str, redirectTo: str = f"{settings.FRONTEND_URL}/login"):
    if provider != "google":
        raise HTTPException(status_code=400, detail="Provider not supported")
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured")

    callback_uri = f"{settings.BACKEND_URL}/api/v1/identity/auth/{provider}/callback"
    params = urlencode({
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": callback_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": _safe_redirect_target(redirectTo),
        "access_type": "offline",
        "prompt": "select_account",
    })
    url = f"https://accounts.google.com/o/oauth2/v2/auth?{params}"
    
    return RedirectResponse(url)

@router.get("/auth/{provider}/callback")
async def oauth_callback(provider: str, code: str, state: str, session: AsyncSession = Depends(get_db)):
    if provider != "google":
        raise HTTPException(status_code=400, detail="Provider not supported")
    redirect_target = _safe_redirect_target(state)
    service = _build_service(session)
    email, username = None, None
    callback_uri = f"{settings.BACKEND_URL}/api/v1/identity/auth/{provider}/callback"
    
    async with httpx.AsyncClient() as client:
        try:
            token_res = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": callback_uri,
                },
            )
            token_res.raise_for_status()
            token_data = token_res.json()

            user_info_res = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {token_data['access_token']}"},
            )
            user_info_res.raise_for_status()
            user_data = user_info_res.json()
            email = user_data["email"]
            username = _sanitize_oauth_username(user_data.get("name"), email)

            result = await service.oauth_flow(OAuthUserCommand(email=email, username=username))
            params = urlencode({
                "access_token": result["access_token"],
                "refresh_token": result["refresh_token"],
            })
            return RedirectResponse(
                f"{redirect_target}?{params}"
            )
        except Exception as e:
            logger.error(f"OAuth error for {provider}: {e}", exc_info=True)
            return RedirectResponse(f"{redirect_target}?error=oauth_failed")

@router.post("/me/avatar", response_model=UserProfileResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Avatar must be a PNG, JPEG, or WebP image",
        )

    content = await file.read()
    if len(content) > MAX_AVATAR_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Avatar must be 2MB or smaller",
        )

    service = _build_service(session)
    try:
        current_user = await service.get_profile(UUID(user_id))
    except UserNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    AVATAR_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    avatar_filename = f"{user_id}-{uuid4().hex}{ALLOWED_AVATAR_TYPES[file.content_type]}"
    avatar_path = AVATAR_STORAGE_DIR / avatar_filename
    
    async with aiofiles.open(avatar_path, "wb") as f:
        await f.write(content)

    await _delete_avatar_file(current_user.avatar_path)
    user = await service.update_avatar(UUID(user_id), f"{avatar_filename}")
    return _serialize_user_profile(user)


@router.post("/face-verification/enroll", response_model=FaceVerificationProfileResponse)
async def enroll_face_verification(
    body: FaceVerificationEnrollRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = FaceVerificationService(session)
    profile = await service.enroll(UUID(user_id), body.device_label, body.consent)
    return service.profile_response(profile)


@router.get("/face-verification/me", response_model=list[FaceVerificationProfileResponse])
async def get_face_verification_profiles(
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = FaceVerificationService(session)
    return [service.profile_response(profile) for profile in await service.list_profiles(UUID(user_id))]


@router.post("/face-verification/sessions", response_model=FaceVerificationSessionResponse)
async def start_face_verification_session(
    body: FaceVerificationStartRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = FaceVerificationService(session)
    verification = await service.start_session(
        user_id=UUID(user_id),
        game_id=body.game_id,
        tournament_id=body.tournament_id,
        scheduled_match_id=body.scheduled_match_id,
    )
    return service.session_response(verification)


@router.post("/face-verification/sessions/{session_id}/submit", response_model=FaceVerificationSessionResponse)
async def submit_face_verification_session(
    session_id: UUID,
    body: FaceVerificationSubmitRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = FaceVerificationService(session)
    verification = await service.submit(session_id, UUID(user_id), body.scenario)
    return service.session_response(verification)


@router.post("/face-verification/faces/enroll", response_model=FaceVerificationProfileResponse)
async def enroll_face_template(
    body: FaceTemplateEnrollRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = FaceVerificationService(session)
    profile = await service.enroll_face_template(
        user_id=UUID(user_id),
        device_label=body.device_label,
        consent=body.consent,
        face_sample=body.face_sample,
    )
    return service.profile_response(profile)


@router.post("/face-verification/faces/verify", response_model=FaceVerificationSessionResponse)
async def verify_face_template(
    body: FaceTemplateVerifyRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = FaceVerificationService(session)
    verification = await service.verify_live_face_sample(
        user_id=UUID(user_id),
        face_sample=body.face_sample,
        game_id=body.game_id,
        tournament_id=body.tournament_id,
        scheduled_match_id=body.scheduled_match_id,
    )
    return service.session_response(verification)


@router.post("/face-verification/passkeys/enrollment/challenge", response_model=PasskeyChallengeResponse)
async def start_passkey_enrollment(
    body: PasskeyEnrollmentChallengeRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = FaceVerificationService(session)
    challenge = await service.start_passkey_enrollment(
        user_id=UUID(user_id),
        authenticator_attachment=body.authenticator_attachment,
        device_label=body.device_label,
    )
    return PasskeyChallengeResponse(challenge_id=challenge.id, public_key=challenge.payload["public_key"])


@router.post("/face-verification/passkeys/enrollment/complete", response_model=FaceVerificationProfileResponse)
async def complete_passkey_enrollment(
    body: PasskeyEnrollmentCompleteRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = FaceVerificationService(session)
    profile = await service.complete_passkey_enrollment(
        user_id=UUID(user_id),
        challenge_id=body.challenge_id,
        credential=body.credential,
    )
    return service.profile_response(profile)


@router.post("/face-verification/passkeys/verification/challenge", response_model=PasskeyChallengeResponse)
async def start_passkey_verification(
    body: FaceVerificationStartRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = FaceVerificationService(session)
    challenge, _verification = await service.start_passkey_verification(
        user_id=UUID(user_id),
        game_id=body.game_id,
        tournament_id=body.tournament_id,
        scheduled_match_id=body.scheduled_match_id,
    )
    return PasskeyChallengeResponse(challenge_id=challenge.id, public_key=challenge.payload["public_key"])


@router.post("/face-verification/passkeys/verification/complete", response_model=FaceVerificationSessionResponse)
async def complete_passkey_verification(
    body: PasskeyVerificationCompleteRequest,
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = FaceVerificationService(session)
    verification = await service.complete_passkey_verification(
        user_id=UUID(user_id),
        challenge_id=body.challenge_id,
        credential=body.credential,
    )
    return service.session_response(verification)
