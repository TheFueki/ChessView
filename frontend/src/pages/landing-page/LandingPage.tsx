import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react"; 
import { 
  Crown, Swords, Zap, Brain, Lock, Cpu, BarChart3, Github, Twitter, Quote, Code2, Database, Terminal, ChevronDown, ShieldCheck, Search, Sun, Moon, LayoutDashboard, UserCircle, Settings, LogOut 
} from "lucide-react";
import { useNavigate, Link } from "react-router";
import { Button, Card } from "@/shared/ui";
import "../../pages-style/landing-page/landingpage.scss";

const fadeInUp = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8, ease: "easeOut" }
} as const;

type LandingUser = {
  email: string;
};

export default function LandingPage() {
  const navigate = useNavigate();
  const monitorRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: monitorRef, offset: ["start end", "end start"] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [15, -15]);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [, setIsTokenModalOpen] = useState(false);
  const [, setIsSearchOpen] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [user, setUser] = useState<LandingUser | null>(null); 
  const profile = { username: "Ventie Ravelle", avatar_url: null };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  const handleLogout = () => {
    setUser(null);
    setIsUserMenuOpen(false);
  };

  return (
    <div className="landing-wrapper">
      <div className="bg-blobs">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <nav className="navbar">
        <div className="nav-utility">
          <div className="utility-container">
            <div className="utility-left">
              <div className="system-status-item">
                <span className="ping-dot"></span>
                <span className="utility-text">Players Online</span>
              </div>
              <div className="system-status-item">
                <span className="utility-label">Latency</span>
                <span className="utility-value">1ms</span>
              </div>
            </div>

            <div className="utility-right">
              <a href="#market" className="utility-link">Marketplace</a>
              <div className="token-stats" onClick={() => setIsTokenModalOpen(true)} style={{ cursor: 'pointer' }}>
                <span className="token-network-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="12" fill="#0052FF"/>
                  </svg>
                </span>
                <span className="token-value">$VENTIE</span>
                <span className="token-trend positive">Live</span>
              </div>
            </div>
          </div>
        </div>

        <div className="nav-content">
          <div className="logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <div className="logo-icon-wrapper"><div className="logo-shape"></div></div>
            <div className="logo-text">
              Chess<span className="logo-accent">View</span>
              <span className="startup-tag">StartUp v1.1.1</span>
            </div>
          </div>

          <div className="nav-main-wrapper">
            <div className="nav-links">
              <div className="nav-item">
                <a href="#experience" className="nav-link">
                  Platform <ChevronDown size={14} className="chevron" />
                </a>
                <div className="mega-menu">
                  <div className="mega-menu-content">
                    <div className="mega-column-info">
                      <span className="mega-tag">Core Engine</span>
                      <h2>Our Platform</h2>
                      <p>Explore cutting-edge technologies for real-time chess game analysis.</p>
                      <button className="mega-btn">Research Stack</button>
                    </div>
                    <div className="mega-column-links">
                      <h4>Modules</h4>
                      <div className="mega-grid">
                        <div className="mega-link-card">
                          <span className="icon"><Zap size={18} /></span>
                          <div>
                            <h5>Low Latency</h5>
                            <p>Minimal response time for professional tournaments.</p>
                          </div>
                        </div>
                        <div className="mega-link-card">
                          <span className="icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                              <line x1="12" y1="18" x2="12.01" y2="18"/>
                            </svg>
                          </span>
                          <div>
                            <h5>Cross-platform</h5>
                            <p>Available on all devices without loss of functionality.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="nav-item">
                <a href="#tech" className="nav-link">
                  Security <ChevronDown size={14} className="chevron" />
                </a>
                <div className="mega-menu">
                  <div className="mega-menu-content">
                    <div className="mega-column-info">
                      <span className="mega-tag">Shield</span>
                      <h2>Data Protection</h2>
                      <p>We use modern encryption protocols to protect your account.</p>
                      <button className="mega-btn">Security Report</button>
                    </div>
                    <div className="mega-column-links">
                      <h4>Technologies</h4>
                      <div className="mega-grid">
                        <div className="mega-link-card">
                          <span className="icon"><ShieldCheck size={18} /></span>
                          <div>
                            <h5>Neural Guard</h5>
                            <p>AI monitoring of suspicious activity in games.</p>
                          </div>
                        </div>
                        <div className="mega-link-card">
                          <span className="icon">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                          </span>
                          <div>
                            <h5>Privacy</h5>
                            <p>Your data belongs only to you.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="nav-item">
                <a href="#tournaments" className="nav-link-simple">Tournaments</a>
              </div>
            </div>
          </div>

          <div className="nav-right">
            <button className="theme-toggle" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            
            <div className="search-command-wrapper">
              <button className="btn-search-trigger" onClick={() => setIsSearchOpen(true)}>
                <Search size={16} />
                <span className="search-text">Search</span>
              </button>
            </div>
            
            <div className="user-actions">
              {user ? (
                <div className="user-profile-nav">
                  <button 
                    className={`avatar-btn ${isUserMenuOpen ? 'active' : ''}`} 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  >
                    <div className="avatar-wrapper">
                      <img 
                        src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
                        alt="Avatar" 
                        className="nav-avatar"
                        onError={(e) => {
                           (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${profile?.username || 'User'}&background=00D1FF&color=fff`;
                        }}
                      />
                      <div className="online-badge"></div>
                    </div>
                  </button>

                  {isUserMenuOpen && (
                    <div className="user-dropdown">
                      <div className="dropdown-header">
                        <span className="user-name">{profile?.username || user.email.split('@')[0]}</span>
                        <span className="user-status">Online</span>
                      </div>
                      <div className="dropdown-divider"></div>
                      <Link to="/" className="dropdown-item" onClick={() => setIsUserMenuOpen(false)}>
                        <LayoutDashboard size={16} />
                        <span>Dashboard</span>
                      </Link>
                      <Link to="/profile" className="dropdown-item" onClick={() => setIsUserMenuOpen(false)}>
                        <UserCircle size={16} />
                        <span>Profile</span>
                      </Link>
                      <Link to="/settings" className="dropdown-item" onClick={() => setIsUserMenuOpen(false)}>
                        <Settings size={16} />
                        <span>Settings</span>
                      </Link>
                      <div className="dropdown-divider"></div>
                      <button className="dropdown-item logout" onClick={handleLogout}>
                        <LogOut size={16} />
                        <span>Logout</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="auth-buttons">
                  <Link to="/login">
                    <button className="btn-login-premium">Login</button>
                  </Link>
                  <Link to="/register">
                    <button className="btn-register-premium">Register</button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="landing-content">
        <section className="hero-section">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="hero-badge">
            <div className="pulse-dot" /> <span>System Operational: v1.0.1</span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="hero-title">
            Chess as an <br /> <span className="gradient-text">Art of intelligence.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="hero-subtitle">
            The future of the chess industry: WebRTC gaming, deep profile/settings customization, and one-click FIDE global rating integration.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="hero-btns">
            <Button size="lg" className="btn-glow" onClick={() => navigate("/register")}>Start</Button>
            <Button variant="secondary" size="lg" className="btn-outline">Documentation</Button>
          </motion.div>
        </section>

        <section id="showcase" className="showcase-section" ref={monitorRef}>
          <motion.div style={{ rotateX }} className="monitor-container">
            <div className="monitor-frame">
              <div className="monitor-screen">
                <div className="screen-header">
                  <div className="dots"><span /><span /><span /></div>
                  <div className="address-bar">chessview.cc/game/live_0942</div>
                </div>
                <div className="screen-content">
                  <div className="fake-board">
                    <div className="chess-grid" />
                    <motion.div animate={{ x: [0, 60, 0], y: [0, -60, 0] }} transition={{ duration: 4, repeat: Infinity }} className="fake-piece" />
                  </div>
                  <div className="fake-sidebar">
                    <div className="sidebar-item active">Analysis Node</div>
                    <div className="sidebar-item">Move History</div>
                    <div className="eval-bar"><div className="eval-fill" /></div>
                    <div className="stockfish-box">Stockfish 16.1: +1.4</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="monitor-stand" /><div className="monitor-glow" />
          </motion.div>
        </section>

        <motion.section id="tech" {...fadeInUp} className="tech-section">
          <h2 className="title-md">Powered by Modern Tech</h2>
          <div className="tech-grid">
            <div className="tech-item"><Code2 /> <span>React 18</span></div>
            <div className="tech-item"><Terminal /> <span>Node.js</span></div>
            <div className="tech-item"><Database /> <span>PostgreSQL</span></div>
            <div className="tech-item"><Cpu /> <span>Stockfish WASM</span></div>
          </div>
        </motion.section>

        <section id="features" className="features-section">
          <div className="section-head">
            <h2 className="title-md">Architected for Mastery</h2>
          </div>
          <div className="features-grid">
            {[
              { i: Swords, t: "Battle Logic", d: "Strict server-side validation.", c: "blue" },
              { i: Brain, t: "Deep Neural", d: "Cloud-synced engine insights.", c: "indigo" },
              { i: BarChart3, t: "Data Visuals", d: "Visualize strengths in real-time.", c: "cyan" },
              { i: Lock, t: "Anti-Cheat", d: "Advanced behavioral analysis.", c: "purple" }
            ].map((f, i) => (
              <motion.div key={i} {...fadeInUp} transition={{ delay: i * 0.1 }}>
                <Card className={`glass-card ${f.c}`}>
                  <f.i className="card-icon" />
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="testimonials-section">
          <motion.div {...fadeInUp} className="testimonial-card">
            <Quote className="quote-icon" />
            <p>"The latency is nonexistent. It's the first time I've felt a web-based chess app respond like a native desktop client."</p>
            <div className="user-info">
              <div className="user-avatar" />
              <div><strong>Ventie Ravelle</strong><span>Grandmaster Rank</span></div>
            </div>
          </motion.div>
        </section>

<section id="community-hub" className="trace-discord-section">
  <motion.div 
    initial="initial"
    whileInView="whileInView"
    viewport={{ once: true, margin: "-100px" }}
    variants={fadeInUp}
    className="trace-container"
  >
    <div className="trace-visual">
      <div className="discord-circle">
        <svg viewBox="0 0 127.14 96.36" width="120" height="120" fill="currentColor">
          <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.06,72.06,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.71,32.65-1.87,56.6.19,80.21a105.73,105.73,0,0,0,32.17,16.15,77.7,77.7,0,0,0,6.89-11.11,68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1,105.25,105.25,0,0,0,32.19-16.14c2.72-27.31-4.82-51.1-19.34-72.14ZM42.45,65.69c-6.22,0-11.38-5.71-11.38-12.73s5-12.73,11.38-12.73,11.44,5.71,11.44,12.73S48.67,65.69,42.45,65.69Zm42.24,0c-6.22,0-11.38-5.71-11.38-12.73s5-12.73,11.38-12.73,11.44,5.71,11.44,12.73S84.69,65.69,84.69,65.69Z"/>
        </svg>
      </div>
      <div className="visual-glow" />
    </div>

    <div className="trace-content">
      <h2 className="trace-title">Join the Hive Mind</h2>
      <h3 className="trace-subtitle">Collaborate, Analyze, and Compete.</h3>
      <p className="trace-text">
        Connect with chess enthusiasts and developers. Share opening theories or find a sparring partner for your next blitz session.
      </p>
      
      <div className="trace-status">
        <div className="status-indicator" />
        <span className="status-count">0</span> Online Now
      </div>
      <a href="https://discord.gg/4KA39UEEc4" className="trace-btn" target="_blank" rel="noreferrer noopener">
        Join Discord Community
      </a>
    </div>
  </motion.div>
</section>

        <section id="clubs" className="private-clubs-section">
  <div className="container">
    <div className="clubs-layout">
      <motion.div 
        initial="initial"
        whileInView="whileInView"
        viewport={{ once: true, margin: "-100px" }}
        variants={fadeInUp}
        className="clubs-content"
      >
        <span className="section-tag">Elite Circles</span>
        <h2 className="gradient-title">Private Chess Clubs</h2>
        <p className="description-text">
          Create your own sovereign chess space. Manage memberships, 
          host internal tournaments, and define your club's unique hierarchy.
        </p>
        
        <ul className="clubs-features">
          {[
            { t: "Custom Interiors", d: "Personalize your club's lobby and board aesthetics." },
            { t: "Voice Channels", d: "Integrated low-latency audio for real-time coaching." },
            { t: "Role Hierarchy", d: "Advanced permission system for staff and VIPs." }
          ].map((f, i) => (
            <li key={i}>
              <div className="check-icon"><Zap size={14} /></div>
              <div>
                <strong>{f.t}</strong>
                <p>{f.d}</p>
              </div>
            </li>
          ))}
        </ul>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, x: 50 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="clubs-visual"
      >
        <div className="club-card-stack">
          <div className="club-card-preview main-card">
            <div className="club-image-placeholder">
              <img src="https://images.unsplash.com/photo-1528605105345-5344ea20e269?q=80&w=2070&auto=format&fit=crop" alt="Club" />
              <div className="image-overlay" />
            </div>
            <div className="club-info">
              <div className="info-header">
                <h4>Base Alpha</h4>
                <span className="badge-private">Private</span>
              </div>
              <p>52 Members   12 Online</p>
              <div className="member-avatars">
                <div className="mini-avatar" style={{ background: '#3b82f6' }} />
                <div className="mini-avatar" style={{ background: '#6366f1' }} />
                <div className="mini-avatar" style={{ background: '#a855f7' }} />
                <div className="more-count">+12</div>
              </div>
            </div>
          </div>
          <div className="club-card-preview back-card-1" />
          <div className="club-card-preview back-card-2" />
        </div>
      </motion.div>
    </div>
  </div>
</section>
      </main>

    <footer className="footer-pro">
  <div className="footer-blur-effect"></div>
  <div className="container">
    <div className="footer-top">
      <div className="footer-brand-huge">
        <div className="logo" onClick={() => navigate("/")}>
          <Crown className="logo-icon" /> 
          Chess<span className="logo-accent">View</span>
        </div>
        <p className="footer-description">
          Building the next generation of server-authoritative chess. 
          Precision analysis meets zero-latency gameplay.
        </p>
        <div className="footer-socials">
          <a href="https://discord.gg/JjcTWnr8rm" className="social-link" target="_blank" rel="noreferrer noopener">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
          </a>
          <a href="#" className="social-link"><Twitter size={20} /></a>
          <a href="https://github.com/an8kk/ChessView" className="social-link" target="_blank" rel="noreferrer noopener"><Github size={20} /></a>
        </div>
      </div>

      <div className="footer-links-grid">
        <div className="footer-col">
          <h4>Platform</h4>
          <a href="#features">Features</a>
          <a href="#showcase">Showcase</a>
          <a href="#tech">Technology</a>
          <a href="/play">Play Now</a>
        </div>
        <div className="footer-col">
          <h4>Community</h4>
          <a href="#community-hub">Discord</a>
          <a href="#">Tournaments</a>
          <a href="#">Leaderboard</a>
          <a href="#">Clubs</a>
        </div>
        <div className="footer-col">
          <h4>Resources</h4>
          <a href="#">Documentation</a>
          <a href="#">API Reference</a>
          <a href="#">Open Source</a>
          <a href="#">System Status</a>
        </div>
      </div>

      <div className="footer-newsletter">
        <h4>Stay in the loop</h4>
        <p>Get notified about new engine updates and tournament seasons.</p>
        <div className="newsletter-form">
          <input type="email" placeholder="Email address" />
          <button className="btn-subscribe"> </button>
        </div>
        <div className="system-status">
          <span className="status-dot green"></span>
          Operational: 99.9% Uptime
        </div>
      </div>
    </div>

    <div className="footer-divider"></div>

    <div className="footer-bottom">
      <div className="footer-legal">
        <a href="#">Privacy Policy</a>
        <a href="#">Terms of Service</a>
      </div>
      <p className="footer-copy">
          {new Date().getFullYear()} ChessView. <br />
        Handcrafted for the chess community.
      </p>
      <div className="footer-lang">
        <span>English (US)</span>
      </div>
    </div>
  </div>
</footer>
    </div>
  );
}
