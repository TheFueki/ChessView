import { create } from "zustand";
import type { ConnectionState, ErrorPayload, MatchFoundPayload, TimeControlKey } from "@/shared/types";

export type QueueStatus = "idle" | "joining" | "queued" | "leaving" | "matched";

interface MatchmakingState {
  queueStatus: QueueStatus;
  queuePosition: number | null;
  selectedTimeControl: TimeControlKey;
  connectionState: ConnectionState;
  lastError: ErrorPayload | null;
  lastMatch: MatchFoundPayload | null;
  setConnectionState: (state: ConnectionState) => void;
  setSelectedTimeControl: (timeControl: TimeControlKey) => void;
  setJoining: () => void;
  setQueued: (position: number) => void;
  setLeaving: () => void;
  clearQueue: () => void;
  setMatched: (payload: MatchFoundPayload) => void;
  setError: (payload: ErrorPayload | null) => void;
  reset: () => void;
}

const initialState = {
  queueStatus: "idle" as QueueStatus,
  queuePosition: null as number | null,
  selectedTimeControl: "5+0" as TimeControlKey,
  connectionState: "idle" as ConnectionState,
  lastError: null as ErrorPayload | null,
  lastMatch: null as MatchFoundPayload | null,
};

export const useMatchmakingStore = create<MatchmakingState>((set) => ({
  ...initialState,

  setConnectionState: (connectionState) => set({ connectionState }),

  setSelectedTimeControl: (selectedTimeControl) => set({ selectedTimeControl }),

  setJoining: () =>
    set({
      queueStatus: "joining",
      queuePosition: null,
      lastError: null,
      lastMatch: null,
    }),

  setQueued: (queuePosition) =>
    set({
      queueStatus: "queued",
      queuePosition,
      lastError: null,
    }),

  setLeaving: () =>
    set((state) => ({
      ...state,
      queueStatus: "leaving",
      lastError: null,
    })),

  clearQueue: () =>
    set((state) => ({
      ...state,
      queueStatus: "idle",
      queuePosition: null,
      lastError: null,
      lastMatch: null,
    })),

  setMatched: (lastMatch) =>
    set({
      queueStatus: "matched",
      queuePosition: null,
      lastError: null,
      lastMatch,
    }),

  setError: (lastError) =>
    set((state) => ({
      ...state,
      lastError,
    })),

  reset: () => set(initialState),
}));
