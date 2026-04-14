"""Small SQLAlchemy column helpers for consistent backend models."""

from datetime import datetime
import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import mapped_column
from sqlalchemy.sql import func


def uuid_primary_key():
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def uuid_reference(
    target: str,
    *,
    nullable: bool = False,
    primary_key: bool = False,
    unique: bool = False,
):
    return mapped_column(
        UUID(as_uuid=True),
        ForeignKey(target),
        nullable=nullable,
        primary_key=primary_key,
        unique=unique,
    )


def utc_timestamp_column(*, nullable: bool = False):
    return mapped_column(TIMESTAMP(timezone=True), nullable=nullable)


def created_at_column():
    return mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
