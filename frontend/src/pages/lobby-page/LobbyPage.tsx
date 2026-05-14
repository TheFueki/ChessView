import { Activity, Swords, Trophy } from "lucide-react";
import { useLobbyMatchmakingRealtime } from "@/features/join-matchmaking";
import { Card } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { MatchmakingPanel } from "@/widgets/matchmaking-panel";

export default function LobbyPage() {
  useLobbyMatchmakingRealtime();

  return (
    <AppShell
      eyebrow="Play"
      title="Lobby"
      description="Choose a time control and enter matchmaking. Live games open on the board as soon as a match is found."
    >
      <section className="grid gap-4 md:grid-cols-2">
        <Card className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-violet-500/25 bg-violet-500/10 text-violet-200">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Mode</div>
            <div className="text-lg font-semibold text-neutral-100">Rated Match</div>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-violet-500/25 bg-violet-500/10 text-violet-200">
            <Swords className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Queue</div>
            <div className="text-lg font-semibold text-neutral-100">Fast Pairing</div>
          </div>
        </Card>
      </section>

      <Card className="p-0">
        <MatchmakingPanel />
      </Card>

      <div className="inline-flex items-center gap-2 text-sm text-neutral-500">
        <Activity className="h-4 w-4 text-violet-400" />
        Matchmaking is connected through the live ChessView game service.
      </div>
    </AppShell>
  );
}
