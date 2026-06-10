import { expect, test } from "@playwright/test";

const adminUrl = process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:5174";

test.describe("desktop browser workflows", () => {
  test("loads the public player app and navigates to auth", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/ChessView/i);
    await expect(page.getByRole("link", { name: /login/i }).first()).toBeVisible();

    await page.getByRole("link", { name: /login/i }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: /sign in|login/i })).toBeVisible();
  });

  test("loads a mocked authenticated dashboard in a desktop viewport", async ({ page }) => {
    await page.route("**/api/v1/identity/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "11111111-1111-4111-8111-111111111111",
          username: "alice",
          email: "alice@example.test",
          rating: 1510,
          wins: 4,
          losses: 2,
          draws: 1,
          coins: 120,
          role: "user",
          is_banned: false,
          bio: "Deterministic E2E user",
          country: "KZ",
          avatar_url: null,
        }),
      });
    });
    await page.route("**/api/v1/profiles/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "11111111-1111-4111-8111-111111111111",
          username: "alice",
          rating: 1510,
          ratings: { "5+0": 1510, "10+0": 1490 },
          wins: 4,
          losses: 2,
          draws: 1,
          coins: 120,
          avatar_url: null,
          bio: "Deterministic E2E user",
          country: "KZ",
          recent_games: [],
        }),
      });
    });
    await page.route("**/api/v1/games", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], total: 0, page: 1, size: 20 }),
      });
    });
    await page.route("**/api/v1/tournaments", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.addInitScript(() => {
      window.localStorage.setItem(
        "chessview-auth",
        JSON.stringify({
          state: {
            accessToken: "e2e-access",
            refreshToken: "e2e-refresh",
            isAuthenticated: true,
            user: {
              id: "11111111-1111-4111-8111-111111111111",
              username: "alice",
              email: "alice@example.test",
              rating: 1510,
              role: "user",
              is_banned: false,
            },
          },
          version: 0,
        }),
      );
    });

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "ChessView" })).toBeVisible();
    await expect(page.getByRole("button", { name: /play/i }).first()).toBeVisible();
    await expect(page.getByText(/find an opponent/i)).toBeVisible();
  });

  test("loads the admin login shell", async ({ page }) => {
    await page.goto(adminUrl);

    await expect(page).toHaveTitle(/ChessView/i);
    await expect(page.getByRole("button", { name: /sign in|login/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });
});
