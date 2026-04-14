import { BarChart3, Brain, Clock3, PlayCircle, Swords, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { http } from "@/shared/api";
import type { GameHistoryResponse, ProfileResponse, TournamentSummaryResponse } from "@/shared/types";
import { Button, Card, Spinner } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";

function formatDateTime(value: string | null) {
  if (!value) {
    return "--";
  }

  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function outcomeLabel(result: string | null, myColor: "white" | "black") {
  if (result === "1/2-1/2") {
    return "Draw";
  }
  if ((result === "1-0" && myColor === "white") || (result === "0-1" && myColor === "black")) {
    return "Win";
  }
  if (result) {
    return "Loss";
  }
  return "Active";
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const profileQuery = useQuery({
    queryKey: ["dashboard-profile"],
    queryFn: () => http.get<ProfileResponse>("/profiles/me"),
  });
  const historyQuery = useQuery({
    queryKey: ["dashboard-history"],
    queryFn: () => http.get<GameHistoryResponse>("/games"),
  });
  const tournamentsQuery = useQuery({
    queryKey: ["dashboard-tournaments"],
    queryFn: () => http.get<TournamentSummaryResponse[]>("/tournaments"),
  });

  const profile = profileQuery.data ?? null;
  const history = historyQuery.data?.items ?? [];
  const activeGame = history.find((game) => game.status === "active") ?? null;
  const finishedGames = history.filter((game) => game.status !== "active");
  const analysisGames = finishedGames.slice(0, 3);
  const recentGames = history.slice(0, 4);
  const highlightedTournaments = (tournamentsQuery.data ?? []).slice(0, 3);

  return (
    <AppShell
      eyebrow="Dashboard"
      title="Everything you need before the next move"
      description="Jump back into an active game, start a new pairing, solve a quick puzzle, inspect recent analysis, and keep an eye on your tournament calendar."
      actions={
        <>
          <Button onClick={() => navigate(activeGame ? `/game/${activeGame.id}` : "/lobby")}>
            <PlayCircle className="h-4 w-4" />
            {activeGame ? "Continue Game" : "Quick Play"}
          </Button>
          <Button variant="secondary" onClick={() => navigate("/analysis")}>
            <BarChart3 className="h-4 w-4" />
            Study Board
          </Button>
          <Button variant="secondary" onClick={() => navigate("/puzzles")}>
            <Brain className="h-4 w-4" />
            Solve Puzzle
          </Button>
        </>
      }
    >
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-neutral-800 bg-linear-to-r from-emerald-500/12 via-transparent to-cyan-500/12 px-6 py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300/80">Now Playing</div>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-neutral-100">
                  {activeGame ? "Resume your current board" : "Queue into a new match"}
                </h2>
                <p className="mt-2 text-sm text-neutral-400">
                  {activeGame
                    ? `You're already in a live ${activeGame.time_control_name} game against ${activeGame.opponent.username}.`
                    : "No active games right now. Start a rated match or jump into your next tournament pairing."}
                </p>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 px-5 py-4 text-right">
                <div className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">Current Rating</div>
                <div className="mt-1 text-3xl font-bold tabular-nums text-neutral-100">
                  {profile ? profile.rating : "--"}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
                <Swords className="h-3.5 w-3.5" />
                Games Played
              </div>
              <div className="mt-3 text-2xl font-semibold text-neutral-100">{profile?.games_played ?? "--"}</div>
              <div className="mt-1 text-sm text-neutral-500">Completed games on record</div>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
                <Clock3 className="h-3.5 w-3.5" />
                Win Rate
              </div>
              <div className="mt-3 text-2xl font-semibold text-neutral-100">
                {profile ? `${profile.win_rate.toFixed(1)}%` : "--"}
              </div>
              <div className="mt-1 text-sm text-neutral-500">Across rated and casual play</div>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500">
                <Trophy className="h-3.5 w-3.5" />
                Record
              </div>
              <div className="mt-3 text-2xl font-semibold text-neutral-100">
                {profile ? `${profile.wins}-${profile.losses}-${profile.draws}` : "--"}
              </div>
              <div className="mt-1 text-sm text-neutral-500">Wins, losses, draws</div>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Tournament Radar</div>
          {tournamentsQuery.isLoading ? (
            <div className="flex items-center gap-3 text-sm text-neutral-400">
              <Spinner size="sm" />
              Loading tournaments...
            </div>
          ) : highlightedTournaments.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-400">
              No live or upcoming tournaments yet. Create one or browse the tournament hub.
            </div>
          ) : (
            <div className="space-y-3">
              {highlightedTournaments.map((tournament) => (
                <button
                  key={tournament.id}
                  onClick={() => navigate(`/tournaments/${tournament.id}`)}
                  className="w-full rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-4 text-left transition hover:border-neutral-700 hover:bg-neutral-900/70"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-neutral-100">{tournament.name}</div>
                    <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                      {tournament.status}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-neutral-500">
                    {tournament.time_control_name} • {tournament.player_count} players • Round {tournament.current_round}/
                    {Math.max(tournament.total_rounds, 0)}
                  </div>
                </button>
              ))}
            </div>
          )}
          <Button variant="secondary" onClick={() => navigate("/tournaments")}>
            Browse Tournaments
          </Button>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.92fr)]">
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Recent Games</div>
              <div className="mt-2 text-sm text-neutral-400">Your latest boards, with one-click replay or profile navigation.</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>
              Open History
            </Button>
          </div>

          {historyQuery.isLoading ? (
            <div className="flex items-center gap-3 text-sm text-neutral-400">
              <Spinner size="sm" />
              Loading games...
            </div>
          ) : recentGames.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-400">
              No games yet. Play your first match to start building your archive.
            </div>
          ) : (
            <div className="space-y-3">
              {recentGames.map((game) => (
                <button
                  key={game.id}
                  onClick={() => navigate(game.status === "active" ? `/game/${game.id}` : `/games/${game.id}`)}
                  className="grid w-full gap-3 rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-4 text-left transition hover:border-neutral-700 hover:bg-neutral-900/70 lg:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold text-neutral-100">{game.opponent.username}</span>
                      <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-neutral-400">
                        {outcomeLabel(game.result, game.my_color)}
                      </span>
                      <span className="text-xs text-neutral-500">{game.time_control_name}</span>
                    </div>
                    <div className="mt-2 text-xs text-neutral-500">
                      {game.rated ? "Rated" : "Casual"} • {game.termination_reason?.replaceAll("_", " ") ?? game.status}
                    </div>
                  </div>
                  <div className="text-xs text-neutral-500">{formatDateTime(game.ended_at ?? game.started_at)}</div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Analysis Queue</div>
              <div className="mt-2 text-sm text-neutral-400">Jump back into the positions most worth reviewing.</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/analysis")}>
              Full Study Board
            </Button>
          </div>

          {historyQuery.isLoading ? (
            <div className="flex items-center gap-3 text-sm text-neutral-400">
              <Spinner size="sm" />
              Loading analysis shortcuts...
            </div>
          ) : analysisGames.length === 0 ? (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4 text-sm text-neutral-400">
              Finish a game to unlock replay and Stockfish analysis shortcuts here.
            </div>
          ) : (
            <div className="space-y-3">
              {analysisGames.map((game) => (
                <button
                  key={game.id}
                  onClick={() => navigate(`/games/${game.id}`)}
                  className="w-full rounded-2xl border border-neutral-800 bg-neutral-950/60 px-4 py-4 text-left transition hover:border-neutral-700 hover:bg-neutral-900/70"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-neutral-100">{game.opponent.username}</div>
                    <div className="text-xs font-medium text-neutral-500">{game.time_control_name}</div>
                  </div>
                  <div className="mt-2 text-xs text-neutral-500">
                    Review {outcomeLabel(game.result, game.my_color).toLowerCase()} • {formatDateTime(game.ended_at ?? game.started_at)}
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
              <Brain className="h-3.5 w-3.5" />
              Puzzle Training
            </div>
            <div className="mt-3 text-sm text-neutral-300">
              Need a fast study rep? Open puzzle mode for a tactical position without leaving the main app.
            </div>
            <Button className="mt-4" size="sm" onClick={() => navigate("/puzzles")}>
              Open Puzzles
            </Button>
          </div>
        </Card>
      </section>
    </AppShell>
  );
}
