import React, { useState } from "react";
import { 
  BarChart3, Brain, PlayCircle, Swords, Trophy, 
  Settings, ChevronLeft, ChevronRight,
  ShieldCheck, ShoppingBag, Users,
  Medal
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { http } from "@/shared/api";
import { Avatar, Button, Card, Spinner } from "@/shared/ui"; 
import { SERVER_URL } from "@/shared/config";
import type { GameHistoryResponse, ProfileResponse, TournamentSummaryResponse } from "@/shared/types";
import "../../pages-style/dashboard-page/dashboardpage.scss";
import logoImage from '../../assets/logo.jpeg';

interface AppShellProps {
  children: React.ReactNode;
  className?: string; 
}

const LocalAppShell = ({ children, className }: AppShellProps) => {
  return (
    <div className={`app-shell-container ${className || ''}`}>
      {children}
    </div>
  );
};

function formatDateTime(value: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleString([], {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function outcomeLabel(result: string | null, myColor: "white" | "black") {
  if (result === "1/2-1/2") return "Draw";
  if ((result === "1-0" && myColor === "white") || (result === "0-1" && myColor === "black")) return "Win";
  if (result) return "Loss";
  return "Active";
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [uiState, setUiState] = useState({ left: true, right: true });

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
  const recentGames = history.slice(0, 4);
  const highlightedTournaments = (tournamentsQuery.data ?? []).slice(0, 3);

  const getAvatarUrl = (path: string | null | undefined) => {
    if (!path) return null;
    return path.startsWith('http') 
      ? path 
      : `${SERVER_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  return (
    <LocalAppShell className={`dashboard-root ${!uiState.left ? 'l-collapsed' : ''} ${!uiState.right ? 'r-collapsed' : ''}`}>
      <div className="dashboard-grid">
        <aside className="side-panel left-panel">
          <button className="collapse-btn" onClick={() => setUiState(s => ({...s, left: !s.left}))}>
            {uiState.left ? <ChevronLeft size={16}/> : <ChevronRight size={16}/>}
          </button>
          
          <div className="panel-inner">
            <div className="brand-section">
              <div className="logo-box">
                <img 
                  src={logoImage} 
                  alt="ChessView Logo" 
                  className="logo-img" 
                />
              </div>
              <div className="brand-text">
                <span className="name">ChessView</span>
                <span className="ver">v1.1.1</span>
              </div>
            </div>

            <nav className="main-nav">
              <button className="nav-item active" onClick={() => navigate("/")}>
                <Swords size={20}/> <span>Dashboard</span>
              </button>
              <button className="nav-item" onClick={() => navigate("/clubs")}>
                <Users size={20}/> <span>Clubs</span>
              </button>
              <button className="nav-item" onClick={() => navigate("/shop")}>
                <ShoppingBag size={20}/> <span>Market</span>
              </button>
              <button className="nav-item" onClick={() => navigate("/settings")}>
                <Settings size={20}/> <span>Settings</span>
              </button>
              <button className="nav-item" onClick={() => navigate("/analysis")}>
                <BarChart3 size={20}/> <span>Study</span>
              </button>
              <button className="nav-item" onClick={() => navigate("/tournaments")}>
                <Trophy size={20}/> <span>Tournaments</span>
              </button>
              <button className="nav-item" onClick={() => navigate("/leaderboard")}>
                <Medal size={20}/> <span>Leaderboard</span>
              </button>
            </nav>

            <div className="profile-anchor">
              <div className="user-card-mini" onClick={() => navigate("/profile")}>
                <div className="relative"> 
                  {profileQuery.isLoading ? (
                    <div className="w-8 h-8 flex items-center justify-center"><Spinner size="sm" /></div>
                  ) : (
                    <Avatar 
                      username={profile?.username ?? "Guest"} 
                      avatarUrl={getAvatarUrl(profile?.avatar_url)} 
                      size="sm"
                    />
                  )}
                  <div className="online-status" />
                </div>
                
                <div className="user-meta">
                  <span className="username">
                    {profileQuery.isLoading ? "Loading..." : (profile?.username ?? "Guest")}
                  </span>
                  <span className="rank">Ranked Player</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="main-viewport">
          <header className="viewport-header">
            <div className="header-info">
              <h1>Control Panel</h1>
              <div className="server-badge">
                <span className="pulse-dot" /> Server: Stable
              </div>
            </div>
            <div className="quick-stats">
              <div className="stat-pill"><span>Blitz</span> <b>{profile?.rating ?? 1200}</b></div>
              <div className="stat-pill"><span>Winrate</span> <b>{profile?.win_rate ? profile.win_rate.toFixed(1) : "0.0"}%</b></div>
            </div>
          </header>

          <section className="hero-action-section">
            <Card className="play-card">
              <div className="card-content">
                <span className="tag">Ready to play?</span>
                <h2>{activeGame ? "Continue Battle" : "Find Opponent"}</h2>
                <p>{activeGame ? `Match vs ${activeGame.opponent.username}` : "Jump into a 5+3 blitz game right now."}</p>
                
                <div className="actions-row">
                  <Button className="btn-main" onClick={() => navigate(activeGame ? `/game/${activeGame.id}` : "/lobby")}>
                    <PlayCircle className="mr-2"/> {activeGame ? "Resume Game" : "Start Search"}
                  </Button>
                  <Button variant="secondary" onClick={() => navigate("/puzzles")}>
                    <Brain className="mr-2"/> Solve Puzzles
                  </Button>
                </div>
              </div>
            </Card>

            <div className="sub-grid">
              <Card className="mini-action" onClick={() => navigate("/analysis")}>
                <BarChart3 size={24} className="text-blue-400"/>
                <div>
                  <h3>Analysis</h3>
                  <p>Review games</p>
                </div>
              </Card>
              <Card className="mini-action" onClick={() => navigate("/tournaments")}>
                <Trophy size={24} className="text-yellow-500"/>
                <div>
                  <h3>Tournaments</h3>
                  <p>Join leagues</p>
                </div>
              </Card>
            </div>
          </section>

          <section className="recent-section">
            <div className="section-title">
              <h3>Recent Boards</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate("/history")}
              >
                Show History
              </Button>
            </div>
            <div className="games-stack">
              {historyQuery.isLoading ? <Spinner /> : recentGames.map((game) => (
                <div key={game.id} className="game-row" onClick={() => navigate(`/games/${game.id}`)}>
                  <div className="res-indicator" data-result={outcomeLabel(game.result, game.my_color).toLowerCase()}>
                    {outcomeLabel(game.result, game.my_color)}
                  </div>
                  <div className="opp-info">
                    <span className="name">{game.opponent.username}</span>
                    <span className="meta">{game.time_control_name}   {game.rated ? "Rated" : "Casual"}</span>
                  </div>
                  <div className="time">{formatDateTime(game.ended_at ?? game.started_at)}</div>
                  <Button size="sm" variant="ghost">Analyze</Button>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className="side-panel right-panel">
          <button className="collapse-btn" onClick={() => setUiState(s => ({...s, right: !s.right}))}>
            {uiState.right ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
          </button>

          <div className="panel-inner">
            <div className="aside-section">
              <div className="section-head"><ShieldCheck size={18}/> Help Center</div>
              <div className="help-grid">
                <button className="help-item" onClick={() => navigate("/support")}>Support</button>
                <button className="help-item" onClick={() => navigate("/community")}><Users size={16}/> Community</button>
              </div>
            </div>

            <div className="aside-section tournaments-radar">
              <div className="section-head"><Trophy size={18}/> Live Leagues</div>
              <div className="t-list">
                {highlightedTournaments.map(t => (
                  <div key={t.id} className="t-item" onClick={() => navigate(`/tournaments/${t.id}`)}>
                    <span className="t-time">Live</span>
                    <div className="t-info">
                      <span className="t-name">{t.name}</span>
                      <span className="t-players">{t.player_count} players</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="status-footer">
              <div className="status-card">
                <div className="sys-icon"><div className="dot"/></div>
                <div className="sys-meta">
                  <span className="l">Status</span>
                  <span className="v">Stable</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </LocalAppShell>
  );
}