import { useUserStore } from "@/entities/user";
import DashboardPage from "@/pages/dashboard-page/DashboardPage";
import LandingPage from "@/pages/landing-page/LandingPage";

export default function HomeRoute() {
  const hasHydrated = useUserStore((state) => state.hasHydrated);
  const isBootstrapping = useUserStore((state) => state.isBootstrapping);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);

  if (!hasHydrated || isBootstrapping) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
      </div>
    );
  }

  return isAuthenticated ? <DashboardPage /> : <LandingPage />;
}
