import React, { useState } from "react";
import { 
  Users, Search, Plus, Shield, Globe, Lock,
  ChevronLeft, ChevronRight, Swords, Trophy, ShoppingBag,
  Info, Rocket
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { http } from "@/shared/api";
import { Avatar, Button, Card } from "@/shared/ui"; 
import type { ProfileResponse } from "@/shared/types";
import "../../pages-style/clubs-page/clubspage.scss";
import logoImage from '../../assets/logo.jpeg';

const LocalAppShell = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={`app-shell-container ${className || ''}`}>{children}</div>
);

export default function ClubsPage() {
  const navigate = useNavigate();
  const [uiState, setUiState] = useState({ left: true, right: true });

  const profileQuery = useQuery({
    queryKey: ["dashboard-profile"],
    queryFn: () => http.get<ProfileResponse>("/profiles/me"),
  });

  const profile = profileQuery.data ?? null;

  const placeholderClubs = [
    { id: 1, name: "Grandmasters Elite", members: 1240, type: "Public", rating: 2100 },
    { id: 2, name: "Cyber Knights", members: 850, type: "Invite Only", rating: 1800 },
    { id: 3, name: "Blitz Wizards", members: 3200, type: "Public", rating: 1400 },
  ];

  return (
    <LocalAppShell className={`clubs-root ${!uiState.left ? 'l-collapsed' : ''} ${!uiState.right ? 'r-collapsed' : ''}`}>
      <div className="dev-overlay">
        <div className="overlay-content">
          <Rocket size={48} className="icon-pulse" />
          <h2>Clubs are in Development</h2>
          <p>This feature is currently being built. Stay tuned for social updates!</p>
          <Button onClick={() => navigate("/")}>Back to Dashboard</Button>
        </div>
      </div>

      <div className="dashboard-grid">
        <aside className="side-panel left-panel">
          <button className="collapse-btn" onClick={() => setUiState(s => ({...s, left: !s.left}))}>
            {uiState.left ? <ChevronLeft size={16}/> : <ChevronRight size={16}/>}
          </button>
          <div className="panel-inner">
            <div className="brand-section">
              <div className="logo-box"><img src={logoImage} alt="Logo" className="logo-img" /></div>
              <div className="brand-text"><span className="name">ChessView</span><span className="ver">v1.1.1</span></div>
            </div>
            <nav className="main-nav">
              <button className="nav-item" onClick={() => navigate("/")}><Swords size={20}/> <span>Dashboard</span></button>
              <button className="nav-item active"><Users size={20}/> <span>Clubs</span></button>
              <button className="nav-item" onClick={() => navigate("/shop")}><ShoppingBag size={20}/> <span>Market</span></button>
            </nav>
            <div className="profile-anchor">
              <div className="user-card-mini">
                <Avatar username={profile?.username ?? "Guest"} size="sm" />
                <div className="user-meta">
                  <span className="username">{profile?.username ?? "Guest"}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="main-viewport blur-content">
          <header className="viewport-header">
            <div className="header-info">
              <h1>Clubs & Communities</h1>
              <div className="server-badge">Join the conversation</div>
            </div>
            <div className="header-actions">
               <Button variant="secondary" className="create-club-btn"><Plus size={18}/> Create Club</Button>
            </div>
          </header>

          <div className="search-bar-container">
            <div className="search-input">
              <Search size={18} />
              <input type="text" placeholder="Search clubs by name or tag..." disabled />
            </div>
          </div>

          <section className="clubs-list-section">
            <div className="clubs-grid">
              {placeholderClubs.map(club => (
                <Card key={club.id} className="club-card">
                  <div className="club-banner" />
                  <div className="club-body">
                    <div className="club-icon"><Shield size={24}/></div>
                    <h3>{club.name}</h3>
                    <div className="club-stats">
                      <span><Users size={14}/> {club.members}</span>
                      <span><Trophy size={14}/> {club.rating}+</span>
                    </div>
                    <div className="club-footer">
                      <span className="type-tag">{club.type === "Public" ? <Globe size={12}/> : <Lock size={12}/>} {club.type}</span>
                      <Button size="sm" variant="ghost">View Details</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        </main>

        <aside className="side-panel right-panel">
          <button className="collapse-btn" onClick={() => setUiState(s => ({...s, right: !s.right}))}>
            {uiState.right ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
          </button>
          <div className="panel-inner">
            <div className="aside-section">
              <div className="section-head"><Info size={18}/> Club Benefits</div>
              <ul className="benefits-list">
                <li>Exclusive Tournaments</li>
                <li>Private Chat Rooms</li>
                <li>Team Leaderboards</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </LocalAppShell>
  );
}