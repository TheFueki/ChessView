"""
Identity domain exceptions.

Raised by domain/application layers, caught by presentation layer.
"""

class IdentityException(Exception):
    """Base exception for all identity-related errors."""
    pass


class DuplicateEmail(IdentityException):
    """Raised when attempting to register with an already-used email."""
    pass


class DuplicateUsername(IdentityException):
    """Raised when attempting to register with an already-used username."""
    pass


class InvalidCredentials(IdentityException):
    """Raised when login email/password combination is wrong."""
    pass


class UserNotFound(IdentityException):
    """Raised when a user lookup by ID or email returns nothing."""
    pass