import { useEffect, useState } from "react";
import { Crown, ArrowLeft, Search, Loader2 } from "lucide-react";
import { useNavigate } from "react-router";
import { Card } from "@/shared/ui"; 
import { http } from "@/shared/api";
import { API_BASE_URL } from "@/shared/config";
import "../../pages-style/leaderboards-page/leaderboardspage.scss";

interface Leader {
  id: string;
  username: string;
  rating: number;
  wins: number;
  avatar_url: string | null;
  global_rank?: number;
}

interface LeaderboardResponse {
  data: Leader[];
}

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const getAvatarUrl = (path: string | null) => 
    path ? `${API_BASE_URL}${path}` : null;

  useEffect(() => {
    const fetchLeaders = async () => {
      try {
        const response = await http.get<Leader[] | LeaderboardResponse>("/profiles/leaderboard");
        
        let leadersArray: Leader[] = [];
        if (Array.isArray(response)) {
          leadersArray = response;
        } else if (response && typeof response === 'object' && 'data' in response) {
          leadersArray = response.data;
        }

        setLeaders([...leadersArray].sort((a, b) => b.rating - a.rating));
      } catch (error) {
        console.error("Failed to load leaderboard:", error);
        setLeaders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaders();
  }, []);

  const filteredLeaders = leaders.filter(l => 
    l.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const topThree = filteredLeaders.slice(0, 3);
  const remaining = filteredLeaders.slice(3);

  if (loading) {
    return (
      <div id="leaderboard-root" className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  return (
    <div id="leaderboard-root">
      <div className="leaderboard-container">
        <header className="leaderboard-header">
          <button onClick={() => navigate(-1)} className="back-btn">
            <ArrowLeft size={20} />
          </button>
          <div className="title-group">
            <h1>Rankings</h1>
            <p>Global Chess Ratings</p>
          </div>
          
          <div className="search-box">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              placeholder="Find player..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </header>

        {filteredLeaders.length > 0 && searchQuery === "" && (
          <div className="podium-section">
            {[1, 0, 2].map((idx) => { 
              const player = topThree[idx];
              if (!player) return <div key={idx} className="podium-item empty" />;
              
              const rank = idx === 0 ? 1 : idx === 1 ? 2 : 3;
              const avatar = getAvatarUrl(player.avatar_url);

              return (
                <div 
                  key={player.id} 
                  className={`podium-item rank-${rank}`}
                  onClick={() => navigate(`/profile/${player.id}`)}
                >
                  <div className="avatar-holder">
                    {avatar ? (
                      <img src={avatar} alt={player.username} className="avatar-img" />
                    ) : (
                      <div className="avatar-initial">{player.username[0]}</div>
                    )}
                    <div className="rank-crown">
                      {rank === 1 ? <Crown size={24} className="text-yellow-400" /> : <div className="rank-num">{rank}</div>}
                    </div>
                  </div>
                  <div className="podium-name">{player.username}</div>
                  <div className="podium-rating">{player.rating}</div>
                </div>
              );
            })}
          </div>
        )}

        <Card className="leader-table-card">
          <div className="table-row head">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Wins</span>
            <span className="text-right">ELO</span>
          </div>
          
          <div className="table-body">
            {(searchQuery !== "" ? filteredLeaders : remaining).map((player, i) => {
              const actualRank = searchQuery !== "" ? i + 1 : i + 4;
              const avatar = getAvatarUrl(player.avatar_url);

              return (
                <div 
                  key={player.id} 
                  className="table-row clickable"
                  onClick={() => navigate(`/profile/${player.id}`)}
                >
                  <span className="rank-col">{actualRank}</span>
                  <div className="player-col">
                    <div className="mini-ava">
                      {avatar ? <img src={avatar} alt="" /> : player.username[0]}
                    </div>
                    <span className="player-name">{player.username}</span>
                  </div>
                  <span className="wins-col text-right">{player.wins}</span>
                  <span className="rating-col text-right font-mono">{player.rating}</span>
                </div>
              );
            })}
            
            {filteredLeaders.length === 0 && (
              <div className="empty-state">No players found</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}