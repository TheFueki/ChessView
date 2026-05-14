"""Local payment emulator service."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from domains.identity.infrastructure.models import UserModel
from domains.payments.infrastructure.models import PaymentEventModel, PaymentIntentModel
from domains.payments.presentation.schemas import PaymentIntentResponse
from domains.scheduled_matches.infrastructure.models import ScheduledMatchModel
from domains.tournaments.infrastructure.models import TournamentModel, TournamentPlayerModel


TERMINAL_RELEASE_STATUSES = {"failed", "cancelled", "expired"}
SUCCESS_SCENARIOS = {"success": "succeeded", "pending": "pending", "failed": "failed", "cancelled": "cancelled", "expired": "expired", "refunded": "refunded", "disputed": "disputed"}
WALLET_CURRENCY = "CVC"


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


def apply_wallet_charge(user: object, payment: object) -> None:
    """Deduct ChessView coins once for a successful emulator payment."""
    metadata = dict(getattr(payment, "metadata_json", None) or {})
    if metadata.get("wallet_debited"):
        return

    amount = int(getattr(payment, "amount_cents", 0) or 0)
    balance = int(getattr(user, "coins", 0) or 0)
    if amount > balance:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Not enough ChessView coins")

    setattr(user, "coins", balance - amount)
    metadata["wallet_debited"] = True
    metadata["wallet_amount"] = amount
    setattr(payment, "metadata_json", metadata)


def apply_wallet_refund(user: object, payment: object) -> None:
    """Return ChessView coins once for a refunded emulator payment."""
    metadata = dict(getattr(payment, "metadata_json", None) or {})
    if not metadata.get("wallet_debited") or metadata.get("wallet_refunded"):
        return

    amount = int(metadata.get("wallet_amount") or getattr(payment, "amount_cents", 0) or 0)
    setattr(user, "coins", int(getattr(user, "coins", 0) or 0) + amount)
    metadata["wallet_refunded"] = True
    setattr(payment, "metadata_json", metadata)


def payment_subject(payment: object) -> tuple[str, UUID]:
    tournament_id = getattr(payment, "tournament_id", None)
    scheduled_match_id = getattr(payment, "scheduled_match_id", None)
    if tournament_id is not None and scheduled_match_id is None:
        return ("tournament", tournament_id)
    if scheduled_match_id is not None and tournament_id is None:
        return ("scheduled_match", scheduled_match_id)
    raise ValueError("Payment must reference exactly one payable subject")


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
            scheduled_match_id=None,
            amount_cents=amount_cents,
            currency=WALLET_CURRENCY,
            status="created",
            scenario=None,
            reserved_until=datetime.now(timezone.utc) + timedelta(minutes=15),
            metadata_json={
                "wallet_currency": "ChessView coins",
                "slot_policy": "pending reserves a slot until reserved_until",
            },
        )
        self._session.add(payment)
        await self._session.flush()
        self._event(payment.id, "payment.created", {"amount_cents": amount_cents})
        await self._session.commit()
        await self._session.refresh(payment)
        return payment

    async def create_scheduled_match_payment(self, match_id: UUID, user_id: UUID) -> PaymentIntentModel:
        match = await self._session.get(ScheduledMatchModel, match_id)
        if match is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled match not found")
        if user_id not in {match.creator_user_id, match.invited_user_id, match.white_player_id, match.black_player_id}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Scheduled match payment access denied")

        metadata = dict(match.metadata_json or {})
        amount_cents = int(metadata.get("entry_fee_cents") or metadata.get("match_fee_cents") or 0)
        payment = PaymentIntentModel(
            user_id=user_id,
            tournament_id=None,
            scheduled_match_id=match_id,
            amount_cents=amount_cents,
            currency=WALLET_CURRENCY,
            status="created",
            scenario=None,
            reserved_until=datetime.now(timezone.utc) + timedelta(minutes=15),
            metadata_json={
                "subject": "scheduled_match",
                "wallet_currency": "ChessView coins",
                "slot_policy": "pending reserves match payment until reserved_until",
            },
        )
        self._session.add(payment)
        await self._session.flush()
        self._event(payment.id, "payment.created", {"amount_cents": amount_cents, "subject": "scheduled_match"})
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
            user = await self._session.get(UserModel, payment.user_id)
            if user is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
            apply_wallet_charge(user, payment)
            subject, _subject_id = payment_subject(payment)
            if subject == "tournament":
                await self._confirm_registration(payment)
            else:
                await self._confirm_scheduled_match_payment(payment)
        elif payment.status == "refunded":
            payment.reserved_until = None
            user = await self._session.get(UserModel, payment.user_id)
            if user is not None:
                apply_wallet_refund(user, payment)
            if payment.tournament_id is not None:
                existing = await self._session.get(TournamentPlayerModel, (payment.tournament_id, payment.user_id))
                apply_refund_to_registration(existing, payment.updated_at)
        elif payment.status in TERMINAL_RELEASE_STATUSES:
            payment.reserved_until = None

        await self._session.commit()
        await self._session.refresh(payment)
        return payment

    async def _confirm_registration(self, payment: PaymentIntentModel) -> None:
        if payment.tournament_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment is not for a tournament")
        existing = await self._session.get(TournamentPlayerModel, (payment.tournament_id, payment.user_id))
        if existing is not None:
            existing.status = "active"
            existing.withdrawn_at = None
            return

        tournament = await self._session.get(TournamentModel, payment.tournament_id)
        if tournament is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tournament not found")

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

    async def _confirm_scheduled_match_payment(self, payment: PaymentIntentModel) -> None:
        if payment.scheduled_match_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment is not for a scheduled match")
        match = await self._session.get(ScheduledMatchModel, payment.scheduled_match_id)
        if match is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheduled match not found")
        metadata = dict(match.metadata_json or {})
        metadata["payment_status"] = "paid"
        metadata["payment_intent_id"] = str(payment.id)
        match.metadata_json = metadata

    def _event(self, payment_id: UUID, event_type: str, payload: dict) -> None:
        self._session.add(PaymentEventModel(payment_intent_id=payment_id, type=event_type, payload=payload))

    @staticmethod
    def to_response(payment: PaymentIntentModel) -> PaymentIntentResponse:
        return PaymentIntentResponse(
            id=payment.id,
            user_id=payment.user_id,
            tournament_id=payment.tournament_id,
            scheduled_match_id=payment.scheduled_match_id,
            subject_type=payment_subject(payment)[0],
            amount_cents=payment.amount_cents,
            currency=payment.currency,
            status=payment.status,
            scenario=payment.scenario,
            reserved_until=payment.reserved_until,
            metadata=payment.metadata_json,
            created_at=payment.created_at,
            updated_at=payment.updated_at,
        )
