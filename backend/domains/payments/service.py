"""Local payment emulator service."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from domains.payments.infrastructure.models import PaymentEventModel, PaymentIntentModel
from domains.payments.presentation.schemas import PaymentIntentResponse
from domains.tournaments.infrastructure.models import TournamentModel, TournamentPlayerModel


TERMINAL_RELEASE_STATUSES = {"failed", "cancelled", "expired"}
SUCCESS_SCENARIOS = {"success": "succeeded", "pending": "pending", "failed": "failed", "cancelled": "cancelled", "expired": "expired", "refunded": "refunded", "disputed": "disputed"}


def occupies_tournament_slot(status_value: str, reserved_until: datetime | None, now: datetime | None = None) -> bool:
    """Return whether a payment state occupies tournament capacity."""
    if status_value in {"succeeded", "disputed"}:
        return True
    if status_value != "pending" or reserved_until is None:
        return False
    return reserved_until > (now or datetime.now(timezone.utc))


def apply_refund_to_registration(player: object | None, now: datetime | None = None) -> None:
    """Mark a confirmed registration as withdrawn while preserving an audit trail."""
    if player is None:
        return
    setattr(player, "status", "withdrawn")
    setattr(player, "withdrawn_at", now or datetime.now(timezone.utc))


class PaymentService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create_entry_payment(self, tournament_id: UUID, user_id: UUID) -> PaymentIntentModel:
        tournament = await self._session.get(TournamentModel, tournament_id)
        if tournament is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")

        amount_cents = tournament.entry_fee_cents
        payment = PaymentIntentModel(
            user_id=user_id,
            tournament_id=tournament_id,
            amount_cents=amount_cents,
            currency="USD",
            status="created",
            scenario=None,
            reserved_until=datetime.now(timezone.utc) + timedelta(minutes=15),
            metadata_json={"slot_policy": "pending reserves a slot until reserved_until"},
        )
        self._session.add(payment)
        await self._session.flush()
        self._event(payment.id, "payment.created", {"amount_cents": amount_cents})
        await self._session.commit()
        await self._session.refresh(payment)
        return payment

    async def simulate(self, payment_id: UUID, scenario: str) -> PaymentIntentModel:
        payment = await self._session.get(PaymentIntentModel, payment_id)
        if payment is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
        if scenario not in SUCCESS_SCENARIOS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported payment scenario")

        payment.scenario = scenario
        payment.status = SUCCESS_SCENARIOS[scenario]
        payment.updated_at = datetime.now(timezone.utc)
        self._event(payment.id, f"payment.{payment.status}", {"scenario": scenario})

        if payment.status == "succeeded":
            await self._confirm_registration(payment)
        elif payment.status == "refunded":
            payment.reserved_until = None
            existing = await self._session.get(TournamentPlayerModel, (payment.tournament_id, payment.user_id))
            apply_refund_to_registration(existing, payment.updated_at)
        elif payment.status in TERMINAL_RELEASE_STATUSES:
            payment.reserved_until = None

        await self._session.commit()
        await self._session.refresh(payment)
        return payment

    async def _confirm_registration(self, payment: PaymentIntentModel) -> None:
        existing = await self._session.get(TournamentPlayerModel, (payment.tournament_id, payment.user_id))
        if existing is not None:
            existing.status = "active"
            existing.withdrawn_at = None
            return

        tournament = await self._session.get(TournamentModel, payment.tournament_id)
        if tournament is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")

        from domains.identity.infrastructure.models import UserModel

        user = await self._session.get(UserModel, payment.user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        self._session.add(
            TournamentPlayerModel(
                tournament_id=payment.tournament_id,
                user_id=payment.user_id,
                seed_rating=user.rating,
                score=0,
                status="active",
            )
        )

    def _event(self, payment_id: UUID, event_type: str, payload: dict) -> None:
        self._session.add(PaymentEventModel(payment_intent_id=payment_id, type=event_type, payload=payload))

    @staticmethod
    def to_response(payment: PaymentIntentModel) -> PaymentIntentResponse:
        return PaymentIntentResponse(
            id=payment.id,
            user_id=payment.user_id,
            tournament_id=payment.tournament_id,
            amount_cents=payment.amount_cents,
            currency=payment.currency,
            status=payment.status,
            scenario=payment.scenario,
            reserved_until=payment.reserved_until,
            metadata=payment.metadata_json,
            created_at=payment.created_at,
            updated_at=payment.updated_at,
        )
