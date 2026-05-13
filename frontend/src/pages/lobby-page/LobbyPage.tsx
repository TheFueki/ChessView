import { motion, AnimatePresence } from "framer-motion";
import { Home, LogOut, X, Trophy, Swords, Activity } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useMatchmakingStore } from "@/entities/matchmaking";
import { useUserStore } from "@/entities/user";
import { useLobbyMatchmakingRealtime } from "@/features/join-matchmaking";
import { wsClient } from "@/shared/api";
import { Button } from "@/shared/ui";
import { MatchmakingPanel } from "@/widgets/matchmaking-panel";
import "../../pages-style/lobby-page/lobbypage.scss";
import logoImage from "../../assets/logo.jpeg";

export default function LobbyPage({ isOpen = true, onClose = () => {} }) {
  useLobbyMatchmakingRealtime();

  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);
  const resetMatchmaking = useMatchmakingStore((state) => state.reset);

  const handleLogout = () => {
    wsClient.disconnect();
    resetMatchmaking();
    logout();
    onClose(); 
    navigate("/", { replace: true });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="lobby-modal-overlay">
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="lobby-modal-card"
            initial={{ opacity: 0, scale: 0.9, y: 40, rotateX: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 40 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            <div className="card-ambient-glow" />
            
            <header className="modal-header">
              <div className="brand-group">
                  <div className="logo-box">
                    <img 
                      src={logoImage} 
                      alt="ChessView Logo" 
                      className="logo-img"
                    />
                  </div>
                <div className="title-stack">
                  <span className="main-title">ChessView Lobby</span>
                  <div className="status-badge">
                    <span className="pulse-dot" />
                    Live System
                  </div>
                </div>
              </div>

              <div className="header-actions">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { onClose(); navigate("/"); }}
                  className="home-nav-btn"
                >
                  <Home size={16} />
                </Button>

                {user && (
                  <Link to="/profile" className="user-mini-pill" onClick={onClose}>
                    <span className="name">{user.username}</span>
                    <span className="rank-val">{user.rating}</span>
                  </Link>
                )}
                
                <button className="close-trigger" onClick={onClose}>
                  <X size={20} />
                </button>
              </div>
            </header>

            <main className="modal-body">
              <div className="lobby-info-grid">
                <div className="info-item">
                  <Trophy size={14} />
                  <div className="info-text">
                    <span className="label">Mode</span>
                    <span className="value">Ranked Match</span>
                  </div>
                </div>
                <div className="info-item">
                  <Swords size={14} />
                  <div className="info-text">
                    <span className="label">Time Control</span>
                    <span className="value">Classic 10m</span>
                  </div>
                </div>
              </div>

              <div className="matchmaking-panel-wrapper">
                <MatchmakingPanel />
              </div>
            </main>

            <footer className="modal-footer">
              <div className="sys-status">
                <Activity size={12} />
                <span>Global Matchmaking Online</span>
              </div>
              
              <button className="logout-link" onClick={handleLogout}>
                <LogOut size={14} />
                <span>Logout Session</span>
              </button>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}