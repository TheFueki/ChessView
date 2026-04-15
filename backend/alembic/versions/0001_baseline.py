"""Baseline schema for ChessView v1."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("username", sa.String(length=32), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password", sa.String(length=255), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("avatar_path", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("username"),
    )

    op.create_table(
        "games",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("white_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("black_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("time_control_name", sa.String(length=20), nullable=False),
        sa.Column("initial_time_ms", sa.Integer(), nullable=False),
        sa.Column("increment_ms", sa.Integer(), nullable=False),
        sa.Column("white_time_ms", sa.Integer(), nullable=False),
        sa.Column("black_time_ms", sa.Integer(), nullable=False),
        sa.Column("last_clock_started_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("disconnected_player_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("disconnect_grace_deadline_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("rated", sa.Boolean(), nullable=False),
        sa.Column("white_rating_before", sa.Integer(), nullable=False),
        sa.Column("black_rating_before", sa.Integer(), nullable=False),
        sa.Column("white_rating_after", sa.Integer(), nullable=True),
        sa.Column("black_rating_after", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("result", sa.String(length=10), nullable=True),
        sa.Column("fen", sa.Text(), nullable=False),
        sa.Column("pgn", sa.Text(), nullable=True),
        sa.Column(
            "started_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("ended_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("termination_reason", sa.String(length=40), nullable=True),
        sa.Column("rating_applied_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["black_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["white_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "puzzles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("fen", sa.Text(), nullable=False),
        sa.Column("solution_moves", sa.JSON(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("themes", sa.JSON(), nullable=False),
        sa.Column("source_game_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["source_game_id"], ["games.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "tournaments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("time_control_name", sa.String(length=20), nullable=False),
        sa.Column("initial_time_ms", sa.Integer(), nullable=False),
        sa.Column("increment_ms", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("current_round", sa.Integer(), nullable=False),
        sa.Column("total_rounds", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("started_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("finished_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("game_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.String(length=500), nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "moves",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("game_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("uci", sa.String(length=5), nullable=False),
        sa.Column("fen_after", sa.Text(), nullable=False),
        sa.Column("move_number", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "puzzle_attempts",
        sa.Column("puzzle_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("attempts_count", sa.Integer(), nullable=False),
        sa.Column("solved", sa.Boolean(), nullable=False),
        sa.Column("last_result", sa.String(length=20), nullable=True),
        sa.Column("last_attempted_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["puzzle_id"], ["puzzles.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("puzzle_id", "user_id"),
    )

    op.create_table(
        "tournament_players",
        sa.Column("tournament_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("seed_rating", sa.Integer(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column(
            "joined_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("tournament_id", "user_id"),
    )

    op.create_table(
        "tournament_rounds",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("tournament_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "tournament_pairings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("tournament_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("round_number", sa.Integer(), nullable=False),
        sa.Column("white_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("black_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("game_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("result", sa.String(length=10), nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["black_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"]),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
        sa.ForeignKeyConstraint(["white_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("game_id"),
    )


def downgrade() -> None:
    op.drop_table("tournament_pairings")
    op.drop_table("tournament_rounds")
    op.drop_table("tournament_players")
    op.drop_table("puzzle_attempts")
    op.drop_table("moves")
    op.drop_table("chat_messages")
    op.drop_table("tournaments")
    op.drop_table("puzzles")
    op.drop_table("games")
    op.drop_table("users")
