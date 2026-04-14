"""
Identity domain exceptions.

Raised by domain/application layers, caught by presentation layer.
"""


class DuplicateEmail(Exception):
    """Raised when attempting to register with an already-used email."""
    pass


class DuplicateUsername(Exception):
    """Raised when attempting to register with an already-used username."""
    pass


class InvalidCredentials(Exception):
    """Raised when login email/password combination is wrong."""
    pass


class UserNotFound(Exception):
    """Raised when a user lookup by ID or email returns nothing."""
    pass
