"""Abstract tournament repository port."""

from abc import ABC, abstractmethod
from uuid import UUID

from domains.tournaments.domain.entities import (
    Tournament,
    TournamentPairing,
    TournamentPlayer,
    TournamentRound,
)


class AbstractTournamentRepository(ABC):
    @abstractmethod
    async def create_tournament(self, tournament: Tournament) -> Tournament:
        ...

    @abstractmethod
    async def get_tournament(self, tournament_id: UUID) -> Tournament | None:
        ...

    @abstractmethod
    async def list_tournaments(self) -> list[Tournament]:
        ...

    @abstractmethod
    async def update_tournament(self, tournament: Tournament) -> Tournament:
        ...

    @abstractmethod
    async def add_player(self, player: TournamentPlayer) -> TournamentPlayer:
        ...

    @abstractmethod
    async def get_player(self, tournament_id: UUID, user_id: UUID) -> TournamentPlayer | None:
        ...

    @abstractmethod
    async def list_players(self, tournament_id: UUID) -> list[TournamentPlayer]:
        ...

    @abstractmethod
    async def remove_player(self, tournament_id: UUID, user_id: UUID) -> None:
        ...

    @abstractmethod
    async def update_players(self, players: list[TournamentPlayer]) -> list[TournamentPlayer]:
        ...

    @abstractmethod
    async def create_round(self, tournament_round: TournamentRound) -> TournamentRound:
        ...

    @abstractmethod
    async def list_rounds(self, tournament_id: UUID) -> list[TournamentRound]:
        ...

    @abstractmethod
    async def add_pairing(self, pairing: TournamentPairing) -> TournamentPairing:
        ...

    @abstractmethod
    async def list_pairings(
        self,
        tournament_id: UUID,
        round_number: int | None = None,
    ) -> list[TournamentPairing]:
        ...

    @abstractmethod
    async def get_pairing_by_game_id(self, game_id: UUID) -> TournamentPairing | None:
        ...

    @abstractmethod
    async def update_pairing(self, pairing: TournamentPairing) -> TournamentPairing:
        ...
