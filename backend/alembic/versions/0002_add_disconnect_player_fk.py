"""Add the missing disconnected-player foreign key for games."""

from __future__ import annotations

from alembic import op


revision = "0002_add_disconnect_player_fk"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None


CONSTRAINT_NAME = "fk_games_disconnected_player_id_users"


def upgrade() -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = '{CONSTRAINT_NAME}'
            ) THEN
                ALTER TABLE games
                ADD CONSTRAINT {CONSTRAINT_NAME}
                FOREIGN KEY (disconnected_player_id)
                REFERENCES users (id);
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = '{CONSTRAINT_NAME}'
            ) THEN
                ALTER TABLE games
                DROP CONSTRAINT {CONSTRAINT_NAME};
            END IF;
        END $$;
        """
    )
