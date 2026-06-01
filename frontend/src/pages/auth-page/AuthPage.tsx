import { type FormEvent, useState, useEffect} from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router";
import { 
  ShieldCheck, Swords, Video, Mail, Lock, 
  User, ArrowLeft
} from "lucide-react";
import { resolvePostAuthPath, withRedirectQuery } from "@/app/authRedirect";
import { useUserStore, type AuthenticatedUser } from "@/entities/user";
import { http, wsClient } from "@/shared/api";
import { LanguageSwitcher, useI18n } from "@/shared/i18n";
import type { TokenResponse } from "@/shared/types";
import { API_BASE_URL } from "@/shared/config";
import { Button, Card, Input } from "@/shared/ui";
import "../../pages-style/auth-page/authpage.scss";
import logoImage from '../../assets/logo.jpeg';

type AuthMode = "login" | "register" | "forgot" | "reset";

interface AuthFormState {
  username: string;
  email: string;
  password: string;
  resetToken: string;
  resetEmail: string;
}

const initialFormState: AuthFormState = {
  username: "",
  email: "",
  password: "",
  resetToken: "",
  resetEmail: "",
};

const authHighlights = [
  {
    icon: Swords,
    titleKey: "auth.highlights.boardTitle",
    descriptionKey: "auth.highlights.boardDescription",
  },
  {
    icon: Video,
    titleKey: "auth.highlights.matchesTitle",
    descriptionKey: "auth.highlights.matchesDescription",
  },
  {
    icon: ShieldCheck,
    titleKey: "auth.highlights.profileTitle",
    descriptionKey: "auth.highlights.profileDescription",
  },
];

function getMode(pathname: string): AuthMode {
  if (pathname.includes("forgot-password")) return "forgot";
  if (pathname.includes("reset-password")) return "reset";
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
  const resetTokenFromUrl = mode === "reset" ? searchParams.get("token") || "" : "";
  const { t } = useI18n();
  
  const { isAuthenticated, setAuth, hasHydrated } = useUserStore();
  
  const [form, setForm] = useState<AuthFormState>(() => ({ ...initialFormState, resetToken: resetTokenFromUrl }));
  const [error, setError] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = resolvePostAuthPath(searchParams.get("redirectTo"));

  useEffect(() => {
    if (mode === "reset") {
      setForm((current) => current.resetToken === resetTokenFromUrl ? current : { ...current, resetToken: resetTokenFromUrl });
      return;
    }

    const token = searchParams.get("access_token") || searchParams.get("token");
    const refresh = searchParams.get("refresh_token") || "";
    const oauthError = searchParams.get("error");

    if (oauthError) {
      setError(`${t("auth.errors.oauthFailed")}: ${oauthError}`);
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
          setError(t("auth.errors.oauthSession"));
        } finally {
          setIsSubmitting(false);
        }
      };
      handleOAuthFlow();
    }
  }, [mode, resetTokenFromUrl, searchParams, setAuth, navigate, redirectTo, setSearchParams, t]);

  if (hasHydrated && isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const title = mode === "login" ? t("auth.titles.login") : t("auth.titles.register");
  const resolvedTitle = mode === "forgot" ? t("auth.titles.forgot") : mode === "reset" ? t("auth.titles.reset") : title;
  const alternateHref = withRedirectQuery(mode === "login" ? "/register" : "/login", redirectTo);
  const alternateLabel = mode === "login" ? t("auth.actions.create") : t("auth.actions.login");

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
      if (mode === "forgot") {
        const response = await http.post<{ detail: string }>("/identity/password-reset/request", { email: form.resetEmail || form.email });
        setError(response.detail);
        return;
      }

      if (mode === "reset") {
        const response = await http.post<{ detail: string }>("/identity/password-reset/complete", {
          token: form.resetToken,
          password: form.password,
        });
        setError(response.detail);
        navigate("/login", { replace: true });
        return;
      }

      const payload = mode === "register" ? { username: form.username, email: form.email, password: form.password } : { email: form.email, password: form.password };
      const endpoint = mode === "register" ? "/identity/register" : "/identity/login";
      
      const response = await http.post<TokenResponse>(endpoint, payload);
      const user = response.user ? response.user : await resolveUser(response.access_token);
      
      setAuth(user, response.access_token, response.refresh_token);
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      let message = t("auth.errors.authFailed");
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { detail?: string; message?: string } } };
        message = axiosErr.response?.data?.detail || axiosErr.response?.data?.message || message;
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
              {t("auth.hero.back")}
            </Link>

            <div className="brand-section">
                <div className="logo-box">
                  <img 
        src={logoImage} 
        alt="ChessView Logo" 
        className="logo-img" 
      />
                </div>
              <span className="brand-name">{t("common.brand")}</span>
            </div>
            
            <h1 className="hero-title">
              {mode === "login" ? (
                <>{t("auth.hero.loginStart")} <span>{t("auth.hero.loginAccent")}</span>.</>
              ) : (
                <>{t("auth.hero.registerStart")} <span>{t("auth.hero.registerAccent")}</span>.</>
              )}
            </h1>
            <p className="hero-desc">
              {t("auth.hero.description")}
            </p>
          </div>

          <div className="feature-grid">
            {authHighlights.map((item) => (
              <div key={item.titleKey} className="feature-item">
                <div className="icon-box">
                  <item.icon size={20} />
                </div>
                <div className="text-wrap">
                  <h3>{t(item.titleKey)}</h3>
                  <p>{t(item.descriptionKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="form-container">
          <Card className="auth-card">
            <div className="card-header">
              <h2>{resolvedTitle}</h2>
              <p>
                {mode === "forgot"
                  ? t("auth.subtitles.forgot")
                  : mode === "reset"
                    ? t("auth.subtitles.reset")
                    : t("auth.subtitles.default")}
              </p>
              <LanguageSwitcher compact />
            </div>

            {mode !== "forgot" && mode !== "reset" ? <div className="oauth-group">
              <button 
                type="button" 
                onClick={() => handleOAuth('google')} 
                className="oauth-btn"
                disabled={isSubmitting}
                aria-label={t("auth.actions.google")}
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" />
                <span>{t("auth.actions.google")}</span>
              </button>
            </div> : null}

            {mode !== "forgot" && mode !== "reset" ? <div className="divider">
              <span>{t("auth.actions.divider")}</span>
            </div> : null}

            <form onSubmit={handleSubmit}>
              {mode === "register" && (
                <div className="input-group">
                  <label><User size={12} /> {t("auth.fields.username")}</label>
                  <Input
                    placeholder={t("auth.placeholders.username")}
                    value={form.username}
                    onChange={(e) => handleChange("username", e.target.value)}
                    required
                  />
                </div>
              )}

              {(mode === "login" || mode === "register") && <div className="input-group">
                <label><Mail size={12} /> {t("auth.fields.email")}</label>
                <Input
                  type="email"
                  placeholder={t("auth.placeholders.email")}
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  required
                />
              </div>}

              {mode === "forgot" && (
                <div className="input-group">
                  <label><Mail size={12} /> {t("auth.fields.email")}</label>
                  <Input
                    type="email"
                    placeholder={t("auth.placeholders.email")}
                    value={form.resetEmail}
                    onChange={(e) => handleChange("resetEmail", e.target.value)}
                    required
                  />
                </div>
              )}

              {mode === "reset" && (
                <div className="input-group">
                  <label><ShieldCheck size={12} /> {t("auth.fields.resetToken")}</label>
                  <Input
                    placeholder={t("auth.placeholders.resetToken")}
                    value={form.resetToken}
                    onChange={(e) => handleChange("resetToken", e.target.value)}
                    required
                  />
                </div>
              )}

              {mode !== "forgot" && <div className="input-group">
                <label><Lock size={12} /> {mode === "reset" ? t("auth.fields.newPassword") : t("auth.fields.password")}</label>
                <Input
                  type="password"
                  placeholder={mode === "reset" ? t("auth.placeholders.newPassword") : t("auth.placeholders.password")}
                  value={form.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  required
                />
              </div>}

              {error && <div className="error-msg">{error}</div>}

              <Button 
                type="submit" 
                className="submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? t("auth.actions.processing")
                  : mode === "forgot"
                    ? t("auth.actions.sendReset")
                    : mode === "reset"
                      ? t("auth.actions.resetPassword")
                      : mode === "login"
                        ? t("auth.actions.signIn")
                        : t("auth.actions.getStarted")}
              </Button>
            </form>

            <div className="footer-link">
              {mode === "login" ? (
                <>
                  <Link to="/forgot-password">{t("auth.actions.forgot")}</Link>
                  <span className="mx-2 text-neutral-600">·</span>
                </>
              ) : null}
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
