import { moveAccuracyFromWinProbabilityLoss, type MoveClass } from "./moveClassifier";
import type { ReviewReportRow } from "./gameReviewReport";

export type MoveQualityTone = "best" | "brilliant" | "good" | "neutral" | "warning" | "bad";

export interface SideInsights {
  accuracy: number;
  estimatedRating: number;
  averageCentipawnLoss: number;
  classCounts: Record<MoveClass, number>;
}

export interface GameReviewInsights {
  totalMoves: number;
  overallAccuracy: number;
  estimatedRating: number;
  white: SideInsights;
  black: SideInsights;
  brilliantMoves: number;
  classCounts: Record<MoveClass, number>;
}

export const MOVE_CLASSES: readonly MoveClass[] = [
  "best",
  "forced",
  "great",
  "excellent",
  "good",
  "book",
  "inaccuracy",
  "mistake",
  "miss",
  "blunder",
  "brilliant",
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function emptyClassCounts(): Record<MoveClass, number> {
  return MOVE_CLASSES.reduce(
    (counts, moveClass) => ({
      ...counts,
      [moveClass]: 0,
    }),
    {
      best: 0,
      forced: 0,
      great: 0,
      excellent: 0,
      good: 0,
      book: 0,
      inaccuracy: 0,
      mistake: 0,
      miss: 0,
      blunder: 0,
      brilliant: 0,
    } satisfies Record<MoveClass, number>,
  );
}

function countMoveClasses(rows: readonly ReviewReportRow[]): Record<MoveClass, number> {
  const classCounts = emptyClassCounts();

  for (const row of rows) {
    classCounts[row.classification] += 1;
  }

  return classCounts;
}

function centipawnLoss(row: ReviewReportRow): number {
  return Math.max(0, row.color === "w" ? row.evaluationBefore - row.evaluationAfter : row.evaluationAfter - row.evaluationBefore);
}

function estimateRating(accuracy: number, averageLoss: number, blunderRate: number): number {
  const accuracyCurve = 250 + accuracy * 24.5;
  const lossPenalty = Math.sqrt(Math.max(0, averageLoss)) * 18;
  const blunderPenalty = blunderRate * 420;

  return Math.round(clamp(accuracyCurve - lossPenalty - blunderPenalty, 400, 2850));
}

function isReviewableAccuracyRow(row: ReviewReportRow): boolean {
  return row.classification !== "book" && row.classification !== "forced";
}

function sideInsights(rows: readonly ReviewReportRow[]): SideInsights {
  const classCounts = countMoveClasses(rows);

  if (rows.length === 0) {
    return {
      accuracy: 0,
      estimatedRating: 400,
      averageCentipawnLoss: 0,
      classCounts,
    };
  }

  const reviewableRows = rows.filter(isReviewableAccuracyRow);
  const accuracyRows = reviewableRows.length > 0 ? reviewableRows : rows;
  const averageCentipawnLoss = accuracyRows.reduce((sum, row) => sum + centipawnLoss(row), 0) / accuracyRows.length;
  const averageWinProbabilityLoss = accuracyRows.reduce((sum, row) => sum + row.winProbabilityLoss, 0) / accuracyRows.length;
  const accuracy = moveAccuracyFromWinProbabilityLoss(averageWinProbabilityLoss);
  const blunders = accuracyRows.filter((row) => row.classification === "blunder" || row.classification === "miss").length;

  return {
    accuracy,
    estimatedRating: estimateRating(accuracy, averageCentipawnLoss, blunders / accuracyRows.length),
    averageCentipawnLoss: Math.round(averageCentipawnLoss),
    classCounts,
  };
}

export function moveQualityTone(moveClass: MoveClass): MoveQualityTone {
  switch (moveClass) {
    case "brilliant":
      return "brilliant";
    case "best":
    case "great":
    case "excellent":
      return "best";
    case "good":
      return "good";
    case "book":
    case "forced":
      return "neutral";
    case "inaccuracy":
      return "warning";
    case "miss":
    case "mistake":
    case "blunder":
      return "bad";
  }
}

export function buildGameReviewInsights(rows: readonly ReviewReportRow[]): GameReviewInsights {
  const classCounts = countMoveClasses(rows);
  const white = sideInsights(rows.filter((row) => row.color === "w"));
  const black = sideInsights(rows.filter((row) => row.color === "b"));
  const overallAccuracy = Math.round(((white.accuracy + black.accuracy) / 2) * 10) / 10;
  const estimatedRating = Math.round((white.estimatedRating + black.estimatedRating) / 2);

  return {
    totalMoves: rows.length,
    overallAccuracy,
    estimatedRating,
    white,
    black,
    brilliantMoves: classCounts.brilliant,
    classCounts,
  };
}
