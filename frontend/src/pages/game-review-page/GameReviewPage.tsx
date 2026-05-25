import { useMemo, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, RotateCcw, SkipBack, SkipForward, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Chessboard } from "react-chessboard";
import type { Square } from "react-chessboard/dist/chessboard/types";
import { Link, useNavigate, useParams } from "react-router";
import { useUserStore } from "@/entities/user";
import {
  analyzeGameReviewWithStockfish,
  buildAnalysisContextFromChessViewGame,
  buildAnalysisContextFromPgn,
  buildGameReview,
  buildGameReviewInsights,
  moveQualityTone,
  pairReviewRows,
  type GameReview,
  type MoveClass,
  type ReviewReportRow,
} from "@/features/game-review-analysis";
import { http } from "@/shared/api";
import { formatPrincipalVariation, getMoveSquares, STANDARD_START_FEN, uciToSan } from "@/shared/lib/chess";
import type { GameDetailResponse } from "@/shared/types";
import { Avatar, Button, Card, Spinner } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { EvalBar } from "@/pages/analysis-page/EvalBar";
import { formatDateTime, formatEvaluation } from "@/pages/analysis-page/analysis-utils";

const CLASS_LABELS: Record<MoveClass, string> = {
  best: "Best",
  forced: "Forced",
  great: "Great",
  excellent: "Excellent",
  good: "Good",
  book: "Book",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  miss: "Miss",
  blunder: "Blunder",
  brilliant: "Brilliant",
};

const TONE_STYLES = {
  brilliant: "border-violet-400/40 bg-violet-400/10 text-violet-200",
  best: "border-violet-500/40 bg-violet-500/10 text-violet-200",
  good: "border-lime-400/35 bg-lime-400/10 text-lime-200",
  neutral: "border-neutral-700 bg-neutral-900/80 text-neutral-300",
  warning: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  bad: "border-red-400/40 bg-red-400/10 text-red-200",
} as const;

function formatResult(result: string | null, status: string) {
  return result || (status === "active" ? "In progress" : status.replaceAll("_", " "));
}

function cpScore(value: number | null | undefined) {
  return typeof value === "number" ? { type: "cp" as const, value } : null;
}

function classBadge(moveClass: MoveClass) {
  const tone = moveQualityTone(moveClass);

  return `inline-flex min-w-24 items-center justify-center rounded-md border px-2.5 py-1 text-xs font-semibold ${TONE_STYLES[tone]}`;
}

function buildInitialReview(game: GameDetailResponse): GameReview {
  if (game.moves.length > 0) {
    return buildGameReview(
      buildAnalysisContextFromChessViewGame({
        gameId: game.id,
        finalFen: game.fen,
        moves: game.moves,
      }),
    );
  }

  try {
    if (game.pgn) {
      return buildGameReview(buildAnalysisContextFromPgn(game.pgn));
    }
  } catch {
    // Fall through to the server move list. The local move replay remains the authority for review state.
  }

  return buildGameReview(buildAnalysisContextFromChessViewGame({ gameId: game.id, finalFen: game.fen, moves: [] }));
}

function PlayerCard({
  label,
  player,
  rating,
}: {
  label: "White" | "Black";
  player: GameDetailResponse["white"];
  rating: GameDetailResponse["white_rating"];
}) {
  return (
    <Link to={`/players/${player.id}`} className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-4 transition hover:border-neutral-700">
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">{label}</div>
      <div className="mt-2 flex items-center gap-3">
        <Avatar username={player.username} avatarUrl={player.avatar_url} size="md" />
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold text-neutral-100">{player.username}</div>
          <div className="mt-1 text-sm text-neutral-400">
            {rating
              ? `${rating.before} -> ${rating.after} (${rating.delta > 0 ? "+" : ""}${rating.delta})`
              : player.rating}
          </div>
        </div>
      </div>
    </Link>
  );
}

function MetricTile({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-4">
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">{label}</div>
      <div className="mt-3 text-3xl font-bold tabular-nums text-neutral-100">{value}</div>
      <div className="mt-1 text-sm text-neutral-500">{helper}</div>
    </div>
  );
}

function MoveCell({
  row,
  selected,
  onSelect,
}: {
  row?: ReviewReportRow;
  selected: boolean;
  onSelect: (ply: number) => void;
}) {
  if (!row) {
    return <div className="h-12 rounded-md border border-neutral-900 bg-neutral-950/40" />;
  }

  return (
    <button
      onClick={() => onSelect(row.ply)}
      className={`grid h-12 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-3 text-left transition ${
        selected ? "border-violet-500/50 bg-violet-500/12" : "border-neutral-800 bg-neutral-950/60 hover:border-neutral-700"
      }`}
    >
      <span className="min-w-0 truncate font-mono text-sm text-neutral-100">{row.san}</span>
      <span className={classBadge(row.classification)}>{CLASS_LABELS[row.classification]}</span>
    </button>
  );
}

function ReplayContent({ game, currentUserId }: { game: GameDetailResponse; currentUserId: string | null | undefined }) {
  const [selectedPly, setSelectedPly] = useState<number | null>(null);
  const [stockfishState, setStockfishState] = useState<{
    status: "idle" | "running" | "done" | "error";
    error: string | null;
    review: GameReview | null;
  }>({ status: "idle", error: null, review: null });

  const simulatedReview = useMemo(() => buildInitialReview(game), [game]);
  const review = stockfishState.review ?? simulatedReview;
  const insights = useMemo(() => buildGameReviewInsights(review.rows), [review.rows]);
  const movePairs = useMemo(() => pairReviewRows(review.rows), [review.rows]);
  const moveIndex = selectedPly ?? review.rows.length;
  const selectedMove = moveIndex > 0 ? review.rows[moveIndex - 1] : null;
  const nextMove = review.rows[moveIndex] ?? null;
  const currentFen = review.context.fens[moveIndex] ?? STANDARD_START_FEN;
  const currentScore = cpScore(selectedMove?.evaluationAfter ?? review.rows[0]?.evaluationBefore ?? 0);
  const bestMove = nextMove?.bestMove ?? null;
  const bestMoveLabel = bestMove ? uciToSan(currentFen, bestMove) ?? bestMove : null;
  const bestMoveSquares = getMoveSquares(bestMove);
  const bestMoveArrows = useMemo<[Square, Square, string?][]>(
    () => (bestMoveSquares ? [[bestMoveSquares[0] as Square, bestMoveSquares[1] as Square, "rgba(139, 92, 246, 0.85)"]] : []),
    [bestMoveSquares],
  );
  const principalVariation = bestMove ? formatPrincipalVariation(currentFen, [bestMove]) : "";
  const analysisEnabled = game.status !== "active" && review.rows.length > 0;

  const goToPly = (nextPly: number | ((current: number) => number)) => {
    const resolved = typeof nextPly === "function" ? nextPly(moveIndex) : nextPly;
    setSelectedPly(Math.max(0, Math.min(review.rows.length, resolved)));
  };

  const runStockfishReview = async () => {
    if (!analysisEnabled || stockfishState.status === "running") {
      return;
    }

    setStockfishState({ status: "running", error: null, review: null });

    try {
      const result = await analyzeGameReviewWithStockfish(simulatedReview.context.fens, 10);
      setStockfishState({
        status: "done",
        error: null,
        review: buildGameReview(simulatedReview.context, {
          evaluations: result.evaluations,
          bestMoves: result.bestMoves,
        }),
      });
    } catch (error) {
      setStockfishState({
        status: "error",
        error: error instanceof Error ? error.message : "Stockfish review failed.",
        review: null,
      });
    }
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
      <div className="space-y-6">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-neutral-800 bg-linear-to-r from-neutral-800/80 via-neutral-900 to-neutral-800/80 px-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Game Review</div>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-neutral-100">
                  {game.white.username} vs {game.black.username}
                </h2>
                <div className="mt-2 text-sm text-neutral-400">
                  {formatResult(game.result, game.status)} · {game.time_control_name} · {formatDateTime(game.ended_at ?? game.started_at)}
                </div>
                {!review.context.isVerified ? (
                  <div className="mt-2 text-sm text-amber-200">Local replay differs from the saved final FEN, so review uses the locally rebuilt move timeline.</div>
                ) : null}
              </div>
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/75 px-5 py-4 text-right">
                <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Position</div>
                <div className="mt-1 text-3xl font-bold tabular-nums text-neutral-100">
                  {moveIndex}/{review.rows.length}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-6 sm:grid-cols-2">
            <PlayerCard label="White" player={game.white} rating={game.white_rating} />
            <PlayerCard label="Black" player={game.black} rating={game.black_rating} />
          </div>

          <div className="px-6 pb-6">
            <div className="grid gap-4 md:grid-cols-[40px_minmax(0,1fr)]">
              <EvalBar score={currentScore} />
              <div className="mx-auto aspect-square w-full max-w-[min(100%,calc(100vh-16rem),680px)] overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
                <Chessboard
                  id={`review-${game.id}`}
                  position={currentFen}
                  arePiecesDraggable={false}
                  boardOrientation={currentUserId === game.black.id ? "black" : "white"}
                  customDarkSquareStyle={{ backgroundColor: "#2B3A30" }}
                  customLightSquareStyle={{ backgroundColor: "#D9DFC8" }}
                  customBoardStyle={{ borderRadius: "0.75rem" }}
                  animationDuration={170}
                  customArrows={bestMoveArrows}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => goToPly(0)} disabled={moveIndex === 0}>
              <SkipBack className="h-4 w-4" />
              Start
            </Button>
            <Button variant="secondary" size="sm" onClick={() => goToPly((value) => value - 1)} disabled={moveIndex === 0}>
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button variant="secondary" size="sm" onClick={() => goToPly((value) => value + 1)} disabled={moveIndex === review.rows.length}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="sm" onClick={() => goToPly(review.rows.length)} disabled={moveIndex === review.rows.length}>
              End
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedPly(null)}>
              <RotateCcw className="h-4 w-4" />
              Latest
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile label="Accuracy" value={`${insights.overallAccuracy}%`} helper="Average player accuracy" />
            <MetricTile label="Estimated" value={insights.estimatedRating} helper="Review performance rating" />
            <MetricTile label="Critical" value={insights.classCounts.blunder + insights.classCounts.miss + insights.classCounts.mistake} helper="Mistakes, misses, blunders" />
          </div>
        </Card>
      </div>

      <div className="flex min-h-0 flex-col gap-6">
        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Review Engine</div>
              <div className="mt-2 text-sm text-neutral-400">
                {stockfishState.review ? "Stockfish-backed review is active." : "Showing deterministic local review until Stockfish finishes."}
              </div>
            </div>
            <Button size="sm" onClick={runStockfishReview} disabled={!analysisEnabled || stockfishState.status === "running"}>
              {stockfishState.status === "running" ? <Spinner size="sm" /> : <Sparkles className="h-4 w-4" />}
              {stockfishState.status === "running" ? "Reviewing" : "Run Stockfish"}
            </Button>
          </div>

          {stockfishState.error ? (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{stockfishState.error}</div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <MetricTile label={game.white.username} value={`${insights.white.accuracy}%`} helper={`Estimated ${insights.white.estimatedRating}`} />
            <MetricTile label={game.black.username} value={`${insights.black.accuracy}%`} helper={`Estimated ${insights.black.estimatedRating}`} />
          </div>

          <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-4">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
              <BarChart3 className="h-3.5 w-3.5" />
              Selected Position
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs text-neutral-500">Evaluation</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-100">{formatEvaluation(currentScore)}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-500">Best move</div>
                <div className="mt-1 text-2xl font-semibold text-neutral-100">{bestMoveLabel ?? "--"}</div>
              </div>
            </div>
            <div className="mt-3 text-sm leading-6 text-neutral-300">
              {selectedMove ? (
                <>
                  {selectedMove.san} was {CLASS_LABELS[selectedMove.classification].toLowerCase()} with {selectedMove.moveAccuracy}% accuracy.
                </>
              ) : (
                "Start position selected."
              )}
              {principalVariation ? ` Best line starts ${principalVariation}.` : ""}
            </div>
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col">
          <div className="border-b border-neutral-800 pb-4">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Move Review</div>
            <div className="mt-2 text-sm text-neutral-400">Click a move to inspect its board state, label, evaluation, and best-move hint.</div>
          </div>

          <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
            {movePairs.length === 0 ? (
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-500">No moves were recorded for this game.</div>
            ) : (
              movePairs.map((pair) => (
                <div key={pair.moveNumber} className="grid grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
                  <div className="text-sm font-semibold tabular-nums text-neutral-500">{pair.moveNumber}.</div>
                  <MoveCell row={pair.white} selected={moveIndex === pair.white?.ply} onSelect={goToPly} />
                  <MoveCell row={pair.black} selected={moveIndex === pair.black?.ply} onSelect={goToPly} />
                </div>
              ))
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
      eyebrow="Review"
      title="Game review"
      description="Review accuracy, move quality, best-move hints, and the selected board state from a local analysis timeline."
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
          <span className="text-sm text-neutral-400">Loading game review...</span>
        </Card>
      ) : error || !gameQuery.data ? (
        <Card className="mx-auto mt-12 max-w-xl text-center">
          <div className="space-y-3">
            <div className="text-lg font-semibold text-neutral-100">Game unavailable</div>
            <p className="text-sm text-neutral-400">{error ?? "We couldn't load that review."}</p>
          </div>
        </Card>
      ) : (
        <ReplayContent game={gameQuery.data} currentUserId={currentUser?.id} />
      )}
    </AppShell>
  );
}
