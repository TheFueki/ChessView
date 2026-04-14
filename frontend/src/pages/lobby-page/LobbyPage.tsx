import { Crown } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useMatchmakingStore } from "@/entities/matchmaking";
import { useUserStore } from "@/entities/user";
import { useLobbyMatchmakingRealtime } from "@/features/join-matchmaking";
import { wsClient } from "@/shared/api";
import { Button } from "@/shared/ui";
import { MatchmakingPanel } from "@/widgets/matchmaking-panel";

export default function LobbyPage() {
  useLobbyMatchmakingRealtime();

  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);
  const resetMatchmaking = useMatchmakingStore((state) => state.reset);

  const handleLogout = () => {
    wsClient.disconnect();
    resetMatchmaking();
    logout();
    navigate("/", { replace: true });
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-neutral-950">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-emerald-500/5 blur-3xl" />
        <div className="absolute -right-16 bottom-1/4 h-64 w-64 rounded-full bg-emerald-600/4 blur-3xl" />
      </div>

      <nav className="relative z-10 flex items-center justify-between border-b border-neutral-800/50 px-8 py-4">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 transition hover:opacity-80">
          <Crown className="h-5 w-5 text-emerald-500" />
          <span className="font-bold tracking-tight text-neutral-100">ChessView</span>
        </button>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            Home
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/analysis")}>
            Analysis
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/tournaments")}>
            Tournaments
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>
            History
          </Button>
          {user ? (
            <Link to="/profile" className="flex items-center gap-2.5 rounded-full border border-neutral-800 bg-neutral-900/70 px-4 py-2 text-sm transition hover:border-neutral-700">
              <span className="font-medium text-neutral-100">{user.username}</span>
              <span className="h-1 w-1 rounded-full bg-neutral-600" />
              <span className="tabular-nums text-neutral-400">{user.rating}</span>
            </Link>
          ) : null}
          <Button variant="secondary" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </nav>

      <main className="relative z-10 flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-100">Game Lobby</h1>
            <p className="mt-1.5 text-sm text-neutral-500">Find an opponent and start a match</p>
          </div>
          <MatchmakingPanel />
        </div>
      </main>
    </div>
  );
}
