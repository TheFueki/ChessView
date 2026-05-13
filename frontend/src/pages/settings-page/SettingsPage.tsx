import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserStore } from "@/entities/user";
import { http } from "@/shared/api";
import type { FaceVerificationProfileResponse } from "@/shared/types";
import { 
  User, Shield, Camera, Save, 
  Trash2, Bell, Swords, Play, 
  Lock, Palette
} from "lucide-react";
import { Button, Input, Card, Avatar } from "@/shared/ui";
import "../../pages-style/settings-page/SettingsPage.scss";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("account");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, setUser } = useUserStore();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    bio: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || "",
        email: user.email || "",
        bio: user.bio || "",
      });
    }
  }, [user]);

  const faceProfilesQuery = useQuery({
    queryKey: ["face-verification-profiles"],
    queryFn: () => http.get<FaceVerificationProfileResponse[]>("/identity/face-verification/me"),
    enabled: Boolean(user),
  });

  const enrollFaceVerification = useMutation({
    mutationFn: () =>
      http.post<FaceVerificationProfileResponse>("/identity/face-verification/enroll", {
        device_label: "Primary browser",
        consent: true,
      }),
    onSuccess: async () => {
      setMessage({ type: 'success', text: "Face verification enrollment created" });
      await queryClient.invalidateQueries({ queryKey: ["face-verification-profiles"] });
    },
    onError: () => setMessage({ type: 'error', text: "Unable to enroll face verification" }),
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
      setMessage({ type: 'error', text: "File too large (max 2MB)" });
      return;
    }

    const data = new FormData();
    data.append("file", file);

    try {
      setIsSaving(true);
      setMessage(null);
      const updatedUser = await http.post<typeof user>("/identity/me/avatar", data);
      if (user && updatedUser) setUser({ ...user, ...updatedUser });
      setMessage({ type: 'success', text: "Avatar updated successfully" });
    } catch {
      setMessage({ type: 'error', text: "Failed to upload avatar" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    
    try {
      const updatedUser = await http.put<typeof user>("/identity/profile", {
        username: formData.username,
        bio: formData.bio
      });
      if (updatedUser) setUser(updatedUser);
      setMessage({ type: 'success', text: "Profile changes saved" });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Update failed";
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    const confirmed = confirm("Are you sure? This action is irreversible.");
    if (confirmed) {
      console.warn("Account deletion logic goes here");
    }
  };

  const renderAccountTab = () => (
    <div className="tab-content-wrapper">
      <section className="settings-section">
        <header className="section-header">
          <h1 className="section-title">Public Profile</h1>
          <p className="section-desc">Managing your identity across the platform.</p>
        </header>

        <Card className="settings-card">
          <div className="avatar-upload-group">
            <div className="avatar-preview-wrapper">
              <Avatar 
                username={user?.username || "V"} 
                avatarUrl={user?.avatar_url} 
                className="settings-avatar-preview"
              />
              <label className="avatar-edit-overlay">
                <Camera size={22} />
                <input type="file" hidden accept="image/*" onChange={handleAvatarUpload} disabled={isSaving} />
              </label>
            </div>
            <div className="avatar-info">
              <h3>Profile Picture</h3>
              <p>Click the image to upload a new one. PNG, JPG or GIF.</p>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="settings-form">
            <div className="form-grid">
              <div className="input-group">
                <label>Display Name</label>
                <Input 
                  value={formData.username} 
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  placeholder="Enter username"
                  required
                />
              </div>
              <div className="input-group">
                <label>Email Address</label>
                <Input value={formData.email} disabled className="disabled-input" />
                <span className="input-hint">Contact support to change email.</span>
              </div>
            </div>

            <div className="input-group full-width">
              <label>Bio (Short description)</label>
              <textarea 
                className="custom-textarea"
                value={formData.bio}
                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                placeholder="Tell the world about yourself..."
                maxLength={160}
              />
            </div>

            {message && <div className={`status-message ${message.type}`}>{message.text}</div>}

            <div className="form-actions">
              <Button type="submit" disabled={isSaving} className="btn-save">
                <Save size={18} /> {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Card>
      </section>

      <section className="settings-section dangerous">
        <h3 className="danger-title">Danger Zone</h3>
        <Card className="danger-card">
          <div className="danger-text">
            <h4>Delete Account</h4>
            <p>Once you delete your account, there is no going back. Please be certain.</p>
          </div>
          <Button variant="danger" onClick={handleDeleteAccount}>
            <Trash2 size={18} /> Delete Account
          </Button>
        </Card>
      </section>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="tab-content-wrapper">
      <section className="settings-section">
        <header className="section-header">
          <h1 className="section-title">Security Settings</h1>
          <p className="section-desc">Manage your credentials and account safety.</p>
        </header>
        <Card className="settings-card stub-card">
          <Lock size={40} className="stub-icon" />
          <h3>Password & Authentication</h3>
          <p>Two-factor authentication and password rotation modules are coming soon.</p>
          <Button variant="secondary" className="mt-4" onClick={() => alert("Stub: Reset email sent")}>
            Request Password Reset
          </Button>
        </Card>

        <Card className="settings-card mt-6">
          <div className="avatar-upload-group" style={{ marginBottom: 24 }}>
            <div className="avatar-preview-wrapper">
              <div className="settings-avatar-preview flex items-center justify-center bg-black">
                <Camera size={30} className="text-indigo-400" />
              </div>
            </div>
            <div className="avatar-info">
              <h3>Face Verification</h3>
              <p>Local consent and stub verification profile for game checks.</p>
            </div>
          </div>

          <div className="stub-list">
            {faceProfilesQuery.isLoading ? (
              <div className="stub-row">
                <span>Loading verification status...</span>
              </div>
            ) : faceProfilesQuery.error ? (
              <div className="stub-row">
                <span>Unable to load verification status</span>
                <span className="text-xs text-red-400 uppercase">error</span>
              </div>
            ) : (faceProfilesQuery.data ?? []).length > 0 ? (
              (faceProfilesQuery.data ?? []).map((profile) => (
                <div key={profile.id} className="stub-row">
                  <span>{profile.device_label ?? profile.provider}</span>
                  <span className="text-xs text-neutral-400 uppercase">{profile.status}</span>
                </div>
              ))
            ) : (
              <div className="stub-row">
                <span>No face verification profile enrolled</span>
                <span className="text-xs text-neutral-400 uppercase">local stub</span>
              </div>
            )}
          </div>

          <div className="form-actions">
            <Button
              variant="secondary"
              onClick={() => enrollFaceVerification.mutate()}
              disabled={enrollFaceVerification.isPending}
            >
              <Camera size={18} /> Enroll Local Stub
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="tab-content-wrapper">
      <section className="settings-section">
        <header className="section-header">
          <h1 className="section-title">Notifications</h1>
          <p className="section-desc">Choose how you want to be notified.</p>
        </header>
        <Card className="settings-card">
          <div className="stub-list">
            {[ "Email notifications on game start", "Marketing updates", "Security alerts" ].map((text, i) => (
              <div key={i} className="stub-row">
                <span>{text}</span>
                <div className="mock-switch active"></div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );

 const renderCustomizationTab = () => (
  <div className="tab-content-wrapper">
    <section className="settings-section">
      <header className="section-header">
        <h1 className="section-title">Customization</h1>
        <p className="section-desc">Personalize your board experience and interface.</p>
      </header>
      
      <Card className="settings-card">
        <div className="appearance-options">
          <div className="option-group">
            <label className="group-label">Interface Theme</label>
            <div className="theme-grid">
              {['Midnight', 'Phantom', 'OLED Deep'].map((theme) => (
                <div key={theme} className={`theme-preview ${theme === 'Phantom' ? 'active' : ''}`}>
                  <div className="color-dots">
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                  <span>{theme}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="divider" />

          <div className="option-group">
            <label className="group-label">Board Aesthetics</label>
            <div className="form-grid">
              <div className="input-group">
                <label>Board Material</label>
                <select className="custom-select">
                  <option>Midnight Blue (Default)</option>
                  <option>Classic Wood</option>
                  <option>Minimalist Grey</option>
                </select>
              </div>
              <div className="input-group">
                <label>Piece Set</label>
                <select className="custom-select">
                  <option>Neo Classic</option>
                  <option>Modern Outline</option>
                  <option>Alpha</option>
                </select>
              </div>
            </div>
          </div>

          <div className="divider" />
          <div className="stub-list">
            <div className="stub-row">
              <div className="text-info">
                <span>Show Rating on Profile</span>
                <p className="text-xs text-dim">Display your current Elo to other players.</p>
              </div>
              <div className="mock-switch active"></div>
            </div>
            <div className="stub-row">
              <div className="text-info">
                <span>Enable Board Animations</span>
                <p className="text-xs text-dim">Smooth transition when pieces move.</p>
              </div>
              <div className="mock-switch active"></div>
            </div>
          </div>
        </div>
      </Card>
    </section>
  </div>
);

  return (
    <div className="settings-root">
      <header className="settings-header">
        <div className="header-container">
          <div className="brand" onClick={() => navigate("/")}>
            <Swords className="text-indigo-500" />
            <span className="brand-text">CHESSVIEW</span>
          </div>
          <div className="nav-actions">
            <Button variant="ghost" onClick={() => navigate("/")}>Dashboard</Button>
            <Button onClick={() => navigate("/lobby")} className="play-btn">
              <Play size={16} className="mr-2 fill-current" /> Play
            </Button>
            <Button variant="secondary" onClick={() => navigate("/profile")}>
              <User size={18} />
            </Button>
          </div>
        </div>
      </header>

      <div className="settings-container">
        <aside className="settings-sidebar">
          <h2 className="sidebar-title">Settings</h2>
          <nav className="sidebar-nav">
            <button 
              className={`nav-item ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => setActiveTab('account')}
            >
              <User size={18} /> Account
            </button>
            <button 
              className={`nav-item ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <Shield size={18} /> Security
            </button>
            <button 
              className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              <Bell size={18} /> Notifications
            </button>
            <button 
              className={`nav-item ${activeTab === 'customization' ? 'active' : ''}`}
              onClick={() => setActiveTab('customization')}
            >
              <Palette size={18} /> Customization
            </button>
          </nav>
        </aside>

        <main className="settings-content">
          {activeTab === 'account' && renderAccountTab()}
          {activeTab === 'security' && renderSecurityTab()}
          {activeTab === 'notifications' && renderNotificationsTab()}
          {activeTab === 'customization' && renderCustomizationTab()}
        </main>
      </div>
    </div>
  );
}
