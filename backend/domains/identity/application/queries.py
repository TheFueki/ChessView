"""
Identity application-layer query DTOs.
"""

from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class GetProfileQuery:
    """Input for fetching a user profile by ID."""
    user_id: UUID
