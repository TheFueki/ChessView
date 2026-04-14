import { useEffect } from "react";
import type { Piece, Square } from "react-chessboard/dist/chessboard/types";
import { useGameStore } from "@/entities/game";
import { useUserStore } from "@/entities/user";
import { http, wsClient } from "@/shared/api";
import { buildMoveUci, getLegalMoves, getSquareColor } from "@/shared/lib/chess";
import type { ErrorPayload, GameDetailResponse } from "@/shared/types";

const GAME_ERROR_CODES = new Set([
  "NOT_IN_GAME",
  "NOT_YOUR_TURN",
  "ILLEGAL_MOVE",
  "GAME_NOT_ACTIVE",
  "WS_NOT_READY",
  "LOAD_GAME_FAILED",
]);

function toErrorPayload(error: unknown): ErrorPayload {
  if (error instanceof Error) {
    return {
      code: "LOAD_GAME_FAILED",
      message: error.message,
    };
  }

  return {
    code: "LOAD_GAME_FAILED",
    message: "Unable to load the game right now.",
  };
}

export function useGameRealtime(gameId: string | undefined) {
  const accessToken = useUserStore((state) => state.accessToken);
  const user = useUserStore((state) => state.user);
  const setUser = useUserStore((state) => state.setUser);
  const setGame = useGameStore((state) => state.setGame);
  const hydrateGame = useGameStore((state) => state.hydrateGame);
  const updateState = useGameStore((state) => state.updateState);
  const setGameOver = useGameStore((state) => state.setGameOver);
  const setError = useGameStore((state) => state.setError);
  const setLoading = useGameStore((state) => state.setLoading);

  useEffect(() => {
    if (!gameId || !accessToken) {
      return;
    }

    setGame(gameId, null);
    setLoading(true);
    setError(null);
    wsClient.connect(accessToken);

    let isDisposed = false;

    http
      .get<GameDetailResponse>(`/games/${gameId}`)
      .then((response) => {
        if (isDisposed) {
          return;
        }

        hydrateGame(response, user?.id ?? null);
      })
      .catch((error) => {
        if (isDisposed) {
          return;
        }

        setLoading(false);
        setError(toErrorPayload(error));
      });

    const offGameState = wsClient.on("game_state", (envelope) => {
      if (envelope.game_id !== gameId) {
        return;
      }

      updateState(envelope.payload);
    });

    const offGameOver = wsClient.on("game_over", (envelope) => {
      if (envelope.game_id !== gameId) {
        return;
      }

      if (user && envelope.payload.rating_update) {
        const isWhitePlayer = user.id === useGameStore.getState().white?.id;
        const isBlackPlayer = user.id === useGameStore.getState().black?.id;

        if (isWhitePlayer) {
          setUser({ ...user, rating: envelope.payload.rating_update.white.after });
        } else if (isBlackPlayer) {
          setUser({ ...user, rating: envelope.payload.rating_update.black.after });
        }
      }

      setGameOver(envelope.payload);
    });

    const offError = wsClient.on("error", ({ payload }) => {
      if (!GAME_ERROR_CODES.has(payload.code)) {
        return;
      }

      setError(payload);
    });

    return () => {
      isDisposed = true;
      offGameState();
      offGameOver();
      offError();
    };
  }, [accessToken, gameId, hydrateGame, setError, setGame, setGameOver, setLoading, setUser, updateState, user]);
}

function createNotYourTurnError(isPaused: boolean | undefined): ErrorPayload {
  return {
    code: "NOT_YOUR_TURN",
    message: isPaused ? "The game is paused during reconnect grace." : "Wait for your turn before moving.",
  };
}

export function useMakeMove() {
  const gameId = useGameStore((state) => state.gameId);
  const fen = useGameStore((state) => state.fen);
  const myColor = useGameStore((state) => state.myColor);
  const turn = useGameStore((state) => state.turn);
  const status = useGameStore((state) => state.status);
  const clock = useGameStore((state) => state.clock);
  const selectedSquare = useGameStore((state) => state.selectedSquare);
  const legalTargets = useGameStore((state) => state.legalTargets);
  const premove = useGameStore((state) => state.premove);
  const setSelection = useGameStore((state) => state.setSelection);
  const clearSelection = useGameStore((state) => state.clearSelection);
  const setPremove = useGameStore((state) => state.setPremove);
  const clearPremove = useGameStore((state) => state.clearPremove);
  const setError = useGameStore((state) => state.setError);

  const isGameOver = status !== "active";
  const isPaused = Boolean(clock?.is_paused);
  const isMyTurn = Boolean(myColor) && myColor === turn && !isGameOver && !isPaused;
  const canQueuePremove = Boolean(myColor) && myColor !== turn && !isGameOver && !isPaused;

  const submitMove = (uci: string, options?: { clearQueuedPremove?: boolean; suppressSocketError?: boolean }) => {
    if (!gameId) {
      return false;
    }

    setError(null);
    clearSelection();

    const sent = wsClient.send("move", { uci }, gameId);
    if (!sent && !options?.suppressSocketError) {
      setError({
        code: "WS_NOT_READY",
        message: "Realtime connection is not ready yet.",
      });
      return false;
    }

    if (sent && options?.clearQueuedPremove) {
      clearPremove();
    }

    return sent;
  };

  const selectSquare = (square: Square, previewColor?: typeof myColor) => {
    if (!myColor) {
      clearSelection();
      return;
    }

    const pieceColor = getSquareColor(fen, square);
    if (pieceColor !== myColor) {
      clearSelection();
      return;
    }

    const targets = getLegalMoves(fen, square, previewColor ?? undefined);
    if (targets.length === 0) {
      clearSelection();
      return;
    }

    setSelection(square, targets);
    setError(null);
  };

  const clearQueuedMoveOnInteraction = () => {
    if (premove) {
      clearPremove();
    }
  };

  const onPieceDrop = (sourceSquare: Square, targetSquare: Square): boolean => {
    clearQueuedMoveOnInteraction();

    if (isGameOver) {
      setError({
        code: "GAME_NOT_ACTIVE",
        message: "This game is finished. Moves are disabled.",
      });
      return false;
    }

    if (!isMyTurn) {
      setError(createNotYourTurnError(isPaused));
      return false;
    }

    const uci = buildMoveUci(fen, sourceSquare, targetSquare);
    if (!uci) {
      setError({
        code: "ILLEGAL_MOVE",
        message: "That move is not legal in the current position.",
      });
      return false;
    }

    return submitMove(uci);
  };

  const onPieceDragBegin = (piece: Piece, sourceSquare: Square) => {
    clearQueuedMoveOnInteraction();

    if (!isMyTurn || !myColor) {
      return;
    }

    const pieceColor = piece.startsWith("w") ? "white" : "black";
    if (pieceColor !== myColor) {
      clearSelection();
      return;
    }

    selectSquare(sourceSquare);
  };

  const onSquareClick = (square: Square) => {
    if (!myColor) {
      clearSelection();
      return;
    }

    const pieceColor = getSquareColor(fen, square);
    const hadQueuedPremove = Boolean(premove);

    if (hadQueuedPremove) {
      clearPremove();
    }

    if (isGameOver) {
      clearSelection();
      setError({
        code: "GAME_NOT_ACTIVE",
        message: "This game is finished. Moves are disabled.",
      });
      return;
    }

    if (isMyTurn) {
      if (selectedSquare && legalTargets.includes(square)) {
        const uci = buildMoveUci(fen, selectedSquare, square);

        if (!uci) {
          clearSelection();
          setError({
            code: "ILLEGAL_MOVE",
            message: "That move is not legal in the current position.",
          });
          return;
        }

        submitMove(uci);
        return;
      }

      if (pieceColor === myColor) {
        selectSquare(square);
        return;
      }

      clearSelection();
      return;
    }

    if (canQueuePremove) {
      if (selectedSquare && legalTargets.includes(square)) {
        const uci = buildMoveUci(fen, selectedSquare, square, myColor);

        if (!uci) {
          clearSelection();
          return;
        }

        setPremove({
          from: selectedSquare,
          to: square,
          uci,
        });
        setError(null);
        return;
      }

      if (pieceColor === myColor) {
        selectSquare(square, myColor);
        return;
      }

      clearSelection();
      return;
    }

    clearSelection();
    if (pieceColor === myColor || selectedSquare) {
      setError(createNotYourTurnError(isPaused));
    }
  };

  const isDraggablePiece = ({ piece }: { piece: Piece; sourceSquare: Square }) => {
    if (!isMyTurn) {
      return false;
    }

    return myColor === "white" ? piece.startsWith("w") : piece.startsWith("b");
  };

  useEffect(() => {
    if (!premove || !isMyTurn || !gameId) {
      return;
    }

    const uci = buildMoveUci(fen, premove.from, premove.to);
    if (!uci) {
      clearPremove();
      return;
    }

    setError(null);
    clearSelection();

    const sent = wsClient.send("move", { uci }, gameId);
    if (!sent) {
      setError({
        code: "WS_NOT_READY",
        message: "Realtime connection is not ready yet.",
      });
      return;
    }

    clearPremove();
  }, [clearPremove, clearSelection, fen, gameId, isMyTurn, premove, setError]);

  return {
    isMyTurn,
    isGameOver,
    selectedSquare,
    legalTargets,
    premove,
    isDraggablePiece,
    onPieceDrop,
    onPieceDragBegin,
    onSquareClick,
  };
}
