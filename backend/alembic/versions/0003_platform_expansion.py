"""Add platform expansion foundations."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0003_platform_expansion"
down_revision = "0002_add_disconnect_player_fk"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("bio", sa.String(length=160), nullable=True))
    op.add_column("users", sa.Column("role", sa.String(length=20), nullable=False, server_default="user"))
    op.add_column("users", sa.Column("banned_at", postgresql.TIMESTAMP(timezone=True), nullable=True))
    op.alter_column("users", "role", server_default=None)

    op.add_column("tournaments", sa.Column("tournament_type", sa.String(length=20), nullable=False, server_default="swiss"))
    op.add_column("tournaments", sa.Column("entry_fee_cents", sa.Integer(), nullable=False, server_default="0"))
    op.alter_column("tournaments", "tournament_type", server_default=None)
    op.alter_column("tournaments", "entry_fee_cents", server_default=None)

    op.add_column("tournament_players", sa.Column("status", sa.String(length=20), nullable=False, server_default="active"))
    op.add_column("tournament_players", sa.Column("withdrawn_at", postgresql.TIMESTAMP(timezone=True), nullable=True))
    op.alter_column("tournament_players", "status", server_default=None)

    op.create_table(
        "admin_audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("action", sa.String(length=80), nullable=False),
        sa.Column("target_type", sa.String(length=80), nullable=False),
        sa.Column("target_id", sa.String(length=120), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_admin_audit_logs_created_at", "admin_audit_logs", ["created_at"])
    op.create_index("ix_admin_audit_logs_actor_user_id", "admin_audit_logs", ["actor_user_id"])

    op.create_table(
        "scheduled_matches",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tournament_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("round_id", sa.Integer(), nullable=True),
        sa.Column("pairing_id", sa.Integer(), nullable=True),
        sa.Column("white_player_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("black_player_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("creator_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invited_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("starts_at", postgresql.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("expires_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("game_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["black_player_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["creator_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"]),
        sa.ForeignKeyConstraint(["invited_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
        sa.ForeignKeyConstraint(["white_player_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scheduled_matches_creator_user_id", "scheduled_matches", ["creator_user_id"])
    op.create_index("ix_scheduled_matches_invited_user_id", "scheduled_matches", ["invited_user_id"])
    op.create_index("ix_scheduled_matches_game_id", "scheduled_matches", ["game_id"])
    op.create_index("ix_scheduled_matches_status_starts_at", "scheduled_matches", ["status", "starts_at"])

    op.create_table(
        "payment_intents",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tournament_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("scenario", sa.String(length=20), nullable=True),
        sa.Column("reserved_until", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payment_intents_user_id", "payment_intents", ["user_id"])
    op.create_index("ix_payment_intents_tournament_id", "payment_intents", ["tournament_id"])
    op.create_index("ix_payment_intents_status", "payment_intents", ["status"])
    op.create_table(
        "payment_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("payment_intent_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(length=40), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["payment_intent_id"], ["payment_intents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payment_events_payment_intent_id", "payment_events", ["payment_intent_id"])

    op.create_table(
        "face_verification_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("device_label", sa.String(length=120), nullable=True),
        sa.Column("consented_at", postgresql.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_face_verification_profiles_user_id", "face_verification_profiles", ["user_id"])
    op.create_table(
        "face_verification_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("game_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("tournament_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("scheduled_match_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("reason", sa.String(length=240), nullable=True),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("completed_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["game_id"], ["games.id"]),
        sa.ForeignKeyConstraint(["scheduled_match_id"], ["scheduled_matches.id"]),
        sa.ForeignKeyConstraint(["tournament_id"], ["tournaments.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_face_verification_sessions_user_id", "face_verification_sessions", ["user_id"])
    op.create_index("ix_face_verification_sessions_game_id", "face_verification_sessions", ["game_id"])
    op.create_index("ix_face_verification_sessions_scheduled_match_id", "face_verification_sessions", ["scheduled_match_id"])
    op.create_table(
        "face_verification_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(length=40), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", postgresql.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["face_verification_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_face_verification_events_session_id", "face_verification_events", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_face_verification_events_session_id", table_name="face_verification_events")
    op.drop_index("ix_face_verification_sessions_scheduled_match_id", table_name="face_verification_sessions")
    op.drop_index("ix_face_verification_sessions_game_id", table_name="face_verification_sessions")
    op.drop_index("ix_face_verification_sessions_user_id", table_name="face_verification_sessions")
    op.drop_index("ix_face_verification_profiles_user_id", table_name="face_verification_profiles")
    op.drop_index("ix_payment_events_payment_intent_id", table_name="payment_events")
    op.drop_index("ix_payment_intents_status", table_name="payment_intents")
    op.drop_index("ix_payment_intents_tournament_id", table_name="payment_intents")
    op.drop_index("ix_payment_intents_user_id", table_name="payment_intents")
    op.drop_index("ix_scheduled_matches_status_starts_at", table_name="scheduled_matches")
    op.drop_index("ix_scheduled_matches_game_id", table_name="scheduled_matches")
    op.drop_index("ix_scheduled_matches_invited_user_id", table_name="scheduled_matches")
    op.drop_index("ix_scheduled_matches_creator_user_id", table_name="scheduled_matches")
    op.drop_index("ix_admin_audit_logs_actor_user_id", table_name="admin_audit_logs")
    op.drop_index("ix_admin_audit_logs_created_at", table_name="admin_audit_logs")
    op.drop_table("face_verification_events")
    op.drop_table("face_verification_sessions")
    op.drop_table("face_verification_profiles")
    op.drop_table("payment_events")
    op.drop_table("payment_intents")
    op.drop_table("scheduled_matches")
    op.drop_table("admin_audit_logs")
    op.drop_column("tournament_players", "withdrawn_at")
    op.drop_column("tournament_players", "status")
    op.drop_column("tournaments", "entry_fee_cents")
    op.drop_column("tournaments", "tournament_type")
    op.drop_column("users", "banned_at")
    op.drop_column("users", "role")
    op.drop_column("users", "bio")
