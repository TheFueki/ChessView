import { 
  Clock3, 
  Trophy, 
  TrendingUp, 
  ArrowUpRight,
  Swords
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { http } from "@/shared/api";
import type { ProfileResponse } from "@/shared/types";
import { Button, Card, Spinner } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { HistoryTable } from "@/widgets/history-table";

interface HistoryPageProps {
  isModal?: boolean;
  onClose?: () => void;
}

function formatLastSeen(value: string | null) {
  if (!value) return "No games yet";
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage({ isModal, onClose }: HistoryPageProps) {
  const navigate = useNavigate();

  const profileQuery = useQuery({
    queryKey: ["history-profile"],
    queryFn: () => http.get<ProfileResponse>("/profiles/me"),
  });

  const profile = profileQuery.data ?? null;

  const content = (
    <div className={`history-content-wrapper ${isModal ? "p-0" : "p-0"}`}>
      <section className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card className="play-card p-5 border-neutral-800/50 bg-neutral-900/40 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Trophy className="h-5 w-5 text-yellow-500" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Global Rating</span>
          </div>
          {profileQuery.isLoading ? (
            <Spinner size="sm" />
          ) : (
            <div>
              <div className="text-3xl font-bold tabular-nums text-neutral-100">
                {profile?.rating ?? "--"}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">Blitz Elo Rating</p>
            </div>
          )}
        </Card>

        <Card className="play-card p-5 border-neutral-800/50 bg-neutral-900/40 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-green-500/10">
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Performance</span>
          </div>
          {profileQuery.isLoading ? (
            <Spinner size="sm" />
          ) : (
            <div>
              <div className="text-3xl font-bold text-neutral-100 tabular-nums">
                {profile ? `${profile.wins}-${profile.losses}-${profile.draws}` : "--"}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">W / L / D Distribution</p>
            </div>
          )}
        </Card>

        <Card className="play-card p-5 border-neutral-800/50 bg-neutral-900/40 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Clock3 className="h-5 w-5 text-blue-400" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Last Activity</span>
          </div>
          {profileQuery.isLoading ? (
            <Spinner size="sm" />
          ) : (
            <div>
              <div className="text-xl font-bold text-neutral-100 truncate">
                {formatLastSeen(profile?.recent_games?.[0]?.ended_at ?? null)}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">Latest session completion</p>
            </div>
          )}
        </Card>
      </section>

      <div className="recent-section !p-0">
        <div className="section-title !mb-4">
           <h3>Match Archive</h3>
        </div>
        <div className="rounded-2xl border border-neutral-800/50 bg-neutral-900/20 overflow-hidden backdrop-blur-sm">
          <HistoryTable
            title=""
            description=""
          />
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
        <div 
          className="absolute inset-0 -z-10" 
          onClick={onClose} 
        />
        
        <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col bg-[#0a0a0a] border border-neutral-800 shadow-2xl rounded-[2rem]">
          <header className="flex items-center justify-between px-8 py-6 border-b border-neutral-800/50 bg-neutral-900/10">
            <div className="flex items-center gap-4">
              <div className="logo-box !bg-blue-500/10">
                <Swords className="text-blue-400" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-neutral-100 tracking-tight">Game History</h2>
                <div className="server-badge !mt-0.5">
                   <span className="pulse-dot" /> Live Database
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={onClose} className="hover:bg-neutral-800/50 rounded-xl text-neutral-400">
                Close (Esc)
              </Button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      eyebrow="Archive"
      title="History"
      description="Review your past performances and tactical patterns."
      actions={
        <Button onClick={() => navigate("/analysis")} className="btn-main">
          <ArrowUpRight className="mr-2" size={18} /> Analysis Hub
        </Button>
      }
      maxWidthClassName="max-w-7xl"
    >
      {content}
    </AppShell>
  );
}