"""Admin audit log ORM models."""

from datetime import datetime
import uuid

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.database import Base
from infrastructure.orm import created_at_column, uuid_primary_key, uuid_reference


class AdminAuditLogModel(Base):
    __tablename__ = "admin_audit_logs"

    id: Mapped[uuid.UUID] = uuid_primary_key()
    actor_user_id: Mapped[uuid.UUID] = uuid_reference("users.id")
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    target_type: Mapped[str] = mapped_column(String(80), nullable=False)
    target_id: Mapped[str] = mapped_column(String(120), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = created_at_column()
