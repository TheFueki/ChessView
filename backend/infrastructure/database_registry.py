"""Model import registry for SQLAlchemy metadata discovery."""


def register_models() -> None:
    """Import every ORM module so declarative metadata is fully populated."""
    import domains.admin.infrastructure.models  # noqa: F401
    import domains.clubs.infrastructure.models  # noqa: F401
    import domains.communication.infrastructure.models  # noqa: F401
    import domains.game.infrastructure.models  # noqa: F401
    import domains.identity.face_verification.models  # noqa: F401
    import domains.identity.infrastructure.models  # noqa: F401
    import domains.payments.infrastructure.models  # noqa: F401
    import domains.puzzles.infrastructure.models  # noqa: F401
    import domains.scheduled_matches.infrastructure.models  # noqa: F401
    import domains.shop.infrastructure.models  # noqa: F401
    import domains.tournaments.infrastructure.models  # noqa: F401
