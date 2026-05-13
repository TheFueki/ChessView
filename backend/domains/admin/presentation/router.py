"""Admin REST router."""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_admin
from domains.admin.infrastructure.models import AdminAuditLogModel
from domains.admin.presentation.schemas import AdminAuditLogResponse, AdminRoleRequest, AdminUserPatchRequest, AdminUserResponse
from domains.identity.face_verification.models import FaceVerificationSessionModel
from domains.identity.face_verification.schemas import FaceVerificationSessionResponse
from domains.identity.face_verification.service import FaceVerificationService
from domains.identity.infrastructure.models import UserModel
from domains.payments.infrastructure.models import PaymentIntentModel
from domains.payments.presentation.schemas import PaymentIntentResponse
from domains.payments.service import PaymentService

router = APIRouter()


async def _audit(
    session: AsyncSession,
    actor_user_id: UUID,
    action: str,
    target_type: str,
    target_id: str,
    payload: dict,
) -> None:
    session.add(
        AdminAuditLogModel(
            actor_user_id=actor_user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            payload=payload,
        )
    )
    await session.commit()


def _to_user_response(user: UserModel) -> AdminUserResponse:
    return AdminUserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        rating=user.rating,
        role=user.role,
        banned_at=user.banned_at,
        created_at=user.created_at,
    )


@router.get("/users", response_model=list[AdminUserResponse])
async def list_users(
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_db),
    _admin_id: str = Depends(require_admin),
):
    result = await session.execute(select(UserModel).order_by(UserModel.created_at.desc()).limit(limit))
    return [_to_user_response(user) for user in result.scalars().all()]


@router.patch("/users/{user_id}", response_model=AdminUserResponse)
async def patch_user(
    user_id: UUID,
    body: AdminUserPatchRequest,
    session: AsyncSession = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    user = await session.get(UserModel, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    payload = body.model_dump(exclude_unset=True)
    for key, value in payload.items():
        setattr(user, key, value)
    await session.commit()
    await session.refresh(user)
    await _audit(session, UUID(admin_id), "user.patch", "user", str(user_id), payload)
    return _to_user_response(user)


@router.post("/users/{user_id}/ban", response_model=AdminUserResponse)
async def ban_user(
    user_id: UUID,
    session: AsyncSession = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    user = await session.get(UserModel, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.banned_at = datetime.now(timezone.utc)
    await session.commit()
    await session.refresh(user)
    await _audit(session, UUID(admin_id), "user.ban", "user", str(user_id), {})
    return _to_user_response(user)


@router.post("/users/{user_id}/unban", response_model=AdminUserResponse)
async def unban_user(
    user_id: UUID,
    session: AsyncSession = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    user = await session.get(UserModel, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.banned_at = None
    await session.commit()
    await session.refresh(user)
    await _audit(session, UUID(admin_id), "user.unban", "user", str(user_id), {})
    return _to_user_response(user)


@router.post("/users/{user_id}/role", response_model=AdminUserResponse)
async def change_role(
    user_id: UUID,
    body: AdminRoleRequest,
    session: AsyncSession = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    user = await session.get(UserModel, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.role = body.role
    await session.commit()
    await session.refresh(user)
    await _audit(session, UUID(admin_id), "user.role", "user", str(user_id), {"role": body.role})
    return _to_user_response(user)


@router.get("/logs", response_model=list[AdminAuditLogResponse])
async def list_logs(
    limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_db),
    _admin_id: str = Depends(require_admin),
):
    result = await session.execute(
        select(AdminAuditLogModel).order_by(AdminAuditLogModel.created_at.desc()).limit(limit)
    )
    return result.scalars().all()


@router.get("/payments", response_model=list[PaymentIntentResponse])
async def list_payments(
    limit: int = Query(100, ge=1, le=500),
    session: AsyncSession = Depends(get_db),
    _admin_id: str = Depends(require_admin),
):
    result = await session.execute(
        select(PaymentIntentModel).order_by(PaymentIntentModel.created_at.desc()).limit(limit)
    )
    return [PaymentService.to_response(payment) for payment in result.scalars().all()]


@router.get("/face-verification/sessions", response_model=list[FaceVerificationSessionResponse])
async def list_face_verification_sessions(
    limit: int = Query(100, ge=1, le=500),
    status_filter: str | None = Query(None, alias="status"),
    session: AsyncSession = Depends(get_db),
    _admin_id: str = Depends(require_admin),
):
    stmt = select(FaceVerificationSessionModel).order_by(FaceVerificationSessionModel.created_at.desc()).limit(limit)
    if status_filter is not None:
        stmt = stmt.where(FaceVerificationSessionModel.status == status_filter)
    result = await session.execute(stmt)
    service = FaceVerificationService(session)
    return [service.session_response(item) for item in result.scalars().all()]


@router.post("/payments/{payment_id}/refund", response_model=PaymentIntentResponse)
async def refund_payment(
    payment_id: UUID,
    session: AsyncSession = Depends(get_db),
    admin_id: str = Depends(require_admin),
):
    payment = await PaymentService(session).simulate(payment_id, "refunded")
    await _audit(session, UUID(admin_id), "payment.refund", "payment", str(payment_id), {})
    return PaymentService.to_response(payment)
