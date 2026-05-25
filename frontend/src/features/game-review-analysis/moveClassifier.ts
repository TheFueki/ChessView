export type MoveClass =
  | "best"
  | "forced"
  | "great"
  | "excellent"
  | "good"
  | "book"
  | "inaccuracy"
  | "mistake"
  | "miss"
  | "blunder"
  | "brilliant";

export interface ClassifiedMoveInput {
  from: string;
  to: string;
  promotion?: string;
  color?: "w" | "b";
  san?: string;
  isBook?: boolean;
  isForced?: boolean;
  isBest?: boolean;
  isSacrifice?: boolean;
}

export interface MoveQualityMetrics {
  winProbabilityBefore: number;
  winProbabilityAfter: number;
  winProbabilityLoss: number;
  moveAccuracy: number;
  centipawnLoss: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundTo(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

export function winProbabilityFromWhiteEval(centipawns: number): number {
  const bounded = clamp(centipawns, -1_000, 1_000);
  return 100 / (1 + Math.exp(-0.00368208 * bounded));
}

export function playerWinProbability(whiteCentipawns: number, color: "w" | "b"): number {
  const whiteWinProbability = winProbabilityFromWhiteEval(whiteCentipawns);
  return color === "w" ? whiteWinProbability : 100 - whiteWinProbability;
}

export function moveAccuracyFromWinProbabilityLoss(winProbabilityLoss: number): number {
  if (winProbabilityLoss <= 0) {
    return 100;
  }

  const rawAccuracy =
    103.1668100711649 * Math.exp(-0.04354415386753951 * winProbabilityLoss) - 3.166924740191411;
  return roundTo(clamp(rawAccuracy, 0, 100), 1);
}

export function moveQualityMetrics(
  evaluationBefore: number,
  evaluationAfter: number,
  color: "w" | "b",
): MoveQualityMetrics {
  const winProbabilityBefore = playerWinProbability(evaluationBefore, color);
  const winProbabilityAfter = playerWinProbability(evaluationAfter, color);
  const winProbabilityLoss = Math.max(0, winProbabilityBefore - winProbabilityAfter);
  const centipawnLoss = Math.max(0, color === "w" ? evaluationBefore - evaluationAfter : evaluationAfter - evaluationBefore);

  return {
    winProbabilityBefore: roundTo(winProbabilityBefore, 1),
    winProbabilityAfter: roundTo(winProbabilityAfter, 1),
    winProbabilityLoss: roundTo(winProbabilityLoss, 1),
    moveAccuracy: moveAccuracyFromWinProbabilityLoss(winProbabilityLoss),
    centipawnLoss,
  };
}

function severeCentipawnLossClass(metrics: MoveQualityMetrics): MoveClass | null {
  if (metrics.centipawnLoss >= 300) {
    if (metrics.winProbabilityBefore >= 70 && metrics.winProbabilityLoss >= 10) {
      return "miss";
    }

    return metrics.winProbabilityLoss >= 20 ? "blunder" : "mistake";
  }

  if (metrics.centipawnLoss >= 180) {
    if (metrics.winProbabilityBefore >= 70 && metrics.winProbabilityLoss >= 10) {
      return "miss";
    }

    return metrics.winProbabilityLoss >= 20 ? "blunder" : "mistake";
  }

  if (metrics.centipawnLoss >= 90) {
    if (metrics.winProbabilityBefore >= 70 && metrics.winProbabilityLoss >= 10) {
      return "miss";
    }

    return metrics.winProbabilityLoss >= 10 ? "mistake" : "inaccuracy";
  }

  return null;
}

export function classifyMoves(evaluations: readonly number[], moves: readonly ClassifiedMoveInput[]): MoveClass[] {
  if (evaluations.length !== moves.length + 1) {
    throw new Error(`Expected evaluations.length === moves.length + 1, got ${evaluations.length} and ${moves.length}`);
  }

  return moves.map((move, index) => {
    const color = move.color ?? (index % 2 === 0 ? "w" : "b");

    if (move.isBook === true) {
      return "book";
    }

    if (move.isForced === true) {
      return "forced";
    }

    const before = evaluations[index];
    const after = evaluations[index + 1];

    if (before === undefined || after === undefined) {
      throw new Error(`Missing evaluation around ply ${index + 1}`);
    }

    const metrics = moveQualityMetrics(before, after, color);
    const isBest = move.isBest === true;

    if (isBest && move.isSacrifice === true && metrics.moveAccuracy >= 98) {
      return "brilliant";
    }

    if (move.isSacrifice === true && metrics.moveAccuracy >= 95) {
      return "great";
    }

    if (isBest) {
      return "best";
    }

    const severeClass = severeCentipawnLossClass(metrics);
    if (severeClass !== null) {
      return severeClass;
    }

    if (metrics.moveAccuracy >= 95 || metrics.winProbabilityLoss <= 2) {
      return "excellent";
    }

    if (metrics.moveAccuracy >= 88 || metrics.winProbabilityLoss <= 6) {
      return "good";
    }

    if (metrics.moveAccuracy >= 75 || metrics.winProbabilityLoss <= 10) {
      return "inaccuracy";
    }

    if (metrics.moveAccuracy >= 50 || metrics.winProbabilityLoss <= 20) {
      return "mistake";
    }

    if (metrics.winProbabilityBefore >= 70 && metrics.winProbabilityLoss >= 10) {
      return "miss";
    }

    return "blunder";
  });
}
