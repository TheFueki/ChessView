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
  Trophy,
  History,
  Target
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
        boxShadow: "inset 0 0 0 9999px rgba(245, 158, 11, 0.18)",
      });
    }
  }

  if (selectedSquare) {
    mergeSquareStyle(styles, selectedSquare, {
      boxShadow: "inset 0 0 0 3px rgba(59, 130, 246, 0.9), inset 0 0 0 9999px rgba(59, 130, 246, 0.15)",
    });
  }

  for (const square of legalTargets) {
    const occupied = Boolean(getSquareColor(fen, square));
    mergeSquareStyle(
      styles,
      square,
      occupied
        ? { boxShadow: "inset 0 0 0 3px rgba(16, 185, 129, 0.7)" }
        : { backgroundImage: "radial-gradient(circle, rgba(16, 185, 129, 0.35) 20%, transparent 25%)" },
    );
  }

  if (checkSquare) {
    mergeSquareStyle(styles, checkSquare, {
      boxShadow: "inset 0 0 0 3px rgba(239, 68, 68, 0.9), inset 0 0 0 9999px rgba(239, 68, 68, 0.2)",
    });
  }

  return styles;
}

function resultTone(result: SessionState) {
  if (result === "solved") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]";
  }
  if (result === "failed") {
    return "border-red-500/30 bg-red-500/10 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.1)]";
  }
  return "border-neutral-800/60 bg-neutral-900/40 text-neutral-400";
}

function attemptLabel(attempt: PuzzleAttemptStateResponse | null) {
  if (!attempt) return "Fresh";
  if (attempt.solved) return "Solved";
  if (attempt.last_result === "failed") return "Tried";
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
  const [statusMessage, setStatusMessage] = useState("Analyze the position and find the winning line.");
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
    setStatusMessage("Position reset. Try to find the solution again.");
    setReportedFailure(false);
    setIsAutoReplying(false);
  }, [puzzle.fen]);

  const completePuzzle = useCallback(async () => {
    setSessionState("solved");
    setStatusMessage("Perfect calculation. Puzzle solved.");
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
        setStatusMessage("Error in puzzle sequence execution.");
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

    setStatusMessage("Correct. Continue the sequence.");
  }, [completePuzzle, lastMoveUci, puzzle.solution_moves]);

  const handleSolvedMove = useCallback((uci: string) => {
    const appliedMove = applySandboxMove(currentFen, uci);
    if (!appliedMove) return false;

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
      setStatusMessage("Wait, opponent is moving...");
      
      if (autoReplyTimeoutRef.current !== null) window.clearTimeout(autoReplyTimeoutRef.current);
      
      autoReplyTimeoutRef.current = window.setTimeout(() => {
        void autoPlayReplies(appliedMove.fenAfter, nextIndex);
      }, 500);
      return true;
    }

    setStatusMessage("Great move. What's next?");
    return true;
  }, [autoPlayReplies, completePuzzle, currentFen, currentMoveIndex, puzzle.solution_moves.length]);

  const handleAttemptUci = useCallback((uci: string | null) => {
    if (!uci || isAutoReplying || sessionState === "solved") return false;

    const expectedMove = puzzle.solution_moves[currentMoveIndex];
    if (uci !== expectedMove) {
      setSelectedSquare(null);
      setLegalTargets([]);
      setSessionState("failed");
      setStatusMessage("That's not the best move. Try again.");
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
    if (isAutoReplying || sessionState === "solved") return;

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

  const progressLabel = `Sequence ${Math.min(currentMoveIndex + 1, puzzle.solution_moves.length)} / ${puzzle.solution_moves.length}`;

  return (
    <AppShell
      eyebrow="Tactics"
      title="Fueki Puzzles"
      description="Refine your pattern recognition with our curated tactical suite."
      actions={
        <div className="flex gap-2">
          <Button onClick={onLoadRandomPuzzle} className="bg-emerald-600/90 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20">
            <Shuffle className="h-4 w-4" />
            Next Task
          </Button>
          <Button variant="secondary" onClick={resetPuzzle} className="border-neutral-800 bg-neutral-900/40 backdrop-blur-sm">
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      }
      maxWidthClassName="max-w-[1440px]"
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Card className="overflow-hidden border-neutral-800/50 bg-neutral-950/20 p-0 backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800/50 bg-linear-to-r from-emerald-500/10 via-transparent to-blue-500/5 px-8 py-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.4em] text-emerald-500/80">
                  <Target size={12}/> Puzzle Identity
                </div>
                <h2 className="text-xl font-bold tracking-tight text-neutral-100">
                  {puzzle.themes.slice(0, 4).join("   ")}
                </h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Difficulty</div>
                  <div className="text-2xl font-black text-neutral-100">{puzzle.rating}</div>
                </div>
                <div className="h-10 w-[1px] bg-neutral-800/50" />
                <Trophy className="text-amber-500/50" size={24} />
              </div>
            </div>

            <div className="grid gap-8 p-8 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="relative aspect-square w-full max-w-[600px] overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40 shadow-2xl">
                <Chessboard
                  id="fueki-puzzle-board"
                  position={currentFen}
                  boardOrientation={orientation}
                  arePiecesDraggable={!isAutoReplying && sessionState !== "solved"}
                  onPieceDrop={handlePieceDrop}
                  onSquareClick={handleSquareClick}
                  autoPromoteToQueen
                  animationDuration={250}
                  customDarkSquareStyle={{ backgroundColor: "#171717" }}
                  customLightSquareStyle={{ backgroundColor: "#404040" }}
                  customBoardStyle={{ borderRadius: "0.5rem" }}
                  customSquareStyles={boardHighlights}
                />
                {isAutoReplying && (
                  <div className="absolute inset-0 z-10 bg-black/5 flex items-center justify-center backdrop-blur-[1px]">
                     <div className="rounded-full bg-neutral-950/80 px-4 py-2 border border-neutral-800 flex items-center gap-2">
                        <Spinner size="sm" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Opponent Thinking</span>
                     </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-5">
                <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/20 p-5 backdrop-blur-sm">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500 mb-1">Status</div>
                  <div className="text-lg font-bold text-neutral-100">{progressLabel}</div>
                  <div className="mt-4 flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full animate-pulse ${currentFen.includes(" w ") ? 'bg-white' : 'bg-black border border-neutral-700'}`} />
                    <span className="text-xs text-neutral-400">{currentFen.includes(" w ") ? "White" : "Black"} to move</span>
                  </div>
                </div>

                <div className={`rounded-2xl border p-5 transition-all duration-500 ${resultTone(sessionState)}`}>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-3">
                    {sessionState === "solved" ? <CircleCheck size={14} /> : sessionState === "failed" ? <CircleX size={14} /> : <Brain size={14} />}
                    {sessionState === "solved" ? "Success" : sessionState === "failed" ? "Failed Attempt" : "Active Task"}
                  </div>
                  <p className="text-sm leading-relaxed opacity-90">{statusMessage}</p>
                </div>

                <div className="mt-auto space-y-4">
                  <div className="rounded-2xl border border-neutral-800/50 bg-neutral-950/30 p-5">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-4">
                      <History size={12}/> Session Info
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-neutral-400">Total Attempts</span>
                      <span className="font-mono text-sm font-bold text-neutral-200">{attemptState?.attempts_count ?? 0}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[11px] font-medium text-neutral-400">Global State</span>
                      <span className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter border ${
                        attemptState?.solved ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500' : 'border-neutral-800 bg-neutral-900 text-neutral-500'
                      }`}>
                        {attemptLabel(attemptState)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <Card className="flex-1 flex flex-col border-neutral-800/50 bg-neutral-950/20 p-0 backdrop-blur-xl overflow-hidden">
            <div className="border-b border-neutral-800/50 bg-neutral-900/20 px-6 py-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-[0.3em] text-neutral-500">Starter Queue</h3>
                <Sparkles size={14} className="text-emerald-500/40" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {starterQueue.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectPuzzle(item.id)}
                  className={`group relative w-full overflow-hidden rounded-xl border p-4 text-left transition-all duration-300 ${
                    puzzle.id === item.id
                      ? "border-emerald-500/50 bg-emerald-500/10 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]"
                      : "border-neutral-800/40 bg-neutral-900/10 hover:border-neutral-700 hover:bg-neutral-800/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-xs font-bold text-neutral-200 group-hover:text-white transition-colors">
                      {item.themes[0]}   {item.themes[1] || 'Tactics'}
                    </div>
                    <div className="font-mono text-[10px] font-bold text-neutral-500">{item.rating}</div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className={`text-[9px] font-black uppercase tracking-widest ${item.attempt?.solved ? 'text-emerald-500' : 'text-neutral-600'}`}>
                      {item.attempt?.solved ? 'Mastered' : 'Unsolved'}
                    </div>
                    <ChevronRight size={14} className="text-neutral-700 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all"/>
                  </div>
                  {puzzle.id === item.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-emerald-500" />
                  )}
                </button>
              ))}
            </div>
          </Card>

          <Button 
            variant="secondary" 
            onClick={onOpenAnalysis} 
            className="w-full h-16 border-neutral-800 bg-neutral-900/20 backdrop-blur-md text-neutral-400 hover:text-emerald-400 hover:border-emerald-500/30 group transition-all"
          >
            <BarChart3 className="mr-3 h-5 w-5 opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="text-left">
              <div className="text-[10px] font-black uppercase tracking-widest leading-none">Deep Study</div>
              <div className="text-xs opacity-60">Open in Analysis Board</div>
            </div>
          </Button>
        </aside>
      </div>
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
    queryFn: () => http.get<PuzzleListResponse>("/puzzles?size=15"),
  });

  const puzzleQuery = useQuery({
    queryKey: puzzleId ? ["puzzle", puzzleId] : ["puzzle-random", randomRequestKey, randomExcludeId],
    queryFn: () =>
      puzzleId
        ? http.get<PuzzleDetailResponse>(`/puzzles/${puzzleId}`)
        : http.get<PuzzleDetailResponse>(
            randomExcludeId ? `/puzzles/random?exclude_id=${randomExcludeId}` : "/puzzles/random",
          ),
    staleTime: 0,
  });

  const recordAttemptMutation = useMutation({
    mutationFn: (payload: { puzzleId: string; result: PuzzleAttemptResult }) =>
      http.post<PuzzleAttemptStateResponse>(`/puzzles/${payload.puzzleId}/attempts`, { result: payload.result }),
    onSuccess: (nextAttempt, variables) => {
      queryClient.setQueryData<PuzzleListResponse | undefined>(["puzzle-catalog"], (current) => {
        if (!current) return current;
        return {
          ...current,
          items: current.items.map((item) => (
            item.id === variables.puzzleId ? { ...item, attempt: nextAttempt } : item
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
      <AppShell eyebrow="Fueki Puzzles" title="Initialising" description="">
        <div className="flex h-[500px] w-full flex-col items-center justify-center rounded-3xl border border-neutral-800/50 bg-neutral-950/20 backdrop-blur-xl shadow-2xl">
          <div className="relative flex items-center justify-center">
            <div className="absolute h-16 w-16 animate-ping rounded-full bg-emerald-500/10" />
            <Spinner size="lg" className="text-emerald-500" />
          </div>
          <div className="mt-6 text-[10px] font-black uppercase tracking-[0.4em] text-neutral-500">
            Syncing Neural Patterns
          </div>
        </div>
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