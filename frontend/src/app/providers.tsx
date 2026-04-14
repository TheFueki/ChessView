/**
 * App-level providers.
 *
 * Wraps the application with:
 * - TanStack QueryClientProvider (server state)
 * - Any future context providers (auth, theme, etc.)
 *
 * FSD layer: app
 * May import: shared
 */

import { type ReactNode, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUserStore } from "@/entities/user";
import { http } from "@/shared/api";
import type { UserProfile } from "@/shared/types";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

interface ProvidersProps {
  children: ReactNode;
}

function AuthBootstrap({ children }: ProvidersProps) {
  const accessToken = useUserStore((state) => state.accessToken);
  const hasHydrated = useUserStore((state) => state.hasHydrated);
  const setUser = useUserStore((state) => state.setUser);
  const clearAuth = useUserStore((state) => state.clearAuth);
  const setBootstrapping = useUserStore((state) => state.setBootstrapping);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!accessToken) {
      setBootstrapping(false);
      return;
    }

    let isDisposed = false;
    setBootstrapping(true);

    http
      .get<UserProfile>("/identity/me")
      .then((profile) => {
        if (isDisposed) {
          return;
        }

        setUser(profile);
        setBootstrapping(false);
      })
      .catch(() => {
        if (isDisposed) {
          return;
        }

        clearAuth();
      });

    return () => {
      isDisposed = true;
    };
  }, [accessToken, clearAuth, hasHydrated, setBootstrapping, setUser]);

  return <>{children}</>;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>{children}</AuthBootstrap>
    </QueryClientProvider>
  );
}
