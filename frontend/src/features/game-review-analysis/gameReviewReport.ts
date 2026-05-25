import { Chess } from "chess.js";
import type { Color, Move, PieceSymbol, Square } from "chess.js";
import { STANDARD_START_FEN } from "@/shared/lib/chess";
import { classifyMoves, moveQualityMetrics, type ClassifiedMoveInput, type MoveClass } from "./moveClassifier";

type PromotionPiece = "q" | "r" | "b" | "n";

export interface ChessViewReviewMove {
  move_number: number;
  uci: string;
  username: string;
  user_id: string | null;
  fen_after: string | null;
  created_at: string | null;
}

export interface PlayedReviewMove extends ClassifiedMoveInput {
  color: Color;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
}

export interface GameReviewSource {
  kind: "pgn" | "chessview";
  gameId?: string;
  pgn?: string;
  moves?: readonly ChessViewReviewMove[];
  finalFen?: string | null;
}

export interface AnalysisContext {
  source: GameReviewSource;
  fens: string[];
  moves: PlayedReviewMove[];
  isVerified: boolean;
  verificationError?: string;
}

export interface ReviewReportRow {
  ply: number;
  moveNumber: number;
  color: Color;
  from: string;
  to: string;
  promotion?: string;
  san: string;
  uci: string;
  fenBefore: string;
  fenAfter: string;
  evaluationBefore: number;
  evaluationAfter: number;
  winProbabilityBefore: number;
  winProbabilityAfter: number;
  winProbabilityLoss: number;
  moveAccuracy: number;
  bestMove?: string;
  isBestMove: boolean;
  classification: MoveClass;
}

export interface GameReview {
  context: AnalysisContext;
  rows: ReviewReportRow[];
}

export interface BuildGameReviewOptions {
  evaluations?: readonly number[];
  bestMoves?: ReadonlyArray<string | null | undefined>;
}

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

function placement(fen: string | null | undefined): string | null {
  return fen?.split(" ")[0] ?? null;
}

function materialBalanceCp(chess: Chess): number {
  let balance = 0;

  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) {
        continue;
      }

      balance += piece.color === "w" ? PIECE_VALUES[piece.type] : -PIECE_VALUES[piece.type];
    }
  }

  return balance;
}

function parseUciMove(uci: string): { from: Square; to: Square; promotion?: PromotionPiece } {
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const promotion = uci.slice(4, 5).toLowerCase();

  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) {
    throw new Error(`Invalid UCI move: ${uci}`);
  }

  return promotion === "q" || promotion === "r" || promotion === "b" || promotion === "n"
    ? { from, to, promotion }
    : { from, to };
}

function uciFromMove(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function playerMaterialLoss(before: number, after: number, color: Color): number {
  return color === "w" ? Math.max(0, before - after) : Math.max(0, after - before);
}

function isSacrifice(chessBefore: Chess, result: Move, beforeBalance: number, afterBalance: number): boolean {
  const movedPiece = chessBefore.get(result.from);
  const capturedPiece = chessBefore.get(result.to);
  const movedPieceValue = movedPiece ? PIECE_VALUES[movedPiece.type] : 0;
  const capturedPieceValue = capturedPiece ? PIECE_VALUES[capturedPiece.type] : 0;
  const materialLoss = playerMaterialLoss(beforeBalance, afterBalance, result.color);
  const capturesMuchCheaperPiece = capturedPieceValue > 0 && movedPieceValue - capturedPieceValue >= 300;

  return materialLoss >= 250 || capturesMuchCheaperPiece;
}

function pushPlayedMove(
  playedMoves: PlayedReviewMove[],
  result: Move,
  fenBefore: string,
  fenAfter: string,
  legalMoveCount: number,
  sacrifice: boolean,
): void {
  const uci = uciFromMove(result);

  playedMoves.push({
    from: result.from,
    to: result.to,
    ...(result.promotion ? { promotion: result.promotion } : {}),
    color: result.color,
    san: result.san,
    uci,
    fenBefore,
    fenAfter,
    isBook: false,
    isForced: legalMoveCount <= 1,
    isSacrifice: sacrifice,
  });
}

function buildContextFromAppliedMoves(
  source: GameReviewSource,
  applyMoves: (chess: Chess, playedMoves: PlayedReviewMove[]) => string | null | undefined | void,
): AnalysisContext {
  const chess = new Chess();
  const playedMoves: PlayedReviewMove[] = [];
  const fens = [chess.fen()];

  const replayError = applyMoves(chess, playedMoves) || null;
  for (const move of playedMoves) {
    fens.push(move.fenAfter);
  }

  const lastFen = fens.at(-1);
  const expectedFinalFen = source.finalFen;
  const isVerified =
    replayError === null &&
    (expectedFinalFen === undefined ||
      expectedFinalFen === null ||
      (lastFen !== undefined && placement(lastFen) === placement(expectedFinalFen)));
  const verificationError = replayError ?? (isVerified ? undefined : "Final position does not match the saved game state");

  return {
    source,
    fens,
    moves: playedMoves,
    isVerified,
    ...(verificationError ? { verificationError } : {}),
  };
}

export function buildAnalysisContextFromPgn(pgn: string): AnalysisContext {
  const source: GameReviewSource = { kind: "pgn", pgn };
  const imported = new Chess();

  try {
    imported.loadPgn(pgn.replace(/\{[^{}]*\}/g, " ").replace(/;[^\r\n]*/g, " "), { strict: false });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not import PGN: ${detail}`);
  }

  const history = imported.history({ verbose: true });
  if (history.length === 0) {
    throw new Error("Could not import PGN: no moves found");
  }

  return buildContextFromAppliedMoves(source, (chess, playedMoves) => {
    for (const historicalMove of history) {
      const legalMoveCount = chess.moves().length;
      const fenBefore = chess.fen();
      const beforeBalance = materialBalanceCp(chess);
      const chessBefore = new Chess(fenBefore);
      const result = chess.move({
        from: historicalMove.from,
        to: historicalMove.to,
        ...(historicalMove.promotion ? { promotion: historicalMove.promotion } : {}),
      });
      const afterBalance = materialBalanceCp(chess);

      pushPlayedMove(playedMoves, result, fenBefore, chess.fen(), legalMoveCount, isSacrifice(chessBefore, result, beforeBalance, afterBalance));
    }
  });
}

export function buildAnalysisContextFromChessViewGame({
  gameId,
  finalFen,
  moves,
}: {
  gameId?: string;
  finalFen?: string | null;
  moves: readonly ChessViewReviewMove[];
}): AnalysisContext {
  const source: GameReviewSource = { kind: "chessview", gameId, finalFen, moves };
  const orderedMoves = [...moves].sort((left, right) => left.move_number - right.move_number);

  return buildContextFromAppliedMoves(source, (chess, playedMoves) => {
    for (const move of orderedMoves) {
      const legalMoveCount = chess.moves().length;
      const fenBefore = chess.fen();
      const beforeBalance = materialBalanceCp(chess);
      const chessBefore = new Chess(fenBefore);
      const result = chess.move(parseUciMove(move.uci));
      const afterBalance = materialBalanceCp(chess);

      pushPlayedMove(playedMoves, result, fenBefore, chess.fen(), legalMoveCount, isSacrifice(chessBefore, result, beforeBalance, afterBalance));

      if (move.fen_after && placement(move.fen_after) !== placement(chess.fen())) {
        return `Saved position after move ${move.move_number} does not match replayed move ${move.uci}`;
      }
    }

    return null;
  });
}

function moveMatchesBestMove(moveUci: string, bestMove: string | null | undefined): boolean {
  if (!bestMove) {
    return false;
  }

  return moveUci === bestMove || moveUci.slice(0, 4) === bestMove.slice(0, 4);
}

export function buildReviewReport(
  context: AnalysisContext,
  evaluations: readonly number[],
  bestMoves: ReadonlyArray<string | null | undefined> = [],
): ReviewReportRow[] {
  const movesForClassification = context.moves.map((move, index) => ({
    ...move,
    isBest: move.isBest === true || moveMatchesBestMove(move.uci, bestMoves[index]),
  }));
  const classifications = classifyMoves(evaluations, movesForClassification);

  return context.moves.map((move, index) => {
    const evaluationBefore = evaluations[index];
    const evaluationAfter = evaluations[index + 1];
    const classification = classifications[index];

    if (evaluationBefore === undefined || evaluationAfter === undefined || classification === undefined) {
      throw new Error(`Missing report data for ply ${index + 1}`);
    }

    const rawMetrics = moveQualityMetrics(evaluationBefore, evaluationAfter, move.color);
    const metrics =
      classification === "book" || classification === "forced"
        ? { ...rawMetrics, winProbabilityAfter: rawMetrics.winProbabilityBefore, winProbabilityLoss: 0, moveAccuracy: 100, centipawnLoss: 0 }
        : rawMetrics;
    const bestMove = bestMoves[index] ?? undefined;

    return {
      ply: index + 1,
      moveNumber: Math.floor(index / 2) + 1,
      color: move.color,
      from: move.from,
      to: move.to,
      ...(move.promotion ? { promotion: move.promotion } : {}),
      san: move.san,
      uci: move.uci,
      fenBefore: move.fenBefore,
      fenAfter: move.fenAfter,
      evaluationBefore,
      evaluationAfter,
      winProbabilityBefore: metrics.winProbabilityBefore,
      winProbabilityAfter: metrics.winProbabilityAfter,
      winProbabilityLoss: metrics.winProbabilityLoss,
      moveAccuracy: metrics.moveAccuracy,
      ...(bestMove ? { bestMove } : {}),
      isBestMove: moveMatchesBestMove(move.uci, bestMove),
      classification,
    };
  });
}

export function simulateEvaluations(fens: readonly string[]): number[] {
  return fens.map((fen, index) => {
    const chess = new Chess(fen || STANDARD_START_FEN);
    const material = materialBalanceCp(chess);
    const activeColorTempo = fen.split(" ")[1] === "w" ? 12 : -12;
    const deterministicNoise = ((index * 37) % 41) - 20;

    return material + activeColorTempo + deterministicNoise;
  });
}

export function buildGameReview(context: AnalysisContext, options: BuildGameReviewOptions = {}): GameReview {
  const evaluations = options.evaluations ?? simulateEvaluations(context.fens);

  return {
    context,
    rows: buildReviewReport(context, evaluations, options.bestMoves),
  };
}
