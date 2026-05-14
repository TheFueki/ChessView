import { BarChart3, Brain, PlayCircle, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { http } from "@/shared/api";
import { Button, Spinner } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import type { GameHistoryResponse, ProfileResponse, TournamentSummaryResponse } from "@/shared/types";
import "../../pages-style/dashboard-page/dashboardpage.scss";

const TIME_CONTROLS = ["1+0", "1+1", "1+2", "2+1", "3+0", "3+1", "3+2", "5+0", "5+3", "10+0", "15+0", "15+10"];

function formatDateTime(value: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function outcomeLabel(result: string | null, myColor: "white" | "black") {
  if (result === "1/2-1/2") return "Draw";
  if ((result === "1-0" && myColor === "white") || (result === "0-1" && myColor === "black")) return "Win";
  if (result) return "Loss";
  return "Active";
}

function ratingValue(profile: ProfileResponse | null, control: string) {
  const value = profile?.ratings?.[control];
  return typeof value === "number" ? value : "Not rated";
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
  const recentGames = history.slice(0, 5);
  const highlightedTournaments = (tournamentsQuery.data ?? []).slice(0, 3);

  return (
    <AppShell
      eyebrow="Home"
      title="ChessView"
      description="Play games, follow tournaments, study positions, and keep your ratings moving."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => navigate(activeGame ? `/game/${activeGame.id}` : "/lobby")}>
            <PlayCircle className="h-4 w-4" />
            {activeGame ? "Resume Game" : "Play"}
          </Button>
          <Button variant="secondary" onClick={() => navigate("/puzzles")}>
            <Brain className="h-4 w-4" />
            Puzzles
          </Button>
        </div>
      }
    >
      <div className="dashboard-clean">
        <section className="dashboard-panel play-panel">
          <div>
            <span className="panel-kicker">Ready to play?</span>
            <h2>{activeGame ? "Continue your game" : "Find an opponent"}</h2>
            <p>
              {activeGame
                ? `Resume the match against ${activeGame.opponent.username}.`
                : "Start a quick game or warm up with tactics before joining a tournament."}
            </p>
          </div>
          <div className="panel-actions">
            <Button onClick={() => navigate(activeGame ? `/game/${activeGame.id}` : "/lobby")}>
              <PlayCircle className="h-4 w-4" />
              {activeGame ? "Resume" : "Start Search"}
            </Button>
            <Button variant="secondary" onClick={() => navigate("/analysis")}>
              <BarChart3 className="h-4 w-4" />
              Analyze
            </Button>
          </div>
        </section>

        <section className="dashboard-panel ratings-panel">
          <div className="section-title">
            <h3>Ratings</h3>
            {profileQuery.isLoading ? <Spinner size="sm" /> : null}
          </div>
          <div className="ratings-grid">
            {TIME_CONTROLS.map((control) => (
              <div key={control} className="rating-row">
                <span>{control}</span>
                <strong>{ratingValue(profile, control)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard-panel recent-panel">
          <div className="section-title">
            <h3>Recent Games</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>History</Button>
          </div>
          <div className="games-stack">
            {historyQuery.isLoading ? (
              <div className="stack-empty"><Spinner /></div>
            ) : recentGames.length === 0 ? (
              <div className="stack-empty">No games yet.</div>
            ) : (
              recentGames.map((game) => (
                <button key={game.id} className="game-row" onClick={() => navigate(`/games/${game.id}`)}>
                  <span className="result" data-result={outcomeLabel(game.result, game.my_color).toLowerCase()}>
                    {outcomeLabel(game.result, game.my_color)}
                  </span>
                  <span className="opponent">
                    <strong>{game.opponent.username}</strong>
                    <small>{game.time_control_name} / {game.rated ? "Rated" : "Casual"}</small>
                  </span>
                  <span className="played-at">{formatDateTime(game.ended_at ?? game.started_at)}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <aside className="dashboard-panel tournaments-panel">
          <div className="section-title">
            <h3>Tournaments</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate("/tournaments")}>View all</Button>
          </div>
          <div className="tournament-list">
            {highlightedTournaments.length === 0 ? (
              <div className="stack-empty">No tournaments available.</div>
            ) : (
              highlightedTournaments.map((tournament) => (
                <button key={tournament.id} onClick={() => navigate(`/tournaments/${tournament.id}`)}>
                  <Trophy size={16} />
                  <span>
                    <strong>{tournament.name}</strong>
                    <small>{tournament.time_control_name} / {tournament.player_count} players</small>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
