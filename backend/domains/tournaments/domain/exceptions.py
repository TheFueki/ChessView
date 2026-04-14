"""Tournament domain exceptions."""


class TournamentNotFound(Exception):
    """Raised when a tournament cannot be found."""


class TournamentAlreadyJoined(Exception):
    """Raised when a player joins the same tournament twice."""


class TournamentPlayerNotFound(Exception):
    """Raised when a tournament player lookup fails."""


class TournamentRegistrationClosed(Exception):
    """Raised when registration-only actions are attempted after start."""


class TournamentForbidden(Exception):
    """Raised when the current user cannot perform a tournament action."""


class TournamentStartRequirementsNotMet(Exception):
    """Raised when a tournament cannot start yet."""


class TournamentRoundNotReady(Exception):
    """Raised when advancing before a round has finished."""


class InvalidTournamentConfiguration(Exception):
    """Raised for invalid tournament creation inputs."""


class TournamentOwnerCannotLeave(Exception):
    """Raised when the tournament owner attempts to leave registration."""
