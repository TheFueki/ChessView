"""Development-only compatibility helpers for local schema drift."""

from dataclasses import dataclass

from sqlalchemy import inspect

from domains.tournaments.domain.value_objects import TournamentStatus
from shared.time_controls import DEFAULT_TIME_CONTROL


@dataclass(frozen=True, slots=True)
class ColumnCompatibility:
    """A single compatibility column addition for a legacy dev table."""

    name: str
    ddl: str


@dataclass(frozen=True, slots=True)
class TableCompatibilityPlan:
    """All compatibility additions for one legacy table."""

    table_name: str
    columns: tuple[ColumnCompatibility, ...]


GAME_COMPATIBILITY = TableCompatibilityPlan(
    table_name="games",
    columns=(
        ColumnCompatibility("rated", "ALTER TABLE games ADD COLUMN rated BOOLEAN NOT NULL DEFAULT TRUE"),
        ColumnCompatibility(
            "time_control_name",
            f"ALTER TABLE games ADD COLUMN time_control_name VARCHAR(20) NOT NULL DEFAULT '{DEFAULT_TIME_CONTROL.name}'",
        ),
        ColumnCompatibility(
            "initial_time_ms",
            f"ALTER TABLE games ADD COLUMN initial_time_ms INTEGER NOT NULL DEFAULT {DEFAULT_TIME_CONTROL.initial_time_ms}",
        ),
        ColumnCompatibility(
            "increment_ms",
            f"ALTER TABLE games ADD COLUMN increment_ms INTEGER NOT NULL DEFAULT {DEFAULT_TIME_CONTROL.increment_ms}",
        ),
        ColumnCompatibility(
            "white_time_ms",
            f"ALTER TABLE games ADD COLUMN white_time_ms INTEGER NOT NULL DEFAULT {DEFAULT_TIME_CONTROL.initial_time_ms}",
        ),
        ColumnCompatibility(
            "black_time_ms",
            f"ALTER TABLE games ADD COLUMN black_time_ms INTEGER NOT NULL DEFAULT {DEFAULT_TIME_CONTROL.initial_time_ms}",
        ),
        ColumnCompatibility(
            "last_clock_started_at",
            "ALTER TABLE games ADD COLUMN last_clock_started_at TIMESTAMP WITH TIME ZONE",
        ),
        ColumnCompatibility("disconnected_player_id", "ALTER TABLE games ADD COLUMN disconnected_player_id UUID"),
        ColumnCompatibility(
            "disconnect_grace_deadline_at",
            "ALTER TABLE games ADD COLUMN disconnect_grace_deadline_at TIMESTAMP WITH TIME ZONE",
        ),
        ColumnCompatibility("white_rating_before", "ALTER TABLE games ADD COLUMN white_rating_before INTEGER NOT NULL DEFAULT 1200"),
        ColumnCompatibility("black_rating_before", "ALTER TABLE games ADD COLUMN black_rating_before INTEGER NOT NULL DEFAULT 1200"),
        ColumnCompatibility("white_rating_after", "ALTER TABLE games ADD COLUMN white_rating_after INTEGER"),
        ColumnCompatibility("black_rating_after", "ALTER TABLE games ADD COLUMN black_rating_after INTEGER"),
        ColumnCompatibility("termination_reason", "ALTER TABLE games ADD COLUMN termination_reason VARCHAR(40)"),
        ColumnCompatibility("rating_applied_at", "ALTER TABLE games ADD COLUMN rating_applied_at TIMESTAMP WITH TIME ZONE"),
    ),
)

TOURNAMENT_COMPATIBILITY = TableCompatibilityPlan(
    table_name="tournaments",
    columns=(
        ColumnCompatibility("owner_id", "ALTER TABLE tournaments ADD COLUMN owner_id UUID"),
        ColumnCompatibility(
            "time_control_name",
            f"ALTER TABLE tournaments ADD COLUMN time_control_name VARCHAR(20) NOT NULL DEFAULT '{DEFAULT_TIME_CONTROL.name}'",
        ),
        ColumnCompatibility(
            "initial_time_ms",
            f"ALTER TABLE tournaments ADD COLUMN initial_time_ms INTEGER NOT NULL DEFAULT {DEFAULT_TIME_CONTROL.initial_time_ms}",
        ),
        ColumnCompatibility(
            "increment_ms",
            f"ALTER TABLE tournaments ADD COLUMN increment_ms INTEGER NOT NULL DEFAULT {DEFAULT_TIME_CONTROL.increment_ms}",
        ),
        ColumnCompatibility(
            "status",
            f"ALTER TABLE tournaments ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT '{TournamentStatus.REGISTRATION}'",
        ),
        ColumnCompatibility("current_round", "ALTER TABLE tournaments ADD COLUMN current_round INTEGER NOT NULL DEFAULT 0"),
        ColumnCompatibility("total_rounds", "ALTER TABLE tournaments ADD COLUMN total_rounds INTEGER NOT NULL DEFAULT 0"),
        ColumnCompatibility("started_at", "ALTER TABLE tournaments ADD COLUMN started_at TIMESTAMP WITH TIME ZONE"),
        ColumnCompatibility("finished_at", "ALTER TABLE tournaments ADD COLUMN finished_at TIMESTAMP WITH TIME ZONE"),
    ),
)

USER_COMPATIBILITY = TableCompatibilityPlan(
    table_name="users",
    columns=(
        ColumnCompatibility("avatar_path", "ALTER TABLE users ADD COLUMN avatar_path VARCHAR(255)"),
    ),
)

COMPATIBILITY_PLANS = (
    GAME_COMPATIBILITY,
    TOURNAMENT_COMPATIBILITY,
    USER_COMPATIBILITY,
)


def apply_dev_compatibility_migrations(connection) -> None:
    """Backfill missing columns for older local databases created before current metadata."""
    inspector = inspect(connection)
    existing_tables = set(inspector.get_table_names())

    for plan in COMPATIBILITY_PLANS:
        if plan.table_name not in existing_tables:
            continue
        _apply_table_compatibility(connection, inspector, plan)


def _apply_table_compatibility(connection, inspector, plan: TableCompatibilityPlan) -> None:
    existing_columns = {column["name"] for column in inspector.get_columns(plan.table_name)}
    for column in plan.columns:
        if column.name not in existing_columns:
            connection.exec_driver_sql(column.ddl)
