from __future__ import annotations

from collections.abc import AsyncIterator, Callable
from typing import Any

from fastapi import APIRouter, FastAPI

from app.dependencies import get_current_user_id, get_db, require_admin


class ScalarResult:
    def __init__(self, values: list[Any]) -> None:
        self._values = values

    def scalars(self) -> "ScalarResult":
        return self

    def all(self) -> list[Any]:
        return self._values

    def scalar_one_or_none(self) -> Any | None:
        return self._values[0] if self._values else None


class MemorySession:
    def __init__(self) -> None:
        self.store: dict[tuple[Any, Any], Any] = {}
        self.added: list[Any] = []
        self.deleted: list[Any] = []
        self.commits = 0
        self.refreshes: list[Any] = []
        self.executed: list[Any] = []

    def add(self, item: Any) -> None:
        self.added.append(item)
        key = getattr(item, "id", None)
        if key is not None:
            self.store[(type(item), key)] = item

    async def get(self, model: Any, key: Any) -> Any | None:
        return self.store.get((model, key))

    async def execute(self, statement: Any) -> ScalarResult:
        self.executed.append(statement)
        entity = statement.column_descriptions[0]["entity"]
        return ScalarResult(
            [item for (model, _), item in self.store.items() if model is entity]
        )

    async def commit(self) -> None:
        self.commits += 1

    async def refresh(self, item: Any) -> None:
        self.refreshes.append(item)

    async def delete(self, item: Any) -> None:
        self.deleted.append(item)


def app_with_router(
    router: APIRouter,
    *,
    prefix: str,
    user_id: str | None = None,
    session: Any | None = None,
    admin_id: str | None = None,
) -> FastAPI:
    app = FastAPI()
    app.include_router(router, prefix=prefix)

    if user_id is not None:
        app.dependency_overrides[get_current_user_id] = lambda: user_id

    if admin_id is not None:
        app.dependency_overrides[require_admin] = lambda: admin_id

    if session is not None:
        async def override_db() -> AsyncIterator[Any]:
            yield session

        app.dependency_overrides[get_db] = override_db

    return app
