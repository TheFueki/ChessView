import { Clock3, Trophy, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { http } from "@/shared/api";
import type { ProfileResponse } from "@/shared/types";
import { Button, Card, Spinner } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { HistoryTable } from "@/widgets/history-table";

function formatLastSeen(value: string | null) {
  if (!value) {
    return "No games yet";
  }

  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const profileQuery = useQuery({
    queryKey: ["history-profile"],
    queryFn: () => http.get<ProfileResponse>("/profiles/me"),
  });

  const profile = profileQuery.data ?? null;

  return (
    <AppShell
      eyebrow="History"
      title="Your match archive"
      description="Every game now lives as a durable record with opponent context, rating movement, time control, and replay access from a single surface."
      actions={<Button onClick={() => navigate("/analysis")}>Open Analysis Hub</Button>}
      maxWidthClassName="max-w-7xl"
    >
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
            <Trophy className="h-3.5 w-3.5" />
            Rating
          </div>
          {profileQuery.isLoading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-neutral-400">
              <Spinner size="sm" />
              Loading...
            </div>
          ) : (
            <>
              <div className="mt-4 text-3xl font-bold tabular-nums text-neutral-100">{profile?.rating ?? "--"}</div>
              <div className="mt-1 text-sm text-neutral-500">Current ladder snapshot</div>
            </>
          )}
        </Card>
        <Card className="rounded-2xl">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
            <TrendingUp className="h-3.5 w-3.5" />
            Record
          </div>
          {profileQuery.isLoading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-neutral-400">
              <Spinner size="sm" />
              Loading...
            </div>
          ) : (
            <>
              <div className="mt-4 text-3xl font-bold text-neutral-100">
                {profile ? `${profile.wins}-${profile.losses}-${profile.draws}` : "--"}
              </div>
              <div className="mt-1 text-sm text-neutral-500">Wins, losses, draws</div>
            </>
          )}
        </Card>
        <Card className="rounded-2xl">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
            <Clock3 className="h-3.5 w-3.5" />
            Last Finished
          </div>
          {profileQuery.isLoading ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-neutral-400">
              <Spinner size="sm" />
              Loading...
            </div>
          ) : (
            <>
              <div className="mt-4 text-xl font-semibold text-neutral-100">
                {formatLastSeen(profile?.recent_games[0]?.ended_at ?? profile?.recent_games[0]?.started_at ?? null)}
              </div>
              <div className="mt-1 text-sm text-neutral-500">Latest replay-ready board</div>
            </>
          )}
        </Card>
      </section>

      <HistoryTable
        title="Recent Games"
        description="Rows are fully clickable, opponent names still jump to profiles, and every result carries stronger metadata for quick scanning."
      />
    </AppShell>
  );
}
