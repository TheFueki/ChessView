"""
Communication domain exceptions.
"""


class MessageTooLong(Exception):
    """Raised when chat message content exceeds 500 characters."""
    pass
