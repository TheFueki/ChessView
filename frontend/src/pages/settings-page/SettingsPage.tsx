import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUserStore } from "@/entities/user";
import { http } from "@/shared/api";
import type {
  FaceVerificationProfileResponse,
  FaceVerificationSessionResponse,
  PasskeyCredentialCreationOptionsJson,
  PasskeyCredentialRequestOptionsJson,
  PasskeyEnrollmentChallengeResponse,
  PasskeyVerificationChallengeResponse,
} from "@/shared/types";
import { 
  User, Shield, Camera, Save, 
  Trash2, Bell, Lock, Palette
} from "lucide-react";
import { Button, Input, Card, Avatar } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import "../../pages-style/settings-page/SettingsPage.scss";

type PasskeyActionState = "idle" | "enrolling" | "verifying";
type FaceTemplateActionState = "idle" | "enrolling";

function base64UrlToBuffer(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = window.atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

function toCreationOptions(publicKey: PasskeyCredentialCreationOptionsJson): PublicKeyCredentialCreationOptions {
  return {
    ...publicKey,
    challenge: base64UrlToBuffer(publicKey.challenge),
    user: {
      ...publicKey.user,
      id: base64UrlToBuffer(publicKey.user.id),
    },
    excludeCredentials: publicKey.excludeCredentials?.map((credential) => ({
      ...credential,
      id: base64UrlToBuffer(credential.id),
    })),
  };
}

function toRequestOptions(publicKey: PasskeyCredentialRequestOptionsJson): PublicKeyCredentialRequestOptions {
  return {
    ...publicKey,
    challenge: base64UrlToBuffer(publicKey.challenge),
    allowCredentials: publicKey.allowCredentials?.map((credential) => ({
      ...credential,
      id: base64UrlToBuffer(credential.id),
    })),
  };
}

function serializeAttestationCredential(credential: PublicKeyCredential) {
  if (!(credential.response instanceof AuthenticatorAttestationResponse)) {
    throw new Error("Passkey enrollment did not return attestation data");
  }

  return {
    id: credential.id,
    raw_id: bufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticator_attachment: credential.authenticatorAttachment ?? null,
    response: {
      attestation_object: bufferToBase64Url(credential.response.attestationObject),
      client_data_json: bufferToBase64Url(credential.response.clientDataJSON),
    },
  };
}

function serializeAssertionCredential(credential: PublicKeyCredential) {
  if (!(credential.response instanceof AuthenticatorAssertionResponse)) {
    throw new Error("Passkey verification did not return assertion data");
  }

  return {
    id: credential.id,
    raw_id: bufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticator_attachment: credential.authenticatorAttachment ?? null,
    response: {
      authenticator_data: bufferToBase64Url(credential.response.authenticatorData),
      client_data_json: bufferToBase64Url(credential.response.clientDataJSON),
      signature: bufferToBase64Url(credential.response.signature),
      user_handle: credential.response.userHandle ? bufferToBase64Url(credential.response.userHandle) : null,
    },
  };
}

function getPasskeyErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Face ID/passkey prompt was cancelled or timed out";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Face ID/passkey request failed";
}

function captureFaceSample(video: HTMLVideoElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 320;
  canvas.height = video.videoHeight || 240;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to read camera frame");
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

async function captureFaceSampleFromCamera(): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;

  try {
    await video.play();
    await new Promise<void>((resolve) => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        resolve();
        return;
      }
      video.onloadeddata = () => resolve();
    });
    return captureFaceSample(video);
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("account");
  const queryClient = useQueryClient();
  const { user, setUser } = useUserStore();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    bio: "",
  });
  const [verificationSession, setVerificationSession] = useState<FaceVerificationSessionResponse | null>(null);
  const [passkeyAction, setPasskeyAction] = useState<PasskeyActionState>("idle");
  const [faceTemplateAction, setFaceTemplateAction] = useState<FaceTemplateActionState>("idle");

  const passkeysSupported =
    typeof window !== "undefined" &&
    "PublicKeyCredential" in window &&
    Boolean(navigator.credentials?.create) &&
    Boolean(navigator.credentials?.get);

  const cameraSupported =
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia);

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

  const startFaceVerification = useMutation({
    mutationFn: () => http.post<FaceVerificationSessionResponse>("/identity/face-verification/sessions", {}),
    onSuccess: (session) => {
      setVerificationSession(session);
      setMessage({ type: 'success', text: "Face verification session started" });
    },
    onError: () => setMessage({ type: 'error', text: "Unable to start face verification" }),
  });

  const submitFaceVerification = useMutation({
    mutationFn: (scenario: "pass" | "fail" | "uncertain") =>
      http.post<FaceVerificationSessionResponse>(`/identity/face-verification/sessions/${verificationSession?.id}/submit`, {
        scenario: scenario === "pass" ? null : scenario,
      }),
    onSuccess: (session) => {
      setVerificationSession(session);
      setMessage({ type: session.status === "verified" ? 'success' : 'error', text: `Face verification ${session.status}` });
    },
    onError: () => setMessage({ type: 'error', text: "Unable to submit face verification" }),
  });

  const startPasskeyEnrollment = async () => {
    if (!passkeysSupported) {
      setMessage({ type: "error", text: "This browser does not support Face ID/passkeys" });
      return;
    }

    setPasskeyAction("enrolling");
    setMessage(null);

    try {
      const challenge = await http.post<PasskeyEnrollmentChallengeResponse>(
        "/identity/face-verification/passkeys/enrollment/challenge",
        {
          authenticator_attachment: "platform",
          device_label: "Primary browser",
        },
      );
      const credential = await navigator.credentials.create({
        publicKey: toCreationOptions(challenge.public_key),
      });

      if (!(credential instanceof PublicKeyCredential)) {
        throw new Error("Face ID/passkey enrollment was not completed");
      }

      await http.post<FaceVerificationProfileResponse>(
        "/identity/face-verification/passkeys/enrollment/complete",
        {
          challenge_id: challenge.challenge_id,
          credential: serializeAttestationCredential(credential),
        },
      );

      setMessage({ type: "success", text: "Face ID/passkey enrolled for verification" });
      await queryClient.invalidateQueries({ queryKey: ["face-verification-profiles"] });
    } catch (error) {
      setMessage({ type: "error", text: getPasskeyErrorMessage(error) });
    } finally {
      setPasskeyAction("idle");
    }
  };

  const verifyPasskeySession = async () => {
    if (!passkeysSupported) {
      setMessage({ type: "error", text: "This browser does not support Face ID/passkeys" });
      return;
    }

    setPasskeyAction("verifying");
    setMessage(null);

    try {
      const challenge = await http.post<PasskeyVerificationChallengeResponse>(
        "/identity/face-verification/passkeys/verification/challenge",
        {},
      );
      const credential = await navigator.credentials.get({
        publicKey: toRequestOptions(challenge.public_key),
      });

      if (!(credential instanceof PublicKeyCredential)) {
        throw new Error("Face ID/passkey verification was not completed");
      }

      const session = await http.post<FaceVerificationSessionResponse>(
        "/identity/face-verification/passkeys/verification/complete",
        {
          challenge_id: challenge.challenge_id,
          credential: serializeAssertionCredential(credential),
        },
      );

      setVerificationSession(session);
      setMessage({
        type: session.status === "verified" ? "success" : "error",
        text: `Face ID/passkey verification ${session.status}`,
      });
    } catch (error) {
      setMessage({ type: "error", text: getPasskeyErrorMessage(error) });
    } finally {
      setPasskeyAction("idle");
    }
  };

  const enrollFaceFromCamera = async () => {
    if (!cameraSupported) {
      setMessage({ type: "error", text: "This browser does not support camera capture" });
      return;
    }

    setFaceTemplateAction("enrolling");
    setMessage(null);

    try {
      const faceSample = await captureFaceSampleFromCamera();
      await http.post<FaceVerificationProfileResponse>("/identity/face-verification/faces/enroll", {
        device_label: "Primary camera",
        consent: true,
        face_sample: faceSample,
      });
      setMessage({ type: "success", text: "Face template enrolled from camera. Raw frames are not stored." });
      await queryClient.invalidateQueries({ queryKey: ["face-verification-profiles"] });
    } catch (error) {
      setMessage({ type: "error", text: getPasskeyErrorMessage(error) });
    } finally {
      setFaceTemplateAction("idle");
    }
  };

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
              <h3>Face ID / Live Camera Verification</h3>
              <p>Enroll a camera face template so live video checks can confirm the player at the board is you.</p>
            </div>
          </div>

          <div className="stub-list">
            <div className="stub-row">
              <span>{cameraSupported ? "Camera enrollment available" : "Camera enrollment unavailable"}</span>
              <span className="text-xs text-neutral-400 uppercase">{cameraSupported ? "ready" : "unsupported"}</span>
            </div>
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
                <span>No Face ID/passkey profile enrolled</span>
                <span className="text-xs text-neutral-400 uppercase">not set</span>
              </div>
            )}
          </div>

          <div className="form-actions flex-wrap gap-2">
            <Button
              onClick={enrollFaceFromCamera}
              disabled={!cameraSupported || faceTemplateAction !== "idle"}
            >
              <Shield size={18} /> {faceTemplateAction === "enrolling" ? "Enrolling..." : "Enroll Face from Camera"}
            </Button>
            <Button
              variant="secondary"
              onClick={startPasskeyEnrollment}
              disabled={!passkeysSupported || passkeyAction !== "idle"}
            >
              <Shield size={18} /> {passkeyAction === "enrolling" ? "Enrolling..." : "Enroll Device Passkey"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => enrollFaceVerification.mutate()}
              disabled={enrollFaceVerification.isPending || passkeyAction !== "idle"}
            >
              <Camera size={18} /> Dev Stub Enrollment
            </Button>
          </div>
        </Card>

        <Card className="settings-card mt-6">
          <div className="avatar-upload-group" style={{ marginBottom: 24 }}>
            <div className="avatar-preview-wrapper">
              <div className="settings-avatar-preview flex items-center justify-center bg-black">
                <Shield size={30} className="text-violet-300" />
              </div>
            </div>
            <div className="avatar-info">
              <h3>Passkey Verification Check</h3>
              <p>Verify the current session with your device passkey. Local simulation remains available for development.</p>
            </div>
          </div>
          <div className="stub-list">
            <div className="stub-row">
              <span>{verificationSession ? `Session ${verificationSession.status}` : "No active verification session"}</span>
              <span className="text-xs text-neutral-400 uppercase">{verificationSession?.provider ?? "local"}</span>
            </div>
          </div>
          <div className="form-actions flex-wrap gap-2">
            <Button
              onClick={verifyPasskeySession}
              disabled={!passkeysSupported || passkeyAction !== "idle"}
            >
              <Shield size={18} /> {passkeyAction === "verifying" ? "Verifying..." : "Verify with Face ID"}
            </Button>
            <Button variant="secondary" onClick={() => startFaceVerification.mutate()} disabled={startFaceVerification.isPending}>
              Dev Start Check
            </Button>
            <Button onClick={() => submitFaceVerification.mutate("pass")} disabled={!verificationSession || submitFaceVerification.isPending}>
              Dev Verify
            </Button>
            <Button variant="ghost" onClick={() => submitFaceVerification.mutate("uncertain")} disabled={!verificationSession || submitFaceVerification.isPending}>
              Dev Uncertain
            </Button>
            <Button variant="danger" onClick={() => submitFaceVerification.mutate("fail")} disabled={!verificationSession || submitFaceVerification.isPending}>
              Dev Fail
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
    <AppShell
      eyebrow="Account"
      title="Settings"
      description="Manage your profile, account safety, notifications, and board preferences."
      maxWidthClassName="max-w-6xl"
    >
    <div className="settings-root settings-embedded">
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
    </AppShell>
  );
}
