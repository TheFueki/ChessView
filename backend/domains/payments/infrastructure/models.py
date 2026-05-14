"""Payment emulator ORM models."""

from datetime import datetime
import uuid

from sqlalchemy import JSON, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.database import Base
from infrastructure.orm import created_at_column, utc_timestamp_column, uuid_primary_key, uuid_reference


class PaymentIntentModel(Base):
    __tablename__ = "payment_intents"

    id: Mapped[uuid.UUID] = uuid_primary_key()
    user_id: Mapped[uuid.UUID] = uuid_reference("users.id")
    tournament_id: Mapped[uuid.UUID | None] = uuid_reference("tournaments.id", nullable=True)
    scheduled_match_id: Mapped[uuid.UUID | None] = uuid_reference("scheduled_matches.id", nullable=True)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    scenario: Mapped[str | None] = mapped_column(String(20), nullable=True)
    reserved_until: Mapped[datetime | None] = utc_timestamp_column(nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = created_at_column()
    updated_at: Mapped[datetime | None] = utc_timestamp_column(nullable=True)

    events: Mapped[list["PaymentEventModel"]] = relationship(
        "PaymentEventModel",
        back_populates="payment_intent",
        order_by="PaymentEventModel.created_at",
    )


class PaymentEventModel(Base):
    __tablename__ = "payment_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    payment_intent_id: Mapped[uuid.UUID] = uuid_reference("payment_intents.id")
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = created_at_column()

    payment_intent: Mapped[PaymentIntentModel] = relationship("PaymentIntentModel", back_populates="events")
