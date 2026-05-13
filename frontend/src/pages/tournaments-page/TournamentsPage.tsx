import React, { useMemo, useState } from "react";
import { 
  BarChart3, PlayCircle, Swords, Trophy, 
  Settings, ChevronLeft, ChevronRight, ShoppingBag, Users,
  Medal, Plus, Info
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { http } from "@/shared/api";
import { Avatar, Button, Card, Spinner, Input } from "@/shared/ui"; 
import type { ProfileResponse, TournamentSummaryResponse, TimeControlKey } from "@/shared/types";
import "../../pages-style/dashboard-page/dashboardpage.scss";
import logoImage from "../../assets/logo.jpeg";

const TIME_CONTROL_OPTIONS: TimeControlKey[] = ["1+0", "1+1", "1+2", "2+1", "3+0", "3+1", "3+2", "5+0", "5+3", "10+0", "15+0", "15+10"];

const LocalAppShell = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={`app-shell-container ${className || ''}`}>
      {children}
    </div>
  );
};


function formatStatus(status: TournamentSummaryResponse["status"]) {
  return status.replaceAll("_", " ");
}

export default function TournamentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uiState, setUiState] = useState({ left: true, right: true });
  
  const [name, setName] = useState("");
  const [timeControlName, setTimeControlName] = useState<TimeControlKey>("5+0");
  const [actionError, setActionError] = useState<string | null>(null);

  const profileQuery = useQuery({
    queryKey: ["dashboard-profile"],
    queryFn: () => http.get<ProfileResponse>("/profiles/me"),
  });

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

  const profile = profileQuery.data ?? null;
  const tournaments = tournamentsQuery.data ?? [];

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
              <button className="nav-item" onClick={() => navigate("/")}>
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
              <button className="nav-item active" onClick={() => navigate("/tournaments")}>
                <Trophy size={20}/> <span>Tournaments</span>
              </button>
              <button className="nav-item" onClick={() => navigate("/leaderboard")}>
                <Medal size={20}/> <span>Leaderboard</span>
              </button>
            </nav>

            <div className="profile-anchor">
              <div className="user-card-mini" onClick={() => navigate("/profile")}>
                <div className="relative"> 
                  <Avatar 
                    username={profile?.username ?? "Guest"} 
                    avatarUrl={profile?.avatar_url} 
                    size="sm"
                  />
                  <div className="online-status" />
                </div>
                <div className="user-meta">
                  <span className="username">{profile?.username ?? "Loading..."}</span>
                  <span className="rank">Ranked Player</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="main-viewport">
          <header className="viewport-header">
            <div className="header-info">
              <h1>Tournaments</h1>
              <div className="server-badge">
                <span className="pulse-dot" /> Swiss Events
              </div>
            </div>
            <div className="quick-stats">
              <div className="stat-pill">
                <span>Active</span> 
                <b>{tournaments.filter(t => t.status !== "registration" && t.status !== "finished").length}</b>
              </div>
              <div className="stat-pill">
                <span>Open</span> 
                <b>{tournaments.filter(t => t.status === "registration").length}</b>
              </div>
            </div>
          </header>

          <section className="hero-action-section">
            <Card className="play-card">
              <div className="card-content">
                <span className="tag">New Event</span>
                <h2>Host a Tournament</h2>
                <p>Create a Swiss event with custom time controls and invite players.</p>
                
                <div className="actions-row" style={{ marginTop: '1rem', gap: '0.75rem', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                    <Input 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      placeholder="Tournament Name" 
                      style={{ flex: 1 }}
                    />
                    <select
                      value={timeControlName}
                      onChange={(e) => setTimeControlName(e.target.value as TimeControlKey)}
                      className="h-11 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100 outline-hidden transition focus:border-emerald-500"
                    >
                      {TIME_CONTROL_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Button className="btn-main" onClick={handleCreate} disabled={createTournament.isPending}>
                      <Plus className="mr-2"/> {createTournament.isPending ? "Creating..." : "Create Now"}
                    </Button>
                    {error && <span className="text-sm text-red-400">{error}</span>}
                  </div>
                </div>
              </div>
            </Card>

            <div className="sub-grid">
              <Card className="mini-action" onClick={() => navigate("/lobby")}>
                <PlayCircle size={24} className="text-blue-400"/>
                <div>
                  <h3>Quick Play</h3>
                  <p>Casual match</p>
                </div>
              </Card>
              <Card className="mini-action" onClick={() => navigate("/leaderboard")}>
                <Medal size={24} className="text-yellow-500"/>
                <div>
                  <h3>Standings</h3>
                  <p>View top players</p>
                </div>
              </Card>
            </div>
          </section>

          <section className="recent-section">
            <div className="section-title">
              <h3>Available Events</h3>
              <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["tournaments"] })}>Refresh List</Button>
            </div>
            
            <div className="games-stack">
              {tournamentsQuery.isLoading ? (
                <div className="flex justify-center p-8"><Spinner /></div>
              ) : tournaments.length === 0 ? (
                <div className="p-8 text-center text-neutral-500 text-sm">No active tournaments found.</div>
              ) : (
                tournaments.map((t) => {
                  const isLeavingOwner = t.viewer_is_owner && t.viewer_is_member;
                  return (
                    <div key={t.id} className="game-row">
                      <div className="res-indicator" data-result={t.status === "registration" ? "draw" : "win"}>
                        {formatStatus(t.status)}
                      </div>
                      <div className="opp-info" onClick={() => navigate(`/tournaments/${t.id}`)} style={{ cursor: 'pointer' }}>
                        <span className="name">{t.name}</span>
                        <span className="meta">
                          {t.time_control_name}   {t.player_count} Players   Round {t.current_round}/{Math.max(t.total_rounds, 0)}
                        </span>
                      </div>
                      <div className="time">
                        {t.owner.username}
                      </div>
                      <div className="flex items-center gap-2">
                        {t.status === "registration" && (
                          <>
                            {!t.viewer_is_member && (
                              <Button size="sm" onClick={() => joinTournament.mutate(t.id)} disabled={joinTournament.isPending}>
                                Join
                              </Button>
                            )}
                            {t.viewer_is_member && !isLeavingOwner && (
                              <Button variant="ghost" size="sm" onClick={() => leaveTournament.mutate(t.id)} disabled={leaveTournament.isPending}>
                                Leave
                              </Button>
                            )}
                          </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/tournaments/${t.id}`)}>View</Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </main>

        <aside className="side-panel right-panel">
          <button className="collapse-btn" onClick={() => setUiState(s => ({...s, right: !s.right}))}>
            {uiState.right ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
          </button>

          <div className="panel-inner">
            <div className="aside-section">
              <div className="section-head"><Info size={18}/> Tournament Rules</div>
              <div className="help-grid">
                <div className="help-item" style={{ cursor: 'default', opacity: 0.8 }}>Swiss System</div>
                <div className="help-item" style={{ cursor: 'default', opacity: 0.8 }}>Elo Rated</div>
              </div>
              <p className="text-[11px] text-neutral-500 mt-3 px-1">
                Standings update in real-time. Pairings avoid rematches when possible.
              </p>
            </div>

            <div className="aside-section tournaments-radar">
              <div className="section-head"><Trophy size={18}/> Live Status</div>
              <div className="t-list">
                <div className="p-4 text-center text-xs text-neutral-600 border border-dashed border-neutral-800 rounded-xl">
                  Tournament pairing updates will appear here.
                </div>
              </div>
            </div>

            <div className="status-footer">
              <div className="status-card">
                <div className="sys-icon"><div className="dot"/></div>
                <div className="sys-meta">
                  <span className="l">Matchmaking</span>
                  <span className="v">Stable   Online</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </LocalAppShell>
  );
}