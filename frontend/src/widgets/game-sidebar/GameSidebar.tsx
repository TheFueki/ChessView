import { Activity, List } from "lucide-react";
import { useGameStore } from "@/entities/game";
import { ResignButton } from "@/features/resign-game";
import { Card } from "@/shared/ui";

function formatStatus(status: string, turn: "white" | "black", result: string | null) {
  if (status === "active") {
    return `Turn: ${turn}`;
  }

  if (result) {
    return `${status} - ${result}`;
  }

  return status;
}

function formatReason(reason: string | null) {
  if (!reason) {
    return null;
  }

  return reason.replaceAll("_", " ");
}

export function GameSidebar() {
  const moves = useGameStore((state) => state.moves);
  const status = useGameStore((state) => state.status);
  const timeControlName = useGameStore((state) => state.timeControlName);
  const turn = useGameStore((state) => state.turn);
  const result = useGameStore((state) => state.result);
  const gameOverReason = useGameStore((state) => state.gameOverReason);
  const terminationReason = useGameStore((state) => state.terminationReason);
  const clock = useGameStore((state) => state.clock);
  const error = useGameStore((state) => state.error);
  const isGameOver = status !== "active";

  const movePairs = [];
  for (let index = 0; index < moves.length; index += 2) {
    movePairs.push({
      turn: Math.floor(index / 2) + 1,
      white: moves[index] ?? null,
      black: moves[index + 1] ?? null,
    });
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
          <Activity className="h-3.5 w-3.5" />
          {isGameOver ? "Game Finished" : "Game Status"}
        </div>
        <div className="text-base font-semibold capitalize text-neutral-100">
          {formatStatus(status, turn, result)}
        </div>
        <div className="text-sm text-neutral-500">Time control: {timeControlName}</div>
        {isGameOver && gameOverReason ? (
          <div className="inline-flex w-fit rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium capitalize text-amber-300">
            {formatReason(terminationReason ?? gameOverReason)}
          </div>
        ) : null}
        {!isGameOver && clock?.grace_deadline_at ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
            Reconnect grace is active.
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error.message}
          </div>
        ) : null}
      </Card>

      <Card className="flex-1 overflow-y-auto p-4">
        <h3 className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
          <List className="h-3.5 w-3.5" />
          Move History
        </h3>
        {movePairs.length > 0 ? (
          <div className="space-y-2">
            {movePairs.map((pair) => (
              <div
                key={pair.turn}
                className="grid grid-cols-[36px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 rounded-lg border border-neutral-800/80 bg-neutral-950/60 px-3 py-2 text-sm text-neutral-200 transition-colors hover:border-neutral-700 hover:bg-neutral-900/60"
              >
                <span className="text-xs font-medium tabular-nums text-neutral-500">{pair.turn}.</span>
                <span className="truncate rounded-md bg-neutral-900/80 px-2 py-1 font-mono text-xs">{pair.white?.uci ?? " "}</span>
                <span className="truncate rounded-md bg-neutral-900/80 px-2 py-1 font-mono text-xs">{pair.black?.uci ?? " "}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-neutral-600">
            <List className="h-5 w-5 text-neutral-700" />
            <p className="text-xs">Moves will appear here</p>
          </div>
        )}
      </Card>

      <div className="flex gap-2">
        <ResignButton />
        <button
          disabled
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-sm font-medium text-neutral-400 transition-all hover:bg-neutral-700 disabled:opacity-50"
        >
          Offer Draw
        </button>
      </div>
    </div>
  );
}

export default GameSidebar;
