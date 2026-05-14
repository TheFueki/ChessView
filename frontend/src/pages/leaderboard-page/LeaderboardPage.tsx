import { useMemo, useState } from "react";
import { Search, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Avatar, Card, Input, Spinner } from "@/shared/ui";
import { http } from "@/shared/api";
import { API_BASE_URL } from "@/shared/config";
import type { RatingCategory } from "@/shared/types";
import { AppShell } from "@/widgets/app-shell";

interface Leader {
  id: string;
  username: string;
  rating: number;
  ratings?: Partial<Record<RatingCategory, number | null>>;
  wins: number;
  avatar_url: string | null;
  global_rank?: number;
}

interface LeaderboardResponse {
  data: Leader[];
}

function normalizeLeaders(response: Leader[] | LeaderboardResponse): Leader[] {
  return Array.isArray(response) ? response : response.data;
}

function avatarUrl(path: string | null) {
  if (!path) return null;
  return path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
}

const ratingCategories: { value: RatingCategory; label: string }[] = [
  { value: "bullet", label: "Bullet" },
  { value: "blitz", label: "Blitz" },
  { value: "rapid", label: "Rapid" },
  { value: "classical", label: "Classical" },
];

function selectedRating(player: Leader, selectedCategory: RatingCategory) {
  return player.ratings?.[selectedCategory] ?? player.rating;
}

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<RatingCategory>("blitz");
  const leadersQuery = useQuery({
    queryKey: ["leaderboard", selectedCategory],
    queryFn: () => {
      const params = { category: selectedCategory };
      return http.get<Leader[] | LeaderboardResponse>(
        `/profiles/leaderboard?${new URLSearchParams(params)}`,
      );
    },
  });

  const leaders = useMemo(
    () =>
      normalizeLeaders(leadersQuery.data ?? []).sort(
        (a, b) => selectedRating(b, selectedCategory) - selectedRating(a, selectedCategory),
      ),
    [leadersQuery.data, selectedCategory],
  );
  const filteredLeaders = leaders.filter((leader) =>
    leader.username.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const topPlayers = filteredLeaders.slice(0, 3);
  const tablePlayers = filteredLeaders.slice(3);

  return (
    <AppShell
      eyebrow="Ratings"
      title="Leaderboard"
      description="Track the strongest players by rating and open a profile for deeper head-to-head comparison."
      actions={
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div className="grid grid-cols-4 rounded-md border border-neutral-800 bg-neutral-950 p-1">
            {ratingCategories.map((category) => {
              const isSelected = category.value === selectedCategory;
              return (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => setSelectedCategory(category.value)}
                  className={`rounded px-3 py-2 text-xs font-semibold transition ${
                    isSelected
                      ? "bg-violet-500 text-white"
                      : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
                  }`}
                  aria-pressed={isSelected}
                >
                  {category.label}
                </button>
              );
            })}
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <Input
              className="pl-9"
              placeholder="Find player"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Find player"
            />
          </div>
        </div>
      }
    >
      {leadersQuery.isLoading ? (
        <Card className="flex items-center gap-3">
          <Spinner />
          <span className="text-sm text-neutral-400">Loading leaderboard...</span>
        </Card>
      ) : (
        <>
        {topPlayers.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-3 md:items-end">
            {topPlayers.map((player, index) => {
              const place = index + 1;
              const heightClass = place === 1 ? "md:min-h-[230px]" : place === 2 ? "md:min-h-[200px]" : "md:min-h-[180px]";
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => navigate(`/players/${player.id}`)}
                  className={`flex min-h-[170px] flex-col items-center justify-between rounded-md border border-neutral-800 bg-neutral-900/70 p-5 text-center transition hover:border-violet-500/40 hover:bg-neutral-900 ${heightClass}`}
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
                    #{place}
                  </div>
                  <Avatar username={player.username} avatarUrl={avatarUrl(player.avatar_url)} size="lg" />
                  <div className="min-w-0">
                    <div className="truncate text-lg font-semibold text-neutral-100">{player.username}</div>
                    <div className="mt-1 text-sm text-neutral-500">{player.wins} wins</div>
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-violet-200">
                    {selectedRating(player, selectedCategory)}
                  </div>
                </button>
              );
            })}
          </section>
        ) : null}

        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-[56px_minmax(0,1fr)_90px_90px] gap-3 border-b border-neutral-800 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Wins</span>
            <span className="text-right">Rating</span>
          </div>
          <div className="divide-y divide-neutral-800/70">
            {tablePlayers.map((player, index) => (
              <button
                key={player.id}
                type="button"
                onClick={() => navigate(`/players/${player.id}`)}
                className="grid w-full grid-cols-[56px_minmax(0,1fr)_90px_90px] items-center gap-3 px-4 py-3 text-left transition hover:bg-neutral-800/40"
              >
                <span className="font-mono text-sm text-neutral-500">{index + 4}</span>
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar username={player.username} avatarUrl={avatarUrl(player.avatar_url)} size="sm" />
                  <span className="truncate font-semibold text-neutral-100">{player.username}</span>
                </span>
                <span className="text-right text-sm tabular-nums text-neutral-400">{player.wins}</span>
                <span className="text-right text-sm font-semibold tabular-nums text-violet-200">
                  {selectedRating(player, selectedCategory)}
                </span>
              </button>
            ))}
            {filteredLeaders.length === 0 ? (
              <div className="flex items-center gap-3 px-4 py-8 text-sm text-neutral-500">
                <Trophy className="h-5 w-5" />
                No players found.
              </div>
            ) : null}
          </div>
        </Card>
        </>
      )}
    </AppShell>
  );
}
