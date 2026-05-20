import { useEffect, useState } from "react";
import { useMessageStore } from "@/entities/message";
import { useGameStore } from "@/entities/game";
import { useUserStore } from "@/entities/user";
import { http, wsClient } from "@/shared/api";
import type { ChatMessagePayload } from "@/shared/types";

const MAX_MESSAGE_LENGTH = 500;
const CHAT_ERROR_CODES = new Set(["MESSAGE_TOO_LONG", "NOT_IN_GAME", "WS_NOT_READY"]);

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unable to load chat history right now.";
}

export function useGameChat() {
  const gameId = useGameStore((state) => state.gameId);
  const accessToken = useUserStore((state) => state.accessToken);
  const setGameRoom = useMessageStore((state) => state.setGameRoom);
  const setMessages = useMessageStore((state) => state.setMessages);
  const addMessage = useMessageStore((state) => state.addMessage);
  const setLoading = useMessageStore((state) => state.setLoading);
  const setError = useMessageStore((state) => state.setError);
  const clear = useMessageStore((state) => state.clear);

  useEffect(() => {
    if (!gameId || !accessToken) {
      clear();
      return;
    }

    setGameRoom(gameId);
    setLoading(true);
    setError(null);
    wsClient.connect(accessToken);

    let isDisposed = false;

    http
      .get<ChatMessagePayload[]>(`/chat/${gameId}/messages`)
      .then((messages) => {
        if (isDisposed) {
          return;
        }

        setMessages(messages);
      })
      .catch((error) => {
        if (isDisposed) {
          return;
        }

        setError(toErrorMessage(error));
      });

    const offChatMessage = wsClient.on("chat_message", (envelope) => {
      if (envelope.game_id !== gameId) {
        return;
      }

      addMessage(envelope.payload);
    });

    const offError = wsClient.on("error", ({ payload }) => {
      if (!CHAT_ERROR_CODES.has(payload.code)) {
        return;
      }

      setError(payload.message);
    });

    return () => {
      isDisposed = true;
      offChatMessage();
      offError();
    };
  }, [accessToken, addMessage, clear, gameId, setError, setGameRoom, setLoading, setMessages]);
}

export function useSendMessage() {
  const gameId = useGameStore((state) => state.gameId);
  const setError = useMessageStore((state) => state.setError);
  const [isSending, setIsSending] = useState(false);

  const sendMessage = (rawContent: string): boolean => {
    const content = rawContent.trim();

    if (!gameId || !content || isSending) {
      return false;
    }

    if (content.length > MAX_MESSAGE_LENGTH) {
      setError(`Message exceeds ${MAX_MESSAGE_LENGTH} characters.`);
      return false;
    }

    setError(null);
    setIsSending(true);
    const sent = wsClient.send("chat_send", { content }, gameId);
    setIsSending(false);

    if (!sent) {
      setError("Realtime connection is not ready yet.");
      return false;
    }

    return true;
  };

  return {
    sendMessage,
    isSending,
    maxLength: MAX_MESSAGE_LENGTH,
  };
}
