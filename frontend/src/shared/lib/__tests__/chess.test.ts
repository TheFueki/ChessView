import { describe, expect, it } from "vitest";
import {
  applySandboxMove,
  boardPositionFromFen,
  buildFenFromEditorState,
  formatPrincipalVariation,
  getAnalysisEligibility,
  parsePgnToSandbox,
  STANDARD_START_FEN,
} from "../chess";

describe("analysis chess helpers", () => {
  it("round-trips editor board state into a FEN suitable for analysis", () => {
    const position = boardPositionFromFen(STANDARD_START_FEN);
    const result = buildFenFromEditorState(position, {
      turn: "white",
      castling: {
        whiteKingside: true,
        whiteQueenside: true,
        blackKingside: true,
        blackQueenside: true,
      },
    });

    expect(result).toEqual({
      fen: STANDARD_START_FEN,
      error: null,
    });
    expect(getAnalysisEligibility(result.fen ?? "")).toEqual({ ok: true, reason: null });
  });

  it("rejects impossible castling metadata before analysis starts", () => {
    const result = getAnalysisEligibility("4k3/8/8/8/8/8/8/4K3 w K - 0 1");

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("White kingside castling");
  });

  it("applies UCI moves and formats principal variations deterministically", () => {
    const firstMove = applySandboxMove(STANDARD_START_FEN, "e2e4");

    expect(firstMove).toMatchObject({
      moveNumber: 1,
      uci: "e2e4",
      san: "e4",
    });
    expect(formatPrincipalVariation(STANDARD_START_FEN, ["e2e4", "e7e5", "g1f3"])).toBe("e4 e5 Nf3");
  });

  it("parses PGN headers and moves for imported analysis lines", () => {
    const parsed = parsePgnToSandbox(`
      [Event "Training"]
      [White "Ada"]
      [Black "Noether"]

      1. e4 e5 2. Nf3 Nc6
    `);

    expect(parsed.headers).toMatchObject({ Event: "Training", White: "Ada", Black: "Noether" });
    expect(parsed.rootFen).toBe(STANDARD_START_FEN);
    expect(parsed.moves.map((move) => move.uci)).toEqual(["e2e4", "e7e5", "g1f3", "b8c6"]);
  });
});
