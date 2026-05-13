/**
 * Application router.
 *
 * Central route definitions for all pages.
 * Pages are lazy-loaded for code splitting.
 *
 * FSD layer: app
 * May import: pages, shared
 */

import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from "react-router";
import { useUserStore } from "@/entities/user";
import { buildAuthRedirectPath, resolvePostAuthPath } from "./authRedirect";
import HomeRoute from "./HomeRoute";
import RouteErrorPage from "./RouteErrorPage";

const AuthPage = lazy(() => import("@/pages/auth-page/AuthPage"));
const AnalysisPage = lazy(() => import("@/pages/analysis-page/AnalysisPage"));
const LobbyPage = lazy(() => import("@/pages/lobby-page/LobbyPage"));
const GamePage = lazy(() => import("@/pages/game-page/GamePage"));
const SettingsPage = lazy(() => import("@/pages/settings-page/SettingsPage"));
const HistoryPage = lazy(() => import("@/pages/history-page/HistoryPage"));
const LeaderboardPage = lazy(() => import("@/pages/leaderboard-page/LeaderboardPage"));
const GameReviewPage = lazy(() => import("@/pages/game-review-page/GameReviewPage"));
const PuzzlePage = lazy(() => import("@/pages/puzzle-page/PuzzlePage"));
const ProfilePage = lazy(() => import("@/pages/profile-page/ProfilePage"));
const TournamentsPage = lazy(() => import("@/pages/tournaments-page/TournamentsPage"));
const TournamentDetailPage = lazy(() => import("@/pages/tournament-detail-page/TournamentDetailPage"));
const ShopPage = lazy(() => import("@/pages/shop-page/ShopPage"));
const ClubsPage = lazy(() => import("@/pages/clubs-page/ClubsPage"));
const routeErrorElement = <RouteErrorPage />;

function SuspenseWrapper({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-neutral-950">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const hasHydrated = useUserStore((state) => state.hasHydrated);
  const isBootstrapping = useUserStore((state) => state.isBootstrapping);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);

  if (!hasHydrated || isBootstrapping) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to={buildAuthRedirectPath(location)} replace />;
}

function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const location = useLocation();
  const hasHydrated = useUserStore((state) => state.hasHydrated);
  const isBootstrapping = useUserStore((state) => state.isBootstrapping);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);

  if (!hasHydrated || isBootstrapping) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const redirectTo = resolvePostAuthPath(new URLSearchParams(location.search).get("redirectTo"));
  return isAuthenticated ? <Navigate to={redirectTo} replace /> : children;
}

const router = createBrowserRouter([
  {
    path: "/",
    errorElement: routeErrorElement,
    element: (
      <SuspenseWrapper>
        <HomeRoute />
      </SuspenseWrapper>
    ),
  },
  {
    path: "/login",
    errorElement: routeErrorElement,
    element: (
      <SuspenseWrapper>
        <RedirectIfAuthenticated>
          <AuthPage />
        </RedirectIfAuthenticated>
      </SuspenseWrapper>
    ),
  },
  {
    path: "/register",
    errorElement: routeErrorElement,
    element: (
      <SuspenseWrapper>
        <RedirectIfAuthenticated>
          <AuthPage />
        </RedirectIfAuthenticated>
      </SuspenseWrapper>
    ),
  },
  {
    path: "/settings",
    errorElement: routeErrorElement,
    element: (
      <SuspenseWrapper>
        <RequireAuth>
          <SettingsPage />
        </RequireAuth>
      </SuspenseWrapper>
    ),
  },
  {
    path: "/leaderboard",
    errorElement: routeErrorElement,
    element: (
      <SuspenseWrapper>
        <RequireAuth>
          <LeaderboardPage />
        </RequireAuth>
      </SuspenseWrapper>
    ),
  },
  {
    path: "/lobby",
    errorElement: routeErrorElement,
    element: (
      <SuspenseWrapper>
        <RequireAuth>
          <LobbyPage />
        </RequireAuth>
      </SuspenseWrapper>
    ),
  },
  {
    path: "/game/:gameId",
    errorElement: routeErrorElement,
    element: (
      <SuspenseWrapper>
        <RequireAuth>
          <GamePage />
        </RequireAuth>
      </SuspenseWrapper>
    ),
  },
  {
    path: "/analysis",
    errorElement: routeErrorElement,
    element: (
      <SuspenseWrapper>
        <RequireAuth>
          <AnalysisPage />
        </RequireAuth>
      </SuspenseWrapper>
    ),
  },
  {
    path: "/puzzles",
    errorElement: routeErrorElement,
    element: (
      <SuspenseWrapper>
        <RequireAuth>
          <PuzzlePage />
        </RequireAuth>
      </SuspenseWrapper>
    ),
  },
  {
    path: "/puzzles/:puzzleId",
    errorElement: routeErrorElement,
    element: (
      <SuspenseWrapper>
        <RequireAuth>
          <PuzzlePage />
        </RequireAuth>
      </SuspenseWrapper>
    ),
  },
  {
    path: "/history",
    errorElement: routeErrorElement,
    element: (
      <SuspenseWrapper>
        <RequireAuth>
          <HistoryPage />
        </RequireAuth>
      </SuspenseWrapper>
    ),
  },
  {
    path: "/tournaments",
    errorElement: routeErrorElement,
    element: (
      <SuspenseWrapper>
        <RequireAuth>
          <TournamentsPage />
        </RequireAuth>
      </SuspenseWrapper>
    ),
  },
  {
    path: "/tournaments/:tournamentId",
    errorElement: routeErrorElement,
    element: (
      <SuspenseWrapper>
        <RequireAuth>
          <TournamentDetailPage />
        </RequireAuth>
      </SuspenseWrapper>
    ),
  },
  {
    path: "/games/:gameId",
    errorElement: routeErrorElement,
    element: (
      <SuspenseWrapper>
        <RequireAuth>
          <GameReviewPage />
        </RequireAuth>
      </SuspenseWrapper>
    ),
  },
  {
    path: "/shop",
    errorElement: routeErrorElement,
    element: (
      <SuspenseWrapper>
        <RequireAuth>
          <ShopPage />
        </RequireAuth>
      </SuspenseWrapper>
    ),
  },
  {
    path: "/clubs",
    errorElement: routeErrorElement,
    element: (
      <SuspenseWrapper>
        <RequireAuth>
          <ClubsPage />
        </RequireAuth>
      </SuspenseWrapper>
    ),
  },
  {
    path: "/profile",
    errorElement: routeErrorElement,
    element: (
      <SuspenseWrapper>
        <RequireAuth>
          <ProfilePage />
        </RequireAuth>
      </SuspenseWrapper>
    ),
  },
  {
    path: "/players/:userId",
    errorElement: routeErrorElement,
    element: (
      <SuspenseWrapper>
        <RequireAuth>
          <ProfilePage />
        </RequireAuth>
      </SuspenseWrapper>
    ),
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
