from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

# --- Request schemas ---

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetCompleteRequest(BaseModel):
    token: str = Field(min_length=16)
    password: str = Field(min_length=6, max_length=128)
    
class UpdateProfileRequest(BaseModel):
    username: str | None = Field(None, min_length=3, max_length=32)
    bio: str | None = Field(None, max_length=160)

# --- Response schemas ---

class UserProfileResponse(BaseModel):
    id: str
    username: str
    email: str
    rating: int
    role: str = "user"
    banned_at: datetime | None = None
    bio: str | None = None
    avatar_url: str | None = None
    created_at: datetime
    global_rank: int = 0  #                                       

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserProfileResponse | None = None


class PasswordResetRequestResponse(BaseModel):
    detail: str

class PublicProfileResponse(BaseModel):
    id: str
    username: str
    rating: int
    bio: str | None = None
    avatar_url: str | None = None
    global_rank: int = 0
