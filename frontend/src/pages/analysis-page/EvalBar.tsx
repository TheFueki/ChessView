import { formatEvaluation } from "./analysis-utils";

function getEvalRatio(score: { type: "cp" | "mate"; value: number } | null) {
  if (!score) {
    return 50;
  }

  if (score.type === "mate") {
    return score.value > 0 ? 100 : 0;
  }

  const clamped = Math.max(-600, Math.min(600, score.value));
  return 50 + clamped / 15;
}

export function EvalBar({ score }: { score: { type: "cp" | "mate"; value: number } | null }) {
  const ratio = Math.max(2, Math.min(98, getEvalRatio(score)));

  return (
    <div className="flex h-full w-8 flex-col overflow-hidden rounded-full border border-neutral-800 bg-neutral-950/70">
      <div className="flex items-start justify-center bg-neutral-100 text-[10px] font-semibold text-neutral-950" style={{ height: `${ratio}%` }}>
        <span className="pt-2">{score && ratio > 55 ? formatEvaluation(score) : ""}</span>
      </div>
      <div className="flex flex-1 items-end justify-center bg-neutral-900 text-[10px] font-semibold text-neutral-100">
        <span className="pb-2">{score && ratio <= 55 ? formatEvaluation(score) : ""}</span>
      </div>
    </div>
  );
}
