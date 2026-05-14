import { type FormEvent, useState, useEffect} from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import { 
  ShieldCheck, Swords, Video, Mail, Lock, 
  User, ArrowLeft
} from "lucide-react";
import { resolvePostAuthPath, withRedirectQuery } from "@/app/authRedirect";
import { useUserStore, type AuthenticatedUser } from "@/entities/user";
import { http, wsClient } from "@/shared/api";
import type { TokenResponse } from "@/shared/types";
import { API_BASE_URL } from "@/shared/config";
import { Button, Card, Input } from "@/shared/ui";
import "../../pages-style/auth-page/authpage.scss";
import logoImage from '../../assets/logo.jpeg';

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
    title: "Return to the Board",
    description: "Jump back into live games, reviews, and tournaments.",
  },
  {
    icon: Video,
    title: "Fair Live Matches",
    description: "Play rated games and join organized events.",
  },
  {
    icon: ShieldCheck,
    title: "One Chess Profile",
    description: "Keep ratings, history, and community activity together.",
  },
];

function getMode(pathname: string): AuthMode {
  return pathname.includes("register") ? "register" : "login";
}

async function resolveUser(accessToken: string): Promise<AuthenticatedUser> {
  const meResponse = await fetch(`${API_BASE_URL}/identity/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!meResponse.ok) throw new Error("Unable to load current user");
  return (await meResponse.json()) as AuthenticatedUser;
}

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = getMode(location.pathname);
  
  const { isAuthenticated, setAuth, hasHydrated } = useUserStore();
  
  const [form, setForm] = useState<AuthFormState>(initialFormState);
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = resolvePostAuthPath(searchParams.get("redirectTo"));

  useEffect(() => {
    const token = searchParams.get("access_token") || searchParams.get("token");
    const refresh = searchParams.get("refresh_token") || "";
    const oauthError = searchParams.get("error");

    if (oauthError) {
      setError(`Social Auth Failed: ${oauthError}`);
      setSearchParams({}, { replace: true });
      return;
    }

    if (token) {
      const handleOAuthFlow = async () => {
        setIsSubmitting(true);
        try {
          const user = await resolveUser(token);
          setAuth(user, token, refresh);
          
          navigate(redirectTo, { replace: true });
        } catch {
          // Исправлено: убрана неиспользуемая переменная 'err' (строка 94)
          setError("OAuth session initialization failed");
        } finally {
          setIsSubmitting(false);
        }
      };
      handleOAuthFlow();
    }
  }, [searchParams, setAuth, navigate, redirectTo, setSearchParams]);

  if (hasHydrated && isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const title = mode === "login" ? "Welcome Back" : "Create Account";
  const alternateHref = withRedirectQuery(mode === "login" ? "/register" : "/login", redirectTo);
  const alternateLabel = mode === "login" ? "New player? Create an account" : "Already have an account? Sign in";

  const handleChange = (field: keyof AuthFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleOAuth = (provider: string) => {
    const callbackUrl = `${window.location.origin}/login`;
    window.location.href = `${API_BASE_URL}/identity/auth/${provider}?redirectTo=${encodeURIComponent(callbackUrl)}`;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      wsClient.disconnect();
      const payload = mode === "register" ? { ...form } : { email: form.email, password: form.password };
      const endpoint = mode === "register" ? "/identity/register" : "/identity/login";
      
      const response = await http.post<TokenResponse>(endpoint, payload);
      const user = response.user ? response.user : await resolveUser(response.access_token);
      
      setAuth(user, response.access_token, response.refresh_token);
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      let message = "Authentication failed";
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        message = axiosErr.response?.data?.message || message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page-root">
      <div className="auth-visual-layer">
        <div className="aurora-1" />
        <div className="aurora-2" />
      </div>

      <div className="auth-layout">
        <div className="sidebar-content">
          <div className="top-section">
            <Link to="/" className="nav-back">
              <ArrowLeft size={16} />
              Back to site
            </Link>

            <div className="brand-section">
                <div className="logo-box">
                  <img 
        src={logoImage} 
        alt="ChessView Logo" 
        className="logo-img" 
      />
                </div>
              <span className="brand-name">ChessView</span>
            </div>
            
            <h1 className="hero-title">
              {mode === "login" ? (
                <>Elevate Your <span>Game</span>.</>
              ) : (
                <>Master The <span>Board</span>.</>
              )}
            </h1>
            <p className="hero-desc">
              Play online, join tournaments, review your games, and improve your rating.
            </p>
          </div>

          <div className="feature-grid">
            {authHighlights.map((item) => (
              <div key={item.title} className="feature-item">
                <div className="icon-box">
                  <item.icon size={20} />
                </div>
                <div className="text-wrap">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="form-container">
          <Card className="auth-card">
            <div className="card-header">
              <h2>{title}</h2>
              <p>Continue with Google or email</p>
            </div>

            <div className="oauth-group">
              <button 
                type="button" 
                onClick={() => handleOAuth('google')} 
                className="oauth-btn"
                disabled={isSubmitting}
                aria-label="Continue with Google"
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" />
                <span>Continue with Google</span>
              </button>
            </div>

            <div className="divider">
              <span>Or use email</span>
            </div>

            <form onSubmit={handleSubmit}>
              {mode === "register" && (
                <div className="input-group">
                  <label><User size={12} /> Username</label>
                  <Input
                    placeholder="Username"
                    value={form.username}
                    onChange={(e) => handleChange("username", e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="input-group">
                <label><Mail size={12} /> Email Address</label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label><Lock size={12} /> Password</label>
                <Input
                  type="password"
                  placeholder="        "
                  value={form.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  required
                />
              </div>

              {error && <div className="error-msg">{error}</div>}

              <Button 
                type="submit" 
                className="submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Processing..." : mode === "login" ? "Sign In" : "Get Started"}
              </Button>
            </form>

            <div className="footer-link">
              <Link to={alternateHref}>
                {alternateLabel}
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
