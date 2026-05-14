import type { CustomSquareStyles, Square } from "react-chessboard/dist/chessboard/types";
import type { StockfishScore } from "@/features/analyze-position";
import { getCheckSquare, getMoveSquares, getSquareColor } from "@/shared/lib/chess";

export function formatDateTime(value: string | null) {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatEvaluation(score: { type: "cp" | "mate"; value: number } | null) {
  if (!score) {
    return "--";
  }

  if (score.type === "mate") {
    return score.value > 0 ? `#${score.value}` : `#-${Math.abs(score.value)}`;
  }

  const pawns = score.value / 100;
  return pawns > 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2);
}

export function scoreFromWhitePerspective(fen: string, score: StockfishScore | null): StockfishScore | null {
  if (!score) {
    return null;
  }

  const activeColor = fen.split(" ")[1] ?? "w";
  const multiplier = activeColor === "b" ? -1 : 1;

  return {
    type: score.type,
    value: score.value * multiplier,
  };
}

export function formatLargeNumber(value: number | null) {
  if (value === null) {
    return "--";
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }

  return String(value);
}

export function formatAnalysisStatus(status: "idle" | "loading" | "ready" | "analyzing" | "done" | "error") {
  switch (status) {
    case "loading":
      return "Loading engine";
    case "ready":
      return "Ready";
    case "analyzing":
      return "Analyzing";
    case "done":
      return "Complete";
    case "error":
      return "Unavailable";
    default:
      return "Idle";
  }
}

function mergeSquareStyle(styles: CustomSquareStyles, square: string, nextStyle: Record<string, string | number>) {
  const key = square as Square;
  const current = styles[key] ?? {};
  const merged: Record<string, string | number> = { ...current, ...nextStyle };

  if (typeof current.boxShadow === "string" && typeof nextStyle.boxShadow === "string") {
    merged.boxShadow = `${current.boxShadow}, ${nextStyle.boxShadow}`;
  }

  if (typeof current.backgroundImage === "string" && typeof nextStyle.backgroundImage === "string") {
    merged.backgroundImage = `${current.backgroundImage}, ${nextStyle.backgroundImage}`;
  }

  styles[key] = merged;
}

export function buildBoardHighlights({
  fen,
  lastMoveUci,
  selectedSquare,
  legalTargets,
}: {
  fen: string | null;
  lastMoveUci: string | null;
  selectedSquare: string | null;
  legalTargets: string[];
}): CustomSquareStyles {
  if (!fen) {
    return {};
  }

  const styles: CustomSquareStyles = {};
  const lastMoveSquares = getMoveSquares(lastMoveUci);
  const checkSquare = getCheckSquare(fen);

  if (lastMoveSquares) {
    for (const square of lastMoveSquares) {
      mergeSquareStyle(styles, square, {
        boxShadow: "inset 0 0 0 9999px rgba(245, 158, 11, 0.22)",
      });
    }
  }

  if (selectedSquare) {
    mergeSquareStyle(styles, selectedSquare, {
      boxShadow: "inset 0 0 0 3px rgba(139, 92, 246, 0.95), inset 0 0 0 9999px rgba(139, 92, 246, 0.18)",
    });
  }

  for (const square of legalTargets) {
    const occupied = Boolean(getSquareColor(fen, square));
    mergeSquareStyle(
      styles,
      square,
      occupied
        ? { boxShadow: "inset 0 0 0 3px rgba(139, 92, 246, 0.82)" }
        : { backgroundImage: "radial-gradient(circle, rgba(139, 92, 246, 0.42) 0%, rgba(139, 92, 246, 0.42) 22%, transparent 24%)" },
    );
  }

  if (checkSquare) {
    mergeSquareStyle(styles, checkSquare, {
      boxShadow: "inset 0 0 0 3px rgba(248, 113, 113, 0.95), inset 0 0 0 9999px rgba(220, 38, 38, 0.22)",
    });
  }

  return styles;
}

export function sourceTitleFromHeaders(headers: Record<string, string>) {
  if (headers.Event) {
    return headers.Event;
  }

  if (headers.White || headers.Black) {
    return `${headers.White ?? "White"} vs ${headers.Black ?? "Black"}`;
  }

  return "Imported PGN";
}
