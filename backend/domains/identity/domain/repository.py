"""
Abstract user repository   the port that infrastructure implements.

Domain layer defines the interface; infrastructure provides the adapter.
"""

from abc import ABC, abstractmethod
from uuid import UUID

from domains.identity.domain.entities import User


class AbstractUserRepository(ABC):
    """Port for user persistence operations."""

    @abstractmethod
    async def create(self, user: User) -> User:
        """Persist a new user. Raise DuplicateEmail/DuplicateUsername on conflict."""
        ...

    @abstractmethod
    async def get_by_id(self, user_id: UUID) -> User | None:
        """Retrieve a user by primary key."""
        ...

    @abstractmethod
    async def get_by_email(self, email: str) -> User | None:
        """Retrieve a user by email address."""
        ...

    @abstractmethod
    async def get_by_username(self, username: str) -> User | None:
        """Retrieve a user by username."""
        ...

    @abstractmethod
    async def update(self, user: User) -> User:
        """Persist changes to an existing user (e.g., rating update)."""
        ...

    @abstractmethod
    async def update_many(self, users: list[User]) -> list[User]:
        """Persist multiple users atomically when possible."""
        ...
