/**
 * chess.js helper utilities.
 *
 * Client-side move preview and board state helpers.
 * The server is the source of truth - these are for UI only.
 *
 * FSD layer: shared/lib
 */

import { Chess } from "chess.js";
import type { PlayerColor } from "@/shared/types";

export const STANDARD_START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const BOARD_FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const BOARD_RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

export type EditorPieceCode =
  | "wP"
  | "wN"
  | "wB"
  | "wR"
  | "wQ"
  | "wK"
  | "bP"
  | "bN"
  | "bB"
  | "bR"
  | "bQ"
  | "bK";

export type BoardPosition = Partial<Record<string, EditorPieceCode>>;

export interface FenMetadata {
  turn: PlayerColor;
  castling: {
    whiteKingside: boolean;
    whiteQueenside: boolean;
    blackKingside: boolean;
    blackQueenside: boolean;
  };
}

export interface SandboxMove {
  moveNumber: number;
  uci: string;
  san: string;
  fenAfter: string;
}

interface ParsedUciMove {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
}

function toChessColor(color: PlayerColor) {
  return color === "white" ? "w" : "b";
}

function buildPreviewBoard(fen: string, color?: PlayerColor): Chess {
  const game = new Chess(fen);

  if (color) {
    game.setTurn(toChessColor(color));
  }

  return game;
}

function getMovesForSquare(fen: string, square: string, color?: PlayerColor) {
  const game = buildPreviewBoard(fen, color);
  return game.moves({ square: square as never, verbose: true });
}

function parseUciMove(uci: string): ParsedUciMove | null {
  if (uci.length < 4) {
    return null;
  }

  const parsedMove: ParsedUciMove = {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
  };

  const promotion = uci.slice(4, 5).toLowerCase();
  if (promotion === "q" || promotion === "r" || promotion === "b" || promotion === "n") {
    parsedMove.promotion = promotion;
  }

  return parsedMove;
}

function tryApplyUciMove(game: Chess, uci: string) {
  const parsedMove = parseUciMove(uci);
  if (!parsedMove) {
    return null;
  }

  try {
    return game.move(parsedMove);
  } catch {
    return null;
  }
}

export function createBoardFromFen(fen: string): Chess {
  return new Chess(fen);
}

export function boardPositionFromFen(fen: string): BoardPosition {
  const game = new Chess(fen);
  const position: BoardPosition = {};

  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece) {
        continue;
      }

      position[piece.square] = `${piece.color}${piece.type.toUpperCase()}` as EditorPieceCode;
    }
  }

  return position;
}

export function fenMetadataFromFen(fen: string): FenMetadata {
  const [, activeColor = "w", castlingToken = "-"] = fen.split(" ");

  return {
    turn: activeColor === "b" ? "black" : "white",
    castling: {
      whiteKingside: castlingToken.includes("K"),
      whiteQueenside: castlingToken.includes("Q"),
      blackKingside: castlingToken.includes("k"),
      blackQueenside: castlingToken.includes("q"),
    },
  };
}

function fenPlacementFromBoardPosition(position: BoardPosition): string {
  return BOARD_RANKS.map((rank) => {
    let emptyCount = 0;
    let row = "";

    for (const file of BOARD_FILES) {
      const piece = position[`${file}${rank}`];
      if (!piece) {
        emptyCount += 1;
        continue;
      }

      if (emptyCount > 0) {
        row += String(emptyCount);
        emptyCount = 0;
      }

      const symbol = piece[1];
      row += piece[0] === "w" ? symbol : symbol.toLowerCase();
    }

    if (emptyCount > 0) {
      row += String(emptyCount);
    }

    return row || "8";
  }).join("/");
}

function fenCastlingToken(metadata: FenMetadata): string {
  const token = [
    metadata.castling.whiteKingside ? "K" : "",
    metadata.castling.whiteQueenside ? "Q" : "",
    metadata.castling.blackKingside ? "k" : "",
    metadata.castling.blackQueenside ? "q" : "",
  ].join("");

  return token || "-";
}

export function buildFenFromEditorState(position: BoardPosition, metadata: FenMetadata) {
  const fen = `${fenPlacementFromBoardPosition(position)} ${metadata.turn === "black" ? "b" : "w"} ${fenCastlingToken(metadata)} - 0 1`;

  try {
    new Chess(fen);
    return {
      fen,
      error: null,
    };
  } catch (error) {
    return {
      fen: null,
      error: error instanceof Error ? error.message : "Invalid board setup.",
    };
  }
}

export function applySandboxMove(fen: string, uci: string): SandboxMove | null {
  const game = new Chess(fen);
  const move = tryApplyUciMove(game, uci);

  if (!move) {
    return null;
  }

  return {
    moveNumber: game.history().length,
    uci: `${move.from}${move.to}${move.promotion ?? ""}`,
    san: move.san,
    fenAfter: game.fen(),
  };
}

export function applySandboxMoveFromSquares(
  fen: string,
  from: string,
  to: string,
  color?: PlayerColor,
): SandboxMove | null {
  const uci = buildMoveUci(fen, from, to, color);
  if (!uci) {
    return null;
  }

  return applySandboxMove(fen, uci);
}

export function parsePgnToSandbox(pgn: string): { headers: Record<string, string>; rootFen: string; moves: SandboxMove[]; normalizedPgn: string } {
  const game = new Chess();
  game.loadPgn(pgn);

  const verboseMoves = game.history({ verbose: true });
  const headers = game.getHeaders();
  const rootFen = verboseMoves[0]?.before ?? headers.FEN ?? STANDARD_START_FEN;

  return {
    headers,
    rootFen,
    normalizedPgn: game.pgn(),
    moves: verboseMoves.map((move, index) => ({
      moveNumber: index + 1,
      uci: `${move.from}${move.to}${move.promotion ?? ""}`,
      san: move.san,
      fenAfter: move.after,
    })),
  };
}

export function isLegalMove(fen: string, from: string, to: string, color?: PlayerColor): boolean {
  const moves = getMovesForSquare(fen, from, color);
  return moves.some((move) => move.to === to);
}

export function getLegalMoves(fen: string, square: string, color?: PlayerColor): string[] {
  return getMovesForSquare(fen, square, color).map((move) => move.to);
}

export function buildMoveUci(fen: string, from: string, to: string, color?: PlayerColor): string | null {
  const moves = getMovesForSquare(fen, from, color);
  const matchingMove = moves.find((move) => move.to === to);

  if (!matchingMove) {
    return null;
  }

  return `${matchingMove.from}${matchingMove.to}${matchingMove.promotion ?? ""}`;
}

export function getSquareColor(fen: string, square: string): PlayerColor | null {
  const game = new Chess(fen);
  const piece = game.get(square as never);

  if (!piece) {
    return null;
  }

  return piece.color === "w" ? "white" : "black";
}

export function getCheckSquare(fen: string): string | null {
  const game = new Chess(fen);

  if (!game.isCheck()) {
    return null;
  }

  const kingSquares = game.findPiece({
    type: "k",
    color: game.turn(),
  });

  return kingSquares[0] ?? null;
}

export function getMoveSquares(uci: string | null | undefined): [string, string] | null {
  if (!uci || uci.length < 4) {
    return null;
  }

  return [uci.slice(0, 2), uci.slice(2, 4)];
}

export function uciToSan(fen: string, uci: string): string | null {
  const game = new Chess(fen);
  const move = tryApplyUciMove(game, uci);
  return move?.san ?? null;
}

export function formatPrincipalVariation(fen: string, uciMoves: string[]): string {
  if (uciMoves.length === 0) {
    return "";
  }

  const game = new Chess(fen);
  const sanMoves: string[] = [];

  for (const uci of uciMoves) {
    const move = tryApplyUciMove(game, uci);
    if (!move) {
      break;
    }

    sanMoves.push(move.san);
  }

  return sanMoves.join(" ");
}

export function isPlayableUciMove(fen: string, uci: string): boolean {
  const game = new Chess(fen);
  return Boolean(tryApplyUciMove(game, uci));
}
