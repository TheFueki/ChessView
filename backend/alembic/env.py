"""Alembic environment configuration for ChessView."""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
import sqlalchemy as sa
from sqlalchemy import engine_from_config, pool

from app.config import settings
from infrastructure.database import Base
from infrastructure.database_migrations import (
    HEAD_REVISION,
    apply_legacy_schema_fixes,
    should_stamp_baseline,
    to_migration_database_url,
    validate_existing_schema,
)
from infrastructure.database_registry import register_models


config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

register_models()
target_metadata = Base.metadata


def _resolved_database_url() -> str:
    configured_url = config.attributes.get("database_url")
    if configured_url:
        return configured_url
    return to_migration_database_url(settings.DATABASE_URL)


def run_migrations_offline() -> None:
    """Run migrations in offline mode."""
    context.configure(
        url=_resolved_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in online mode."""
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = _resolved_database_url()
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        _stamp_legacy_database_if_needed(connection)
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


def _stamp_legacy_database_if_needed(connection) -> None:
    existing_tables = set(sa.inspect(connection).get_table_names())
    validate_existing_schema(existing_tables)
    if not should_stamp_baseline(existing_tables):
        if connection.in_transaction():
            connection.rollback()
        return

    apply_legacy_schema_fixes(connection)
    version_table = sa.Table(
        "alembic_version",
        sa.MetaData(),
        sa.Column("version_num", sa.String(length=32), nullable=False),
        sa.PrimaryKeyConstraint("version_num"),
    )
    version_table.create(connection)
    connection.execute(sa.insert(version_table).values(version_num=HEAD_REVISION))
    connection.commit()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
