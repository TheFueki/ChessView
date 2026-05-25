import type { ReviewReportRow } from "./gameReviewReport";

export interface ReviewMovePair {
  moveNumber: number;
  white?: ReviewReportRow;
  black?: ReviewReportRow;
}

export function pairReviewRows(rows: readonly ReviewReportRow[]): ReviewMovePair[] {
  const pairsByMove = new Map<number, ReviewMovePair>();

  for (const row of rows) {
    const pair = pairsByMove.get(row.moveNumber) ?? { moveNumber: row.moveNumber };

    if (row.color === "w") {
      pair.white = row;
    } else {
      pair.black = row;
    }

    pairsByMove.set(row.moveNumber, pair);
  }

  return [...pairsByMove.values()].sort((left, right) => left.moveNumber - right.moveNumber);
}
