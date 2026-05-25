import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, CreditCard, Play, Plus, Search, X } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useUserStore } from "@/entities/user";
import { http } from "@/shared/api";
import type { PaymentIntentResponse, PlayerSearchResult, ScheduledMatchResponse } from "@/shared/types";
import { Button, Card, Input, Spinner } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

const startableStatuses = new Set(["scheduled", "accepted", "rescheduled"]);
const closedStatuses = new Set(["cancelled", "declined", "completed", "live"]);

function toDatetimeLocalValue(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function canAcceptMatch(match: ScheduledMatchResponse, userId: string | undefined) {
  return match.status === "pending_acceptance" && match.invited_user_id === userId && match.creator_user_id !== userId;
}

function canDeclineMatch(match: ScheduledMatchResponse, userId: string | undefined) {
  return match.status === "pending_acceptance" && match.invited_user_id === userId;
}

function canCancelMatch(match: ScheduledMatchResponse, userId: string | undefined) {
  return match.creator_user_id === userId && !closedStatuses.has(match.status);
}

function canPayForMatch(match: ScheduledMatchResponse) {
  return (
    typeof match.metadata?.match_fee_cents === "number" &&
    match.metadata.match_fee_cents > 0 &&
    !closedStatuses.has(match.status)
  );
}

function canStartMatch(match: ScheduledMatchResponse, userId: string | undefined) {
  const isParticipant = [match.creator_user_id, match.invited_user_id, match.white_player_id, match.black_player_id].includes(userId ?? "");
  return isParticipant && startableStatuses.has(match.status);
}

function PlayerSearch({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (player: PlayerSearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const searchQuery = useQuery({
    queryKey: ["scheduled-player-search", query],
    queryFn: () => http.get<PlayerSearchResult[]>(`/profiles/search?query=${encodeURIComponent(query)}`),
    enabled: query.trim().length >= 2,
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
        <Search className="h-4 w-4 text-neutral-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search opponent"
          className="h-7 flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
        />
      </div>
      {query.trim().length >= 2 ? (
        <div className="overflow-hidden rounded-md border border-neutral-800 bg-neutral-950">
          {searchQuery.isFetching ? <div className="px-3 py-2 text-sm text-neutral-500">Searching...</div> : null}
          {(searchQuery.data ?? []).map((player) => (
            <button
              key={player.id}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-neutral-900 ${
                selectedId === player.id ? "bg-violet-500/10 text-violet-200" : "text-neutral-300"
              }`}
              onClick={() => {
                onSelect(player);
                setQuery(player.username);
              }}
            >
              {player.username}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ScheduledMatchesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const [invitedUserId, setInvitedUserId] = useState("");
  const [startsAt, setStartsAt] = useState(() => toDatetimeLocalValue(new Date()));
  const [matchFee, setMatchFee] = useState("0");
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
        metadata: {
          match_fee_cents: Math.max(0, Math.round(Number(matchFee || 0))),
        },
    }),
    onSuccess: async () => {
      setInvitedUserId("");
      setStartsAt(toDatetimeLocalValue(new Date()));
      setMatchFee("0");
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["scheduled-matches"] });
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Unable to create match"),
  });

  const action = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: "accept" | "decline" | "cancel" | "start" }) =>
      http.post<ScheduledMatchResponse>(`/scheduled-matches/${id}/${verb}`).then((match) => ({ match, verb })),
    onSuccess: async ({ match, verb }) => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["scheduled-matches"] });
      if (verb === "start" && match.game_id) {
        navigate(`/game/${match.game_id}`);
      }
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Unable to update match"),
  });

  const createPayment = useMutation({
    mutationFn: async (id: string) => {
      const payment = await http.post<PaymentIntentResponse>(`/scheduled-matches/${id}/payment`);
      return http.post<PaymentIntentResponse>(`/payments/emulator/${payment.id}/simulate`, { scenario: "success" });
    },
    onSuccess: async () => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["scheduled-matches"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["marketplace-profile"] }),
      ]);
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Unable to create payment"),
  });

  const matches = matchesQuery.data ?? [];

  return (
    <AppShell
      eyebrow="Match calendar"
      title="Scheduled matches"
      description="Plan direct matches with another player, accept invitations, and launch games when both players are ready."
      maxWidthClassName="max-w-6xl"
    >
      <Card className="p-5">
        {(matchesQuery.error || actionError) && (
          <div className="mb-4 rounded-md border border-red-500/20 bg-red-950/10 p-3 text-sm text-red-300">
            {actionError ?? (matchesQuery.error instanceof Error ? matchesQuery.error.message : "Unable to load matches")}
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_120px_auto] lg:items-start">
          <PlayerSearch
            selectedId={invitedUserId}
            onSelect={(player) => setInvitedUserId(player.id)}
          />
          <Input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
          <Input value={matchFee} onChange={(event) => setMatchFee(event.target.value)} placeholder="Fee coins" />
          <Button disabled={!invitedUserId || !startsAt || createMatch.isPending} onClick={() => createMatch.mutate()}>
            <Plus className="h-4 w-4" /> Invite
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        {matchesQuery.isLoading ? (
          <Spinner />
        ) : matches.length === 0 ? (
          <p className="text-sm text-neutral-400">No scheduled matches yet.</p>
        ) : (
          <div className="divide-y divide-neutral-800">
            {matches.map((match) => {
              const userId = user?.id;
              const canAccept = canAcceptMatch(match, userId);
              const canDecline = canDeclineMatch(match, userId);
              const canCancel = canCancelMatch(match, userId);
              const canPay = canPayForMatch(match);
              const canStart = canStartMatch(match, userId);
              const hasActions = canAccept || canDecline || canCancel || canPay || canStart;

              return (
                <div key={match.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-violet-300" />
                      <span className="font-semibold">{new Date(match.starts_at).toLocaleString()}</span>
                      <span className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs uppercase tracking-[0.14em] text-neutral-500">
                        {statusLabel(match.status)}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-neutral-500">
                      {match.game_id ? (
                        <Link to={`/game/${match.game_id}`} className="text-violet-300 hover:text-violet-200">
                          Game {match.game_id}
                        </Link>
                      ) : (
                        "Direct planned match"
                      )}
                      {typeof match.metadata?.match_fee_cents === "number" && match.metadata.match_fee_cents > 0
                        ? ` / ${match.metadata.match_fee_cents.toLocaleString()} coins`
                        : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {canAccept ? (
                      <Button size="sm" variant="secondary" onClick={() => action.mutate({ id: match.id, verb: "accept" })}>
                        <Check className="h-4 w-4" /> Accept
                      </Button>
                    ) : null}
                    {canDecline ? (
                      <Button size="sm" variant="ghost" onClick={() => action.mutate({ id: match.id, verb: "decline" })}>
                        <X className="h-4 w-4" /> Decline
                      </Button>
                    ) : null}
                    {canCancel ? (
                      <Button size="sm" variant="ghost" onClick={() => action.mutate({ id: match.id, verb: "cancel" })}>
                        <X className="h-4 w-4" /> Cancel
                      </Button>
                    ) : null}
                    {canPay ? (
                      <Button size="sm" variant="secondary" onClick={() => createPayment.mutate(match.id)}>
                        <CreditCard className="h-4 w-4" /> Pay coins
                      </Button>
                    ) : null}
                    {canStart ? (
                      <Button size="sm" onClick={() => action.mutate({ id: match.id, verb: "start" })}>
                        <Play className="h-4 w-4" /> Start
                      </Button>
                    ) : null}
                    {!hasActions ? <span className="text-sm text-neutral-500">No actions available</span> : null}
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
