import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Chessboard } from "react-chessboard";
import type { Square } from "react-chessboard/dist/chessboard/types";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clipboard,
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
import { useSearchParams } from "react-router";
import { useStockfishAnalysis } from "@/features/analyze-position";
import { http } from "@/shared/api";
import {
  applySandboxMove,
  applySandboxMoveFromSquares,
  boardPositionFromFen,
  buildFenFromEditorState,
  fenMetadataFromFen,
  formatPrincipalVariation,
  getAnalysisEligibility,
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
import type { GameDetailResponse, ProfileResponse } from "@/shared/types";
import { Avatar, Button, Card } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { EvalBar } from "./EvalBar";
import {
  buildBoardHighlights,
  formatAnalysisStatus,
  formatEvaluation,
  formatLargeNumber,
  scoreFromWhitePerspective,
  sourceTitleFromHeaders,
} from "./analysis-utils";
import "../../pages-style/analysis-page/analysispage.scss";

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
  const [, setSourceSubtitle] = useState("Build positions, import PGNs, and study without touching live games.");
  const [loadedSourceKey, setLoadedSourceKey] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["dashboard-profile"],
    queryFn: () => http.get<ProfileResponse>("/profiles/me"),
  });
  const sourceGameQuery = useQuery({
    queryKey: ["analysis-source-game", sourceGameId],
    queryFn: () => http.get<GameDetailResponse>(`/games/${sourceGameId}`),
    enabled: Boolean(sourceGameId),
  });

  const profile = profileQuery.data ?? null;
  const currentFen = useMemo(
    () => (currentMoveIndex === 0 ? rootFen : lineMoves[currentMoveIndex - 1]?.fenAfter ?? rootFen),
    [currentMoveIndex, lineMoves, rootFen],
  );
  const editorValidation = useMemo(() => buildFenFromEditorState(editorPosition, editorMetadata), [editorPosition, editorMetadata]);
  const analysisFen = mode === "edit" ? editorValidation.fen : currentFen;
  const analysisEligibility = useMemo(
    () => (analysisFen ? getAnalysisEligibility(analysisFen) : null),
    [analysisFen],
  );
  const analysisUnavailableReason = !analysisFen
    ? editorValidation.error ?? "Create a valid position in the editor to start local analysis."
    : analysisEligibility?.ok
      ? null
      : analysisEligibility?.reason ?? "Analysis is unavailable for this position.";
  const analysis = useStockfishAnalysis({
    fen: analysisFen ?? STANDARD_START_FEN,
    enabled: Boolean(analysisFen && analysisEligibility?.ok),
    depth: 15,
    debounceMs: 250,
  });
  const normalizedScore = useMemo(
    () => (analysisFen && !analysisUnavailableReason ? scoreFromWhitePerspective(analysisFen, analysis.score) : null),
    [analysis.score, analysisFen, analysisUnavailableReason],
  );
  const bestMoveLabel = useMemo(
    () =>
      analysisFen && !analysisUnavailableReason && analysis.bestMove
        ? formatPrincipalVariation(analysisFen, [analysis.bestMove]) || analysis.bestMove
        : null,
    [analysis.bestMove, analysisFen, analysisUnavailableReason],
  );
  const bestMoveSquares = useMemo(
    () => (analysisUnavailableReason ? null : getMoveSquares(analysis.bestMove)),
    [analysis.bestMove, analysisUnavailableReason],
  );
  const bestMoveArrows = useMemo<[Square, Square, string?][]>(
    () => (bestMoveSquares && analysisFen ? [[bestMoveSquares[0] as Square, bestMoveSquares[1] as Square, "rgba(139, 92, 246, 0.85)"]] : []),
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
  const currentPv = useMemo(
    () => (analysisFen && !analysisUnavailableReason ? formatPrincipalVariation(analysisFen, analysis.pv) : ""),
    [analysis.pv, analysisFen, analysisUnavailableReason],
  );
  const analysisStatusLabel = analysisUnavailableReason ? "Unavailable" : formatAnalysisStatus(analysis.status);

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
        subtitle: `Loaded from replay   ${sourceGameQuery.data.time_control_name}`,
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
      title={sourceTitle}
      description={mode === "edit" ? "Edit a legal position and send it to the board." : "Analyze positions, import PGNs, and review candidate lines."}
      maxWidthClassName="max-w-[1440px]"
      actions={
        <div className="flex flex-wrap gap-2">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-300">
            Depth <b className="text-neutral-100">{analysis.depth || 0}</b>
          </div>
          <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-300">
            Eval <b className="text-neutral-100">{formatEvaluation(normalizedScore)}</b>
          </div>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-6">

          <section className="hero-action-section">
            <div className="grid min-w-0 gap-4 md:grid-cols-[48px_minmax(0,1fr)]">
              <EvalBar score={normalizedScore} />
              <div className="mx-auto aspect-square w-full max-w-[min(100%,calc(100vh-12rem),680px)] overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 sm:p-4">
                <Chessboard
                  id="analysis-board"
                  position={mode === "edit" ? editorPosition : currentFen}
                  boardOrientation={orientation}
                  onPieceDrop={handlePieceDrop}
                  onSquareClick={handleSquareClick}
                  animationDuration={180}
                  customDarkSquareStyle={{ backgroundColor: "#2B3A30" }}
                  customLightSquareStyle={{ backgroundColor: "#D9DFC8" }}
                  customBoardStyle={{ borderRadius: "1rem" }}
                  customSquareStyles={boardHighlights}
                  customArrows={analysisUnavailableReason ? [] : bestMoveArrows}
                />
              </div>
            </div>
          </section>

          <section className="recent-section">
             <div className="actions-row flex flex-wrap gap-2 mb-6">
                <Button size="sm" variant="secondary" onClick={() => goToMoveIndex(0)} disabled={currentMoveIndex === 0}><SkipBack size={16}/> Start</Button>
                <Button size="sm" variant="secondary" onClick={() => goToMoveIndex(c => c - 1)} disabled={currentMoveIndex === 0}><ChevronLeft size={16}/> Prev</Button>
                <Button size="sm" variant="secondary" onClick={() => goToMoveIndex(c => c + 1)} disabled={currentMoveIndex === lineMoves.length}><ChevronRight size={16}/> Next</Button>
                <Button size="sm" variant="secondary" onClick={() => goToMoveIndex(lineMoves.length)} disabled={currentMoveIndex === lineMoves.length}><SkipForward size={16}/> End</Button>
                <div className="flex-1" />
                <Button size="sm" variant="secondary" onClick={handleResetStart}><RotateCcw size={16}/> Reset</Button>
                <Button size="sm" variant="secondary" onClick={() => setOrientation(o => o === "white" ? "black" : "white")}><FlipHorizontal size={16}/> Flip</Button>
                <Button size="sm" className="btn-main" onClick={() => setMode(m => m === "play" ? "edit" : "play")}>
                  {mode === "play" ? <><PenSquare size={16} className="mr-2"/> Editor</> : <><PlayCircle size={16} className="mr-2"/> Sandbox</>}
                </Button>
             </div>

             <div className="grid gap-4 md:grid-cols-2">
                <Card className="p-4 space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Analysis Output</div>
                  {analysisUnavailableReason ? (
                    <div className="text-sm text-amber-500 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">{analysisUnavailableReason}</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div>
                          <div className="text-3xl font-bold">{bestMoveLabel ?? "--"}</div>
                          <div className="text-xs text-neutral-500 uppercase">Best Move</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-mono">{formatLargeNumber(analysis.nps)}</div>
                          <div className="text-xs text-neutral-500 uppercase">NPS</div>
                        </div>
                      </div>
                      <div className="text-sm leading-relaxed text-neutral-300 font-mono bg-neutral-900/50 p-3 rounded-xl border border-neutral-800">
                        {currentPv || "Thinking..."}
                      </div>
                    </div>
                  )}
                </Card>

                <Card className="p-4">
                   <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500 mb-3">Workspace Details</div>
                   <div className="space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-neutral-500">Status</span><span className="text-neutral-200">{analysisStatusLabel}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-neutral-500">Nodes</span><span className="text-neutral-200">{formatLargeNumber(analysis.nodes)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-neutral-500">Plies</span><span className="text-neutral-200">{lineMoves.length}</span></div>
                      <div className="pt-2">
                        <div className="text-[10px] text-neutral-600 uppercase mb-1">Current FEN</div>
                        <div className="text-[11px] font-mono break-all text-neutral-400 bg-black/20 p-2 rounded-lg">{analysisFen || "N/A"}</div>
                      </div>
                   </div>
                </Card>
             </div>
          </section>
        </section>

        <aside className="space-y-4">
          <Card className="space-y-4">
            {mode === "edit" ? (
              <div className="aside-section">
                <div className="section-head"><PenSquare size={18}/> Editor Palette</div>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {piecePalette.map(p => (
                    <button 
                      key={p.value} 
                      onClick={() => setEditorSelection(p.value)} 
                      className={`help-item ${editorSelection === p.value ? 'active' : ''}`}
                      style={{ padding: '12px 0', fontSize: '14px' }}
                    >
                      {p.glyph}
                    </button>
                  ))}
                </div>
                
                <div className="mt-6 space-y-4">
                  <div>
                    <div className="text-[10px] uppercase text-neutral-500 mb-2">Turn</div>
                    <div className="flex gap-2">
                      {(["white", "black"] as const).map(t => (
                        <button 
                          key={t} 
                          className={`help-item flex-1 ${editorMetadata.turn === t ? 'active' : ''}`}
                          onClick={() => setEditorMetadata(prev => ({ ...prev, turn: t }))}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase text-neutral-500 mb-2">Castling</div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.keys(editorMetadata.castling).map(key => (
                        <button 
                          key={key} 
                          className={`help-item text-[10px] ${editorMetadata.castling[key as keyof FenMetadata["castling"]] ? 'active' : ''}`}
                          onClick={() => setEditorMetadata(prev => ({ 
                            ...prev, 
                            castling: { ...prev.castling, [key]: !prev.castling[key as keyof FenMetadata["castling"]] } 
                          }))}
                        >
                          {key.replace('white', 'W ').replace('black', 'B ')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" className="flex-1" onClick={handleClearBoard}><Trash2 size={14}/></Button>
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => syncEditorFromFen(STANDARD_START_FEN)}><WandSparkles size={14}/></Button>
                  </div>
                  <Button className="w-full btn-main" onClick={handleApplyEditorPosition}>Apply Setup</Button>
                </div>
              </div>
            ) : (
              <div className="aside-section">
                <div className="section-head"><Clipboard size={18}/> Import & Tools</div>
                
                <div className="mt-4 space-y-6">
                  <div>
                    <div className="text-[10px] uppercase text-neutral-500 mb-2">FEN Input</div>
                    <textarea 
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-[11px] font-mono outline-none focus:border-violet-500/50 transition-colors"
                      rows={3}
                      value={fenInput}
                      onChange={e => setFenInput(e.target.value)}
                    />
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="flex-1" onClick={handleLoadFen}>Load</Button>
                      <Button size="sm" variant="secondary" onClick={handleCopyFen}><Clipboard size={14}/></Button>
                    </div>
                    {fenMessage && <div className="text-[10px] text-violet-400 mt-2">{fenMessage}</div>}
                  </div>

                  <div>
                    <div className="text-[10px] uppercase text-neutral-500 mb-2">PGN Import</div>
                    <textarea 
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-[11px] outline-none focus:border-violet-500/50 transition-colors"
                      rows={5}
                      value={pgnInput}
                      onChange={e => setPgnInput(e.target.value)}
                      placeholder="[Event ...]"
                    />
                    <Button className="w-full mt-2" variant="secondary" onClick={handleImportPgn}><FileUp size={14} className="mr-2"/> Import PGN</Button>
                    {pgnError && <div className="text-[10px] text-red-400 mt-2">{pgnError}</div>}
                  </div>

                  {Object.keys(importHeaders).length > 0 && (
                    <div className="bg-black/20 p-3 rounded-xl border border-neutral-800">
                      <div className="text-[10px] uppercase text-neutral-500 mb-2">Headers</div>
                      {Object.entries(importHeaders).slice(0, 4).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-[10px] mb-1">
                          <span className="text-neutral-600">{k}</span>
                          <span className="text-neutral-400">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <div className="section-head"><BarChart3 size={18}/> Sandbox Line</div>
            <div className="games-stack max-h-[360px] overflow-y-auto">
              {lineMoves.length === 0 ? (
                <div className="p-4 text-xs text-neutral-500">No moves yet. Make a move or import PGN.</div>
              ) : (
                lineMoves.map((move, idx) => (
                  <button
                    type="button"
                    key={`${move.uci}-${idx}`}
                    className={`game-row w-full text-left ${currentMoveIndex === idx + 1 ? 'active' : ''}`}
                    onClick={() => goToMoveIndex(idx + 1)}
                  >
                    <div className="res-indicator" data-result="win">{move.moveNumber}</div>
                    <div className="opp-info">
                      <span className="name">{move.san}</span>
                      <span className="meta">{move.uci}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card className="flex items-center gap-3">
            <Avatar username={profile?.username ?? "Guest"} avatarUrl={profile?.avatar_url} size="sm" />
            <div>
              <div className="text-sm font-semibold text-neutral-100">{profile?.username ?? "Loading..."}</div>
              <div className="text-xs text-neutral-500">Engine {analysis.status}</div>
            </div>
          </Card>
        </aside>
      </div>
    </AppShell>
  );
}
