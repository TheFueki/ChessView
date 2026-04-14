import { useMatchmakingStore } from "@/entities/matchmaking";
import { wsClient } from "@/shared/api";

export function useLeaveMatchmaking() {
  const setLeaving = useMatchmakingStore((state) => state.setLeaving);
  const clearQueue = useMatchmakingStore((state) => state.clearQueue);
  const setError = useMatchmakingStore((state) => state.setError);

  const leaveQueue = () => {
    setLeaving();
    const sent = wsClient.send("queue_leave", {});

    if (!sent) {
      clearQueue();
      setError({
        code: "WS_NOT_READY",
        message: "Unable to leave the queue because realtime is disconnected.",
      });
      return;
    }

    clearQueue();
  };

  return { leaveQueue };
}
