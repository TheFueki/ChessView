import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  BarChart3, Crown, TrendingUp, Trophy, Settings, Camera, Play, History, Swords,
  Target, Zap, ShieldAlert, ChevronRight,
  EyeOff, Eye, Copy
} from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { useUserStore } from "@/entities/user";
import { http } from "@/shared/api";
import type { GameHistoryItemResponse, HeadToHeadResponse, ProfileResponse, UserProfile } from "@/shared/types";
import { Avatar, Button, Card, Spinner } from "@/shared/ui";
import { SERVER_URL } from "@/shared/config";
import { HistoryTable } from "@/widgets/history-table";
import { VerificationBadge } from "@/shared/ui";
import "../../pages-style/profile-page/profilepage.scss";

const toHistoryItems = (profile: ProfileResponse): GameHistoryItemResponse[] => {
  return profile.recent_games.map((game) => ({
    ...game,
    my_color: game.player_color,
  }));
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>(); 
  const currentUser = useUserStore((state) => state.user);
  const setUser = useUserStore((state) => state.setUser);
  const queryClient = useQueryClient();
  
  const [showEmail, setShowEmail] = useState(false);
  const [showId, setShowId] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isOwnProfile = !userId || userId === currentUser?.id;

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", isOwnProfile ? "me" : userId],
    queryFn: () => http.get<ProfileResponse>(isOwnProfile ? "/profiles/me" : `/profiles/${userId}`),
  });

  const headToHeadQuery = useQuery({
    queryKey: ["head-to-head", currentUser?.id, userId],
    queryFn: () => http.get<HeadToHeadResponse>(`/profiles/${currentUser?.id}/head-to-head/${userId}`),
    enabled: Boolean(currentUser?.id && userId && userId !== currentUser.id),
  });
 
  const getRankTitle = (rank: number | null | undefined) => {
    if (!rank) return 'Active Player';
    if (rank === 1) return 'World Champion';
    if (rank === 2) return 'Grand Challenger';
    if (rank === 3) return 'Elite Master';
    if (rank <= 5) return 'Top Tier Contender';
    if (rank <= 10) return 'Top 10 Global';
    if (rank <= 50) return 'Grandmaster';
    if (rank <= 100) return 'Master';
    return 'Active Player';
  };

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return http.post<UserProfile>("/identity/me/avatar", formData);
    },
    onSuccess: (updatedUser) => {
      setUploadError(null);
      if (currentUser) {
        setUser({ ...currentUser, ...updatedUser });
      }
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err: unknown) => { 
      let message = "Upload failed";
      if (err instanceof Error) message = err.message;
      setUploadError(message);
    },
  });

  const copyToClipboard = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch {
        console.error("Failed to copy");
      }
      document.body.removeChild(textArea);
    }
  };

  const handleAvatarSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setUploadError("File too large (max 2MB)");
      return;
    }

    try {
      await avatarMutation.mutateAsync(file);
    } catch (err) {
      console.error("Avatar upload process failed:", err);
    } finally {
      event.target.value = "";
    }
  };

  if (isLoading) return <div className="profile-loading"><Spinner size="lg" /></div>;
  if (!profile) return null;

  const totalGames = profile.games_played || 0;
  const hasPlayed = totalGames > 0;
  const winPrc = hasPlayed ? (profile.wins / totalGames) * 100 : 0;
  const drawPrc = hasPlayed ? (profile.draws / totalGames) * 100 : 0;
  const lossPrc = hasPlayed ? (profile.losses / totalGames) * 100 : 0;

  const currentAvatarUrl = isOwnProfile ? currentUser?.avatar_url : profile.avatar_url;

  const finalAvatarUrl = currentAvatarUrl 
    ? currentAvatarUrl.startsWith('http') 
      ? currentAvatarUrl 
      : `${SERVER_URL}${currentAvatarUrl.startsWith('/') ? '' : '/'}${currentAvatarUrl}`
    : null;

  return (
    <div className="profile-page-root">
     <header className="profile-nav">
        <div className="nav-container">
          <div className="brand" onClick={() => navigate("/")} style={{ cursor: 'pointer' }}>
            <Swords className="text-blue-500" />
            <span className="font-black tracking-tighter uppercase">ChessView</span>
          </div>
          <div className="nav-actions">
            <Button variant="ghost" className="text-neutral-400 hover:text-white" onClick={() => navigate("/")}>
              Dashboard
            </Button>
            <Button onClick={() => navigate("/lobby")} className="play-btn">
              <Play size={16} className="mr-2 fill-current" /> Play
            </Button>
            {isOwnProfile && (
              <Button variant="secondary" onClick={() => navigate("/settings")} className="border-white/5 bg-white/5">
                <Settings size={18} />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="profile-content">
        <div className="profile-container">
          <section className="profile-hero">
            <div className="hero-card-inner">
              <div className="avatar-section">
                <div className="avatar-container">
                  <Avatar 
                    username={profile.username} 
                    avatarUrl={finalAvatarUrl} 
                    className={`main-avatar shadow-2xl shadow-blue-500/20 ${avatarMutation.isPending ? 'opacity-50' : ''}`}
                  />
                  {isOwnProfile && (
                    <label className={`edit-overlay ${avatarMutation.isPending ? 'cursor-wait' : ''}`}>
                      {avatarMutation.isPending ? <Spinner size="sm" /> : <Camera size={20} />}
                      <input 
                        type="file" 
                        className="hidden" 
                        onChange={handleAvatarSelect} 
                        accept="image/*" 
                        disabled={avatarMutation.isPending}
                      />
                    </label>
                  )}
                </div>
                
                <div className="user-meta">
                  {isOwnProfile && (
                    <div className="tiny-id-wrapper">
                      <span className="id-label" onClick={() => setShowId(!showId)}>
                        {showId ? profile.id : `ID: ••••••••`}
                      </span>
                      {showId && (
                        <button className="copy-icon-btn" onClick={() => copyToClipboard(profile.id)}>
                          <Copy size={10} />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="name-group">
                    <h1>{profile.username}</h1>
                    <VerificationBadge 
                      rank={profile.global_rank} 
                      username={profile.username}
                      size={24} 
                    />
                    {profile.rating > 2000 && (
                      <Crown className="text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]" size={28} />
                    )}
                  </div>
                  
                  <p className="status-text">
                    <span className="online-indicator" /> Active Player • Member since {new Date(profile.created_at).getFullYear()}
                  </p>

                  {isOwnProfile && (
                    <div className="private-field email-field">
                      <div className="field-content" onClick={() => setShowEmail(!showEmail)}>
                        {showEmail ? <EyeOff size={12} /> : <Eye size={12} />}
                        <span>{showEmail ? currentUser?.email : "••••••••@••••.••"}</span>
                      </div>
                      {showEmail && (
                        <button className="copy-btn" onClick={() => copyToClipboard(currentUser?.email)}>
                          <Copy size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="hero-stats-row">
                <div className="hero-stat-box">
                  <span className="label">Rating</span>
                  <span className="value">{profile.rating}</span>
                  <div className="trend positive"><TrendingUp size={12} /></div>
                </div>

                <div className="hero-stat-box">
                  <span className="label">Global Rank</span>
                  <span className="value">#{profile.global_rank || "—"}</span>
                  <div className="trend">
                    {getRankTitle(profile.global_rank)}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="profile-details-grid">
            {headToHeadQuery.data && (
              <Card className="detail-card border-emerald-500/20 bg-emerald-600/5">
                <div className="card-header">
                  <Swords className="text-emerald-500" />
                  <h2>Head to Head</h2>
                </div>
                <div className="stats-list">
                  <div className="list-item">Games: <strong>{headToHeadQuery.data.total_games}</strong></div>
                  <div className="list-item">Wins: <strong>{headToHeadQuery.data.wins}</strong></div>
                  <div className="list-item">Draws: <strong>{headToHeadQuery.data.draws}</strong></div>
                  <div className="list-item">Losses: <strong>{headToHeadQuery.data.losses}</strong></div>
                  <div className="list-item">Avg moves: <strong>{headToHeadQuery.data.average_moves}</strong></div>
                </div>
              </Card>
            )}
            <Card className="detail-card main-stats-card bg-blue-600/5 border-blue-500/20">
              <div className="card-header">
                <Trophy className="text-blue-500" />
                <h2>Career Performance</h2>
              </div>
              
              <div className="winrate-display">
                <div className="circle-stat">
                  <svg viewBox="0 0 36 36" className="circular-chart blue">
                    <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    <path className="circle" strokeDasharray={`${profile.win_rate}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  </svg>
                  <div className="percentage">{profile.win_rate.toFixed(0)}%</div>
                </div>
                <div className="stats-list">
                  <div className="list-item"><span className="dot win" /> Wins: <strong>{profile.wins}</strong></div>
                  <div className="list-item"><span className="dot draw" /> Draws: <strong>{profile.draws}</strong></div>
                  <div className="list-item"><span className="dot loss" /> Losses: <strong>{profile.losses}</strong></div>
                </div>
              </div>

              <div className="progress-bar-container">
                <div className="labels">
                  <span>Win distribution</span>
                  <span>{totalGames} Total</span>
                </div>
                <div className="multi-progress">
                  <div className="segment win" style={{ width: `${winPrc}%` }} />
                  <div className="segment draw" style={{ width: `${drawPrc}%` }} />
                  <div className="segment loss" style={{ width: `${lossPrc}%` }} />
                </div>
              </div>
            </Card>

            <div className="side-cards-group">
              <Card className="detail-card promo-card bg-gradient-to-br from-blue-600/20 to-transparent">
                <div className="flex items-center gap-3 mb-4">
                   <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400"><BarChart3 size={20} /></div>
                   <h3 className="font-bold">Analysis Hub</h3>
                </div>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Deep-dive into your games with our engine analysis tool.
                </p>
                <Button className="w-full mt-4 bg-white/5 hover:bg-white/10" onClick={() => navigate("/analysis")}>
                  Launch Engine
                </Button>
              </Card>

              <div className="nav-grid">
                <button className="nav-tile" onClick={() => navigate("/history")}>
                  <History size={20} />
                  <span>Full History</span>
                  <ChevronRight size={14} className="opacity-30" />
                </button>
                <button className="nav-tile" onClick={() => navigate("/puzzles")}>
                  <Target size={20} />
                  <span>Tactics</span>
                  <ChevronRight size={14} className="opacity-30" />
                </button>
              </div>
            </div>
          </div>

          <section className="history-full-width">
            <div className="section-header">
              <div className="title-group">
                <Zap size={20} className="text-blue-500" />
                <h2>Recent Matches</h2>
              </div>
              <p className="text-sm text-neutral-500">Last 8 competitive games</p>
            </div>
            
            <Card className="history-table-wrapper border-white/5 bg-white/[0.01]">
              <HistoryTable 
                items={toHistoryItems(profile)} 
                isLoading={false} 
                title=""
              />
            </Card>
          </section>

          {(uploadError || avatarMutation.isError) && (
            <div className="error-alert mt-4 p-3 bg-red-500/10 text-red-500 rounded-lg flex items-center gap-2">
              <ShieldAlert size={16} /> {uploadError || "Upload failed"}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
