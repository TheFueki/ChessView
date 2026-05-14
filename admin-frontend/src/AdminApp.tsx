import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AdminPage from "./AdminPage";
import "./styles.css";

const AUTH_STORAGE_KEY = "chessview-admin-auth";
const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? "http://localhost:8000";
export const API_BASE_URL = `${SERVER_URL}/api/v1`;

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  rating: number;
  role?: "user" | "admin";
  banned_at?: string | null;
  created_at: string;
}

interface TokenResponse {
  user: AdminUser;
  access_token: string;
  refresh_token: string;
}

export interface AdminSession {
  user: AdminUser;
  accessToken: string;
  refreshToken: string;
}

function readStoredSession(): AdminSession | null {
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

async function postJson<TResponse>(path: string, body: unknown, token?: string): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

export async function adminGet<TResponse>(path: string, token: string): Promise<TResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

export async function adminPost<TResponse>(path: string, token: string): Promise<TResponse> {
  return postJson<TResponse>(path, {}, token);
}

export function AdminButton({
  children,
  className = "",
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const variantClass =
    variant === "danger"
      ? "border-red-500/30 bg-red-600/20 text-red-300 hover:bg-red-600/30"
      : variant === "secondary"
        ? "border-neutral-700 bg-neutral-900 text-neutral-100 hover:bg-neutral-800"
        : "border-neutral-300 bg-neutral-100 text-neutral-950 hover:bg-white";

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variantClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-neutral-800 bg-neutral-900/80 p-6 ${className}`}>{children}</section>;
}

export function AdminSpinner() {
  return <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-600 border-t-neutral-200" />;
}

function AdminAccessCard({ title, message, children }: { title: string; message: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-6 text-neutral-100">
      <AdminCard className="w-full max-w-md space-y-5 text-center">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">ChessView Admin</div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100">{title}</h1>
          <p className="text-sm leading-6 text-neutral-400">{message}</p>
        </div>
        {children}
      </AdminCard>
    </div>
  );
}

function AdminLoginForm({ onLogin }: { onLogin: (session: AdminSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await postJson<TokenResponse>("/identity/login", { email, password });
      if (!response.user || response.user.role !== "admin") {
        setError("This account does not have admin access.");
        return;
      }

      const nextSession = {
        user: response.user,
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
      };
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
      onLogin(nextSession);
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
        <input
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-400"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          autoComplete="email"
          placeholder="admin@example.com"
        />
      </label>
      <label className="grid gap-2 text-sm text-neutral-300">
        Password
        <input
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-4 py-2.5 text-sm text-neutral-100 outline-none focus:border-neutral-400"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          type="password"
          autoComplete="current-password"
          placeholder="Password"
        />
      </label>
      {error ? <div className="rounded-md border border-red-500/30 bg-red-950/20 p-3 text-sm text-red-300">{error}</div> : null}
      <AdminButton type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Sign in to Admin"}
      </AdminButton>
    </form>
  );
}

export default function AdminApp() {
  const [session, setSession] = useState<AdminSession | null>(() => readStoredSession());
  const queryClient = useMemo(() => new QueryClient(), []);

  const logout = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setSession(null);
  };

  if (!session) {
    return (
      <AdminAccessCard title="Admin sign in" message="Use an administrator account for this separated workspace.">
        <AdminLoginForm onLogin={setSession} />
      </AdminAccessCard>
    );
  }

  if (session.user.role !== "admin") {
    return <AdminAccessCard title="Admin access required" message="This workspace is limited to ChessView administrators." />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AdminPage session={session} onLogout={logout} />
    </QueryClientProvider>
  );
}
