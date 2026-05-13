import { type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BarChart3, Brain, Crown, History, LayoutGrid, Shield, Swords, Trophy, Settings, Medal } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useMatchmakingStore } from "@/entities/matchmaking";
import { useUserStore } from "@/entities/user";
import { wsClient } from "@/shared/api";
import { Avatar, Button } from "@/shared/ui";

interface AppShellProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  maxWidthClassName?: string;
}

const navItems = [
  { to: "/", label: "Home", icon: LayoutGrid },
  { to: "/lobby", label: "Play", icon: Swords },
  { to: "/history", label: "History", icon: History },
  { to: "/analysis", label: "Study", icon: BarChart3 },
  { to: "/puzzles", label: "Puzzles", icon: Brain },
  { to: "/tournaments", label: "Tournaments", icon: Trophy },
  { to: "/profile", label: "Profile", icon: Shield },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/leaderboards", label: "Leaderboards", icon: Medal },
];

export function AppShell({
  eyebrow,
  title,
  description,
  actions,
  children,
  maxWidthClassName = "max-w-7xl",
}: AppShellProps) {
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
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
    <div className="relative min-h-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-96 w-96 rounded-full bg-emerald-500/6 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-amber-500/4 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-neutral-800/60 bg-neutral-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="flex items-center gap-2 transition hover:opacity-85">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-2">
                <Crown className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold tracking-[0.18em] text-neutral-400">CHESSVIEW</div>
                <div className="text-lg font-bold tracking-tight text-neutral-100">Competitive chess, built for review.</div>
              </div>
            </button>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <nav className="flex flex-wrap items-center gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-medium uppercase tracking-[0.18em] transition ${
                      isActive || (item.to !== "/" && location.pathname.startsWith(item.to))
                        ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                        : "border-neutral-800 bg-neutral-900/70 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                    }`
                  }
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-3 self-start lg:self-auto">
              {user ? (
                <button
                  onClick={() => navigate("/profile")}
                  className="flex items-center gap-3 rounded-full border border-neutral-800 bg-neutral-900/80 px-4 py-2 transition hover:border-neutral-700"
                >
                  <Avatar username={user.username} avatarUrl={user.avatar_url} size="sm" />
                  <div className="text-left">
                    <div className="text-sm font-medium text-neutral-100">{user.username}</div>
                    <div className="text-xs tabular-nums text-neutral-500">{user.rating} rapid</div>
                  </div>
                </button>
              ) : null}
              <Button variant="secondary" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <motion.main
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className={`relative z-10 mx-auto flex w-full flex-col gap-8 px-6 py-8 ${maxWidthClassName}`}
      >
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            {eyebrow ? (
              <div className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300/80">{eyebrow}</div>
            ) : null}
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-neutral-100">{title}</h1>
            {description ? <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div> : null}
        </section>

        {children}
      </motion.main>
    </div>
  );
}
