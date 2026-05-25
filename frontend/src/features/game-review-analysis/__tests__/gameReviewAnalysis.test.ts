import { describe, expect, it } from "vitest";
import {
  buildAnalysisContextFromChessViewGame,
  buildAnalysisContextFromPgn,
  buildGameReview,
  buildGameReviewInsights,
  classifyMoves,
  pairReviewRows,
  simulateEvaluations,
  type ChessViewReviewMove,
  type ReviewReportRow,
} from "../index";

const PGN = `
[Event "Scholar"]
[Site "ChessView"]
[Result "1-0"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0
`;

const CHESSVIEW_MOVES: ChessViewReviewMove[] = [
  {
    move_number: 1,
    uci: "e2e4",
    username: "White",
    user_id: "white",
    fen_after: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
    created_at: "2026-05-25T00:00:00Z",
  },
  {
    move_number: 2,
    uci: "e7e5",
    username: "Black",
    user_id: "black",
    fen_after: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    created_at: "2026-05-25T00:00:01Z",
  },
  {
    move_number: 3,
    uci: "g1f3",
    username: "White",
    user_id: "white",
    fen_after: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
    created_at: "2026-05-25T00:00:02Z",
  },
];

function reportRow(overrides: Partial<ReviewReportRow>): ReviewReportRow {
  return {
    ply: 1,
    moveNumber: 1,
    color: "w",
    from: "e2",
    to: "e4",
    san: "e4",
    uci: "e2e4",
    fenBefore: "start",
    fenAfter: "after",
    evaluationBefore: 0,
    evaluationAfter: 0,
    winProbabilityBefore: 50,
    winProbabilityAfter: 50,
    winProbabilityLoss: 0,
    moveAccuracy: 100,
    isBestMove: false,
    classification: "excellent",
    ...overrides,
  };
}

describe("game review analysis", () => {
  it("builds review context from PGN", () => {
    const context = buildAnalysisContextFromPgn(PGN);

    expect(context.source.kind).toBe("pgn");
    expect(context.isVerified).toBe(true);
    expect(context.moves).toHaveLength(7);
    expect(context.fens).toHaveLength(8);
    expect(context.moves[0]).toMatchObject({ uci: "e2e4", san: "e4", color: "w", isBook: false });
    expect(context.moves.at(-1)).toMatchObject({ uci: "h5f7", san: "Qxf7#" });
  });

  it("builds review context from ordered ChessView move records without trusting backend state as authoritative", () => {
    const context = buildAnalysisContextFromChessViewGame({
      gameId: "game-1",
      finalFen: "not-a-fen-from-server",
      moves: [CHESSVIEW_MOVES[2], CHESSVIEW_MOVES[0], CHESSVIEW_MOVES[1]],
    });

    expect(context.source.kind).toBe("chessview");
    expect(context.isVerified).toBe(false);
    expect(context.moves.map((move) => move.uci)).toEqual(["e2e4", "e7e5", "g1f3"]);
    expect(context.fens.at(-1)).toContain("RNBQKB1R b KQkq");
  });

  it("reports the first mismatched backend fen_after ply", () => {
    const context = buildAnalysisContextFromChessViewGame({
      moves: [
        {
          ...CHESSVIEW_MOVES[0],
          fen_after: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1",
        },
        CHESSVIEW_MOVES[1],
      ],
    });

    expect(context.isVerified).toBe(false);
    expect(context.verificationError).toContain("move 1");
  });

  it("classifies moves and builds renderable report rows from deterministic inputs", () => {
    const context = buildAnalysisContextFromChessViewGame({ moves: CHESSVIEW_MOVES });
    const report = buildGameReview(context, {
      evaluations: [20, 15, 80, -220],
      bestMoves: ["e2e4", "g8f6", "d2d4"],
    });

    expect(classifyMoves([20, 15, 80, -220], context.moves)).toEqual(["excellent", "good", "blunder"]);
    expect(report.rows).toHaveLength(3);
    expect(report.rows[0]).toMatchObject({
      ply: 1,
      moveNumber: 1,
      color: "w",
      uci: "e2e4",
      san: "e4",
      bestMove: "e2e4",
      isBestMove: true,
      classification: "best",
      moveAccuracy: 98,
    });
    expect(report.rows[2]).toMatchObject({
      ply: 3,
      bestMove: "d2d4",
      isBestMove: false,
    });
  });

  it("does not hide early severe mistakes as opening book", () => {
    const context = buildAnalysisContextFromChessViewGame({ moves: [CHESSVIEW_MOVES[0]] });
    const report = buildGameReview(context, {
      evaluations: [250, -450],
      bestMoves: ["d2d4"],
    });

    expect(report.rows[0].classification === "book").toBe(false);
    expect(["mistake", "blunder", "miss"]).toContain(report.rows[0].classification);
  });

  it("pairs rows into full-move table rows", () => {
    expect(
      pairReviewRows([
        reportRow({ ply: 1, moveNumber: 1, color: "w", san: "e4" }),
        reportRow({ ply: 2, moveNumber: 1, color: "b", san: "e5" }),
        reportRow({ ply: 3, moveNumber: 2, color: "w", san: "Nf3" }),
      ]),
    ).toMatchObject([
      { moveNumber: 1, white: { san: "e4" }, black: { san: "e5" } },
      { moveNumber: 2, white: { san: "Nf3" } },
    ]);
  });

  it("summarizes accuracy, estimated rating, and class counts", () => {
    const insights = buildGameReviewInsights([
      reportRow({ ply: 1, color: "w", classification: "book", moveAccuracy: 100, winProbabilityLoss: 0 }),
      reportRow({ ply: 2, color: "b", classification: "excellent", moveAccuracy: 97, winProbabilityLoss: 1 }),
      reportRow({ ply: 3, color: "w", classification: "brilliant", moveAccuracy: 100, winProbabilityLoss: 0 }),
      reportRow({ ply: 4, color: "b", classification: "blunder", moveAccuracy: 18, winProbabilityLoss: 27 }),
    ]);

    expect(insights.totalMoves).toBe(4);
    expect(insights.brilliantMoves).toBe(1);
    expect(insights.classCounts.blunder).toBe(1);
    expect(insights.white.accuracy).toBe(100);
    expect(insights.black.estimatedRating).toBeLessThan(insights.white.estimatedRating);
  });

  it("can simulate stable evaluations for tests and local fallback review", () => {
    const context = buildAnalysisContextFromPgn(PGN);

    expect(simulateEvaluations(context.fens)).toHaveLength(context.moves.length + 1);
    expect(simulateEvaluations(context.fens)).toEqual(simulateEvaluations(context.fens));
  });
});
