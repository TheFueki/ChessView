import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, Play, Plus, X } from "lucide-react";
import { http } from "@/shared/api";
import type { ScheduledMatchResponse } from "@/shared/types";
import { Button, Card, Input, Spinner } from "@/shared/ui";

export default function ScheduledMatchesPage() {
  const queryClient = useQueryClient();
  const [invitedUserId, setInvitedUserId] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const matchesQuery = useQuery({
    queryKey: ["scheduled-matches"],
    queryFn: () => http.get<ScheduledMatchResponse[]>("/scheduled-matches/me"),
  });

  const createMatch = useMutation({
    mutationFn: () =>
      http.post<ScheduledMatchResponse>("/scheduled-matches", {
        invited_user_id: invitedUserId || null,
        starts_at: new Date(startsAt).toISOString(),
        metadata: {},
      }),
    onSuccess: async () => {
      setInvitedUserId("");
      setStartsAt("");
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["scheduled-matches"] });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Unable to create match"),
  });

  const action = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: "accept" | "decline" | "cancel" | "start" }) =>
      http.post<ScheduledMatchResponse>(`/scheduled-matches/${id}/${verb}`),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["scheduled-matches"] });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Unable to update match"),
  });

  const matches = matchesQuery.data ?? [];

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-neutral-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header>
          <div className="flex items-center gap-3 text-emerald-400">
            <CalendarClock size={22} />
            <span className="text-sm uppercase tracking-wide">Match calendar</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold">Scheduled Matches</h1>
        </header>

        <Card>
          {(matchesQuery.error || actionError) && (
            <div className="mb-3 rounded-lg border border-red-500/20 bg-red-950/10 p-3 text-sm text-red-300">
              {actionError ?? (matchesQuery.error instanceof Error ? matchesQuery.error.message : "Unable to load matches")}
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <Input value={invitedUserId} onChange={(event) => setInvitedUserId(event.target.value)} placeholder="Opponent user id" />
            <Input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
            <Button disabled={!startsAt || createMatch.isPending} onClick={() => createMatch.mutate()}>
              <Plus size={16} /> Invite
            </Button>
          </div>
        </Card>

        <Card>
          {matchesQuery.isLoading ? (
            <Spinner />
          ) : matches.length === 0 ? (
            <p className="text-sm text-neutral-400">No scheduled matches yet.</p>
          ) : (
            <div className="divide-y divide-neutral-800">
              {matches.map((match) => (
                <div key={match.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <div className="font-semibold">{new Date(match.starts_at).toLocaleString()}</div>
                    <div className="text-sm text-neutral-400">
                      {match.status} {match.game_id ? `/ game ${match.game_id}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => action.mutate({ id: match.id, verb: "accept" })}>
                      <Check size={14} /> Accept
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => action.mutate({ id: match.id, verb: "decline" })}>
                      <X size={14} /> Decline
                    </Button>
                    <Button size="sm" onClick={() => action.mutate({ id: match.id, verb: "start" })}>
                      <Play size={14} /> Start
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
