import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const bannedCopyChecks = [
  {
    file: "src/pages/auth-page/AuthPage.tsx",
    terms: [
      "premium workspace",
      "Intent-Preserving",
      "Real Backend Session",
      "actual JWT",
      "secure endpoints",
    ],
  },
  {
    file: "src/pages/landing-page/LandingPage.tsx",
    terms: ["tech stack", "enterprise", "uptime", "infrastructure"],
  },
];

const purplePrimitiveChecks = [
  {
    file: "src/shared/ui/Button.tsx",
    disallowed: ["emerald-"],
  },
  {
    file: "src/shared/ui/Input.tsx",
    disallowed: ["emerald-"],
  },
  {
    file: "src/shared/ui/Card.tsx",
    disallowed: ["emerald-"],
  },
  {
    file: "src/shared/ui/Avatar.tsx",
    disallowed: ["emerald-"],
  },
  {
    file: "src/shared/ui/Spinner.tsx",
    disallowed: ["emerald-"],
  },
  {
    file: "src/widgets/app-shell/AppShell.tsx",
    disallowed: ["emerald-", "overflow-x-auto"],
  },
];

const globalPaletteChecks = {
  files: [
    "src/app/AppErrorBoundary.tsx",
    "src/app/HomeRoute.tsx",
    "src/app/RouteErrorPage.tsx",
    "src/app/router.tsx",
    "src/pages/game-page/GamePage.tsx",
    "src/pages/game-review-page/GameReviewPage.tsx",
    "src/pages/history-page/HistoryPage.tsx",
    "src/pages/leaderboard-page/LeaderboardPage.tsx",
    "src/pages/profile-page/ProfilePage.tsx",
    "src/pages/puzzle-page/PuzzlePage.tsx",
    "src/pages/scheduled-matches-page/ScheduledMatchesPage.tsx",
    "src/pages/tournament-detail-page/TournamentDetailPage.tsx",
    "src/pages/tournaments-page/TournamentsPage.tsx",
    "src/widgets/history-table/HistoryTable.tsx",
    "src/widgets/matchmaking-panel/MatchmakingPanel.tsx",
    "src/widgets/video-chat-panel/VideoChatPanel.tsx",
    "src/pages-style/clubs-page/clubspage.scss",
    "src/pages-style/shop-page/shoppage.scss",
  ],
  disallowed: ["emerald-", "cyan-", "blue-", "#00d1ff", "rgba(16, 185, 129", "rgba(16,185,129"],
};

const boardSizingChecks = [
  "src/pages/analysis-page/AnalysisWorkspace.tsx",
  "src/pages/game-review-page/GameReviewPage.tsx",
  "src/pages/puzzle-page/PuzzlePage.tsx",
  "src/widgets/game-layout/GameLayout.tsx",
];

const duplicateShellChecks = [
  {
    file: "src/pages/analysis-page/AnalysisWorkspace.tsx",
    disallowed: ["LocalAppShell", "dashboard-grid", "side-panel", "main-viewport"],
  },
  {
    file: "src/pages/shop-page/ShopPage.tsx",
    disallowed: ["LocalAppShell", "dashboard-grid", "side-panel"],
  },
  {
    file: "src/pages/clubs-page/ClubsPage.tsx",
    disallowed: ["LocalAppShell", "dashboard-grid", "side-panel", "dev-overlay", "blur-content"],
  },
  {
    file: "src/pages/lobby-page/LobbyPage.tsx",
    disallowed: ["lobby-modal-overlay", "lobby-modal-card", "card-ambient-glow", "Live System"],
  },
  {
    file: "src/pages/leaderboard-page/LeaderboardPage.tsx",
    disallowed: ["leaderboard-root", "podium-section", "back-btn"],
  },
  {
    file: "src/pages/compare-page/ComparePage.tsx",
    disallowed: ["compare-header", "compare-brand", "logoImage"],
    required: ["AppShell"],
  },
  {
    file: "src/pages/scheduled-matches-page/ScheduledMatchesPage.tsx",
    disallowed: ["<main className=\"min-h-screen"],
    required: ["AppShell"],
  },
  {
    file: "src/widgets/app-shell/AppShell.tsx",
    disallowed: ["<nav className=\"scrollbar-none", "overflow-x-auto"],
    required: ["<aside", "lg:pl-72"],
  },
];

const noGradientChecks = [
  "src/app",
  "src/pages",
  "src/pages-style",
  "src/shared",
  "src/widgets",
];

const failures = [];

const leaderboardText = readFileSync(join(root, "src/pages/leaderboard-page/LeaderboardPage.tsx"), "utf8");
for (const token of ["Bullet", "Blitz", "Rapid", "Classical", "selectedCategory", "category: selectedCategory"]) {
  if (!leaderboardText.includes(token)) {
    failures.push(`src/pages/leaderboard-page/LeaderboardPage.tsx must support rating category filters: "${token}"`);
  }
}

const appRouterText = readFileSync(join(root, "src/app/router.tsx"), "utf8");
for (const token of ["AdminPage", 'path: "/admin"', "pages/admin-page"]) {
  if (appRouterText.includes(token)) {
    failures.push(`src/app/router.tsx must keep admin out of the general player app: "${token}"`);
  }
}

const appShellText = readFileSync(join(root, "src/widgets/app-shell/AppShell.tsx"), "utf8");
for (const token of ['label: "Control"', 'label: "Admin"', 'to="/admin"']) {
  if (appShellText.includes(token)) {
    failures.push(`src/widgets/app-shell/AppShell.tsx must not expose admin navigation in the player shell: "${token}"`);
  }
}
for (const token of ["setTheme", "chessview-theme", "Sun", "Moon", "bg-violet-500/12", "text-violet-100"]) {
  if (appShellText.includes(token)) {
    failures.push(`src/widgets/app-shell/AppShell.tsx must use the Lichess-clean steady shell, not toggles/purple chrome: "${token}"`);
  }
}

const globalsText = readFileSync(join(root, "src/app/styles/globals.css"), "utf8");
for (const token of ['data-theme="light"', "#646cff", "#7c3aed", "#6d28d9"]) {
  if (globalsText.includes(token)) {
    failures.push(`src/app/styles/globals.css must remove old purple/light-theme palette for Lichess-clean: "${token}"`);
  }
}
for (const token of ["--color-board-light", "--color-board-dark", "--color-accent: #8b8b8b"]) {
  if (!globalsText.includes(token)) {
    failures.push(`src/app/styles/globals.css must define calm chess platform tokens: "${token}"`);
  }
}

for (const file of ["../admin-frontend/package.json", "../admin-frontend/src/main.tsx", "../admin-frontend/src/AdminApp.tsx"]) {
  if (!existsSync(join(root, file))) {
    failures.push(`Separated admin package is missing: ${file}`);
  }
}
for (const file of ["admin.html", "src/admin/main.tsx", "src/admin/AdminApp.tsx", "src/pages/admin-page/AdminPage.tsx"]) {
  if (existsSync(join(root, file))) {
    failures.push(`Public frontend must not contain admin package source: ${file}`);
  }
}
const separatedAdminAppPath = join(root, "../admin-frontend/src/AdminApp.tsx");
if (existsSync(separatedAdminAppPath)) {
  const adminAppText = readFileSync(separatedAdminAppPath, "utf8");
  for (const token of ["/identity/login", "AdminLoginForm", "setAuth"]) {
    if (!adminAppText.includes(token)) {
      failures.push(`admin-frontend/src/AdminApp.tsx must support login inside the separated admin service: "${token}"`);
    }
  }
}

const settingsText = readFileSync(join(root, "src/pages/settings-page/SettingsPage.tsx"), "utf8");
for (const token of ["navigator.mediaDevices.getUserMedia", "captureFaceSample", "enrollFaceFromCamera", "/identity/face-verification/faces/enroll"]) {
  if (!settingsText.includes(token)) {
    failures.push(`src/pages/settings-page/SettingsPage.tsx must use camera face enrollment for FaceID: "${token}"`);
  }
}

const videoChatText = readFileSync(join(root, "src/widgets/video-chat-panel/VideoChatPanel.tsx"), "utf8");
for (const token of ["verifyFaceFromVideo", "/identity/face-verification/faces/verify", "captureFaceSample"]) {
  if (!videoChatText.includes(token)) {
    failures.push(`src/widgets/video-chat-panel/VideoChatPanel.tsx must verify live players from video: "${token}"`);
  }
}

const configText = readFileSync(join(root, "src/shared/config/index.ts"), "utf8");
if (!configText.includes('?? "http://localhost:8000"')) {
  failures.push("src/shared/config/index.ts must default VITE_SERVER_URL to http://localhost:8000 for fresh local dev");
}

for (const check of bannedCopyChecks) {
  const text = readFileSync(join(root, check.file), "utf8").toLowerCase();
  for (const term of check.terms) {
    if (text.includes(term.toLowerCase())) {
      failures.push(`${check.file} still contains SaaS/dev copy: "${term}"`);
    }
  }
}

for (const check of purplePrimitiveChecks) {
  const text = readFileSync(join(root, check.file), "utf8");
  for (const token of check.disallowed) {
    if (text.includes(token)) {
      failures.push(`${check.file} still uses non-purple primitive token: "${token}"`);
    }
  }
}

for (const file of globalPaletteChecks.files) {
  const text = readFileSync(join(root, file), "utf8");
  for (const token of globalPaletteChecks.disallowed) {
    if (text.includes(token)) {
      failures.push(`${file} still uses off-palette token: "${token}"`);
    }
  }
}

for (const file of boardSizingChecks) {
  const text = readFileSync(join(root, file), "utf8");
  if (text.includes("calc(100vw")) {
    failures.push(`${file} sizes a chessboard from viewport width instead of container width`);
  }
  if (text.includes("100vw-42rem")) {
    failures.push(`${file} uses brittle sidebar subtraction for the board`);
  }
}

for (const check of duplicateShellChecks) {
  const text = readFileSync(join(root, check.file), "utf8");
  for (const token of check.disallowed) {
    if (text.includes(token)) {
      failures.push(`${check.file} still carries duplicate shell/modal design: "${token}"`);
    }
  }
  for (const token of check.required ?? []) {
    if (!text.includes(token)) {
      failures.push(`${check.file} must use shared platform primitive: "${token}"`);
    }
  }
}

const { readdirSync, statSync } = await import("node:fs");
function walk(dir) {
  const abs = join(root, dir);
  return readdirSync(abs).flatMap((name) => {
    const path = join(abs, name);
    const stat = statSync(path);
    if (stat.isDirectory()) return walk(path.slice(root.length + 1));
    return /\.(tsx|scss|css)$/.test(path) ? [path] : [];
  });
}

for (const dir of noGradientChecks) {
  for (const file of walk(dir)) {
    const text = readFileSync(file, "utf8");
    for (const token of ["linear-gradient", "radial-gradient", "conic-gradient", "bg-gradient"]) {
      if (text.includes(token)) {
        failures.push(`${file.slice(root.length + 1)} still uses gradient styling: "${token}"`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("UI consistency checks passed.");
