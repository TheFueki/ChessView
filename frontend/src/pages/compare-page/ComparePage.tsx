import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Search, Swords } from "lucide-react";
import { useSearchParams } from "react-router";
import { http } from "@/shared/api";
import type { HeadToHeadResponse, PlayerSearchResult, ProfileResponse } from "@/shared/types";
import { Card, Spinner } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";

const RATING_CATEGORIES = [
  { key: "bullet", label: "Bullet" },
  { key: "blitz", label: "Blitz" },
  { key: "rapid", label: "Rapid" },
] as const;

function ratingValue(profile: ProfileResponse | undefined, category: string) {
  const value = profile?.ratings?.[category];
  return typeof value === "number" ? value : "Not rated";
}

function PlayerSearchBox({
  label,
  selectedId,
  onSelect,
}: {
  label: string;
  selectedId: string | null;
  onSelect: (player: PlayerSearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const searchQuery = useQuery({
    queryKey: ["profile-search", query],
    queryFn: () => http.get<PlayerSearchResult[]>(`/profiles/search?query=${encodeURIComponent(query)}`),
    enabled: query.trim().length >= 2,
  });

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{label}</label>
      <div className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2">
        <Search className="h-4 w-4 text-neutral-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search username"
          className="h-7 flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
        />
      </div>
      {query.trim().length >= 2 ? (
        <div className="overflow-hidden rounded-md border border-neutral-800 bg-neutral-950">
          {searchQuery.isFetching ? <div className="px-3 py-2 text-sm text-neutral-500">Searching...</div> : null}
          {!searchQuery.isFetching && searchQuery.data?.length === 0 ? (
            <div className="px-3 py-2 text-sm text-neutral-500">No players found.</div>
          ) : null}
          {(searchQuery.data ?? []).map((player) => (
            <button
              key={player.id}
              className={`block w-full px-3 py-2 text-left text-sm transition hover:bg-neutral-900 ${
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

function H2HBlock({ h2h }: { h2h: HeadToHeadResponse | undefined }) {
  if (!h2h) {
    return <div className="rounded-md border border-neutral-800 bg-neutral-950 p-4 text-sm text-neutral-500">Select two players to load head-to-head stats.</div>;
  }

  if (h2h.total_games === 0) {
    return <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-100">These players have never played each other.</div>;
  }

  const items = [
    ["Total games", h2h.total_games],
    ["Wins", h2h.wins],
    ["Draws", h2h.draws],
    ["Losses", h2h.losses],
    ["As White", `${h2h.white_wins}-${h2h.white_draws}-${h2h.white_losses}`],
    ["As Black", `${h2h.black_wins}-${h2h.black_draws}-${h2h.black_losses}`],
    ["Average moves", h2h.average_moves],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md border border-neutral-800 bg-neutral-950 p-4">
          <span className="text-xs uppercase tracking-[0.16em] text-neutral-500">{label}</span>
          <strong className="mt-2 block text-xl text-neutral-100">{value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [playerAId, setPlayerAId] = useState<string | null>(searchParams.get("playerA"));
  const [playerBId, setPlayerBId] = useState<string | null>(searchParams.get("playerB"));

  useEffect(() => {
    const next = new URLSearchParams();
    if (playerAId) next.set("playerA", playerAId);
    if (playerBId) next.set("playerB", playerBId);
    setSearchParams(next, { replace: true });
  }, [playerAId, playerBId, setSearchParams]);

  const samePlayer = Boolean(playerAId && playerBId && playerAId === playerBId);

  const profileAQuery = useQuery({
    queryKey: ["compare-profile", playerAId],
    queryFn: () => http.get<ProfileResponse>(`/profiles/${playerAId}`),
    enabled: Boolean(playerAId),
  });

  const profileBQuery = useQuery({
    queryKey: ["compare-profile", playerBId],
    queryFn: () => http.get<ProfileResponse>(`/profiles/${playerBId}`),
    enabled: Boolean(playerBId),
  });

  const h2hQuery = useQuery({
    queryKey: ["compare-h2h", playerAId, playerBId],
    queryFn: () => http.get<HeadToHeadResponse>(`/profiles/${playerAId}/head-to-head/${playerBId}`),
    enabled: Boolean(playerAId && playerBId && !samePlayer),
  });

  const loading = profileAQuery.isFetching || profileBQuery.isFetching || h2hQuery.isFetching;
  const error = useMemo(() => {
    if (samePlayer) return "Choose two different players.";
    const queryError = profileAQuery.error || profileBQuery.error || h2hQuery.error;
    return queryError instanceof Error ? queryError.message : null;
  }, [h2hQuery.error, profileAQuery.error, profileBQuery.error, samePlayer]);

  return (
    <AppShell
      eyebrow="Player comparison"
      title="Compare players"
      description="Review ratings, records, and direct results between two ChessView players."
      maxWidthClassName="max-w-6xl"
    >
      <section className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <PlayerSearchBox label="Player A" selectedId={playerAId} onSelect={(player) => setPlayerAId(player.id)} />
        </Card>
        <Card className="p-4">
          <PlayerSearchBox label="Player B" selectedId={playerBId} onSelect={(player) => setPlayerBId(player.id)} />
        </Card>
      </section>

      {error ? <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
      {loading ? (
        <div className="flex items-center gap-3 rounded-md border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
          <Spinner /> Loading comparison...
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        {[profileAQuery.data, profileBQuery.data].map((profile, index) => (
          <Card key={index} className="p-5">
            {profile ? (
              <>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Player {index === 0 ? "A" : "B"}</div>
                <h2 className="mt-2 text-2xl font-semibold text-neutral-100">{profile.username}</h2>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div><span className="block text-neutral-500">Rating</span><strong>{profile.rating}</strong></div>
                  <div><span className="block text-neutral-500">Games</span><strong>{profile.games_played}</strong></div>
                  <div><span className="block text-neutral-500">Record</span><strong>{profile.wins}-{profile.draws}-{profile.losses}</strong></div>
                </div>
              </>
            ) : (
              <div className="text-sm text-neutral-500">Select Player {index === 0 ? "A" : "B"}.</div>
            )}
          </Card>
        ))}
      </section>

      <Card className="p-5">
        <h2 className="text-xl font-semibold text-neutral-100">Ratings</h2>
        <div className="mt-4 divide-y divide-neutral-800 overflow-hidden rounded-md border border-neutral-800">
          {RATING_CATEGORIES.map((category) => (
            <div key={category.key} className="grid grid-cols-[1fr_1fr_1fr] px-4 py-3 text-sm">
              <span className="text-neutral-500">{category.label}</span>
              <strong>{ratingValue(profileAQuery.data, category.key)}</strong>
              <strong>{ratingValue(profileBQuery.data, category.key)}</strong>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Swords className="h-5 w-5 text-violet-300" />
          <h2 className="text-xl font-semibold text-neutral-100">Head-to-head</h2>
        </div>
        <H2HBlock h2h={samePlayer ? undefined : h2hQuery.data} />
        {h2hQuery.data?.tournament_breakdown.length ? (
          <div className="mt-5 divide-y divide-neutral-800 rounded-md border border-neutral-800">
            {h2hQuery.data.tournament_breakdown.map((item) => (
              <div key={item.tournament_id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-neutral-300">{item.tournament_name}</span>
                <strong>{item.wins}-{item.draws}-{item.losses}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <div className="hidden">
        <ArrowLeftRight />
      </div>
    </AppShell>
  );
}
