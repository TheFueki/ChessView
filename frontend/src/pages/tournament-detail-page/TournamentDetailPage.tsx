import { useMemo, useState } from "react";
import { Swords, Trophy, Users } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { http } from "@/shared/api";
import type { TournamentDetailResponse, TournamentPairingResponse } from "@/shared/types";
import { Button, Card, Spinner } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";

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

function formatStatus(status: TournamentDetailResponse["status"]) {
  return status.replaceAll("_", " ");
}

function formatPairingResult(pairing: TournamentPairingResponse) {
  if (pairing.black === null) {
    return "Bye";
  }

  if (pairing.result === "1-0") {
    return "1-0";
  }

  if (pairing.result === "0-1") {
    return "0-1";
  }

  if (pairing.result === "1/2-1/2") {
    return "1/2-1/2";
  }

  return pairing.game_status === "active" ? "In progress" : "Pending";
}

function pairingLink(pairing: TournamentPairingResponse) {
  if (!pairing.game_id) {
    return null;
  }

  return pairing.game_status === "active" ? `/game/${pairing.game_id}` : `/games/${pairing.game_id}`;
}

export default function TournamentDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tournamentId } = useParams();
  const [actionError, setActionError] = useState<string | null>(null);

  const tournamentQuery = useQuery({
    queryKey: ["tournament", tournamentId],
    queryFn: () => http.get<TournamentDetailResponse>(`/tournaments/${tournamentId}`),
    enabled: Boolean(tournamentId),
    refetchInterval: (query) => (query.state.data?.status === "active" ? 5000 : false),
  });

  const joinTournament = useMutation({
    mutationFn: () => http.post(`/tournaments/${tournamentId}/join`),
    onSuccess: async () => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId] }),
        queryClient.invalidateQueries({ queryKey: ["tournaments"] }),
      ]);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Unable to join tournament.");
    },
  });

  const leaveTournament = useMutation({
    mutationFn: () => http.delete(`/tournaments/${tournamentId}/join`),
    onSuccess: async () => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId] }),
        queryClient.invalidateQueries({ queryKey: ["tournaments"] }),
      ]);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Unable to leave tournament.");
    },
  });

  const startTournament = useMutation({
    mutationFn: () => http.post(`/tournaments/${tournamentId}/start`),
    onSuccess: async () => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId] }),
        queryClient.invalidateQueries({ queryKey: ["tournaments"] }),
      ]);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Unable to start tournament.");
    },
  });

  const advanceTournament = useMutation({
    mutationFn: () => http.post(`/tournaments/${tournamentId}/advance`),
    onSuccess: async () => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId] }),
        queryClient.invalidateQueries({ queryKey: ["tournaments"] }),
      ]);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "Unable to advance tournament.");
    },
  });

  const tournament = tournamentQuery.data ?? null;
  const error = useMemo(() => {
    if (!tournamentId) {
      return "Missing tournament id.";
    }

    if (actionError) {
      return actionError;
    }

    if (tournamentQuery.error instanceof Error) {
      return tournamentQuery.error.message;
    }

    return tournamentQuery.error ? "Unable to load tournament." : null;
  }, [actionError, tournamentId, tournamentQuery.error]);

  return (
    <AppShell
      eyebrow="Tournament"
      title={tournament?.name ?? "Swiss Tournament"}
      description="Track standings, round pairings, and direct game links from a single tournament control room."
      actions={
        <>
          <Button onClick={() => navigate("/tournaments")}>All Tournaments</Button>
          <Button variant="secondary" onClick={() => navigate("/lobby")}>
            Play Lobby
          </Button>
        </>
      }
    >
        {tournamentQuery.isLoading ? (
          <Card className="flex items-center gap-3">
            <Spinner size="sm" />
            <span className="text-sm text-neutral-400">Loading tournament...</span>
          </Card>
        ) : error || !tournament ? (
          <Card className="mx-auto mt-12 max-w-xl text-center">
            <div className="space-y-3">
              <div className="text-lg font-semibold text-neutral-100">Tournament unavailable</div>
              <p className="text-sm text-neutral-400">{error ?? "We couldn't load that event."}</p>
            </div>
          </Card>
        ) : (
          <>
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
              <Card className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300/80">Swiss Tournament</div>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-100">{tournament.name}</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-neutral-400">
                      <span className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 capitalize text-neutral-300">
                        {formatStatus(tournament.status)}
                      </span>
                      <span>{tournament.time_control_name}</span>
                      <span className="h-1 w-1 rounded-full bg-neutral-700" />
                      <span>{tournament.player_count} players</span>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 px-5 py-4 text-right">
                    <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Current Round</div>
                    <div className="mt-1 text-3xl font-bold tabular-nums text-neutral-100">
                      {tournament.current_round}/{Math.max(tournament.total_rounds, 0)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
                      <Users className="h-3.5 w-3.5" />
                      Players
                    </div>
                    <div className="mt-3 text-2xl font-semibold text-neutral-100">{tournament.player_count}</div>
                    <div className="mt-1 text-sm text-neutral-500">Joined entries</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                    <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Owner</div>
                    <div className="mt-3 text-lg font-semibold text-neutral-100">{tournament.owner.username}</div>
                    <div className="mt-1 text-sm text-neutral-500">Created {formatDateTime(tournament.created_at)}</div>
                  </div>
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
                    <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Schedule</div>
                    <div className="mt-3 text-lg font-semibold text-neutral-100">
                      {tournament.started_at ? formatDateTime(tournament.started_at) : "Waiting to start"}
                    </div>
                    <div className="mt-1 text-sm text-neutral-500">
                      {tournament.finished_at ? `Finished ${formatDateTime(tournament.finished_at)}` : "Rounds advance automatically after completion."}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="space-y-4">
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Actions</div>
                <div className="flex flex-wrap gap-2">
                  {!tournament.viewer_is_member && tournament.status === "registration" ? (
                    <Button onClick={() => joinTournament.mutate()} disabled={joinTournament.isPending}>
                      Join Tournament
                    </Button>
                  ) : null}
                  {tournament.viewer_is_member && tournament.status === "registration" && !tournament.viewer_is_owner ? (
                    <Button
                      variant="secondary"
                      onClick={() => leaveTournament.mutate()}
                      disabled={leaveTournament.isPending}
                    >
                      Leave Tournament
                    </Button>
                  ) : null}
                  {tournament.viewer_is_owner && tournament.status === "registration" ? (
                    <Button onClick={() => startTournament.mutate()} disabled={startTournament.isPending}>
                      Start Tournament
                    </Button>
                  ) : null}
                  {tournament.viewer_is_owner && tournament.status === "active" ? (
                    <Button
                      variant="secondary"
                      onClick={() => advanceTournament.mutate()}
                      disabled={advanceTournament.isPending}
                    >
                      Force Advance Check
                    </Button>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-400">
                  Join during registration, then come back here for pairings, standings, and direct links into your assigned games.
                </div>
                {error ? <div className="text-sm text-red-300">{error}</div> : null}
              </Card>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <Card className="overflow-hidden p-0">
                <div className="border-b border-neutral-800 px-6 py-5">
                  <div className="flex items-center gap-2.5">
                    <Trophy className="h-5 w-5 text-emerald-500" />
                    <h2 className="text-lg font-semibold text-neutral-100">Standings</h2>
                  </div>
                </div>
                <div className="hidden grid-cols-[64px_minmax(0,1fr)_100px_110px] gap-4 border-b border-neutral-800/60 px-6 py-3 text-xs font-medium uppercase tracking-wider text-neutral-500 md:grid">
                  <span>Rank</span>
                  <span>Player</span>
                  <span>Score</span>
                  <span>Games</span>
                </div>
                <div className="divide-y divide-neutral-800/70">
                  {tournament.standings.map((standing) => (
                    <div key={standing.player.id} className="grid gap-3 px-6 py-4 md:grid-cols-[64px_minmax(0,1fr)_100px_110px] md:items-center">
                      <div className="text-sm font-semibold text-neutral-100">#{standing.rank}</div>
                      <Link
                        to={`/players/${standing.player.id}`}
                        className="flex items-center gap-3 text-sm transition hover:text-emerald-300"
                      >
                        <span className="font-medium text-neutral-100">{standing.player.username}</span>
                        <span className="text-xs text-neutral-500">{standing.player.rating}</span>
                      </Link>
                      <div className="text-sm font-semibold text-neutral-100">{standing.score.toFixed(1)}</div>
                      <div className="text-sm text-neutral-400">{standing.games_played}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="flex min-h-0 flex-col gap-6">
                {tournament.rounds.map((round) => (
                  <Card key={round.round_number} className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Round {round.round_number}</div>
                        <div className="mt-1 text-sm text-neutral-400">
                          {round.round_number === tournament.current_round && tournament.status === "active"
                            ? "Current live pairings"
                            : "Completed or scheduled pairings"}
                        </div>
                      </div>
                      <div className="rounded-full border border-neutral-800 bg-neutral-950/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
                        {round.pairings.length} board{round.pairings.length === 1 ? "" : "s"}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {round.pairings.map((pairing) => {
                        const target = pairingLink(pairing);
                        return (
                          <div
                            key={`${round.round_number}-${pairing.id ?? pairing.white.id}`}
                            className="grid gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_110px_auto]"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-neutral-500">
                                <Swords className="h-3.5 w-3.5" />
                                Board
                              </div>
                              <div className="mt-2 text-sm text-neutral-100">
                                <Link to={`/players/${pairing.white.id}`} className="font-medium hover:text-emerald-300">
                                  {pairing.white.username}
                                </Link>{" "}
                                <span className="text-neutral-500">vs</span>{" "}
                                {pairing.black ? (
                                  <Link to={`/players/${pairing.black.id}`} className="font-medium hover:text-emerald-300">
                                    {pairing.black.username}
                                  </Link>
                                ) : (
                                  <span className="font-medium text-amber-300">Bye</span>
                                )}
                              </div>
                              <div className="mt-1 text-xs text-neutral-500">
                                {pairing.black
                                  ? `${pairing.white.rating} vs ${pairing.black.rating}`
                                  : "Automatic full-point bye"}
                              </div>
                            </div>

                            <div className="text-sm font-medium text-neutral-300">{formatPairingResult(pairing)}</div>

                            <div className="flex items-center gap-2">
                              {target ? (
                                <Button variant="secondary" size="sm" onClick={() => navigate(target)}>
                                  {pairing.game_status === "active" ? "Open Game" : "Open Replay"}
                                </Button>
                              ) : (
                                <span className="text-xs text-neutral-500">No game link</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          </>
        )}
    </AppShell>
  );
}
