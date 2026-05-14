import { motion } from "framer-motion";
import { Brain, Crown, Github, Swords, Trophy, Users } from "lucide-react";
import { Link, useNavigate } from "react-router";
import logoImage from "../../assets/logo.jpeg";
import "../../pages-style/landing-page/landingpage.scss";

const DISCORD_URL = "https://discord.gg/4KA39UEEc4";
const GITHUB_URL = "https://github.com/an8kk/ChessView";

const features = [
  {
    icon: Swords,
    title: "Play Online",
    description: "Challenge other players in rated and casual games with server-authoritative rules.",
  },
  {
    icon: Trophy,
    title: "Join Tournaments",
    description: "Compete in Swiss events, track standings, and review every pairing afterwards.",
  },
  {
    icon: Brain,
    title: "Review Games",
    description: "Use analysis boards, move history, and tactical puzzles to sharpen your play.",
  },
  {
    icon: Users,
    title: "Chess Community",
    description: "Find opponents, join the Discord community, and follow other players.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-wrapper">
      <nav className="landing-nav">
        <button className="landing-brand" onClick={() => navigate("/")}>
          <img src={logoImage} alt="ChessView" />
          <span>ChessView</span>
        </button>
        <div className="landing-links">
          <a href="#features">Features</a>
          <a href={DISCORD_URL} target="_blank" rel="noreferrer noopener">Discord</a>
          <Link to="/login">Login</Link>
          <Link className="register-link" to="/register">Register</Link>
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
              Online chess platform
            </div>
            <h1>ChessView</h1>
            <p>
              Play chess online, join tournaments, improve your rating, and review your games with a focused dark
              interface built around the board.
            </p>
            <div className="hero-actions">
              <button className="primary-action" onClick={() => navigate("/register")}>Start Playing</button>
              <button className="secondary-action" onClick={() => navigate("/login")}>Login</button>
              <a className="secondary-action" href={DISCORD_URL} target="_blank" rel="noreferrer noopener">
                Join Discord
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
                <span>Blitz 5+3</span>
                <strong>Challenge ready</strong>
              </div>
              <div>
                <span>Rating</span>
                <strong>Improve every game</strong>
              </div>
            </div>
          </motion.div>
        </section>

        <section id="features" className="features-section">
          <div className="section-heading">
            <h2>Everything points back to chess.</h2>
            <p>Games, tournaments, profiles, ratings, puzzles, and reviews stay close to the board.</p>
          </div>
          <div className="features-grid">
            {features.map((feature) => (
              <article key={feature.title} className="feature-card">
                <feature.icon size={22} />
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="discord-section">
          <div>
            <h2>Join the Discord community.</h2>
            <p>Find opponents, discuss tournaments, share feedback, and follow what is coming next.</p>
          </div>
          <a href={DISCORD_URL} target="_blank" rel="noreferrer noopener">Join Discord</a>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-brand">
          <img src={logoImage} alt="" />
          <span>ChessView</span>
        </div>
        <nav>
          <a href={DISCORD_URL} target="_blank" rel="noreferrer noopener">Discord</a>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
            <Github size={16} />
            GitHub
          </a>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="mailto:contact@chessview.cc">Contact</a>
        </nav>
      </footer>
    </div>
  );
}
