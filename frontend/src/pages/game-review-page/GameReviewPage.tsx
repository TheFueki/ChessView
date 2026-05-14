import { useMemo, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Chessboard } from "react-chessboard";
import type { Square } from "react-chessboard/dist/chessboard/types";
import { Link, useNavigate, useParams } from "react-router";
import { useUserStore } from "@/entities/user";
import { useStockfishAnalysis } from "@/features/analyze-position";
import { http } from "@/shared/api";
import { formatPrincipalVariation, getMoveSquares, STANDARD_START_FEN, uciToSan } from "@/shared/lib/chess";
import type { GameDetailResponse } from "@/shared/types";
import { Avatar, Button, Card, Spinner } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { EvalBar } from "@/pages/analysis-page/EvalBar";
import {
  formatAnalysisStatus,
  formatDateTime,
  formatEvaluation,
  formatLargeNumber,
  scoreFromWhitePerspective,
} from "@/pages/analysis-page/analysis-utils";

function formatResult(result: string | null, status: string) {
  if (result) {
    return result;
  }

  return status === "active" ? "In progress" : status.replaceAll("_", " ");
}

function ReplayContent({
  game,
  currentUserId,
}: {
  game: GameDetailResponse;
  currentUserId: string | null | undefined;
}) {
  const [selectedMoveIndex, setSelectedMoveIndex] = useState<number | null>(null);
  const moveIndex = selectedMoveIndex ?? game.moves.length;
  const analysisEnabled = game.status !== "active";

  const currentFen = useMemo(() => {
    if (moveIndex === 0) {
      return STANDARD_START_FEN;
    }

    return game.moves[moveIndex - 1]?.fen_after ?? game.fen;
  }, [game.fen, game.moves, moveIndex]);

  const analysis = useStockfishAnalysis({
    fen: currentFen,
    enabled: analysisEnabled,
    depth: 15,
    debounceMs: 250,
  });
  const normalizedScore = useMemo(
    () => scoreFromWhitePerspective(currentFen, analysis.score),
    [analysis.score, currentFen],
  );

  const bestMoveLabel = useMemo(
    () => (analysis.bestMove ? uciToSan(currentFen, analysis.bestMove) ?? analysis.bestMove : null),
    [analysis.bestMove, currentFen],
  );
  const principalVariation = useMemo(() => formatPrincipalVariation(currentFen, analysis.pv), [analysis.pv, currentFen]);
  const bestMoveSquares = useMemo(() => getMoveSquares(analysis.bestMove), [analysis.bestMove]);
  const bestMoveArrows = useMemo<[Square, Square, string?][]>(
    () => (bestMoveSquares ? [[bestMoveSquares[0] as Square, bestMoveSquares[1] as Square, "rgba(139, 92, 246, 0.85)"]] : []),
    [bestMoveSquares],
  );

  const goToMoveIndex = (nextMoveIndex: number | ((current: number) => number)) => {
    const resolved = typeof nextMoveIndex === "function" ? nextMoveIndex(moveIndex) : nextMoveIndex;
    setSelectedMoveIndex(Math.max(0, Math.min(game.moves.length, resolved)));
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
      <div className="space-y-6">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-neutral-800 bg-linear-to-r from-violet-500/12 via-transparent to-violet-500/12 px-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300/80">Replay Board</div>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-neutral-100">
                  {game.white.username} vs {game.black.username}
                </h2>
                <div className="mt-2 text-sm text-neutral-400">
                  {formatResult(game.result, game.status)}   {game.time_control_name}   {formatDateTime(game.ended_at ?? game.started_at)}
                </div>
                {game.termination_reason ? (
                  <div className="mt-1 text-sm capitalize text-neutral-500">
                    Finished by {game.termination_reason.replaceAll("_", " ")}
                  </div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/75 px-5 py-4 text-right">
                <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Position</div>
                <div className="mt-1 text-3xl font-bold tabular-nums text-neutral-100">
                  {moveIndex}/{game.moves.length}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-6 sm:grid-cols-2">
            <Link to={`/players/${game.white.id}`} className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 transition hover:border-neutral-700">
              <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">White</div>
              <div className="mt-2 flex items-center gap-3">
                <Avatar username={game.white.username} avatarUrl={game.white.avatar_url} size="md" />
                <div className="text-lg font-semibold text-neutral-100">{game.white.username}</div>
              </div>
              <div className="mt-1 text-sm text-neutral-400">
                {game.white_rating
                  ? `${game.white_rating.before} -> ${game.white_rating.after} (${game.white_rating.delta > 0 ? "+" : ""}${game.white_rating.delta})`
                  : game.white.rating}
              </div>
            </Link>
            <Link to={`/players/${game.black.id}`} className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 transition hover:border-neutral-700">
              <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Black</div>
              <div className="mt-2 flex items-center gap-3">
                <Avatar username={game.black.username} avatarUrl={game.black.avatar_url} size="md" />
                <div className="text-lg font-semibold text-neutral-100">{game.black.username}</div>
              </div>
              <div className="mt-1 text-sm text-neutral-400">
                {game.black_rating
                  ? `${game.black_rating.before} -> ${game.black_rating.after} (${game.black_rating.delta > 0 ? "+" : ""}${game.black_rating.delta})`
                  : game.black.rating}
              </div>
            </Link>
          </div>

          <div className="px-6 pb-6">
            <div className="grid gap-4 md:grid-cols-[40px_minmax(0,1fr)]">
              <EvalBar score={normalizedScore} />
              <div className="mx-auto aspect-square w-full max-w-[min(100%,calc(100vh-16rem),680px)] overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
                <Chessboard
                  id={`review-${game.id}`}
                  position={currentFen}
                  arePiecesDraggable={false}
                  boardOrientation={currentUserId === game.black.id ? "black" : "white"}
                  customDarkSquareStyle={{ backgroundColor: "#2B3A30" }}
                  customLightSquareStyle={{ backgroundColor: "#D9DFC8" }}
                  customBoardStyle={{ borderRadius: "1rem" }}
                  animationDuration={170}
                  customArrows={analysisEnabled ? bestMoveArrows : []}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => goToMoveIndex(0)} disabled={moveIndex === 0}>
              <SkipBack className="h-4 w-4" />
              Start
            </Button>
            <Button variant="secondary" size="sm" onClick={() => goToMoveIndex((value) => value - 1)} disabled={moveIndex === 0}>
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button variant="secondary" size="sm" onClick={() => goToMoveIndex((value) => value + 1)} disabled={moveIndex === game.moves.length}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => goToMoveIndex(game.moves.length)} disabled={moveIndex === game.moves.length}>
              End
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedMoveIndex(null)}>
              <RotateCcw className="h-4 w-4" />
              Latest
            </Button>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-400">
            Step through the game to re-run local analysis at every point in the move list. The board arrow shows the current best move when analysis is available.
          </div>
        </Card>
      </div>

      <div className="flex min-h-0 flex-col gap-6">
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Computer Analysis</div>
              <div className="mt-2 text-sm text-neutral-400">
                {analysisEnabled
                  ? `Analyzing replay position ${moveIndex}/${game.moves.length} locally in your browser.`
                  : "Analysis is available once the game is complete."}
              </div>
            </div>
            <div className="rounded-full border border-neutral-800 bg-neutral-950/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
              {formatAnalysisStatus(analysis.status)}
            </div>
          </div>

          {!analysisEnabled ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-400">
              Finish the game first, then reopen it here to inspect engine evaluations and best lines.
            </div>
          ) : analysis.error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {analysis.error}
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Evaluation</div>
                  <div className="mt-3 text-4xl font-bold tabular-nums text-neutral-100">{formatEvaluation(normalizedScore)}</div>
                  <div className="mt-1 text-sm text-neutral-500">White-perspective score for the current replay position</div>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Best Move</div>
                  <div className="mt-3 text-2xl font-semibold text-neutral-100">{bestMoveLabel ?? "--"}</div>
                  <div className="mt-1 text-sm font-mono text-neutral-500">{analysis.bestMove ?? "Waiting for a line..."}</div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Depth</div>
                  <div className="mt-2 text-xl font-semibold tabular-nums text-neutral-100">{analysis.depth || "--"}</div>
                  <div className="mt-1 text-xs text-neutral-500">SelDepth {analysis.selectiveDepth ?? "--"}</div>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Nodes</div>
                  <div className="mt-2 text-xl font-semibold tabular-nums text-neutral-100">{formatLargeNumber(analysis.nodes)}</div>
                  <div className="mt-1 text-xs text-neutral-500">Visited positions</div>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Speed</div>
                  <div className="mt-2 text-xl font-semibold tabular-nums text-neutral-100">{formatLargeNumber(analysis.nps)}</div>
                  <div className="mt-1 text-xs text-neutral-500">Nodes per second</div>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Principal Variation
                </div>
                <div className="mt-3 text-sm leading-6 text-neutral-200">
                  {principalVariation || "Thinking through the best line for this replay position..."}
                </div>
              </div>
            </>
          )}
        </Card>

        <Card className="flex min-h-0 flex-col">
          <div className="border-b border-neutral-800 pb-4">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Move List</div>
            <div className="mt-2 text-sm text-neutral-400">Click any move to jump directly to that position.</div>
          </div>

          <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
            {game.moves.length === 0 ? (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-500">
                No moves were recorded for this game.
              </div>
            ) : (
              game.moves.map((move, index) => {
                const previewFen = index === 0 ? STANDARD_START_FEN : game.moves[index - 1]?.fen_after ?? STANDARD_START_FEN;
                const moveLabel = uciToSan(previewFen, move.uci) ?? move.uci;

                return (
                  <button
                    key={`${move.move_number}-${move.uci}`}
                    onClick={() => goToMoveIndex(index + 1)}
                    className={`grid w-full grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      moveIndex === index + 1
                        ? "border-violet-500/40 bg-violet-500/10"
                        : "border-neutral-800 bg-neutral-950/60 hover:border-neutral-700 hover:bg-neutral-900/70"
                    }`}
                  >
                    <span className="text-xs font-medium tabular-nums text-neutral-500">#{move.move_number}</span>
                    <div>
                      <div className="font-mono text-sm text-neutral-100">{moveLabel}</div>
                      <div className="mt-1 text-xs text-neutral-500">{move.username}</div>
                    </div>
                    <span className="text-xs text-neutral-500">{formatDateTime(move.created_at)}</span>
                  </button>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

export default function GameReviewPage() {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const currentUser = useUserStore((state) => state.user);

  const gameQuery = useQuery({
    queryKey: ["game-review", gameId],
    queryFn: () => http.get<GameDetailResponse>(`/games/${gameId}`),
    enabled: Boolean(gameId),
  });

  const error =
    !gameId
      ? "Missing game id."
      : gameQuery.error instanceof Error
        ? gameQuery.error.message
        : gameQuery.error
          ? "Unable to load game."
          : null;

  return (
    <AppShell
      eyebrow="Replay"
      title="Review and analysis"
      description="Step through the full game, watch the current position update, and inspect local engine guidance without touching the live backend state."
      actions={
        <>
          <Button variant="secondary" onClick={() => navigate(`/analysis?gameId=${gameId}`)}>
            Open in Analysis
          </Button>
          <Button onClick={() => navigate("/analysis")}>Analysis Hub</Button>
          <Button variant="secondary" onClick={() => navigate("/history")}>
            Back to History
          </Button>
        </>
      }
      maxWidthClassName="max-w-[1500px]"
    >
      {gameQuery.isLoading ? (
        <Card className="flex items-center gap-3">
          <Spinner size="sm" />
          <span className="text-sm text-neutral-400">Loading replay...</span>
        </Card>
      ) : error || !gameQuery.data ? (
        <Card className="mx-auto mt-12 max-w-xl text-center">
          <div className="space-y-3">
            <div className="text-lg font-semibold text-neutral-100">Game unavailable</div>
            <p className="text-sm text-neutral-400">{error ?? "We couldn't load that replay."}</p>
          </div>
        </Card>
      ) : (
        <ReplayContent game={gameQuery.data} currentUserId={currentUser?.id} />
      )}
    </AppShell>
  );
}
