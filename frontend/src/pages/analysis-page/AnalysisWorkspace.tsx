import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Chessboard } from "react-chessboard";
import type { Square } from "react-chessboard/dist/chessboard/types";
import {
  BarChart3,
  Brain,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Eraser,
  FileUp,
  FlipHorizontal,
  PenSquare,
  PlayCircle,
  RotateCcw,
  SkipBack,
  SkipForward,
  Trash2,
  WandSparkles,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { useStockfishAnalysis } from "@/features/analyze-position";
import { http } from "@/shared/api";
import {
  applySandboxMove,
  applySandboxMoveFromSquares,
  boardPositionFromFen,
  buildFenFromEditorState,
  fenMetadataFromFen,
  formatPrincipalVariation,
  getLegalMoves,
  getMoveSquares,
  getSquareColor,
  parsePgnToSandbox,
  STANDARD_START_FEN,
  type BoardPosition,
  type EditorPieceCode,
  type FenMetadata,
  type SandboxMove,
} from "@/shared/lib/chess";
import type { GameDetailResponse, GameHistoryResponse } from "@/shared/types";
import { Avatar, Button, Card, Spinner } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { EvalBar } from "./EvalBar";
import {
  buildBoardHighlights,
  formatAnalysisStatus,
  formatDateTime,
  formatEvaluation,
  formatLargeNumber,
  scoreFromWhitePerspective,
  sourceTitleFromHeaders,
} from "./analysis-utils";

type AnalysisMode = "play" | "edit";
type Orientation = "white" | "black";
type EditorSelection = EditorPieceCode | "erase";

const piecePalette: Array<{ value: EditorSelection; label: string; glyph: string }> = [
  { value: "wK", label: "White king", glyph: "wK" },
  { value: "wQ", label: "White queen", glyph: "wQ" },
  { value: "wR", label: "White rook", glyph: "wR" },
  { value: "wB", label: "White bishop", glyph: "wB" },
  { value: "wN", label: "White knight", glyph: "wN" },
  { value: "wP", label: "White pawn", glyph: "wP" },
  { value: "bK", label: "Black king", glyph: "bK" },
  { value: "bQ", label: "Black queen", glyph: "bQ" },
  { value: "bR", label: "Black rook", glyph: "bR" },
  { value: "bB", label: "Black bishop", glyph: "bB" },
  { value: "bN", label: "Black knight", glyph: "bN" },
  { value: "bP", label: "Black pawn", glyph: "bP" },
  { value: "erase", label: "Eraser", glyph: "DEL" },
];

export function AnalysisWorkspace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sourceGameId = searchParams.get("gameId");
  const [mode, setMode] = useState<AnalysisMode>("play");
  const [orientation, setOrientation] = useState<Orientation>("white");
  const [rootFen, setRootFen] = useState(STANDARD_START_FEN);
  const [lineMoves, setLineMoves] = useState<SandboxMove[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);
  const [editorPosition, setEditorPosition] = useState<BoardPosition>(() => boardPositionFromFen(STANDARD_START_FEN));
  const [editorMetadata, setEditorMetadata] = useState<FenMetadata>(() => fenMetadataFromFen(STANDARD_START_FEN));
  const [editorSelection, setEditorSelection] = useState<EditorSelection>("wP");
  const [fenInput, setFenInput] = useState(STANDARD_START_FEN);
  const [fenMessage, setFenMessage] = useState<string | null>(null);
  const [pgnInput, setPgnInput] = useState("");
  const [pgnError, setPgnError] = useState<string | null>(null);
  const [importHeaders, setImportHeaders] = useState<Record<string, string>>({});
  const [sourceTitle, setSourceTitle] = useState("Sandbox Board");
  const [sourceSubtitle, setSourceSubtitle] = useState("Build positions, import PGNs, and study without touching live games.");
  const [loadedSourceKey, setLoadedSourceKey] = useState<string | null>(null);

  const historyQuery = useQuery({
    queryKey: ["analysis-history"],
    queryFn: () => http.get<GameHistoryResponse>("/games"),
  });
  const sourceGameQuery = useQuery({
    queryKey: ["analysis-source-game", sourceGameId],
    queryFn: () => http.get<GameDetailResponse>(`/games/${sourceGameId}`),
    enabled: Boolean(sourceGameId),
  });

  const reviewableGames = useMemo(
    () => (historyQuery.data?.items ?? []).filter((game) => game.status !== "active"),
    [historyQuery.data?.items],
  );
  const currentFen = useMemo(
    () => (currentMoveIndex === 0 ? rootFen : lineMoves[currentMoveIndex - 1]?.fenAfter ?? rootFen),
    [currentMoveIndex, lineMoves, rootFen],
  );
  const editorValidation = useMemo(() => buildFenFromEditorState(editorPosition, editorMetadata), [editorPosition, editorMetadata]);
  const analysisFen = mode === "edit" ? editorValidation.fen : currentFen;
  const analysis = useStockfishAnalysis({ fen: analysisFen ?? STANDARD_START_FEN, enabled: Boolean(analysisFen), depth: 15, debounceMs: 250 });
  const normalizedScore = useMemo(
    () => (analysisFen ? scoreFromWhitePerspective(analysisFen, analysis.score) : null),
    [analysis.score, analysisFen],
  );
  const bestMoveLabel = useMemo(
    () => (analysisFen && analysis.bestMove ? formatPrincipalVariation(analysisFen, [analysis.bestMove]) || analysis.bestMove : null),
    [analysis.bestMove, analysisFen],
  );
  const bestMoveSquares = useMemo(() => getMoveSquares(analysis.bestMove), [analysis.bestMove]);
  const bestMoveArrows = useMemo<[Square, Square, string?][]>(
    () => (bestMoveSquares && analysisFen ? [[bestMoveSquares[0] as Square, bestMoveSquares[1] as Square, "rgba(16, 185, 129, 0.85)"]] : []),
    [analysisFen, bestMoveSquares],
  );
  const boardHighlights = useMemo(
    () => buildBoardHighlights({
      fen: mode === "edit" ? editorValidation.fen : currentFen,
      lastMoveUci: mode === "play" && currentMoveIndex > 0 ? lineMoves[currentMoveIndex - 1]?.uci ?? null : null,
      selectedSquare: mode === "play" ? selectedSquare : null,
      legalTargets: mode === "play" ? legalTargets : [],
    }),
    [currentFen, currentMoveIndex, editorValidation.fen, legalTargets, lineMoves, mode, selectedSquare],
  );
  const currentPv = useMemo(() => (analysisFen ? formatPrincipalVariation(analysisFen, analysis.pv) : ""), [analysis.pv, analysisFen]);

  const syncEditorFromFen = (fen: string) => {
    setEditorPosition(boardPositionFromFen(fen));
    setEditorMetadata(fenMetadataFromFen(fen));
    setFenInput(fen);
  };

  const replaceWorkspace = useCallback(({
    nextRootFen,
    nextMoves,
    nextHeaders,
    title,
    subtitle,
    nextPgnInput,
    loadedKey,
  }: {
    nextRootFen: string;
    nextMoves: SandboxMove[];
    nextHeaders: Record<string, string>;
    title: string;
    subtitle: string;
    nextPgnInput?: string;
    loadedKey?: string | null;
  }) => {
    setRootFen(nextRootFen);
    setLineMoves(nextMoves);
    setCurrentMoveIndex(nextMoves.length);
    setSelectedSquare(null);
    setLegalTargets([]);
    setImportHeaders(nextHeaders);
    setSourceTitle(title);
    setSourceSubtitle(subtitle);
    setFenMessage(null);
    setPgnError(null);
    setMode("play");
    if (nextPgnInput !== undefined) setPgnInput(nextPgnInput);
    syncEditorFromFen(nextMoves[nextMoves.length - 1]?.fenAfter ?? nextRootFen);
    setLoadedSourceKey(loadedKey ?? null);
  }, []);

  useEffect(() => {
    if (!sourceGameId || !sourceGameQuery.data) return;
    const sourceKey = `game:${sourceGameQuery.data.id}`;
    if (loadedSourceKey === sourceKey) return;

    let runningFen = STANDARD_START_FEN;
    const moves: SandboxMove[] = [];
    for (const move of sourceGameQuery.data.moves) {
      const appliedMove = applySandboxMove(runningFen, move.uci);
      if (!appliedMove) continue;
      moves.push({ ...appliedMove, moveNumber: move.move_number });
      runningFen = appliedMove.fenAfter;
    }

    startTransition(() => {
      replaceWorkspace({
        nextRootFen: STANDARD_START_FEN,
        nextMoves: moves,
        nextHeaders: { White: sourceGameQuery.data.white.username, Black: sourceGameQuery.data.black.username, Result: sourceGameQuery.data.result ?? "*" },
        title: `${sourceGameQuery.data.white.username} vs ${sourceGameQuery.data.black.username}`,
        subtitle: `Loaded from replay • ${sourceGameQuery.data.time_control_name}`,
        loadedKey: sourceKey,
      });
    });
  }, [loadedSourceKey, replaceWorkspace, sourceGameId, sourceGameQuery.data]);

  const goToMoveIndex = (nextIndex: number | ((current: number) => number)) => {
    const resolved = typeof nextIndex === "function" ? nextIndex(currentMoveIndex) : nextIndex;
    setCurrentMoveIndex(Math.max(0, Math.min(lineMoves.length, resolved)));
    setSelectedSquare(null);
    setLegalTargets([]);
  };

  const handleApplySandboxMove = (from: string, to: string) => {
    const turnColor = currentFen.includes(" w ") ? "white" : "black";
    const appliedMove = applySandboxMoveFromSquares(currentFen, from, to, turnColor);
    if (!appliedMove) return false;

    const nextLine = [...lineMoves.slice(0, currentMoveIndex), { ...appliedMove, moveNumber: currentMoveIndex + 1 }];
    setLineMoves(nextLine);
    setCurrentMoveIndex(nextLine.length);
    setSelectedSquare(null);
    setLegalTargets([]);
    setImportHeaders({});
    setSourceTitle("Sandbox Board");
    setSourceSubtitle("Local move line from the current position.");
    setLoadedSourceKey(null);
    return true;
  };

  const handleSquareClick = (square: Square) => {
    if (mode === "edit") {
      setEditorPosition((current) => {
        const next = { ...current };
        if (editorSelection === "erase") delete next[square];
        else next[square] = editorSelection;
        return next;
      });
      return;
    }

    if (selectedSquare && legalTargets.includes(square)) {
      handleApplySandboxMove(selectedSquare, square);
      return;
    }

    const squareColor = getSquareColor(currentFen, square);
    const turnColor = currentFen.includes(" w ") ? "white" : "black";
    if (!squareColor || squareColor !== turnColor) {
      setSelectedSquare(null);
      setLegalTargets([]);
      return;
    }

    setSelectedSquare(square);
    setLegalTargets(getLegalMoves(currentFen, square, turnColor));
  };

  const handlePieceDrop = (sourceSquare: Square, targetSquare: Square) => {
    if (mode === "edit") {
      setEditorPosition((current) => {
        const piece = current[sourceSquare];
        if (!piece) return current;
        const next = { ...current };
        delete next[sourceSquare];
        next[targetSquare] = piece;
        return next;
      });
      return true;
    }

    return handleApplySandboxMove(sourceSquare, targetSquare);
  };

  const handleLoadFen = () => {
    const nextFen = fenInput.trim();
    if (!nextFen) {
      setFenMessage("Paste a FEN first.");
      return;
    }

    try {
      replaceWorkspace({ nextRootFen: nextFen, nextMoves: [], nextHeaders: {}, title: "Custom FEN", subtitle: "Loaded directly into the sandbox board." });
      setFenMessage("FEN loaded into the sandbox board.");
    } catch (error) {
      setFenMessage(error instanceof Error ? error.message : "Unable to load FEN.");
    }
  };

  const handleResetStart = () => replaceWorkspace({ nextRootFen: STANDARD_START_FEN, nextMoves: [], nextHeaders: {}, title: "Sandbox Board", subtitle: "Standard starting position ready for local analysis." });
  const handleClearBoard = () => {
    setMode("edit");
    setEditorPosition({});
    setEditorMetadata({ turn: "white", castling: { whiteKingside: false, whiteQueenside: false, blackKingside: false, blackQueenside: false } });
    setFenInput("8/8/8/8/8/8/8/8 w - - 0 1");
    setFenMessage("Board cleared in editor mode. Add kings before starting a sandbox line.");
  };
  const handleEditCurrentPosition = () => {
    syncEditorFromFen(currentFen);
    setMode("edit");
    setFenMessage(null);
  };
  const handleApplyEditorPosition = () => {
    if (!editorValidation.fen) {
      setFenMessage(editorValidation.error ?? "Fix the board setup before using it.");
      return;
    }
    replaceWorkspace({ nextRootFen: editorValidation.fen, nextMoves: [], nextHeaders: {}, title: "Custom Setup", subtitle: "Sandbox line started from the edited position." });
  };
  const handleImportPgn = () => {
    if (!pgnInput.trim()) {
      setPgnError("Paste a PGN first.");
      return;
    }
    try {
      const parsed = parsePgnToSandbox(pgnInput);
      replaceWorkspace({ nextRootFen: parsed.rootFen, nextMoves: parsed.moves, nextHeaders: parsed.headers, title: sourceTitleFromHeaders(parsed.headers), subtitle: "Imported from pasted PGN.", nextPgnInput: pgnInput });
    } catch (error) {
      setPgnError(error instanceof Error ? error.message : "Unable to parse PGN.");
    }
  };
  const handleCopyFen = async () => {
    const exportFen = mode === "edit" ? editorValidation.fen : currentFen;
    if (!exportFen) {
      setFenMessage(editorValidation.error ?? "This edited position is not a valid FEN yet.");
      return;
    }
    if (navigator.clipboard) await navigator.clipboard.writeText(exportFen);
    setFenInput(exportFen);
    setFenMessage("Current FEN copied to your clipboard.");
  };

  return (
    <AppShell
      eyebrow="Study"
      title="Analysis board and editor"
      description="Build any position, paste PGNs, play out local lines, and let Stockfish re-evaluate every current sandbox position without touching live games."
      actions={
        <>
          <Button onClick={handleResetStart}><RotateCcw className="h-4 w-4" />Standard Start</Button>
          <Button variant="secondary" onClick={() => navigate("/puzzles")}><Brain className="h-4 w-4" />Solve Puzzle</Button>
          <Button variant="secondary" onClick={() => setOrientation((current) => (current === "white" ? "black" : "white"))}><FlipHorizontal className="h-4 w-4" />Flip Board</Button>
          <Button variant="secondary" onClick={handleEditCurrentPosition}><PenSquare className="h-4 w-4" />Edit Position</Button>
        </>
      }
      maxWidthClassName="max-w-[1520px]"
    >
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(380px,0.82fr)]">
        <div className="space-y-6">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-neutral-800 bg-linear-to-r from-cyan-500/12 via-transparent to-emerald-500/12 px-6 py-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300/80">Workspace</div>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight text-neutral-100">{sourceTitle}</h2>
                  <p className="mt-2 max-w-2xl text-sm text-neutral-400">{sourceSubtitle}</p>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/75 px-5 py-4 text-right">
                  <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Mode</div>
                  <div className="mt-1 text-3xl font-bold text-neutral-100">{mode === "edit" ? "Editor" : "Sandbox"}</div>
                </div>
              </div>
            </div>
            <div className="grid gap-4 px-6 py-6 md:grid-cols-[40px_minmax(0,1fr)]">
              <EvalBar score={normalizedScore} />
              <div className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950/60 p-4">
                <Chessboard
                  id="analysis-board"
                  position={mode === "edit" ? editorPosition : currentFen}
                  boardOrientation={orientation}
                  arePiecesDraggable
                  onPieceDrop={handlePieceDrop}
                  onSquareClick={handleSquareClick}
                  autoPromoteToQueen
                  animationDuration={180}
                  customDarkSquareStyle={{ backgroundColor: "#2B3A30" }}
                  customLightSquareStyle={{ backgroundColor: "#D9DFC8" }}
                  customBoardStyle={{ borderRadius: "1rem" }}
                  customSquareStyles={boardHighlights}
                  customArrows={analysisFen ? bestMoveArrows : []}
                />
              </div>
            </div>
            <div className="border-t border-neutral-800 px-6 py-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4"><div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Current FEN</div><div className="mt-3 break-all font-mono text-sm text-neutral-100">{analysisFen ?? "Editor position is not valid yet"}</div></div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4"><div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Line Length</div><div className="mt-3 text-2xl font-semibold text-neutral-100">{lineMoves.length} plies</div><div className="mt-1 text-sm text-neutral-500">Current step {currentMoveIndex}</div></div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4"><div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Analysis</div><div className="mt-3 text-2xl font-semibold text-neutral-100">{formatAnalysisStatus(analysis.status)}</div><div className="mt-1 text-sm text-neutral-500">{analysisFen ? "Local Stockfish keeps up with the displayed position." : "Waiting for a valid position."}</div></div>
              </div>
            </div>
          </Card>
          <Card className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => goToMoveIndex(0)} disabled={currentMoveIndex === 0}><SkipBack className="h-4 w-4" />Start</Button>
              <Button variant="secondary" size="sm" onClick={() => goToMoveIndex((value) => value - 1)} disabled={currentMoveIndex === 0}><ChevronLeft className="h-4 w-4" />Prev</Button>
              <Button variant="secondary" size="sm" onClick={() => goToMoveIndex((value) => value + 1)} disabled={currentMoveIndex === lineMoves.length}>Next<ChevronRight className="h-4 w-4" /></Button>
              <Button variant="secondary" size="sm" onClick={() => goToMoveIndex(lineMoves.length)} disabled={currentMoveIndex === lineMoves.length}>End<SkipForward className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => setMode((current) => (current === "play" ? "edit" : "play"))}>
                {mode === "play" ? <><PenSquare className="h-4 w-4" />Switch to Editor</> : <><PlayCircle className="h-4 w-4" />Return to Sandbox</>}
              </Button>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-400">
              {mode === "edit"
                ? "Editor mode lets you place or erase pieces freely, change the side to move, and set castling rights before starting a local line."
                : "Sandbox mode keeps a local move list. Step backward, branch from any point, and Stockfish will immediately re-analyze the displayed position."}
            </div>
          </Card>
        </div>

        <div className="flex min-h-0 flex-col gap-6">
          <Card className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Computer Analysis</div>
                <div className="mt-2 text-sm text-neutral-400">{analysisFen ? "The engine is evaluating the currently displayed sandbox position." : "Create a valid position in the editor to start local analysis."}</div>
              </div>
              <div className="rounded-full border border-neutral-800 bg-neutral-950/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">{formatAnalysisStatus(analysis.status)}</div>
            </div>
            {analysis.error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{analysis.error}</div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4"><div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Evaluation</div><div className="mt-3 text-4xl font-bold tabular-nums text-neutral-100">{formatEvaluation(normalizedScore)}</div><div className="mt-1 text-sm text-neutral-500">White-perspective score for the displayed position</div></div>
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4"><div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Best Move</div><div className="mt-3 text-2xl font-semibold text-neutral-100">{bestMoveLabel ?? "--"}</div><div className="mt-1 font-mono text-sm text-neutral-500">{analysis.bestMove ?? "Waiting for a line..."}</div></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4"><div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Depth</div><div className="mt-2 text-xl font-semibold tabular-nums text-neutral-100">{analysis.depth || "--"}</div><div className="mt-1 text-xs text-neutral-500">SelDepth {analysis.selectiveDepth ?? "--"}</div></div>
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4"><div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Nodes</div><div className="mt-2 text-xl font-semibold tabular-nums text-neutral-100">{formatLargeNumber(analysis.nodes)}</div><div className="mt-1 text-xs text-neutral-500">Visited positions</div></div>
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4"><div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Speed</div><div className="mt-2 text-xl font-semibold tabular-nums text-neutral-100">{formatLargeNumber(analysis.nps)}</div><div className="mt-1 text-xs text-neutral-500">Nodes per second</div></div>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4"><div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500"><BarChart3 className="h-3.5 w-3.5" />Principal Variation</div><div className="mt-3 text-sm leading-6 text-neutral-200">{currentPv || "Thinking through the best continuation..."}</div></div>
              </>
            )}
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div><div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Board Editor</div><div className="mt-2 text-sm text-neutral-400">Place pieces, set metadata, then start a fresh sandbox line.</div></div>
              <Button size="sm" onClick={handleApplyEditorPosition} disabled={!editorValidation.fen}><PlayCircle className="h-4 w-4" />Use Edited Position</Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {piecePalette.map((piece) => (
                <button key={piece.value} onClick={() => setEditorSelection(piece.value)} className={`rounded-2xl border px-3 py-3 text-center transition ${editorSelection === piece.value ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200" : "border-neutral-800 bg-neutral-950/60 text-neutral-300 hover:border-neutral-700"}`}>
                  <div className="text-lg font-semibold">{piece.glyph}</div>
                  <div className="mt-2 text-[11px] uppercase tracking-[0.18em]">{piece.value === "erase" ? "Erase" : piece.value}</div>
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Side to Move</div>
                <div className="mt-3 flex gap-2">{(["white", "black"] as const).map((turn) => <button key={turn} onClick={() => setEditorMetadata((current) => ({ ...current, turn }))} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition ${editorMetadata.turn === turn ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200" : "border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-700"}`}>{turn === "white" ? "White" : "Black"}</button>)}</div>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Castling Rights</div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    { key: "whiteKingside", label: "White O-O" },
                    { key: "whiteQueenside", label: "White O-O-O" },
                    { key: "blackKingside", label: "Black O-O" },
                    { key: "blackQueenside", label: "Black O-O-O" },
                  ].map((item) => (
                    <button key={item.key} onClick={() => setEditorMetadata((current) => ({ ...current, castling: { ...current.castling, [item.key]: !current.castling[item.key as keyof FenMetadata["castling"]] } }))} className={`rounded-xl border px-3 py-2 text-sm transition ${editorMetadata.castling[item.key as keyof FenMetadata["castling"]] ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200" : "border-neutral-800 bg-neutral-950 text-neutral-300 hover:border-neutral-700"}`}>{item.label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={handleClearBoard}><Trash2 className="h-4 w-4" />Clear Board</Button>
              <Button variant="secondary" size="sm" onClick={() => syncEditorFromFen(STANDARD_START_FEN)}><WandSparkles className="h-4 w-4" />Reset Editor</Button>
              <Button variant="ghost" size="sm" onClick={() => setEditorSelection("erase")}><Eraser className="h-4 w-4" />Eraser</Button>
            </div>
            <div className={`rounded-2xl border p-4 text-sm ${editorValidation.fen ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100" : "border-amber-500/20 bg-amber-500/10 text-amber-100"}`}>{editorValidation.fen ? `Valid editor position: ${editorValidation.fen}` : editorValidation.error ?? "Place pieces to build a position."}</div>
          </Card>
          <Card className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">FEN Tools</div>
            <textarea value={fenInput} onChange={(event) => setFenInput(event.target.value)} className="min-h-[110px] w-full rounded-2xl border border-neutral-800 bg-neutral-950/70 px-4 py-3 font-mono text-sm text-neutral-100 outline-none transition focus:border-emerald-500/40" placeholder="Paste a FEN here..." />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleLoadFen}>Load FEN</Button>
              <Button size="sm" variant="secondary" onClick={handleCopyFen}><Clipboard className="h-4 w-4" />Copy Current FEN</Button>
            </div>
            {fenMessage ? <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-300">{fenMessage}</div> : null}
          </Card>

          <Card className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">PGN Import</div>
            <textarea value={pgnInput} onChange={(event) => setPgnInput(event.target.value)} className="min-h-[180px] w-full rounded-2xl border border-neutral-800 bg-neutral-950/70 px-4 py-3 text-sm text-neutral-100 outline-none transition focus:border-emerald-500/40" placeholder={`[Event "Training"]\n1. e4 e5 2. Nf3 Nc6`} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleImportPgn}><FileUp className="h-4 w-4" />Import PGN</Button>
              <Button size="sm" variant="secondary" onClick={() => setPgnInput("")}>Clear PGN</Button>
            </div>
            {pgnError ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{pgnError}</div> : null}
            {Object.keys(importHeaders).length > 0 ? (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Imported Headers</div>
                <div className="mt-3 grid gap-2 text-sm text-neutral-200">
                  {Object.entries(importHeaders).slice(0, 6).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-4"><span className="text-neutral-500">{key}</span><span className="text-right">{value}</span></div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          <Card className="flex min-h-0 flex-col">
            <div className="border-b border-neutral-800 pb-4">
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Sandbox Line</div>
              <div className="mt-2 text-sm text-neutral-400">Click any ply to jump to that exact analysis position.</div>
            </div>
            <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
              {lineMoves.length === 0 ? (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-500">No moves yet. Make a local move, import a PGN, or load a replay into analysis.</div>
              ) : (
                lineMoves.map((move, index) => (
                  <button key={`${move.moveNumber}-${move.uci}-${index}`} onClick={() => goToMoveIndex(index + 1)} className={`grid w-full grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-2xl border px-4 py-3 text-left transition ${currentMoveIndex === index + 1 ? "border-emerald-500/40 bg-emerald-500/10" : "border-neutral-800 bg-neutral-950/60 hover:border-neutral-700 hover:bg-neutral-900/70"}`}>
                    <span className="text-xs font-medium tabular-nums text-neutral-500">#{move.moveNumber}</span>
                    <div><div className="font-mono text-sm text-neutral-100">{move.san}</div><div className="mt-1 text-xs text-neutral-500">{move.uci}</div></div>
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Finished Games</div>
            {historyQuery.isLoading ? (
              <div className="flex items-center gap-3 text-sm text-neutral-400"><Spinner size="sm" /><span>Loading replay shortcuts...</span></div>
            ) : reviewableGames.length === 0 ? (
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-500">Finish a game first, then load it directly into this analysis board.</div>
            ) : (
              <div className="space-y-3">
                {reviewableGames.slice(0, 6).map((game) => (
                  <div key={game.id} className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                    <div className="flex items-center gap-3">
                      <Avatar username={game.opponent.username} avatarUrl={game.opponent.avatar_url} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-neutral-100">{game.opponent.username}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-500"><span>{game.time_control_name}</span><span className="h-1 w-1 rounded-full bg-neutral-700" /><span>{formatDateTime(game.ended_at ?? game.started_at)}</span></div>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => navigate(`/analysis?gameId=${game.id}`)}>Load to Board</Button>
                      <Button size="sm" variant="secondary" className="flex-1" onClick={() => navigate(`/games/${game.id}`)}>Open Replay</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
