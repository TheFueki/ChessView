import { type ReactNode, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  Brain,
  CalendarClock,
  ClipboardList,
  History,
  LayoutGrid,
  LogOut,
  Medal,
  Menu,
  Settings,
  ShoppingBag,
  Swords,
  Trophy,
  X,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useMatchmakingStore } from "@/entities/matchmaking";
import { useUserStore } from "@/entities/user";
import { wsClient } from "@/shared/api";
import { LanguageSwitcher, useI18n } from "@/shared/i18n";
import { beginLogoutRedirect } from "@/shared/lib/authRedirect";
import { Avatar, Button } from "@/shared/ui";
import logoImage from "../../assets/logo.jpeg";

interface AppShellProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  maxWidthClassName?: string;
}

const navGroups = [
  {
    labelKey: "shell.groups.main",
    items: [
      { to: "/", labelKey: "shell.nav.home", icon: LayoutGrid },
      { to: "/lobby", labelKey: "shell.nav.play", icon: Swords },
      { to: "/tournaments", labelKey: "shell.nav.tournaments", icon: Trophy },
      { to: "/scheduled-matches", labelKey: "shell.nav.matches", icon: CalendarClock },
      { to: "/otb", labelKey: "shell.nav.otb", icon: ClipboardList },
    ],
  },
  {
    labelKey: "shell.groups.improve",
    items: [
      { to: "/analysis", labelKey: "shell.nav.study", icon: BarChart3 },
      { to: "/puzzles", labelKey: "shell.nav.puzzles", icon: Brain },
      { to: "/history", labelKey: "shell.nav.history", icon: History },
    ],
  },
  {
    labelKey: "shell.groups.community",
    items: [
      { to: "/leaderboard", labelKey: "shell.nav.leaderboards", icon: Medal },
      { to: "/compare", labelKey: "shell.nav.compare", icon: Swords },
      { to: "/shop", labelKey: "shell.nav.market", icon: ShoppingBag },
    ],
  },
];

export function AppShell({
  eyebrow,
  title,
  description,
  actions,
  children,
  maxWidthClassName = "max-w-6xl",
}: AppShellProps) {
  const prefersReducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const [isNavOpen, setIsNavOpen] = useState(false);
  const user = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);
  const resetMatchmaking = useMatchmakingStore((state) => state.reset);
  const { t } = useI18n();

  const handleLogout = () => {
    setIsNavOpen(false);
    beginLogoutRedirect();
    wsClient.disconnect();
    resetMatchmaking();
    logout();
    navigate("/", { replace: true });
  };

  const isActivePath = (to: string) => location.pathname === to || (to !== "/" && location.pathname.startsWith(to));

  const brand = (
    <button onClick={() => navigate("/")} className="flex items-center gap-3 text-left transition hover:opacity-85">
      <img src={logoImage} alt="ChessView" className="h-11 w-11 rounded-md border border-neutral-800 object-cover" />
      <div>
        <div className="text-sm font-semibold text-neutral-100">{t("common.brand")}</div>
        <div className="text-xs text-neutral-500">{t("shell.tagline")}</div>
      </div>
    </button>
  );

  const navigation = (
    <nav className="grid gap-5">
      {navGroups.map((group) => (
        <div key={group.labelKey} className="grid gap-2">
          <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-600">{t(group.labelKey)}</div>
          <div className="grid gap-1">
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setIsNavOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                    isActive || isActivePath(item.to)
                      ? "border-l-[3px] border-l-[var(--color-accent)] bg-neutral-900 pl-[9px] text-neutral-100 ring-1 ring-neutral-800"
                      : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {t(item.labelKey)}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  const userControls = user ? (
    <div className="grid gap-2">
      <button
        onClick={() => {
          setIsNavOpen(false);
          navigate("/profile");
        }}
        className="flex items-center gap-3 rounded-md border border-neutral-800 bg-neutral-900/70 px-3 py-2 transition hover:border-neutral-700"
      >
        <Avatar username={user.username} avatarUrl={user.avatar_url} size="sm" />
        <div className="min-w-0 text-left">
          <div className="truncate text-sm font-medium text-neutral-100">{user.username}</div>
          <div className="text-xs tabular-nums text-neutral-500">{user.rating} {t("common.rapid")}</div>
        </div>
      </button>
      <LanguageSwitcher />
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setIsNavOpen(false);
            navigate("/settings");
          }}
        >
          <Settings className="h-4 w-4" />
          {t("common.settings")}
        </Button>
        <Button variant="secondary" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          {t("common.logout")}
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-neutral-950 text-neutral-100 lg:pl-72">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-neutral-800 bg-neutral-950 px-5 py-5 lg:flex lg:flex-col">
        <div className="pb-5">{brand}</div>
        <div className="min-h-0 flex-1 overflow-y-auto py-2 pr-1">{navigation}</div>
        {userControls ? <div className="border-t border-neutral-800 pt-4">{userControls}</div> : null}
      </aside>

      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          {brand}
          <Button variant="secondary" size="sm" onClick={() => setIsNavOpen(true)} aria-label={t("shell.openNavigation")}>
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {isNavOpen ? (
        <div className="fixed inset-0 z-40 bg-black/70 lg:hidden">
          <div className="flex h-full w-[min(22rem,calc(100vw-2rem))] flex-col border-r border-neutral-800 bg-neutral-950 px-5 py-5 shadow-2xl">
            <div className="flex items-center justify-between pb-5">
              {brand}
              <Button variant="secondary" size="sm" onClick={() => setIsNavOpen(false)} aria-label={t("shell.closeNavigation")}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-2 pr-1">{navigation}</div>
            {userControls ? <div className="border-t border-neutral-800 pt-4">{userControls}</div> : null}
          </div>
        </div>
      ) : null}

      <motion.main
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
        className={`relative z-10 mx-auto flex w-full flex-col gap-8 px-6 py-8 ${maxWidthClassName}`}
      >
        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            {eyebrow ? (
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{eyebrow}</div>
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
