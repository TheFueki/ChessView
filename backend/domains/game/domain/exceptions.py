"""
Game domain exceptions.
"""


class IllegalMove(Exception):
    """Raised when python-chess rejects a UCI move as illegal."""
    pass


class NotYourTurn(Exception):
    """Raised when a player tries to move when it's not their turn."""
    pass


class GameNotActive(Exception):
    """Raised when attempting an action on a game that has already ended."""
    pass


class GameNotFound(Exception):
    """Raised when a game lookup returns nothing."""
    pass
