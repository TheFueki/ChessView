import { describe, expect, it } from "vitest";
import { useMatchmakingStore } from "../model";

describe("matchmaking store", () => {
  it("moves through queue states without carrying stale match or error data", () => {
    useMatchmakingStore.getState().reset();

    useMatchmakingStore.getState().setJoining();
    expect(useMatchmakingStore.getState()).toMatchObject({
      queueStatus: "joining",
      queuePosition: null,
      lastError: null,
      lastMatch: null,
    });

    useMatchmakingStore.getState().setQueued(3);
    expect(useMatchmakingStore.getState()).toMatchObject({
      queueStatus: "queued",
      queuePosition: 3,
      lastError: null,
    });

    useMatchmakingStore.getState().setMatched({
      game_id: "game-1",
      color: "white",
      time_control: "5+0",
      opponent: { id: "opponent", username: "Noether", rating: 1600 },
    });
    expect(useMatchmakingStore.getState()).toMatchObject({
      queueStatus: "matched",
      queuePosition: null,
      lastError: null,
      lastMatch: { game_id: "game-1" },
    });
  });
});
