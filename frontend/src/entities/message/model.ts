/**
 * Chat message entity and active room store.
 */

import { create } from "zustand";
import type { ChatMessagePayload } from "@/shared/types";

export interface ChatMessage {
  id: number;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
}

interface MessageState {
  gameId: string | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  setGameRoom: (gameId: string) => void;
  addMessage: (payload: ChatMessagePayload) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

function normalizeMessages(messages: ChatMessage[]): ChatMessage[] {
  const byId = new Map<number, ChatMessage>();

  for (const message of messages) {
    byId.set(message.id, message);
  }

  return [...byId.values()].sort((left, right) => {
    if (left.id !== right.id) {
      return left.id - right.id;
    }

    return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
  });
}

const initialState = {
  gameId: null as string | null,
  messages: [] as ChatMessage[],
  isLoading: false,
  error: null as string | null,
};

export const useMessageStore = create<MessageState>((set) => ({
  ...initialState,

  setGameRoom: (gameId) =>
    set((state) =>
      state.gameId === gameId
        ? state
        : {
            ...initialState,
            gameId,
          },
    ),

  addMessage: (payload) =>
    set((state) => ({
      messages: normalizeMessages([...state.messages, payload]),
      error: null,
    })),

  setMessages: (messages) =>
    set((state) => ({
      messages: normalizeMessages([...state.messages, ...messages]),
      isLoading: false,
      error: null,
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  clear: () => set(initialState),
}));
