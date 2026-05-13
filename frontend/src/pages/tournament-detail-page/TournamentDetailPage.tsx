import { useMemo, useState } from "react";
import { 
  Swords, 
  Trophy, 
  Users, 
  Calendar, 
  Clock, 
  ChevronLeft, 
  ExternalLink, 
  Play, 
  History 
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
import { http } from "@/shared/api";
import type { TournamentDetailResponse, TournamentPairingResponse } from "@/shared/types";
import { Button, Card, Spinner } from "@/shared/ui";

import "../../pages-style/dashboard-page/dashboardpage.scss";

function formatDateTime(value: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleString([], {
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
  if (pairing.black === null) return "Bye";
  if (pairing.result === "1-0") return "1-0";
  if (pairing.result === "0-1") return "0-1";
  if (pairing.result === "1/2-1/2") return " - ";
  return pairing.game_status === "active" ? "In progress" : "Pending";
}

function pairingLink(pairing: TournamentPairingResponse) {
  if (!pairing.game_id) return null;
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
    onError: (error) => setActionError(error instanceof Error ? error.message : "Unable to join."),
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
    onError: (error) => setActionError(error instanceof Error ? error.message : "Unable to leave."),
  });

  const startTournament = useMutation({
    mutationFn: () => http.post(`/tournaments/${tournamentId}/start`),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
  });

  const advanceTournament = useMutation({
    mutationFn: () => http.post(`/tournaments/${tournamentId}/advance`),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId] });
    },
  });

  const tournament = tournamentQuery.data ?? null;

  const error = useMemo(() => {
    if (!tournamentId) return "Missing tournament id.";
    if (actionError) return actionError;
    return tournamentQuery.error ? "Unable to load tournament data." : null;
  }, [actionError, tournamentId, tournamentQuery.error]);

  return (
    <div className="dashboard-root">
      <main className="main-viewport" style={{ paddingBottom: '4rem' }}>
        <header className="viewport-header">
          <div className="header-info">
            <div className="flex items-center gap-4">
               <button 
                 onClick={() => navigate("/tournaments")} 
                 className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                 title="Back to tournaments"
               >
                 <ChevronLeft size={20} className="text-neutral-400" />
               </button>
               <div>
                 <h1 className="text-2xl font-bold tracking-tight">
                   {tournament?.name ?? "Tournament Details"}
                 </h1>
                 <div className="server-badge mt-1">
                   <span className={tournament?.status === "active" ? "pulse-dot" : "pulse-dot bg-neutral-600"} /> 
                   {tournament ? formatStatus(tournament.status) : "Synchronizing..."}
                 </div>
               </div>
            </div>
          </div>

          <div className="quick-stats">
            <div className="stat-pill">
              <span>Current Round</span> 
              <b className="text-emerald-400">{tournament?.current_round ?? 0} / {tournament?.total_rounds ?? 0}</b>
            </div>
            <div className="stat-pill">
              <span>Players</span> 
              <b>{tournament?.player_count ?? 0}</b>
            </div>
          </div>
        </header>

        {tournamentQuery.isLoading ? (
          <div className="flex flex-col items-center justify-center p-24 gap-4">
            <Spinner />
            <span className="text-neutral-500 text-sm font-mono animate-pulse">
              fetching_tournament_metadata...
            </span>
          </div>
        ) : error || !tournament ? (
          <div className="p-12 text-center">
            <Card className="inline-block p-8 border-red-900/20 bg-red-950/5 backdrop-blur-md">
              <h2 className="text-red-400 font-semibold mb-2">Access Denied / Error</h2>
              <p className="text-neutral-500 text-sm mb-6 max-w-xs mx-auto">
                {error || "The requested tournament does not exist or has been archived."}
              </p>
              <Button variant="secondary" onClick={() => navigate("/tournaments")}>
                Return to Lobby
              </Button>
            </Card>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid gap-4 md:grid-cols-3 mb-8">
              <Card className="mini-action bg-white/[0.02] border-white/[0.05]" style={{ cursor: 'default' }}>
                <Users size={20} className="text-blue-400 opacity-80"/>
                <div>
                  <h3 className="text-[10px] uppercase tracking-widest text-neutral-500">Organizer</h3>
                  <p className="font-medium text-sm text-neutral-200">{tournament.owner.username}</p>
                </div>
              </Card>
              <Card className="mini-action bg-white/[0.02] border-white/[0.05]" style={{ cursor: 'default' }}>
                <Clock size={20} className="text-emerald-400 opacity-80"/>
                <div>
                  <h3 className="text-[10px] uppercase tracking-widest text-neutral-500">Time Control</h3>
                  <p className="font-medium text-sm text-neutral-200">{tournament.time_control_name}</p>
                </div>
              </Card>
              <Card className="mini-action bg-white/[0.02] border-white/[0.05]" style={{ cursor: 'default' }}>
                <Calendar size={20} className="text-purple-400 opacity-80"/>
                <div>
                  <h3 className="text-[10px] uppercase tracking-widest text-neutral-500">Scheduled</h3>
                  <p className="font-medium text-sm text-neutral-200">
                    {tournament.started_at ? formatDateTime(tournament.started_at) : "Registration Open"}
                  </p>
                </div>
              </Card>
            </div>

            <Card className="flex flex-wrap items-center justify-between gap-4 p-4 mb-8 bg-white/[0.02] border-white/[0.05] backdrop-blur-sm">
              <div className="flex items-center gap-3">
                {!tournament.viewer_is_member && tournament.status === "registration" && (
                  <Button 
                    className="btn-main shadow-lg shadow-emerald-500/10" 
                    onClick={() => joinTournament.mutate()} 
                    disabled={joinTournament.isPending}
                  >
                    Register for Tournament
                  </Button>
                )}
                {tournament.viewer_is_member && tournament.status === "registration" && !tournament.viewer_is_owner && (
                  <Button 
                    variant="ghost" 
                    className="hover:bg-red-500/10 hover:text-red-400"
                    onClick={() => leaveTournament.mutate()} 
                    disabled={leaveTournament.isPending}
                  >
                    Withdraw
                  </Button>
                )}
                {tournament.viewer_is_owner && (
                  <div className="flex gap-2 p-1 bg-black/20 rounded-lg">
                    {tournament.status === "registration" && (
                      <Button 
                        size="sm"
                        className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold"
                        onClick={() => startTournament.mutate()} 
                        disabled={startTournament.isPending}
                      >
                        <Play size={14} className="mr-1 fill-current"/> Start
                      </Button>
                    )}
                    {tournament.status === "active" && (
                      <Button 
                        size="sm"
                        variant="secondary"
                        onClick={() => advanceTournament.mutate()} 
                        disabled={advanceTournament.isPending}
                      >
                        Force Next Round
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] font-mono text-neutral-600 block uppercase tracking-tighter">System Status</span>
                <p className="text-xs text-neutral-400 italic">
                  {tournament.status === "registration" 
                    ? "Awaiting players to fill brackets..." 
                    : "Pairings managed by Swiss System algorithm."}
                </p>
              </div>
            </Card>

            <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
              <section className="space-y-4">
                <div className="section-title border-l-2 border-yellow-500 pl-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-neutral-300">
                    <Trophy size={16} className="text-yellow-500"/> Tournament Standings
                  </h3>
                </div>
                <div className="games-stack border border-white/[0.05] rounded-2xl overflow-hidden bg-black/20">
                  <div className="grid grid-cols-[40px_1fr_60px_60px] px-5 py-3 text-[10px] uppercase tracking-widest text-neutral-500 font-bold border-b border-white/[0.03] bg-white/[0.02]">
                    <span>#</span>
                    <span>Candidate</span>
                    <span className="text-center">Pts</span>
                    <span className="text-center">Games</span>
                  </div>
                  <div className="max-h-[600px] overflow-y-auto">
                    {tournament.standings.map((s) => (
                      <div key={s.player.id} className="game-row hover:bg-white/[0.03] transition-colors border-b border-white/[0.02] last:border-0">
                        <div className="text-neutral-600 font-mono text-xs pl-2">{s.rank}</div>
                        <Link to={`/players/${s.player.id}`} className="flex items-center gap-2 group">
                          <span className="text-sm font-medium group-hover:text-emerald-400 transition-colors truncate">
                            {s.player.username}
                          </span>
                          <span className="text-[10px] text-neutral-600 font-mono">[{s.player.rating}]</span>
                        </Link>
                        <div className="text-emerald-400 font-bold text-sm text-center">{s.score.toFixed(1)}</div>
                        <div className="text-neutral-500 text-xs text-center font-mono">{s.games_played}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <div className="section-title border-l-2 border-blue-500 pl-3">
                  <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-neutral-300">
                    <Swords size={16} className="text-blue-500"/> Match Pairings
                  </h3>
                </div>
                
                <div className="space-y-8">
                  {tournament.rounds.slice().reverse().map((round) => (
                    <div key={round.round_number} className="animate-in fade-in slide-in-from-right-4 duration-500">
                      <div className="flex items-center gap-3 mb-4 px-1">
                        <span className="text-xs font-black uppercase tracking-widest text-neutral-400 bg-white/5 px-2 py-1 rounded">
                          Round {round.round_number}
                        </span>
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-white/[0.08] to-transparent" />
                      </div>
                      
                      <div className="grid gap-2">
                        {round.pairings.map((pairing) => {
                          const target = pairingLink(pairing);
                          return (
                            <div 
                              key={pairing.id ?? `${round.round_number}-${pairing.white.id}`} 
                              className="group relative flex items-center justify-between p-4 rounded-xl border border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.03] hover:border-white/[0.1] transition-all"
                            >
                              <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                                <Link to={`/players/${pairing.white.id}`} className="text-xs font-semibold hover:text-emerald-400 transition-colors truncate text-right">
                                  {pairing.white.username}
                                  <span className="block text-[9px] text-neutral-600 font-normal">White</span>
                                </Link>
                                
                                <div className="flex flex-col items-center gap-1">
                                  <div className="px-3 py-1 rounded-md bg-black/40 border border-white/[0.05] text-[10px] font-mono font-bold text-neutral-400 min-w-[60px] text-center">
                                    {formatPairingResult(pairing)}
                                  </div>
                                </div>

                                {pairing.black ? (
                                  <Link to={`/players/${pairing.black.id}`} className="text-xs font-semibold hover:text-emerald-400 transition-colors truncate text-left">
                                    {pairing.black.username}
                                    <span className="block text-[9px] text-neutral-600 font-normal">Black</span>
                                  </Link>
                                ) : (
                                  <span className="text-xs text-amber-500/40 font-mono tracking-tighter">BYE_SYSTEM_ALLOC</span>
                                )}
                              </div>
                              
                              <div className="ml-6">
                                {target ? (
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-9 w-9 p-0 rounded-full hover:bg-emerald-500 hover:text-black transition-all"
                                    onClick={() => navigate(target)}
                                    title={pairing.game_status === "active" ? "Spectate Match" : "View Analysis"}
                                  >
                                    {pairing.game_status === "active" ? <ExternalLink size={14}/> : <History size={14}/>}
                                  </Button>
                                ) : (
                                  <div className="w-9 h-9 flex items-center justify-center opacity-10 cursor-not-allowed">
                                    <Swords size={14}/>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}