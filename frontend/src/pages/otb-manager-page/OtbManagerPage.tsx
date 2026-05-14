import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, MapPin, Plus, Trophy } from "lucide-react";
import { useNavigate } from "react-router";
import { http } from "@/shared/api";
import type { TimeControlKey, TournamentSummaryResponse } from "@/shared/types";
import { Button, Card, Input, Spinner } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";

const TIME_CONTROLS: TimeControlKey[] = ["5+0", "5+3", "10+0", "15+0", "15+10"];

function customName(minutes: string, increment: string) {
  return `${Math.max(1, Math.round(Number(minutes) || 25))}+${Math.max(0, Math.round(Number(increment) || 0))}`;
}

export default function OtbManagerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("Club OTB Swiss");
  const [venue, setVenue] = useState("Main hall");
  const [timeControl, setTimeControl] = useState<TimeControlKey | "custom">("15+10");
  const [customMinutes, setCustomMinutes] = useState("25");
  const [customIncrement, setCustomIncrement] = useState("10");
  const [rounds, setRounds] = useState("5");
  const [entryFee, setEntryFee] = useState("0");
  const [error, setError] = useState<string | null>(null);

  const tournamentsQuery = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => http.get<TournamentSummaryResponse[]>("/tournaments"),
  });

  const createOtb = useMutation({
    mutationFn: () =>
      http.post<TournamentSummaryResponse>("/tournaments", {
        name: `${name.trim()} @ ${venue.trim()}`,
        time_control_name: timeControl === "custom" ? customName(customMinutes, customIncrement) : timeControl,
        initial_time_ms: timeControl === "custom" ? Math.max(1, Math.round(Number(customMinutes) || 25)) * 60_000 : undefined,
        increment_ms: timeControl === "custom" ? Math.max(0, Math.round(Number(customIncrement) || 0)) * 1_000 : undefined,
        tournament_type: "otb",
        total_rounds: Number(rounds) || 5,
        entry_fee_cents: Math.max(0, Math.round(Number(entryFee || 0))),
      }),
    onSuccess: async (created) => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      navigate(`/tournaments/${created.id}`);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Unable to create OTB tournament."),
  });

  const otbEvents = useMemo(
    () => (tournamentsQuery.data ?? []).filter((event) => event.tournament_type === "otb"),
    [tournamentsQuery.data],
  );

  return (
    <AppShell
      eyebrow="Over the board"
      title="OTB tournament manager"
      description="Create and run in-person Swiss events with table-friendly pairings, entry fees, and manual administration."
      maxWidthClassName="max-w-6xl"
    >
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <Card className="p-5">
          <div className="mb-5 flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-violet-300" />
            <h2 className="text-xl font-semibold text-neutral-100">Create OTB event</h2>
          </div>
          {error ? <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Event name" />
            <Input value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="Venue" />
            <select
              value={timeControl}
              onChange={(event) => setTimeControl(event.target.value as TimeControlKey | "custom")}
              className="h-11 rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100 outline-none focus:border-violet-500"
            >
              {TIME_CONTROLS.map((control) => (
                <option key={control} value={control}>{control}</option>
              ))}
              <option value="custom">Custom</option>
            </select>
            {timeControl === "custom" ? (
              <>
                <Input value={customMinutes} onChange={(event) => setCustomMinutes(event.target.value)} placeholder="Minutes per player" />
                <Input value={customIncrement} onChange={(event) => setCustomIncrement(event.target.value)} placeholder="Increment seconds" />
              </>
            ) : null}
            <Input value={rounds} onChange={(event) => setRounds(event.target.value)} placeholder="Rounds" />
            <Input value={entryFee} onChange={(event) => setEntryFee(event.target.value)} placeholder="Entry fee coins" />
            <Button onClick={() => createOtb.mutate()} disabled={createOtb.isPending || !name.trim() || !venue.trim()}>
              <Plus className="h-4 w-4" />
              {createOtb.isPending ? "Creating..." : "Create event"}
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <MapPin className="h-5 w-5 text-violet-300" />
            <h2 className="text-xl font-semibold text-neutral-100">Floor workflow</h2>
          </div>
          <div className="mt-4 space-y-3 text-sm text-neutral-400">
            <p>1. Create the OTB event and collect entries.</p>
            <p>2. Join players from the tournament detail page.</p>
            <p>3. Start the event to generate round pairings.</p>
            <p>4. Use scheduled match rows as board/table assignments.</p>
          </div>
        </Card>
      </section>

      <Card className="p-5">
        <h2 className="text-xl font-semibold text-neutral-100">OTB events</h2>
        {tournamentsQuery.isLoading ? (
          <div className="mt-5"><Spinner /></div>
        ) : otbEvents.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">No OTB events yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-neutral-800 rounded-md border border-neutral-800">
            {otbEvents.map((event) => (
              <button
                key={event.id}
                className="grid w-full gap-3 px-4 py-3 text-left hover:bg-neutral-900 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                onClick={() => navigate(`/tournaments/${event.id}`)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-violet-300" />
                    <span className="truncate font-medium text-neutral-100">{event.name}</span>
                  </div>
                  <div className="mt-1 text-sm text-neutral-500">{event.player_count} players / {event.total_rounds} rounds / {event.time_control_name}</div>
                </div>
                <span className="rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs uppercase tracking-[0.14em] text-neutral-500">
                  {event.status}
                </span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </AppShell>
  );
}
