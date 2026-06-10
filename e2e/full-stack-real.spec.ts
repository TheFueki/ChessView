import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

const backendUrl = process.env.E2E_BACKEND_URL ?? "http://127.0.0.1:8000";
const adminUrl = process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:5174";
const password = "ChessView123!";

type AuthSession = {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    username: string;
    email: string;
    rating: number;
    role?: "user" | "admin";
    banned_at?: string | null;
    bio?: string | null;
    avatar_url?: string | null;
    created_at?: string;
  };
};

async function apiPost<T>(api: APIRequestContext, path: string, body: unknown, token?: string): Promise<T> {
  const response = await api.post(`/api/v1${path}`, {
    data: body,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  expect(response.ok(), `${path} returned ${response.status()} ${await response.text()}`).toBeTruthy();
  return response.json() as Promise<T>;
}

async function apiGet<T>(api: APIRequestContext, path: string, token?: string): Promise<T> {
  const response = await api.get(`/api/v1${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  expect(response.ok(), `${path} returned ${response.status()} ${await response.text()}`).toBeTruthy();
  return response.json() as Promise<T>;
}

async function registerUser(api: APIRequestContext, username: string): Promise<AuthSession> {
  return apiPost<AuthSession>(api, "/identity/register", {
    username,
    email: `${username}@example.com`,
    password,
  });
}

async function login(api: APIRequestContext, email: string, loginPassword = password): Promise<AuthSession> {
  return apiPost<AuthSession>(api, "/identity/login", { email, password: loginPassword });
}

async function installUserSession(page: Page, session: AuthSession) {
  await page.addInitScript((auth) => {
    window.localStorage.setItem(
      "chessview-auth",
      JSON.stringify({
        state: {
          accessToken: auth.access_token,
          refreshToken: auth.refresh_token,
          isAuthenticated: true,
          user: auth.user,
        },
        version: 0,
      }),
    );
  }, session);
}

test.describe("real Docker stack workflows", () => {
  test("runs core user, scheduling, tournament, puzzle, and admin flows", async ({ browser, page }) => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const api = await request.newContext({ baseURL: backendUrl });

    const alice = await registerUser(api, `alice${suffix}`);
    const bob = await registerUser(api, `bob${suffix}`);

    await installUserSession(page, alice);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "ChessView" })).toBeVisible();
    await expect(page.getByText(/find an opponent/i)).toBeVisible();

    await page.goto("/settings");
    await page.getByPlaceholder(/tell the world/i).fill(`Full-stack E2E ${suffix}`);
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText(/profile changes saved/i)).toBeVisible();

    const updatedMe = await apiGet<{ bio: string | null }>(api, "/identity/me", alice.access_token);
    expect(updatedMe.bio).toBe(`Full-stack E2E ${suffix}`);

    await page.goto("/leaderboard");
    await expect(page.getByText(new RegExp(`alice${suffix}`, "i")).first()).toBeVisible();

    await page.goto("/analysis");
    await page.getByText(/fen input/i).waitFor();
    await page.locator("textarea").first().fill("6k1/5Q2/6K1/8/8/8/8/8 w - - 0 1");
    await page.getByRole("button", { name: /^load$/i }).click();
    await expect(page.getByText(/fen loaded/i)).toBeVisible();

    const puzzles = await apiGet<{ items: Array<{ id: string }> }>(api, "/puzzles?size=1", alice.access_token);
    expect(puzzles.items.length).toBeGreaterThan(0);
    const attempt = await apiPost<{ last_result: string; solved: boolean }>(
      api,
      `/puzzles/${puzzles.items[0].id}/attempts`,
      { result: "solved" },
      alice.access_token,
    );
    expect(attempt.last_result).toBe("solved");
    expect(attempt.solved).toBe(true);
    await page.goto("/puzzles");
    await expect(page.getByText(/puzzle trainer/i)).toBeVisible();

    const startsAt = new Date(Date.now() - 60_000).toISOString();
    const scheduled = await apiPost<{ id: string; status: string }>(
      api,
      "/scheduled-matches",
      { invited_user_id: bob.user.id, starts_at: startsAt },
      alice.access_token,
    );
    expect(scheduled.status).toBe("pending_acceptance");
    const accepted = await apiPost<{ status: string }>(
      api,
      `/scheduled-matches/${scheduled.id}/accept`,
      {},
      bob.access_token,
    );
    expect(accepted.status).toBe("accepted");
    const started = await apiPost<{ status: string; game_id: string }>(
      api,
      `/scheduled-matches/${scheduled.id}/start`,
      {},
      alice.access_token,
    );
    expect(started.status).toBe("live");
    expect(started.game_id).toBeTruthy();
    await page.goto("/scheduled-matches");
    await expect(page.getByText(/scheduled/i)).toBeVisible();

    const tournament = await apiPost<{ id: string; status: string; player_count: number }>(
      api,
      "/tournaments",
      {
        name: `E2E Swiss ${suffix}`,
        time_control_name: "5+0",
        tournament_type: "swiss",
        entry_fee_cents: 0,
        total_rounds: 1,
      },
      alice.access_token,
    );
    expect(tournament.player_count).toBe(1);
    await apiPost(api, `/tournaments/${tournament.id}/publish`, {}, alice.access_token);
    await apiPost(api, `/tournaments/${tournament.id}/open-registration`, {}, alice.access_token);
    const joined = await apiPost<{ player_count: number }>(
      api,
      `/tournaments/${tournament.id}/join`,
      {},
      bob.access_token,
    );
    expect(joined.player_count).toBe(2);
    const startedTournament = await apiPost<{ status: string }>(
      api,
      `/tournaments/${tournament.id}/start`,
      {},
      alice.access_token,
    );
    expect(startedTournament.status).toBe("active");
    const standings = await apiGet<Array<{ player: { username: string } }>>(
      api,
      `/tournaments/${tournament.id}/standings`,
      alice.access_token,
    );
    expect(standings.map((standing) => standing.player.username)).toContain(`alice${suffix}`);
    await page.goto(`/tournaments/${tournament.id}`);
    await expect(page.getByText(`E2E Swiss ${suffix}`)).toBeVisible();

    const adminSession = await login(api, "admin@chessview.app", "admin123");
    expect(adminSession.user.role).toBe("admin");
    const adminPage = await browser.newPage();
    await adminPage.goto(adminUrl);
    await adminPage.getByLabel(/email/i).fill("admin@chessview.app");
    await adminPage.getByLabel(/password/i).fill("admin123");
    await adminPage.getByRole("button", { name: /sign in|login/i }).click();
    await expect(adminPage.getByText(/admin/i).first()).toBeVisible();
    await expect(adminPage.getByText(new RegExp(`alice${suffix}`, "i")).first()).toBeVisible();
    await adminPage.close();

    await api.dispose();
  });
});
