"""
Identity domain value objects.

Immutable, self-validating types with no external dependencies.
"""

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class Email:
    """Validated email value object."""

    value: str

    def __post_init__(self) -> None:
        if not re.match(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$", self.value):
            raise ValueError(f"Invalid email: {self.value}")
        if len(self.value) > 255:
            raise ValueError("Email exceeds 255 characters")
