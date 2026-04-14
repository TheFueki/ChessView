import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useGameStore } from "@/entities/game";
import { useMatchmakingStore } from "@/entities/matchmaking";
import { useUserStore } from "@/entities/user";
import { wsClient } from "@/shared/api";

export function useLobbyMatchmakingRealtime() {
  const navigate = useNavigate();
  const accessToken = useUserStore((state) => state.accessToken);
  const setGame = useGameStore((state) => state.setGame);
  const setConnectionState = useMatchmakingStore((state) => state.setConnectionState);
  const setQueued = useMatchmakingStore((state) => state.setQueued);
  const setMatched = useMatchmakingStore((state) => state.setMatched);
  const setError = useMatchmakingStore((state) => state.setError);
  const clearQueue = useMatchmakingStore((state) => state.clearQueue);

  useEffect(() => {
    if (!accessToken) {
      clearQueue();
      setConnectionState("idle");
      return;
    }

    wsClient.connect(accessToken);

    const offConnection = wsClient.onConnectionStateChange((state) => {
      setConnectionState(state);
      if (state === "disconnected") {
        clearQueue();
      }
    });

    const offQueueJoined = wsClient.on("queue_joined", ({ payload }) => {
      setQueued(payload.position);
      setError(null);
    });

    const offMatchFound = wsClient.on("match_found", ({ payload }) => {
      setMatched(payload);
      setGame(payload.game_id, payload.color);
      navigate(`/game/${payload.game_id}`);
    });

    const offError = wsClient.on("error", ({ payload }) => {
      setError(payload);

      if (payload.code === "NOT_IN_QUEUE") {
        clearQueue();
      }
    });

    return () => {
      offConnection();
      offQueueJoined();
      offMatchFound();
      offError();
    };
  }, [accessToken, clearQueue, navigate, setConnectionState, setError, setGame, setMatched, setQueued]);
}

export function useJoinMatchmaking() {
  const connectionState = useMatchmakingStore((state) => state.connectionState);
  const queueStatus = useMatchmakingStore((state) => state.queueStatus);
  const selectedTimeControl = useMatchmakingStore((state) => state.selectedTimeControl);
  const setJoining = useMatchmakingStore((state) => state.setJoining);
  const setError = useMatchmakingStore((state) => state.setError);
  const clearQueue = useMatchmakingStore((state) => state.clearQueue);

  const joinQueue = () => {
    if (queueStatus === "joining" || queueStatus === "queued") {
      return;
    }

    if (!wsClient.isOpen()) {
      clearQueue();
      setError({
        code: "WS_NOT_READY",
        message:
          connectionState === "connecting"
            ? "Connecting to matchmaking server..."
            : "Realtime connection is not ready yet.",
      });
      return;
    }

    setJoining();
    const sent = wsClient.send("queue_join", { time_control: selectedTimeControl });
    if (!sent) {
      clearQueue();
      setError({
        code: "WS_NOT_READY",
        message: "Unable to send queue request right now.",
      });
    }
  };

  return { joinQueue };
}
