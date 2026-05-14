"""Scheduled match REST router."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user_id, get_db
from domains.payments.presentation.schemas import PaymentIntentResponse
from domains.payments.service import PaymentService
from domains.scheduled_matches.presentation.schemas import (
    ScheduledMatchCreateRequest,
    ScheduledMatchRescheduleRequest,
    ScheduledMatchResponse,
)
from domains.scheduled_matches.service import ScheduledMatchService

router = APIRouter()


@router.get("/me", response_model=list[ScheduledMatchResponse])
async def my_scheduled_matches(
    session: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    service = ScheduledMatchService(session)
    return [service.to_response(match) for match in await service.list_for_user(UUID(user_id))]


@router.get("/{match_id}", response_model=ScheduledMatchResponse)
async def get_scheduled_match(
    match_id: UUID,
    session: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    service = ScheduledMatchService(session)
    match = await service._require_match(match_id)
    viewer_id = UUID(user_id)
    participants = {match.creator_user_id, match.invited_user_id, match.white_player_id, match.black_player_id}
    if viewer_id not in participants:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Scheduled match access denied")
    return service.to_response(match)


@router.post("", response_model=ScheduledMatchResponse)
async def create_scheduled_match(
    body: ScheduledMatchCreateRequest,
    session: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    service = ScheduledMatchService(session)
    match = await service.create_invitation(
        creator_user_id=UUID(user_id),
        invited_user_id=body.invited_user_id,
        starts_at=body.starts_at,
        expires_at=body.expires_at,
        metadata=body.metadata,
    )
    return service.to_response(match)


@router.post("/{match_id}/accept", response_model=ScheduledMatchResponse)
async def accept_match(match_id: UUID, session: AsyncSession = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    service = ScheduledMatchService(session)
    return service.to_response(await service.transition(match_id, UUID(user_id), "accepted"))


@router.post("/{match_id}/decline", response_model=ScheduledMatchResponse)
async def decline_match(match_id: UUID, session: AsyncSession = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    service = ScheduledMatchService(session)
    return service.to_response(await service.transition(match_id, UUID(user_id), "declined"))


@router.post("/{match_id}/cancel", response_model=ScheduledMatchResponse)
async def cancel_match(match_id: UUID, session: AsyncSession = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    service = ScheduledMatchService(session)
    return service.to_response(await service.transition(match_id, UUID(user_id), "cancelled"))


@router.post("/{match_id}/start", response_model=ScheduledMatchResponse)
async def start_match(match_id: UUID, session: AsyncSession = Depends(get_db), user_id: str = Depends(get_current_user_id)):
    service = ScheduledMatchService(session)
    return service.to_response(await service.start(match_id, UUID(user_id)))


@router.post("/{match_id}/reschedule", response_model=ScheduledMatchResponse)
async def reschedule_match(
    match_id: UUID,
    body: ScheduledMatchRescheduleRequest,
    session: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    service = ScheduledMatchService(session)
    return service.to_response(await service.reschedule(match_id, UUID(user_id), body.starts_at, body.expires_at))


@router.post("/{match_id}/payment", response_model=PaymentIntentResponse)
async def create_match_payment(
    match_id: UUID,
    session: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    payment = await PaymentService(session).create_scheduled_match_payment(match_id, UUID(user_id))
    return PaymentService.to_response(payment)
