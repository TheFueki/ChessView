import { Crown } from "lucide-react";
import { Chessboard } from "react-chessboard";
import type { CustomSquareStyles, Square } from "react-chessboard/dist/chessboard/types";
import { Link, useNavigate, useParams } from "react-router";
import { useGameStore } from "@/entities/game";
import { useUserStore } from "@/entities/user";
import { useGameRealtime, useMakeMove } from "@/features/make-move";
import { wsClient } from "@/shared/api";
import { useLiveClock } from "@/shared/hooks";
import { getCheckSquare, getMoveSquares, getSquareColor } from "@/shared/lib/chess";
import { Button, Card } from "@/shared/ui";
import { GameLayout } from "@/widgets/game-layout";
import { GameSidebar } from "@/widgets/game-sidebar";
import { VideoChatPanel } from "@/widgets/video-chat-panel";

function formatClock(timeMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(timeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatResult(result: string | null, status: string) {
  if (result) {
    return result;
  }

  return status === "active" ? "In progress" : status;
}

function formatReason(reason: string | null) {
  if (!reason) {
    return null;
  }

  return reason.replaceAll("_", " ");
}

function mergeSquareStyle(
  styles: CustomSquareStyles,
  square: string,
  nextStyle: Record<string, string | number>,
) {
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

function buildBoardHighlights({
  fen,
  lastMoveUci,
  selectedSquare,
  legalTargets,
  premove,
}: {
  fen: string;
  lastMoveUci: string | null;
  selectedSquare: string | null;
  legalTargets: string[];
  premove: { from: string; to: string } | null;
}): CustomSquareStyles {
  const styles: CustomSquareStyles = {};
  const lastMoveSquares = getMoveSquares(lastMoveUci);
  const checkSquare = getCheckSquare(fen);

  if (lastMoveSquares) {
    for (const square of lastMoveSquares) {
      mergeSquareStyle(styles, square, {
        boxShadow: "inset 0 0 0 9999px rgba(245, 158, 11, 0.22)",
        transition: "all 140ms ease-out",
      });
    }
  }

  if (selectedSquare) {
    mergeSquareStyle(styles, selectedSquare, {
      boxShadow: "inset 0 0 0 3px rgba(16, 185, 129, 0.95), inset 0 0 0 9999px rgba(16, 185, 129, 0.18)",
      transition: "all 120ms ease-out",
    });
  }

  for (const square of legalTargets) {
    const occupied = Boolean(getSquareColor(fen, square));
    mergeSquareStyle(styles, square, occupied
      ? {
          boxShadow: "inset 0 0 0 3px rgba(16, 185, 129, 0.82)",
          transition: "all 120ms ease-out",
        }
      : {
          backgroundImage: "radial-gradient(circle, rgba(16, 185, 129, 0.42) 0%, rgba(16, 185, 129, 0.42) 22%, transparent 24%)",
          transition: "all 120ms ease-out",
        });
  }

  if (premove) {
    for (const square of [premove.from, premove.to]) {
      mergeSquareStyle(styles, square, {
        boxShadow: "inset 0 0 0 2px rgba(96, 165, 250, 0.95), inset 0 0 0 9999px rgba(59, 130, 246, 0.16)",
        transition: "all 120ms ease-out",
      });
    }
  }

  if (checkSquare) {
    mergeSquareStyle(styles, checkSquare, {
      boxShadow: "inset 0 0 0 3px rgba(248, 113, 113, 0.95), inset 0 0 0 9999px rgba(220, 38, 38, 0.22)",
      transition: "all 120ms ease-out",
    });
  }

  return styles;
}

function getOutcomeTitle({
  result,
  winnerId,
  userId,
  status,
}: {
  result: string | null;
  winnerId: string | null;
  userId: string | null | undefined;
  status: string;
}) {
  if (status === "aborted") {
    return "Game Aborted";
  }
  if (result === "1/2-1/2") {
    return "Draw";
  }
  if (winnerId && userId && winnerId === userId) {
    return "Victory";
  }
  if (result) {
    return "Defeat";
  }
  return "Game Finished";
}

function PlayerBar({
  label,
  username,
  rating,
  clockMs,
  active,
}: {
  label: string;
  username: string;
  rating: number | null;
  clockMs: number;
  active: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-300 ${
        active ? "border-emerald-500/40 bg-emerald-500/10 shadow-sm shadow-emerald-500/5" : "border-neutral-800 bg-neutral-900/80"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full transition-colors duration-300 ${
          active ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-neutral-700"
        }`} />
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">{label}</div>
          <div className="mt-0.5 text-base font-semibold text-neutral-100">{username}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className={`rounded-lg border px-3 py-1.5 text-sm font-semibold tabular-nums ${
          active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-neutral-700/80 bg-neutral-950/80 text-neutral-200"
        }`}>
          {formatClock(clockMs)}
        </div>
        <div className="rounded-full border border-neutral-700/80 bg-neutral-950/80 px-3 py-1 text-xs font-medium tabular-nums text-neutral-400">
          {rating ?? 1200}
        </div>
      </div>
    </div>
  );
}

export default function GamePage() {
  const navigate = useNavigate();
  const { gameId } = useParams();

  useGameRealtime(gameId);

  const user = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);
  const fen = useGameStore((state) => state.fen);
  const myColor = useGameStore((state) => state.myColor);
  const turn = useGameStore((state) => state.turn);
  const white = useGameStore((state) => state.white);
  const black = useGameStore((state) => state.black);
  const clock = useGameStore((state) => state.clock);
  const timeControlName = useGameStore((state) => state.timeControlName);
  const status = useGameStore((state) => state.status);
  const lastMove = useGameStore((state) => state.lastMove);
  const result = useGameStore((state) => state.result);
  const winnerId = useGameStore((state) => state.winnerId);
  const gameOverReason = useGameStore((state) => state.gameOverReason);
  const terminationReason = useGameStore((state) => state.terminationReason);
  const isLoading = useGameStore((state) => state.isLoading);
  const resetGame = useGameStore((state) => state.reset);
  const { isMyTurn, isGameOver, selectedSquare, legalTargets, premove, isDraggablePiece, onPieceDrop, onPieceDragBegin, onSquareClick } = useMakeMove();
  const { whiteTimeMs, blackTimeMs, graceRemainingMs } = useLiveClock(clock);

  const topPlayer = myColor === "black" ? white : black;
  const bottomPlayer = myColor === "black" ? black : white;
  const topLabel = myColor === "black" ? "White" : "Black";
  const bottomLabel = myColor === "black" ? "Black" : "White";
  const outcomeTitle = getOutcomeTitle({
    result,
    winnerId,
    userId: user?.id,
    status,
  });
  const boardHighlights = buildBoardHighlights({
    fen,
    lastMoveUci: lastMove?.uci ?? null,
    selectedSquare,
    legalTargets,
    premove,
  });

  const handleLogout = () => {
    wsClient.disconnect();
    resetGame();
    logout();
    navigate("/", { replace: true });
  };

  return (
    <GameLayout
      board={
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate("/lobby")} className="flex items-center gap-2 transition hover:opacity-80">
              <Crown className="h-5 w-5 text-emerald-500" />
              <span className="font-bold tracking-tight text-neutral-100">ChessView</span>
            </button>
            <div className="flex items-center gap-3">
              {user ? (
                <Link to="/profile" className="flex items-center gap-2.5 rounded-full border border-neutral-800 bg-neutral-900/70 px-4 py-2 text-sm transition hover:border-neutral-700">
                  <span className="font-medium text-neutral-100">{user.username}</span>
                  <span className="h-1 w-1 rounded-full bg-neutral-600" />
                  <span className="tabular-nums text-neutral-400">{user.rating}</span>
                </Link>
              ) : null}
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>

          <Card className="space-y-4 p-4">
            <div className="grid gap-3">
              <PlayerBar
                label={topLabel}
                username={topPlayer?.username ?? "Waiting..."}
                rating={topPlayer?.rating ?? null}
                clockMs={myColor === "black" ? whiteTimeMs : blackTimeMs}
                active={turn === topLabel.toLowerCase() && !clock?.is_paused}
              />

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">Turn / Control</div>
                    <div className="mt-0.5 flex items-center gap-2 text-base font-semibold capitalize text-neutral-100">
                      <span className={`h-2 w-2 rounded-full ${turn === "white" ? "bg-white shadow-sm shadow-white/40" : "bg-neutral-400"}`} />
                      {turn} - {timeControlName}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">Status</div>
                    <div className="mt-0.5 text-base font-semibold text-neutral-100">{formatResult(result, status)}</div>
                  </div>
                </div>

                <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/80">
                  {!isLoading ? (
                    <Chessboard
                      id={gameId}
                      position={fen}
                      boardOrientation={myColor ?? "white"}
                      arePiecesDraggable={status === "active" && !clock?.is_paused}
                      isDraggablePiece={isDraggablePiece}
                      onPieceDrop={onPieceDrop}
                      onPieceDragBegin={onPieceDragBegin}
                      onSquareClick={onSquareClick}
                      autoPromoteToQueen
                      animationDuration={220}
                      customDarkSquareStyle={{ backgroundColor: "#2B3A30" }}
                      customLightSquareStyle={{ backgroundColor: "#D9DFC8" }}
                      customSquareStyles={boardHighlights}
                      customBoardStyle={{ borderRadius: "0.75rem" }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-neutral-500">Loading board...</div>
                  )}

                  {isGameOver ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/70 p-4 backdrop-blur-[2px]">
                      <div className="w-full max-w-sm rounded-2xl border border-amber-500/20 bg-neutral-950/95 p-6 text-center shadow-2xl shadow-black/40">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-400">Game Over</div>
                        <div className="mt-3 text-3xl font-extrabold tracking-tight text-neutral-100">{outcomeTitle}</div>
                        <div className="mt-2 text-sm font-medium text-neutral-300">{formatResult(result, status)}</div>
                        {terminationReason || gameOverReason ? (
                          <div className="mt-2 text-sm capitalize text-neutral-400">
                            Finished by {formatReason(terminationReason ?? gameOverReason)}
                          </div>
                        ) : null}
                        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                          <Button className="flex-1" onClick={() => navigate(`/games/${gameId}`)}>
                            Review Game
                          </Button>
                          <Button variant="secondary" className="flex-1" onClick={() => navigate("/lobby")}>
                            Back to Lobby
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <PlayerBar
                label={bottomLabel}
                username={bottomPlayer?.username ?? "Waiting..."}
                rating={bottomPlayer?.rating ?? null}
                clockMs={myColor === "black" ? blackTimeMs : whiteTimeMs}
                active={turn === bottomLabel.toLowerCase() && !clock?.is_paused}
              />
            </div>

            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                isGameOver
                  ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
                  : "border-neutral-800 bg-neutral-950/70 text-neutral-300"
              }`}
            >
              {status === "active"
                ? clock?.grace_deadline_at
                  ? "Connection grace is active while the server waits for a reconnect."
                  : premove
                    ? `Premove queued: ${premove.from}-${premove.to}. Click again to cancel or replace it.`
                    : isMyTurn
                      ? "Your turn - click or drag a piece to move."
                      : "Waiting for your opponent's move. You can queue one premove."
                : `${outcomeTitle} - ${formatReason(terminationReason ?? gameOverReason) ?? "game over"}.`}
            </div>

            {clock?.grace_deadline_at ? (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                Connection grace active for {clock.disconnected_player_id === user?.id ? "you" : "your opponent"}.
                {graceRemainingMs !== null
                  ? ` ${Math.ceil(graceRemainingMs / 1000)}s remaining before the game is resolved automatically.`
                  : null}
              </div>
            ) : null}
          </Card>
        </div>
      }
      sidebar={<GameSidebar />}
      videoChat={<VideoChatPanel />}
    />
  );
}
