"""
SQLAlchemy implementation of the user repository.

Adapts the AbstractUserRepository port to async SQLAlchemy sessions.
Converts between ORM UserModel and domain User entity.
"""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from domains.identity.domain.entities import User
from domains.identity.domain.repository import AbstractUserRepository
from domains.identity.infrastructure.models import UserModel


class SqlAlchemyUserRepository(AbstractUserRepository):
    """Concrete user repository backed by PostgreSQL via SQLAlchemy."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, user: User) -> User:
        model = self._new_user_model(user)
        self._session.add(model)
        await self._persist(model)
        return self._to_entity(model)

    async def get_by_id(self, user_id: UUID) -> User | None:
        model = await self._get_user_model(user_id)
        return self._to_entity(model) if model else None

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(UserModel).where(UserModel.email == email)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def get_by_username(self, username: str) -> User | None:
        stmt = select(UserModel).where(UserModel.username == username)
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_entity(model) if model else None

    async def get_by_ids(self, user_ids: list[UUID] | set[UUID]) -> dict[UUID, User]:
        if not user_ids:
            return {}

        stmt = select(UserModel).where(UserModel.id.in_(list(user_ids)))
        result = await self._session.execute(stmt)
        models = result.scalars().all()
        return {model.id: self._to_entity(model) for model in models}

    async def update(self, user: User) -> User:
        model = await self._get_user_model(user.id)
        if model is None:
            raise ValueError(f"User {user.id} not found for update")
        self._apply_user_state(model, user)
        await self._persist(model)
        return self._to_entity(model)

    async def update_many(self, users: list[User]) -> list[User]:
        if not users:
            return []

        user_map = {user.id: user for user in users}
        stmt = select(UserModel).where(UserModel.id.in_(list(user_map)))
        result = await self._session.execute(stmt)
        models = result.scalars().all()

        for model in models:
            self._apply_user_state(model, user_map[model.id])

        await self._session.commit()

        updated: list[User] = []
        for model in models:
            await self._session.refresh(model)
            updated.append(self._to_entity(model))

        return updated

    @staticmethod
    def _to_entity(model: UserModel) -> User:
        """Convert ORM model to domain entity."""
        return User(
            id=model.id,
            username=model.username,
            email=model.email,
            password_hash=model.password,
            rating=model.rating,
            bio=model.bio,
            avatar_path=model.avatar_path,
            role=model.role,
            banned_at=model.banned_at,
            created_at=model.created_at,
        )

    @staticmethod
    def _new_user_model(user: User) -> UserModel:
        model = UserModel(id=user.id)
        SqlAlchemyUserRepository._apply_user_state(model, user)
        return model

    @staticmethod
    def _apply_user_state(model: UserModel, user: User) -> None:
        model.username = user.username
        model.email = user.email
        model.password = user.password_hash
        model.rating = user.rating
        model.bio = user.bio
        model.avatar_path = user.avatar_path
        model.role = user.role
        model.banned_at = user.banned_at

    async def _get_user_model(self, user_id: UUID) -> UserModel | None:
        result = await self._session.execute(select(UserModel).where(UserModel.id == user_id))
        return result.scalar_one_or_none()

    async def _persist(self, model: UserModel) -> None:
        await self._session.commit()
        await self._session.refresh(model)
