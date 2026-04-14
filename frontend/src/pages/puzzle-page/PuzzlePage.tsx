import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Chessboard } from "react-chessboard";
import {
  BarChart3,
  Brain,
  ChevronRight,
  CircleCheck,
  CircleX,
  RefreshCcw,
  Shuffle,
  Sparkles,
} from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { http } from "@/shared/api";
import {
  applySandboxMove,
  buildMoveUci,
  getCheckSquare,
  getLegalMoves,
  getMoveSquares,
  getSquareColor,
} from "@/shared/lib/chess";
import type {
  PuzzleAttemptResult,
  PuzzleAttemptStateResponse,
  PuzzleDetailResponse,
  PuzzleListResponse,
  PuzzleSummaryResponse,
} from "@/shared/types";
import { Button, Card, Spinner } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";

type SessionState = "ready" | "failed" | "solved";

function formatPuzzleRating(rating: number) {
  return `${rating} Elo`;
}

function mergeSquareStyle(
  styles: Record<string, Record<string, string | number>>,
  square: string,
  nextStyle: Record<string, string | number>,
) {
  const current = styles[square] ?? {};
  const merged: Record<string, string | number> = { ...current, ...nextStyle };

  if (typeof current.boxShadow === "string" && typeof nextStyle.boxShadow === "string") {
    merged.boxShadow = `${current.boxShadow}, ${nextStyle.boxShadow}`;
  }

  if (typeof current.backgroundImage === "string" && typeof nextStyle.backgroundImage === "string") {
    merged.backgroundImage = `${current.backgroundImage}, ${nextStyle.backgroundImage}`;
  }

  styles[square] = merged;
}

function buildPuzzleHighlights({
  fen,
  lastMoveUci,
  selectedSquare,
  legalTargets,
}: {
  fen: string;
  lastMoveUci: string | null;
  selectedSquare: string | null;
  legalTargets: string[];
}) {
  const styles: Record<string, Record<string, string | number>> = {};
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
      boxShadow: "inset 0 0 0 3px rgba(16, 185, 129, 0.95), inset 0 0 0 9999px rgba(16, 185, 129, 0.18)",
    });
  }

  for (const square of legalTargets) {
    const occupied = Boolean(getSquareColor(fen, square));
    mergeSquareStyle(
      styles,
      square,
      occupied
        ? { boxShadow: "inset 0 0 0 3px rgba(16, 185, 129, 0.82)" }
        : { backgroundImage: "radial-gradient(circle, rgba(16, 185, 129, 0.42) 0%, rgba(16, 185, 129, 0.42) 22%, transparent 24%)" },
    );
  }

  if (checkSquare) {
    mergeSquareStyle(styles, checkSquare, {
      boxShadow: "inset 0 0 0 3px rgba(248, 113, 113, 0.95), inset 0 0 0 9999px rgba(220, 38, 38, 0.22)",
    });
  }

  return styles;
}

function resultTone(result: SessionState) {
  if (result === "solved") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-100";
  }
  if (result === "failed") {
    return "border-red-500/20 bg-red-500/10 text-red-100";
  }
  return "border-neutral-800 bg-neutral-950/60 text-neutral-300";
}

function attemptLabel(attempt: PuzzleAttemptStateResponse | null) {
  if (!attempt) {
    return "Fresh";
  }
  if (attempt.solved) {
    return "Solved";
  }
  if (attempt.last_result === "failed") {
    return "Tried";
  }
  return "Ready";
}

interface PuzzleWorkspaceProps {
  puzzle: PuzzleDetailResponse;
  starterQueue: PuzzleSummaryResponse[];
  onLoadRandomPuzzle: () => void;
  onOpenAnalysis: () => void;
  onSelectPuzzle: (puzzleId: string) => void;
  onRecordAttempt: (
    puzzleId: string,
    result: PuzzleAttemptResult,
  ) => Promise<PuzzleAttemptStateResponse>;
}

function PuzzleWorkspace({
  puzzle,
  starterQueue,
  onLoadRandomPuzzle,
  onOpenAnalysis,
  onSelectPuzzle,
  onRecordAttempt,
}: PuzzleWorkspaceProps) {
  const autoReplyTimeoutRef = useRef<number | null>(null);
  const [currentFen, setCurrentFen] = useState(puzzle.fen);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);
  const [lastMoveUci, setLastMoveUci] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("ready");
  const [statusMessage, setStatusMessage] = useState("Find the best move from the displayed position.");
  const [attemptState, setAttemptState] = useState<PuzzleAttemptStateResponse | null>(puzzle.attempt);
  const [reportedFailure, setReportedFailure] = useState(false);
  const [isAutoReplying, setIsAutoReplying] = useState(false);

  useEffect(() => {
    return () => {
      if (autoReplyTimeoutRef.current !== null) {
        window.clearTimeout(autoReplyTimeoutRef.current);
      }
    };
  }, []);

  const orientation = puzzle.fen.includes(" b ") ? "black" : "white";
  const boardHighlights = buildPuzzleHighlights({
    fen: currentFen,
    lastMoveUci,
    selectedSquare,
    legalTargets,
  });

  const reportAttempt = useCallback(async (result: PuzzleAttemptResult) => {
    const nextAttempt = await onRecordAttempt(puzzle.id, result);
    setAttemptState(nextAttempt);
  }, [onRecordAttempt, puzzle.id]);

  const resetPuzzle = useCallback(() => {
    if (autoReplyTimeoutRef.current !== null) {
      window.clearTimeout(autoReplyTimeoutRef.current);
      autoReplyTimeoutRef.current = null;
    }
    setCurrentFen(puzzle.fen);
    setCurrentMoveIndex(0);
    setSelectedSquare(null);
    setLegalTargets([]);
    setLastMoveUci(null);
    setSessionState("ready");
    setStatusMessage("Try again from the start of the puzzle.");
    setReportedFailure(false);
    setIsAutoReplying(false);
  }, [puzzle.fen]);

  const completePuzzle = useCallback(async () => {
    setSessionState("solved");
    setStatusMessage("Solved. Queue up the next puzzle when you're ready.");
    await reportAttempt("solved");
  }, [reportAttempt]);

  const autoPlayReplies = useCallback(async (startingFen: string, nextIndex: number) => {
    let runningFen = startingFen;
    let runningIndex = nextIndex;
    let finalMove = lastMoveUci;

    while (runningIndex < puzzle.solution_moves.length && runningIndex % 2 === 1) {
      const replyUci = puzzle.solution_moves[runningIndex];
      const replyMove = applySandboxMove(runningFen, replyUci);
      if (!replyMove) {
        setIsAutoReplying(false);
        setStatusMessage("The stored puzzle line could not be continued.");
        return;
      }
      runningFen = replyMove.fenAfter;
      runningIndex += 1;
      finalMove = replyUci;
    }

    setCurrentFen(runningFen);
    setCurrentMoveIndex(runningIndex);
    setLastMoveUci(finalMove ?? null);
    setIsAutoReplying(false);

    if (runningIndex >= puzzle.solution_moves.length) {
      await completePuzzle();
      return;
    }

    setStatusMessage("Correct. Find the next move.");
  }, [completePuzzle, lastMoveUci, puzzle.solution_moves]);

  const handleSolvedMove = useCallback((uci: string) => {
    const appliedMove = applySandboxMove(currentFen, uci);
    if (!appliedMove) {
      return false;
    }

    const nextIndex = currentMoveIndex + 1;
    setCurrentFen(appliedMove.fenAfter);
    setCurrentMoveIndex(nextIndex);
    setLastMoveUci(uci);
    setSelectedSquare(null);
    setLegalTargets([]);

    if (nextIndex >= puzzle.solution_moves.length) {
      void completePuzzle();
      return true;
    }

    if (nextIndex % 2 === 1) {
      setIsAutoReplying(true);
      setStatusMessage("Correct. Playing the reply...");
      autoReplyTimeoutRef.current = window.setTimeout(() => {
        void autoPlayReplies(appliedMove.fenAfter, nextIndex);
      }, 320);
      return true;
    }

    setStatusMessage("Correct. Keep going.");
    return true;
  }, [autoPlayReplies, completePuzzle, currentFen, currentMoveIndex, puzzle.solution_moves.length]);

  const handleAttemptUci = useCallback((uci: string | null) => {
    if (!uci || isAutoReplying || sessionState === "solved") {
      return false;
    }

    const expectedMove = puzzle.solution_moves[currentMoveIndex];
    if (uci !== expectedMove) {
      setSelectedSquare(null);
      setLegalTargets([]);
      setSessionState("failed");
      setStatusMessage("Not the puzzle line. Retry the position and look for the tactic.");
      if (!reportedFailure) {
        setReportedFailure(true);
        void reportAttempt("failed");
      }
      return false;
    }

    return handleSolvedMove(uci);
  }, [currentMoveIndex, handleSolvedMove, isAutoReplying, puzzle.solution_moves, reportAttempt, reportedFailure, sessionState]);

  const handlePieceDrop = (sourceSquare: string, targetSquare: string) =>
    handleAttemptUci(buildMoveUci(currentFen, sourceSquare, targetSquare));

  const handleSquareClick = (square: string) => {
    if (isAutoReplying || sessionState === "solved") {
      return;
    }

    if (selectedSquare && legalTargets.includes(square)) {
      handleAttemptUci(buildMoveUci(currentFen, selectedSquare, square));
      return;
    }

    const activeColor = currentFen.includes(" w ") ? "white" : "black";
    const squareColor = getSquareColor(currentFen, square);
    if (!squareColor || squareColor !== activeColor) {
      setSelectedSquare(null);
      setLegalTargets([]);
      return;
    }

    setSelectedSquare(square);
    setLegalTargets(getLegalMoves(currentFen, square, activeColor));
  };

  const progressLabel = `Move ${Math.min(currentMoveIndex + 1, puzzle.solution_moves.length)} of ${puzzle.solution_moves.length}`;

  return (
    <AppShell
      eyebrow="Puzzles"
      title="Tactical training without the clutter"
      description="Open a fast puzzle, play the exact tactical line, and keep your study reps inside the same board surface you already use for analysis and replay."
      actions={
        <>
          <Button onClick={onLoadRandomPuzzle}>
            <Shuffle className="h-4 w-4" />
            Next Puzzle
          </Button>
          <Button variant="secondary" onClick={resetPuzzle}>
            <RefreshCcw className="h-4 w-4" />
            Retry
          </Button>
          <Button variant="secondary" onClick={onOpenAnalysis}>
            <BarChart3 className="h-4 w-4" />
            Study Board
          </Button>
        </>
      }
      maxWidthClassName="max-w-[1480px]"
    >
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <div className="space-y-6">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-neutral-800 bg-linear-to-r from-emerald-500/12 via-transparent to-cyan-500/12 px-6 py-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300/80">Current Puzzle</div>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight text-neutral-100">{puzzle.themes.join(" • ")}</h2>
                  <p className="mt-2 max-w-2xl text-sm text-neutral-400">
                    Play the exact tactical continuation from the current position. Correct moves advance the line, and any stored reply is played automatically.
                  </p>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/75 px-5 py-4 text-right">
                  <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Difficulty</div>
                  <div className="mt-1 text-3xl font-bold text-neutral-100">{formatPuzzleRating(puzzle.rating)}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 px-6 py-6 md:grid-cols-[minmax(0,1fr)_280px]">
              <div className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950/60 p-4">
                <Chessboard
                  id="puzzle-board"
                  position={currentFen}
                  boardOrientation={orientation}
                  arePiecesDraggable={!isAutoReplying && sessionState !== "solved"}
                  onPieceDrop={handlePieceDrop}
                  onSquareClick={handleSquareClick}
                  autoPromoteToQueen
                  animationDuration={180}
                  customDarkSquareStyle={{ backgroundColor: "#2B3A30" }}
                  customLightSquareStyle={{ backgroundColor: "#D9DFC8" }}
                  customBoardStyle={{ borderRadius: "1rem" }}
                  customSquareStyles={boardHighlights}
                />
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Progress</div>
                  <div className="mt-3 text-2xl font-semibold text-neutral-100">{progressLabel}</div>
                  <div className="mt-2 text-sm text-neutral-400">
                    {currentFen.includes(" w ") ? "White" : "Black"} to move from the displayed position.
                  </div>
                </div>

                <div className={`rounded-2xl border p-4 text-sm ${resultTone(sessionState)}`}>
                  <div className="flex items-center gap-2 font-semibold">
                    {sessionState === "solved" ? <CircleCheck className="h-4 w-4" /> : sessionState === "failed" ? <CircleX className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    {sessionState === "solved" ? "Solved" : sessionState === "failed" ? "Try Again" : "Tactical Hint"}
                  </div>
                  <div className="mt-2">{statusMessage}</div>
                </div>

                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Attempt State</div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-300">
                      {attemptLabel(attemptState)}
                    </span>
                    <span className="text-sm text-neutral-400">
                      {attemptState ? `${attemptState.attempts_count} attempts` : "No attempts yet"}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Themes</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {puzzle.themes.map((theme) => (
                      <span key={theme} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-100">
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Starter Queue</div>
                <div className="mt-2 text-sm text-neutral-400">Jump straight to another seed puzzle or roll a random one.</div>
              </div>
              <Button variant="ghost" size="sm" onClick={onLoadRandomPuzzle}>
                Shuffle
              </Button>
            </div>

            <div className="space-y-3">
              {starterQueue.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectPuzzle(item.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    puzzle.id === item.id
                      ? "border-emerald-500/35 bg-emerald-500/10"
                      : "border-neutral-800 bg-neutral-950/60 hover:border-neutral-700 hover:bg-neutral-900/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-neutral-100">{item.themes.join(" • ")}</div>
                    <span className="text-xs text-neutral-500">{formatPuzzleRating(item.rating)}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-neutral-500">
                    <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1 uppercase tracking-[0.18em]">
                      {attemptLabel(item.id === puzzle.id ? attemptState : item.attempt)}
                    </span>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Training Flow</div>
            <div className="space-y-3 text-sm text-neutral-400">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                1. Read the board and play the tactical move.
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                2. Correct moves advance the stored line and auto-play the reply when one exists.
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                3. Wrong moves mark the attempt as failed so you can retry from the starting position.
              </div>
            </div>
            <Button variant="secondary" onClick={onOpenAnalysis}>
              <Brain className="h-4 w-4" />
              Continue on Study Board
            </Button>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}

export default function PuzzlePage() {
  const navigate = useNavigate();
  const { puzzleId } = useParams();
  const queryClient = useQueryClient();
  const [randomRequestKey, setRandomRequestKey] = useState(0);
  const [randomExcludeId, setRandomExcludeId] = useState<string | null>(null);

  const catalogQuery = useQuery({
    queryKey: ["puzzle-catalog"],
    queryFn: () => http.get<PuzzleListResponse>("/puzzles?size=12"),
  });

  const puzzleQuery = useQuery({
    queryKey: puzzleId ? ["puzzle", puzzleId] : ["puzzle-random", randomRequestKey, randomExcludeId],
    queryFn: () =>
      puzzleId
        ? http.get<PuzzleDetailResponse>(`/puzzles/${puzzleId}`)
        : http.get<PuzzleDetailResponse>(
            randomExcludeId ? `/puzzles/random?exclude_id=${randomExcludeId}` : "/puzzles/random",
          ),
  });

  const recordAttemptMutation = useMutation({
    mutationFn: (payload: { puzzleId: string; result: PuzzleAttemptResult }) =>
      http.post<PuzzleAttemptStateResponse>(`/puzzles/${payload.puzzleId}/attempts`, { result: payload.result }),
    onSuccess: (nextAttempt, variables) => {
      queryClient.setQueryData<PuzzleListResponse | undefined>(["puzzle-catalog"], (current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          items: current.items.map((item) => (
            item.id === variables.puzzleId
              ? { ...item, attempt: nextAttempt }
              : item
          )),
        };
      });
    },
  });

  const handleLoadRandomPuzzle = useCallback(() => {
    setRandomExcludeId(puzzleQuery.data?.id ?? null);
    setRandomRequestKey((current) => current + 1);
    navigate("/puzzles");
  }, [navigate, puzzleQuery.data?.id]);

  const handleRecordAttempt = useCallback(async (id: string, result: PuzzleAttemptResult) => (
    recordAttemptMutation.mutateAsync({ puzzleId: id, result })
  ), [recordAttemptMutation]);

  if (puzzleQuery.isLoading || !puzzleQuery.data) {
    return (
      <AppShell
        eyebrow="Puzzles"
        title="Tactical training without the clutter"
        description="Open a fast puzzle, play the exact tactical line, and keep your study reps inside the same board surface you already use for analysis and replay."
        actions={
          <Button variant="secondary" onClick={() => navigate("/analysis")}>
            <BarChart3 className="h-4 w-4" />
            Study Board
          </Button>
        }
        maxWidthClassName="max-w-[1480px]"
      >
        <Card className="flex items-center gap-3">
          <Spinner size="sm" />
          <span className="text-sm text-neutral-400">Loading puzzle workspace...</span>
        </Card>
      </AppShell>
    );
  }

  return (
    <PuzzleWorkspace
      key={puzzleQuery.data.id}
      puzzle={puzzleQuery.data}
      starterQueue={catalogQuery.data?.items ?? []}
      onLoadRandomPuzzle={handleLoadRandomPuzzle}
      onOpenAnalysis={() => navigate("/analysis")}
      onSelectPuzzle={(id) => navigate(`/puzzles/${id}`)}
      onRecordAttempt={handleRecordAttempt}
    />
  );
}
