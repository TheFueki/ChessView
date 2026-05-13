"""Payment emulator REST router."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user_id, get_db
from domains.payments.infrastructure.models import PaymentIntentModel
from domains.payments.presentation.schemas import PaymentIntentResponse, PaymentSimulationRequest
from domains.payments.service import PaymentService

router = APIRouter()


@router.get("/{payment_id}", response_model=PaymentIntentResponse)
async def get_payment(
    payment_id: UUID,
    session: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    payment = await session.get(PaymentIntentModel, payment_id)
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    if payment.user_id != UUID(user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Payment access denied")
    return PaymentService.to_response(payment)


@router.post("/emulator/{payment_id}/simulate", response_model=PaymentIntentResponse)
async def simulate_payment(
    payment_id: UUID,
    body: PaymentSimulationRequest,
    session: AsyncSession = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    payment = await session.get(PaymentIntentModel, payment_id)
    if payment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    if payment.user_id != UUID(user_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Payment access denied")
    payment = await PaymentService(session).simulate(payment_id, body.scenario)
    return PaymentService.to_response(payment)
