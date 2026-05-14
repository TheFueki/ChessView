import { type FormEvent, type ReactNode, Suspense, useEffect, useState } from "react";
import { BrowserRouter } from "react-router";
import { AppErrorBoundary } from "@/app/AppErrorBoundary";
import { Providers } from "@/app/providers";
import "@/app/styles/globals.css";
import { useUserStore } from "@/entities/user";
import { http } from "@/shared/api";
import type { TokenResponse } from "@/shared/types";
import { Button, Card, Input } from "@/shared/ui";
import AdminPage from "./AdminPage";

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center gap-3 bg-neutral-950 text-sm text-neutral-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-500 border-t-transparent" />
      Loading admin workspace
    </div>
  );
}

function AdminAccessCard({ title, message, children }: { title: string; message: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-neutral-100">
      <Card className="w-full max-w-md space-y-5 p-8 text-center">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">ChessView Admin</div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100">{title}</h1>
          <p className="text-sm leading-6 text-neutral-400">{message}</p>
        </div>
        {children}
      </Card>
    </div>
  );
}

function AdminLoginForm() {
  const setAuth = useUserStore((state) => state.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await http.post<TokenResponse>("/identity/login", { email, password });
      if (!response.user || response.user.role !== "admin") {
        setError("This account does not have admin access.");
        return;
      }
      setAuth(response.user, response.access_token, response.refresh_token);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Admin login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 text-left">
      <label className="grid gap-2 text-sm text-neutral-300">
        Email
        <Input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          autoComplete="email"
          placeholder="admin@example.com"
        />
      </label>
      <label className="grid gap-2 text-sm text-neutral-300">
        Password
        <Input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="current-password"
          placeholder="Password"
        />
      </label>
      {error ? <div className="rounded-md border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-300">{error}</div> : null}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in to Admin"}
      </Button>
    </form>
  );
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const hasHydrated = useUserStore((state) => state.hasHydrated);
  const isBootstrapping = useUserStore((state) => state.isBootstrapping);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const user = useUserStore((state) => state.user);
  const setHydrated = useUserStore((state) => state.setHydrated);

  useEffect(() => {
    if (hasHydrated) {
      return;
    }

    const hydrationFallback = window.setTimeout(() => {
      setHydrated(true);
    }, 300);

    return () => window.clearTimeout(hydrationFallback);
  }, [hasHydrated, setHydrated]);

  if (!hasHydrated || isBootstrapping) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return (
      <AdminAccessCard title="Admin sign in" message="Use an administrator account for this separated workspace.">
        <AdminLoginForm />
      </AdminAccessCard>
    );
  }

  if (user?.role !== "admin") {
    return <AdminAccessCard title="Admin access required" message="This workspace is limited to ChessView administrators." />;
  }

  return children;
}

export default function AdminApp() {
  return (
    <Providers>
      <AppErrorBoundary>
        <BrowserRouter>
          <Suspense fallback={<LoadingScreen />}>
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          </Suspense>
        </BrowserRouter>
      </AppErrorBoundary>
    </Providers>
  );
}
