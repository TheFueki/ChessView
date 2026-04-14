import { useGameStore } from "@/entities/game";
import { wsClient } from "@/shared/api";

export function useResignGame() {
  const gameId = useGameStore((state) => state.gameId);
  const status = useGameStore((state) => state.status);
  const setError = useGameStore((state) => state.setError);

  const resign = () => {
    if (!gameId || status !== "active") {
      return;
    }

    const confirmed = window.confirm("Resign this game?");
    if (!confirmed) {
      return;
    }

    const sent = wsClient.send("resign", {}, gameId);
    if (!sent) {
      setError({
        code: "WS_NOT_READY",
        message: "Unable to send resign right now.",
      });
    }
  };

  return {
    resign,
    canResign: Boolean(gameId) && status === "active",
  };
}
