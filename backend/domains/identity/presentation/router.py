"""
Identity REST API router.

Thin presentation layer — delegates all logic to IdentityService.
No business logic here; only request parsing, service calls, and response mapping.
"""

from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user_id, get_db
from domains.identity.application.commands import (
    LoginUserCommand,
    RefreshTokenCommand,
    RegisterUserCommand,
)
from domains.identity.application.services import IdentityService
from domains.identity.domain.exceptions import (
    DuplicateEmail,
    DuplicateUsername,
    InvalidCredentials,
    UserNotFound,
)
from domains.identity.infrastructure.repository import SqlAlchemyUserRepository
from domains.identity.presentation.schemas import (
    LoginRequest,
    PublicProfileResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserProfileResponse,
)
from infrastructure.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter()
AVATAR_STORAGE_DIR = Path(__file__).resolve().parents[3] / "storage" / "avatars"
MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024
ALLOWED_AVATAR_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def _build_service(session: AsyncSession) -> IdentityService:
    """Assemble IdentityService with concrete dependencies."""
    return IdentityService(
        user_repo=SqlAlchemyUserRepository(session),
        hash_password=hash_password,
        verify_password=verify_password,
        create_access_token=create_access_token,
        create_refresh_token=create_refresh_token,
        decode_token=decode_token,
    )


def _serialize_user_profile(user) -> UserProfileResponse:
    return UserProfileResponse(
        id=str(user.id),
        username=user.username,
        email=user.email,
        rating=user.rating,
        avatar_url=user.avatar_path,
        created_at=user.created_at,
    )


def _delete_avatar_file(avatar_path: str | None) -> None:
    if not avatar_path or not avatar_path.startswith("/media/avatars/"):
        return

    file_path = Path(__file__).resolve().parents[3] / "storage" / "avatars" / Path(avatar_path).name
    if file_path.exists():
        file_path.unlink()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, session: AsyncSession = Depends(get_db)):
    service = _build_service(session)
    try:
        result = await service.register(
            RegisterUserCommand(username=body.username, email=body.email, password=body.password)
        )
    except DuplicateEmail:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    except DuplicateUsername:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")
    return result


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_db)):
    service = _build_service(session)
    try:
        result = await service.login(LoginUserCommand(email=body.email, password=body.password))
    except InvalidCredentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return result


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, session: AsyncSession = Depends(get_db)):
    service = _build_service(session)
    try:
        result = await service.refresh(RefreshTokenCommand(refresh_token=body.refresh_token))
    except InvalidCredentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")
    return result


@router.get("/me", response_model=UserProfileResponse)
async def get_me(
    user_id: str = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_db),
):
    service = _build_service(session)
    try:
        user = await service.get_profile(UUID(user_id))
    except UserNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _serialize_user_profile(user)


@router.get("/users/{user_id}", response_model=PublicProfileResponse)
async def get_user(user_id: UUID, session: AsyncSession = Depends(get_db)):
    service = _build_service(session)
    try:
        user = await service.get_profile(user_id)
    except UserNotFound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return PublicProfileResponse(id=str(user.id), username=user.username, rating=user.rating, avatar_url=user.avatar_path)


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

    content = await file.read(MAX_AVATAR_SIZE_BYTES + 1)
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
    avatar_path.write_bytes(content)

    _delete_avatar_file(current_user.avatar_path)
    user = await service.update_avatar(UUID(user_id), f"/media/avatars/{avatar_filename}")
    return _serialize_user_profile(user)
