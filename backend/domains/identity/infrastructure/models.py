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
from infrastructure.orm import created_at_column, uuid_primary_key

USERNAME_LENGTH = 32
EMAIL_LENGTH = 255
PASSWORD_HASH_LENGTH = 255
AVATAR_PATH_LENGTH = 255


class UserModel(Base):
    """ORM model for the `users` table."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = uuid_primary_key()
    username: Mapped[str] = mapped_column(String(USERNAME_LENGTH), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(EMAIL_LENGTH), unique=True, nullable=False)
    password: Mapped[str] = mapped_column(String(PASSWORD_HASH_LENGTH), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    avatar_path: Mapped[str | None] = mapped_column(String(AVATAR_PATH_LENGTH), nullable=True)
    created_at: Mapped[datetime] = created_at_column()
