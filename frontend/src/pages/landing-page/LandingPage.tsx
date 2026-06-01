import { motion } from "framer-motion";
import { Brain, Crown, Github, Swords, Trophy, Users } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { LanguageSwitcher, useI18n } from "@/shared/i18n";
import logoImage from "../../assets/logo.jpeg";
import "../../pages-style/landing-page/landingpage.scss";

const DISCORD_URL = "https://discord.gg/4KA39UEEc4";
const GITHUB_URL = "https://github.com/thefueki/chessview";

const features = [
  {
    icon: Swords,
    titleKey: "landing.features.playTitle",
    descriptionKey: "landing.features.playDescription",
  },
  {
    icon: Trophy,
    titleKey: "landing.features.tournamentsTitle",
    descriptionKey: "landing.features.tournamentsDescription",
  },
  {
    icon: Brain,
    titleKey: "landing.features.reviewTitle",
    descriptionKey: "landing.features.reviewDescription",
  },
  {
    icon: Users,
    titleKey: "landing.features.communityTitle",
    descriptionKey: "landing.features.communityDescription",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className="landing-wrapper">
      <nav className="landing-nav">
        <button className="landing-brand" onClick={() => navigate("/")}>
          <img src={logoImage} alt="ChessView" />
          <span>{t("common.brand")}</span>
        </button>
        <div className="landing-links">
          <a href="#features">{t("landing.nav.features")}</a>
          <a href={DISCORD_URL} target="_blank" rel="noreferrer noopener">Discord</a>
          <Link to="/login">{t("landing.nav.login")}</Link>
          <Link className="register-link" to="/register">{t("landing.nav.register")}</Link>
          <LanguageSwitcher compact />
        </div>
      </nav>

      <main>
        <section className="landing-hero">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="hero-copy"
          >
            <div className="hero-kicker">
              <Crown size={16} />
              {t("landing.hero.kicker")}
            </div>
            <h1>{t("common.brand")}</h1>
            <p>
              {t("landing.hero.description")}
            </p>
            <div className="hero-actions">
              <button className="primary-action" onClick={() => navigate("/register")}>{t("landing.hero.start")}</button>
              <button className="secondary-action" onClick={() => navigate("/login")}>{t("landing.hero.login")}</button>
              <a className="secondary-action" href={DISCORD_URL} target="_blank" rel="noreferrer noopener">
                {t("landing.hero.discord")}
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            className="board-preview"
            aria-hidden="true"
          >
            <div className="preview-board">
              {Array.from({ length: 64 }, (_, index) => (
                <span key={index} className={(Math.floor(index / 8) + index) % 2 === 0 ? "light" : "dark"} />
              ))}
              <div className="preview-piece white-king">♔</div>
              <div className="preview-piece black-knight">♞</div>
              <div className="preview-piece white-rook">♖</div>
            </div>
            <div className="preview-panel">
              <div>
                <span>{t("landing.preview.blitz")}</span>
                <strong>{t("landing.preview.challenge")}</strong>
              </div>
              <div>
                <span>{t("landing.preview.rating")}</span>
                <strong>{t("landing.preview.improve")}</strong>
              </div>
            </div>
          </motion.div>
        </section>

        <section id="features" className="features-section">
          <div className="section-heading">
            <h2>{t("landing.features.heading")}</h2>
            <p>{t("landing.features.summary")}</p>
          </div>
          <div className="features-grid">
            {features.map((feature) => (
              <article key={feature.titleKey} className="feature-card">
                <feature.icon size={22} />
                <h3>{t(feature.titleKey)}</h3>
                <p>{t(feature.descriptionKey)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="discord-section">
          <div>
            <h2>{t("landing.discord.heading")}</h2>
            <p>{t("landing.discord.description")}</p>
          </div>
          <a href={DISCORD_URL} target="_blank" rel="noreferrer noopener">{t("landing.discord.action")}</a>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-brand">
          <img src={logoImage} alt="" />
          <span>{t("common.brand")}</span>
        </div>
        <nav>
          <a href={DISCORD_URL} target="_blank" rel="noreferrer noopener">Discord</a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
            <Github size={16} />
            GitHub
          </a>
          <a href="/terms">{t("landing.footer.terms")}</a>
          <a href="/privacy">{t("landing.footer.privacy")}</a>
          <a href="mailto:contact@chessview.cc">{t("landing.footer.contact")}</a>
        </nav>
      </footer>
    </div>
  );
}
