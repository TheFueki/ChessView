import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Medal, PlayCircle, Plus, Trophy } from "lucide-react";
import { useNavigate } from "react-router";
import { http } from "@/shared/api";
import { Button, Card, Input, Spinner } from "@/shared/ui";
import type { TimeControlKey, TournamentSummaryResponse } from "@/shared/types";
import { AppShell } from "@/widgets/app-shell";

const TIME_CONTROL_OPTIONS: TimeControlKey[] = [
  "1+0",
  "1+1",
  "1+2",
  "2+1",
  "3+0",
  "3+1",
  "3+2",
  "5+0",
  "5+3",
  "10+0",
  "15+0",
  "15+10",
];

function formatStatus(status: TournamentSummaryResponse["status"]) {
  return status.replaceAll("_", " ");
}

function statusTone(status: TournamentSummaryResponse["status"]) {
  if (status === "registration") return "border-violet-500/35 bg-violet-500/10 text-violet-200";
  if (status === "finished") return "border-neutral-700 bg-neutral-900 text-neutral-400";
  return "border-amber-500/30 bg-amber-500/10 text-amber-200";
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
  const openCount = tournaments.filter((tournament) => tournament.status === "registration").length;
  const activeCount = tournaments.filter(
    (tournament) => tournament.status !== "registration" && tournament.status !== "finished",
  ).length;

  const error = useMemo(() => {
    if (actionError) return actionError;
    if (tournamentsQuery.error instanceof Error) return tournamentsQuery.error.message;
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
      eyebrow="Tournament hall"
      title="Tournaments"
      description="Create Swiss events, join open brackets, and follow rounds without leaving the main ChessView layout."
      actions={
        <>
          <div className="rounded-full border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-300">
            <span className="text-neutral-500">Active</span> <strong className="ml-2 text-neutral-100">{activeCount}</strong>
          </div>
          <div className="rounded-full border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-300">
            <span className="text-neutral-500">Open</span> <strong className="ml-2 text-neutral-100">{openCount}</strong>
          </div>
          <Button variant="secondary" onClick={() => queryClient.invalidateQueries({ queryKey: ["tournaments"] })}>
            Refresh
          </Button>
        </>
      }
    >
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.75fr)]">
        <Card className="p-5">
          <div className="flex flex-col gap-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">New event</div>
              <h2 className="mt-2 text-2xl font-semibold text-neutral-100">Host a tournament</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Pick a time control, name the event, and invite players into a rated Swiss bracket.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_auto] md:items-center">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tournament name" />
              <select
                value={timeControlName}
                onChange={(event) => setTimeControlName(event.target.value as TimeControlKey)}
                className="h-11 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100 outline-hidden transition focus:border-violet-500"
              >
                {TIME_CONTROL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <Button onClick={handleCreate} disabled={createTournament.isPending}>
                <Plus className="h-4 w-4" />
                {createTournament.isPending ? "Creating..." : "Create"}
              </Button>
            </div>

            {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Card className="cursor-pointer p-5 transition hover:border-violet-500/35" onClick={() => navigate("/lobby")}>
            <PlayCircle className="h-6 w-6 text-violet-300" />
            <h3 className="mt-3 text-lg font-semibold text-neutral-100">Quick play</h3>
            <p className="mt-1 text-sm text-neutral-500">Warm up before the bracket.</p>
          </Card>
          <Card className="cursor-pointer p-5 transition hover:border-violet-500/35" onClick={() => navigate("/leaderboard")}>
            <Medal className="h-6 w-6 text-yellow-400" />
            <h3 className="mt-3 text-lg font-semibold text-neutral-100">Leaderboards</h3>
            <p className="mt-1 text-sm text-neutral-500">Check the field before joining.</p>
          </Card>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-neutral-100">Available events</h2>
            <p className="mt-1 text-sm text-neutral-500">Open, active, and recently finished tournaments.</p>
          </div>
        </div>

        {tournamentsQuery.isLoading ? (
          <Card className="flex items-center justify-center p-10">
            <Spinner />
          </Card>
        ) : tournaments.length === 0 ? (
          <Card className="p-10 text-center text-sm text-neutral-500">No active tournaments found.</Card>
        ) : (
          <div className="grid gap-3">
            {tournaments.map((tournament) => {
              const isLeavingOwner = tournament.viewer_is_owner && tournament.viewer_is_member;
              return (
                <Card key={tournament.id} className="p-4">
                  <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
                    <div className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${statusTone(tournament.status)}`}>
                      {formatStatus(tournament.status)}
                    </div>

                    <button className="min-w-0 text-left" onClick={() => navigate(`/tournaments/${tournament.id}`)}>
                      <div className="flex min-w-0 items-center gap-2">
                        <Trophy className="h-4 w-4 shrink-0 text-violet-300" />
                        <span className="truncate text-lg font-semibold text-neutral-100">{tournament.name}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-500">
                        <span>{tournament.time_control_name}</span>
                        <span>{tournament.player_count} players</span>
                        <span>
                          Round {tournament.current_round}/{Math.max(tournament.total_rounds, 0)}
                        </span>
                        <span>Host: {tournament.owner.username}</span>
                      </div>
                    </button>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      {tournament.status === "registration" ? (
                        <>
                          {!tournament.viewer_is_member ? (
                            <Button size="sm" onClick={() => joinTournament.mutate(tournament.id)} disabled={joinTournament.isPending}>
                              Join
                            </Button>
                          ) : null}
                          {tournament.viewer_is_member && !isLeavingOwner ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => leaveTournament.mutate(tournament.id)}
                              disabled={leaveTournament.isPending}
                            >
                              Leave
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/tournaments/${tournament.id}`)}>
                        View
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
