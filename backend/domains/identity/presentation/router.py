import httpx
import logging
import aiofiles
from pathlib import Path
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
    callback_uri = f"{settings.BACKEND_URL}/api/v1/identity/auth/{provider}/callback"
    
    if provider == "google":
        url = (
            f"https://accounts.google.com/o/oauth2/v2/auth?client_id={settings.GOOGLE_CLIENT_ID}"
            f"&redirect_uri={callback_uri}&response_type=code&scope=openid email profile&state={redirectTo}"
        )
    elif provider == "github":
        url = (
            f"https://github.com/login/oauth/authorize?client_id={settings.GITHUB_CLIENT_ID}"
            f"&scope=user:email&state={redirectTo}"
        )
    else:
        raise HTTPException(status_code=400, detail="Provider not supported")
    
    return RedirectResponse(url)

@router.get("/auth/{provider}/callback")
async def oauth_callback(provider: str, code: str, state: str, session: AsyncSession = Depends(get_db)):
    service = _build_service(session)
    email, username = None, None
    callback_uri = f"{settings.BACKEND_URL}/api/v1/identity/auth/{provider}/callback"
    
    async with httpx.AsyncClient() as client:
        try:
            if provider == "google":
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
                username = user_data.get("name", email.split("@")[0])

            elif provider == "github":
                token_res = await client.post(
                    "https://github.com/login/oauth/access_token",
                    headers={"Accept": "application/json"},
                    data={
                        "client_id": settings.GITHUB_CLIENT_ID,
                        "client_secret": settings.GITHUB_CLIENT_SECRET,
                        "code": code,
                    },
                )
                token_res.raise_for_status()
                access_token = token_res.json().get("access_token")
                
                user_res = await client.get(
                    "https://api.github.com/user",
                    headers={"Authorization": f"token {access_token}"},
                )
                user_res.raise_for_status()
                user_data = user_res.json()
                username = user_data["login"]
                email = user_data.get("email")
                
                if not email: 
                    emails_res = await client.get(
                        "https://api.github.com/user/emails", 
                        headers={"Authorization": f"token {access_token}"}
                    )
                    email = next(e["email"] for e in emails_res.json() if e["primary"])

            result = await service.oauth_flow(OAuthUserCommand(email=email, username=username))
            return RedirectResponse(
                f"{state}?access_token={result['access_token']}&refresh_token={result['refresh_token']}"
            )
        except Exception as e:
            logger.error(f"OAuth error for {provider}: {e}", exc_info=True)
            return RedirectResponse(f"{state}?error=oauth_failed")

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
