"""
Matchmaking domain exceptions.
"""


class AlreadyInQueue(Exception):
    """Raised when a user tries to join the queue while already in it."""
    pass


class NotInQueue(Exception):
    """Raised when a user tries to leave the queue but isn't in it."""
    pass
