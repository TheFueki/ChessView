"""
SQLAlchemy ORM model for the users table.

Maps to/from the domain User entity via the repository.
Domain layer must never import this module directly.
"""

from datetime import datetime
import uuid

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.database import Base
from infrastructure.orm import created_at_column, utc_timestamp_column, uuid_primary_key

USERNAME_LENGTH = 32
EMAIL_LENGTH = 255
PASSWORD_HASH_LENGTH = 255
AVATAR_PATH_LENGTH = 255
USER_ROLE_LENGTH = 20
USER_BIO_LENGTH = 160


class UserModel(Base):
    """ORM model for the `users` table."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = uuid_primary_key()
    username: Mapped[str] = mapped_column(String(USERNAME_LENGTH), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(EMAIL_LENGTH), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String(PASSWORD_HASH_LENGTH), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    bio: Mapped[str | None] = mapped_column(String(USER_BIO_LENGTH), nullable=True)
    avatar_path: Mapped[str | None] = mapped_column(String(AVATAR_PATH_LENGTH), nullable=True)
    role: Mapped[str] = mapped_column(String(USER_ROLE_LENGTH), nullable=False, default="user")
    banned_at: Mapped[datetime | None] = utc_timestamp_column(nullable=True)
    created_at: Mapped[datetime] = created_at_column()
