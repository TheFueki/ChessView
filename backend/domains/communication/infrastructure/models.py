"""
SQLAlchemy ORM model for the chat_messages table.
"""

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from infrastructure.database import Base

import uuid


class ChatMessageModel(Base):
    """ORM model for the `chat_messages` table."""

    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    game_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("games.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    content: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at = mapped_column(
        TIMESTAMP(timezone=True), server_default=func.now(), nullable=False
    )
