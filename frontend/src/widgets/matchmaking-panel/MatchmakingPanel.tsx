import { Search, TimerReset } from "lucide-react";
import { useMatchmakingStore } from "@/entities/matchmaking";
import { useJoinMatchmaking } from "@/features/join-matchmaking";
import { useLeaveMatchmaking } from "@/features/leave-matchmaking";
import type { TimeControlKey } from "@/shared/types";
import { Button, Card } from "@/shared/ui";

const TIME_CONTROLS: Array<{ key: TimeControlKey; label: string; detail: string }> = [
  { key: "3+0", label: "3+0", detail: "Blitz" },
  { key: "3+2", label: "3+2", detail: "Blitz +" },
  { key: "5+0", label: "5+0", detail: "Rapid" },
  { key: "5+3", label: "5+3", detail: "Rapid +" },
  { key: "10+0", label: "10+0", detail: "Classical" },
];

export function MatchmakingPanel() {
  const { joinQueue } = useJoinMatchmaking();
  const { leaveQueue } = useLeaveMatchmaking();
  const queueStatus = useMatchmakingStore((state) => state.queueStatus);
  const queuePosition = useMatchmakingStore((state) => state.queuePosition);
  const selectedTimeControl = useMatchmakingStore((state) => state.selectedTimeControl);
  const setSelectedTimeControl = useMatchmakingStore((state) => state.setSelectedTimeControl);
  const connectionState = useMatchmakingStore((state) => state.connectionState);
  const lastError = useMatchmakingStore((state) => state.lastError);

  const isBusy = queueStatus === "joining" || queueStatus === "leaving";
  const isQueued = queueStatus === "queued" || queueStatus === "joining" || queueStatus === "leaving";

  const statusLabel =
    queueStatus === "joining"
      ? "Joining queue..."
      : queueStatus === "queued"
        ? `Searching for an opponent${queuePosition ? ` - position ${queuePosition}` : ""}`
        : queueStatus === "leaving"
          ? "Leaving queue..."
          : connectionState === "connecting"
            ? "Connecting to realtime server..."
            : connectionState === "open"
              ? "Ready to find a match."
              : "Reconnect to the lobby to start matchmaking.";

  return (
    <Card glow className="flex flex-col items-center gap-6 p-8">
      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 ${isQueued ? "animate-glow-pulse" : ""}`}>
        <Search className={`h-7 w-7 ${isQueued ? "animate-pulse" : ""}`} />
      </div>

      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-neutral-100">Find a Match</h2>
        <p className="mx-auto max-w-xs text-sm leading-relaxed text-neutral-400">
          Join the queue to be paired with an opponent of similar skill level.
        </p>
      </div>

      <div className="w-full space-y-3">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Time Control</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TIME_CONTROLS.map((timeControl) => (
            <button
              key={timeControl.key}
              onClick={() => setSelectedTimeControl(timeControl.key)}
              disabled={isQueued}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                selectedTimeControl === timeControl.key
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-neutral-800 bg-neutral-950/60 text-neutral-300 hover:border-neutral-700 hover:bg-neutral-900/70"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <div className="text-sm font-semibold">{timeControl.label}</div>
              <div className="mt-1 text-xs text-neutral-500">{timeControl.detail}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-3 text-center text-sm text-neutral-300">
        <span className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${
          connectionState === "open"
            ? isQueued ? "animate-pulse bg-amber-400" : "bg-emerald-500"
            : connectionState === "connecting" ? "animate-pulse bg-amber-400"
            : "bg-neutral-600"
        }`} />
        <span>{statusLabel}</span>
      </div>

      {lastError ? (
        <div className="w-full rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {lastError.message}
        </div>
      ) : null}

      <div className="flex w-full flex-col gap-3">
        <Button
          size="lg"
          className="w-full"
          onClick={joinQueue}
          disabled={isQueued || connectionState !== "open"}
        >
          {queueStatus === "joining" ? "Joining..." : "Find Match"}
        </Button>

        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          onClick={leaveQueue}
          disabled={!isQueued || isBusy}
        >
          <TimerReset className="h-4 w-4" />
          {queueStatus === "leaving" ? "Leaving..." : "Leave Queue"}
        </Button>
      </div>
    </Card>
  );
}

export default MatchmakingPanel;
