import { type FormEvent, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import { Crown, ShieldCheck, Swords, Video } from "lucide-react";
import { resolvePostAuthPath, withRedirectQuery } from "@/app/authRedirect";
import { useUserStore, type AuthenticatedUser } from "@/entities/user";
import { http, wsClient } from "@/shared/api";
import type { TokenResponse, UserProfile } from "@/shared/types";
import { API_BASE_URL } from "@/shared/config";
import { Button, Card, Input } from "@/shared/ui";

type AuthMode = "login" | "register";

interface AuthFormState {
  username: string;
  email: string;
  password: string;
}

const initialFormState: AuthFormState = {
  username: "",
  email: "",
  password: "",
};

const authHighlights = [
  {
    icon: Swords,
    title: "Intent-Preserving Sign-In",
    description: "Return to your dashboard, active board, or requested study page without losing context.",
  },
  {
    icon: Video,
    title: "Webcam-Ready Matches",
    description: "The same account unlocks live play, replay, analysis, tournaments, and puzzles across the product shell.",
  },
  {
    icon: ShieldCheck,
    title: "Real Backend Session",
    description: "Uses the actual JWT and current-user endpoints already in the API.",
  },
];

function getMode(pathname: string): AuthMode {
  return pathname.includes("register") ? "register" : "login";
}

async function resolveUser(response: TokenResponse): Promise<AuthenticatedUser> {
  if (response.user) {
    return response.user as AuthenticatedUser;
  }

  const meResponse = await fetch(`${API_BASE_URL}/identity/me`, {
    headers: {
      Authorization: `Bearer ${response.access_token}`,
    },
  });

  if (!meResponse.ok) {
    throw new Error("Unable to load current user");
  }

  return (await meResponse.json()) as UserProfile;
}

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const mode = getMode(location.pathname);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const setAuth = useUserStore((state) => state.setAuth);
  const [form, setForm] = useState<AuthFormState>(initialFormState);
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = resolvePostAuthPath(searchParams.get("redirectTo"));

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const title = mode === "login" ? "Welcome Back" : "Create Your Account";
  const description =
    mode === "login"
      ? "Sign in with your ChessView account and head back to your dashboard or requested page."
      : "Register once and land inside the full ChessView workspace with the same real backend session.";
  const submitLabel = mode === "login" ? "Login" : "Create Account";
  const alternateHref = withRedirectQuery(mode === "login" ? "/register" : "/login", redirectTo);
  const alternateLabel = mode === "login" ? "Need an account? Register" : "Already have an account? Login";

  const handleChange = (field: keyof AuthFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      wsClient.disconnect();

      const payload =
        mode === "register"
          ? {
              username: form.username.trim(),
              email: form.email.trim(),
              password: form.password,
            }
          : {
              email: form.email.trim(),
              password: form.password,
            };

      const endpoint = mode === "register" ? "/identity/register" : "/identity/login";
      const response = await http.post<TokenResponse>(endpoint, payload);
      const user = await resolveUser(response);
      setAuth(user, response.access_token, response.refresh_token);
      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-6rem] h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-4rem] h-96 w-96 rounded-full bg-emerald-700/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 lg:flex-row lg:items-center lg:gap-12">
        <div className="flex flex-1 flex-col justify-center">
          <Link to="/" className="mb-10 inline-flex items-center gap-2 text-sm text-neutral-300 transition hover:text-white">
            <Crown className="h-5 w-5 text-emerald-500" />
            <span className="font-semibold tracking-tight">ChessView</span>
          </Link>

          <div className="max-w-xl">
            <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.24em] text-emerald-300">
              Demo Auth Flow
            </span>
            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl">
              {mode === "login" ? "Get Back on the Board" : "Start the Match in Seconds"}
            </h1>
            <p className="mt-5 text-base leading-7 text-neutral-400 sm:text-lg">
              {description}
            </p>
          </div>

          <div className="mt-10 grid gap-4">
            {authHighlights.map((item) => (
              <Card key={item.title} className="border-neutral-800/80 bg-neutral-900/60 p-5">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-100">{item.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-neutral-400">{item.description}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-12 flex w-full max-w-md flex-1 justify-center lg:mt-0">
          <Card className="w-full border-neutral-800/90 bg-neutral-900/85 p-8 shadow-2xl shadow-black/30">
            <div className="mb-6 flex rounded-xl border border-neutral-800 bg-neutral-950/80 p-1">
              <button
                type="button"
                onClick={() => navigate(withRedirectQuery("/login", redirectTo))}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mode === "login"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => navigate(withRedirectQuery("/register", redirectTo))}
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                  mode === "register"
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                Register
              </button>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">{description}</p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "register" && (
                <Input
                  label="Username"
                  placeholder="alice"
                  value={form.username}
                  onChange={(event) => handleChange("username", event.target.value)}
                  minLength={3}
                  maxLength={32}
                  required
                />
              )}

              <Input
                label="Email"
                type="email"
                placeholder="alice@example.com"
                value={form.email}
                onChange={(event) => handleChange("email", event.target.value)}
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={(event) => handleChange("password", event.target.value)}
                minLength={6}
                required
              />

              {error ? (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              ) : null}

              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Please wait..." : submitLabel}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-neutral-400">
              <Link to={alternateHref} className="font-medium text-emerald-300 transition hover:text-emerald-200">
                {alternateLabel}
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
