import { useMemo, useState } from "react";
import { Plus, Trophy } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { http } from "@/shared/api";
import type { TimeControlKey, TournamentSummaryResponse } from "@/shared/types";
import { Button, Card, Input, Spinner } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";

const TIME_CONTROL_OPTIONS: TimeControlKey[] = ["3+0", "3+2", "5+0", "5+3", "10+0"];

function formatDateTime(value: string | null) {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStatus(status: TournamentSummaryResponse["status"]) {
  return status.replaceAll("_", " ");
}

export default function TournamentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [timeControlName, setTimeControlName] = useState<TimeControlKey>("5+0");
  const [actionError, setActionError] = useState<string | null>(null);

  const tournamentsQuery = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => http.get<TournamentSummaryResponse[]>("/tournaments"),
  });

  const createTournament = useMutation({
    mutationFn: () =>
      http.post<TournamentSummaryResponse>("/tournaments", {
        name,
        time_control_name: timeControlName,
      }),
    onSuccess: async (createdTournament) => {
      setName("");
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      navigate(`/tournaments/${createdTournament.id}`);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Unable to create tournament.");
    },
  });

  const joinTournament = useMutation({
    mutationFn: (tournamentId: string) => http.post<TournamentSummaryResponse>(`/tournaments/${tournamentId}/join`),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Unable to join tournament.");
    },
  });

  const leaveTournament = useMutation({
    mutationFn: (tournamentId: string) => http.delete<TournamentSummaryResponse>(`/tournaments/${tournamentId}/join`),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Unable to leave tournament.");
    },
  });

  const tournaments = tournamentsQuery.data ?? [];
  const error = useMemo(() => {
    if (actionError) {
      return actionError;
    }

    if (tournamentsQuery.error instanceof Error) {
      return tournamentsQuery.error.message;
    }

    return tournamentsQuery.error ? "Unable to load tournaments." : null;
  }, [actionError, tournamentsQuery.error]);

  const handleCreate = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setActionError("Tournament name is required.");
      return;
    }
    createTournament.mutate();
  };

  return (
    <AppShell
      eyebrow="Tournaments"
      title="Swiss events and standings"
      description="Create or join a Swiss tournament, follow pairings round by round, and keep the whole competitive layer in one place."
      actions={
        <Button onClick={() => navigate("/lobby")}>
          Play Casual Match
        </Button>
      }
    >
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <Card className="space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300/80">Swiss Tournaments</div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-neutral-100">Compete across multiple rounds</h2>
            <p className="mt-2 max-w-2xl text-sm text-neutral-400">
              Tournament games reuse the existing live game flow, Elo updates, and time controls. Pairings avoid rematches when possible and standings update as results land.
            </p>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-400">
            Registration, standings, active round tracking, and replay links all live inside the tournament hub now.
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">
            <Plus className="h-4 w-4" />
            Create Tournament
          </div>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Friday Blitz Arena" />
          <select
            value={timeControlName}
            onChange={(event) => setTimeControlName(event.target.value as TimeControlKey)}
            className="h-11 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100 outline-hidden transition focus:border-emerald-500"
          >
            {TIME_CONTROL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <Button onClick={handleCreate} disabled={createTournament.isPending}>
            {createTournament.isPending ? "Creating..." : "Create Tournament"}
          </Button>
          {error ? <div className="text-sm text-red-300">{error}</div> : null}
        </Card>
      </section>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-neutral-800 px-6 py-5">
          <div className="flex items-center gap-2.5">
            <Trophy className="h-5 w-5 text-emerald-500" />
            <h2 className="text-lg font-semibold text-neutral-100">Open Events</h2>
          </div>
          <p className="mt-1.5 pl-[30px] text-sm text-neutral-500">Create a new event or join an existing tournament before it starts.</p>
        </div>

        {tournamentsQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-neutral-400">
            <Spinner size="md" />
            <p className="text-sm">Loading tournaments...</p>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="px-6 py-20 text-center text-sm text-neutral-400">No tournaments yet. Create the first Swiss event above.</div>
        ) : (
          <div className="divide-y divide-neutral-800/70">
            {tournaments.map((tournament) => {
              const isLeavingOwner = tournament.viewer_is_owner && tournament.viewer_is_member;
              return (
                <div key={tournament.id} className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <button onClick={() => navigate(`/tournaments/${tournament.id}`)} className="text-left transition hover:opacity-90">
                      <div className="truncate text-lg font-semibold text-neutral-100">{tournament.name}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1 capitalize text-neutral-300">
                          {formatStatus(tournament.status)}
                        </span>
                        <span>{tournament.time_control_name}</span>
                        <span className="h-1 w-1 rounded-full bg-neutral-700" />
                        <span>{tournament.player_count} players</span>
                        <span className="h-1 w-1 rounded-full bg-neutral-700" />
                        <span>Owner {tournament.owner.username}</span>
                        <span className="h-1 w-1 rounded-full bg-neutral-700" />
                        <span>Round {tournament.current_round}/{Math.max(tournament.total_rounds, 0)}</span>
                      </div>
                      <div className="mt-2 text-xs text-neutral-600">
                        Created {formatDateTime(tournament.created_at)}
                        {tournament.started_at ? ` • Started ${formatDateTime(tournament.started_at)}` : ""}
                      </div>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => navigate(`/tournaments/${tournament.id}`)}>
                      View
                    </Button>
                    {!tournament.viewer_is_member && tournament.status === "registration" ? (
                      <Button size="sm" onClick={() => joinTournament.mutate(tournament.id)} disabled={joinTournament.isPending}>
                        Join
                      </Button>
                    ) : null}
                    {tournament.viewer_is_member && tournament.status === "registration" && !isLeavingOwner ? (
                      <Button variant="ghost" size="sm" onClick={() => leaveTournament.mutate(tournament.id)} disabled={leaveTournament.isPending}>
                        Leave
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
