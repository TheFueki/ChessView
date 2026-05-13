import React, { useState } from "react";
import { 
  ShoppingBag, Coins, Sparkles, 
  Palette, Layout, UserCircle, ChevronLeft, ChevronRight, Swords, Trophy
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { http } from "@/shared/api";
import { Avatar, Button, Card} from "@/shared/ui"; 
import type { ProfileResponse } from "@/shared/types";
import "../../pages-style/shop-page/shoppage.scss"; 
import logoImage from '../../assets/logo.jpeg';

const LocalAppShell = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={`app-shell-container ${className || ''}`}>{children}</div>
);

export default function ShopPage() {
  const navigate = useNavigate();
  const [uiState, setUiState] = useState({ left: true, right: true });
  const [category, setCategory] = useState("all");

  const profileQuery = useQuery({
    queryKey: ["dashboard-profile"],
    queryFn: () => http.get<ProfileResponse>("/profiles/me"),
  });

  const shopItems = [
    { id: 1, name: "Neon Board", price: 500, type: "board", image: "https://placehold.co/200x200/1e1e2e/white?text=Neon+Board", rarity: "rare" },
    { id: 2, name: "Cyber Avatar", price: 1200, type: "avatar", image: "https://placehold.co/200x200/1e1e2e/white?text=Cyber+Frame", rarity: "epic" },
    { id: 3, name: "Classic Wood", price: 150, type: "board", image: "https://placehold.co/200x200/1e1e2e/white?text=Wood+Set", rarity: "common" },
    { id: 4, name: "Grandmaster Aura", price: 5000, type: "effect", image: "https://placehold.co/200x200/1e1e2e/white?text=Aura", rarity: "legendary" },
  ];

  const profile = profileQuery.data ?? null;

  return (
    <LocalAppShell className={`shop-root ${!uiState.left ? 'l-collapsed' : ''} ${!uiState.right ? 'r-collapsed' : ''}`}>
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
              <button className="nav-item active"><ShoppingBag size={20}/> <span>Market</span></button>
              <button className="nav-item" onClick={() => navigate("/tournaments")}><Trophy size={20}/> <span>Tournaments</span></button>
            </nav>
            <div className="profile-anchor">
              <div className="user-card-mini" onClick={() => navigate("/profile")}>
                <Avatar username={profile?.username ?? "Guest"} size="sm" />
                <div className="user-meta">
                  <span className="username">{profile?.username ?? "Guest"}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="main-viewport">
          <header className="viewport-header">
            <div className="header-info">
              <h1>Marketplace</h1>
              <div className="server-badge">Customize your experience</div>
            </div>
            <div className="quick-stats balance-pill">
              <Coins className="text-yellow-500" size={18} />
              <b>{profile?.coins ?? 2500}</b>
            </div>
          </header>

          <div className="shop-categories">
            <button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}><Layout size={16}/> All</button>
            <button className={category === "board" ? "active" : ""} onClick={() => setCategory("board")}><Palette size={16}/> Boards</button>
            <button className={category === "avatar" ? "active" : ""} onClick={() => setCategory("avatar")}><UserCircle size={16}/> Avatars</button>
            <button className={category === "effect" ? "active" : ""} onClick={() => setCategory("effect")}><Sparkles size={16}/> Effects</button>
          </div>

          <section className="shop-grid-section">
            <div className="items-grid">
              {shopItems.map(item => (
                <Card key={item.id} className={`item-card rarity-${item.rarity}`}>
                  <div className="item-preview">
                    <img src={item.image} alt={item.name} />
                    <div className="rarity-tag">{item.rarity}</div>
                  </div>
                  <div className="item-info">
                    <h3>{item.name}</h3>
                    <div className="price-row">
                      <div className="price"><Coins size={14}/> {item.price}</div>
                      <Button size="sm">Buy</Button>
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
              <div className="section-head"><Sparkles size={18}/> Daily Deals</div>
              <Card className="promo-mini-card">
                <p>Premium Subscription</p>
                <Button variant="secondary" className="w-full">Upgrade</Button>
              </Card>
            </div>
          </div>
        </aside>
      </div>
    </LocalAppShell>
  );
}