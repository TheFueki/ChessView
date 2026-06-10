import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import AdminApp, { adminDelete, adminGet, adminPatch, adminPost } from "./AdminApp";
import { adminRoutes, installFetchMock } from "./test/http";
import { adminDatasets, adminSession, adminUser } from "./test/fixtures";

const authStorageKey = "chessview-admin-auth";

describe("admin API helpers", () => {
  it("sends bearer tokens, JSON bodies, and surfaces response errors", async () => {
    const { calls } = installFetchMock({
      "GET /admin/users": adminDatasets.users,
      "POST /admin/users/user-1/ban": adminDatasets.users[0],
      "PATCH /admin/users/user-1": adminDatasets.users[0],
      "DELETE /admin/users/user-1": new Response(null, { status: 204 }),
      "GET /admin/payments": new Response("Not authorized", { status: 401 }),
    });

    await expect(adminGet("/admin/users", "token-1")).resolves.toEqual(adminDatasets.users);
    await expect(adminPost("/admin/users/user-1/ban", "token-1")).resolves.toEqual(adminDatasets.users[0]);
    await expect(adminPatch("/admin/users/user-1", { rating: 1500 }, "token-1")).resolves.toEqual(adminDatasets.users[0]);
    await expect(adminDelete("/admin/users/user-1", "token-1")).resolves.toBeUndefined();
    await expect(adminGet("/admin/payments", "token-1")).rejects.toThrow("Not authorized");

    expect(calls).toMatchObject([
      { method: "GET", path: "/admin/users", authorization: "Bearer token-1" },
      { method: "POST", path: "/admin/users/user-1/ban", body: {}, authorization: "Bearer token-1" },
      { method: "PATCH", path: "/admin/users/user-1", body: { rating: 1500 }, authorization: "Bearer token-1" },
      { method: "DELETE", path: "/admin/users/user-1", authorization: "Bearer token-1" },
      { method: "GET", path: "/admin/payments", authorization: "Bearer token-1" },
    ]);
  });
});

describe("AdminApp login and session handling", () => {
  it("logs in an admin, stores the session, and loads admin data", async () => {
    const user = userEvent.setup();
    const { calls } = installFetchMock(
      adminRoutes({
        "POST /identity/login": {
          user: adminUser,
          access_token: adminSession.accessToken,
          refresh_token: adminSession.refreshToken,
        },
      }),
    );

    render(<AdminApp />);

    await user.type(screen.getByLabelText("Email"), "admin@example.com");
    await user.type(screen.getByLabelText("Password"), "admin123");
    await user.click(screen.getByRole("button", { name: "Sign in to Admin" }));

    expect(await screen.findByText("ada")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(authStorageKey) ?? "{}")).toMatchObject(adminSession);
    expect(calls[0]).toMatchObject({
      method: "POST",
      path: "/identity/login",
      body: { email: "admin@example.com", password: "admin123" },
    });
  });

  it("rejects non-admin login responses without storing a session", async () => {
    const user = userEvent.setup();
    installFetchMock({
      "POST /identity/login": {
        user: { ...adminUser, role: "user" },
        access_token: "access-token",
        refresh_token: "refresh-token",
      },
    });

    render(<AdminApp />);

    await user.type(screen.getByLabelText("Email"), "player@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in to Admin" }));

    expect(await screen.findByText("This account does not have admin access.")).toBeInTheDocument();
    expect(window.localStorage.getItem(authStorageKey)).toBeNull();
  });

  it("uses a stored admin session and clears malformed session data", async () => {
    window.localStorage.setItem(authStorageKey, JSON.stringify(adminSession));
    installFetchMock(adminRoutes());

    const { unmount } = render(<AdminApp />);

    expect(await screen.findByText("ada")).toBeInTheDocument();
    unmount();

    window.localStorage.setItem(authStorageKey, "not-json");
    render(<AdminApp />);

    expect(screen.getByRole("heading", { name: "Admin sign in" })).toBeInTheDocument();
    expect(window.localStorage.getItem(authStorageKey)).toBeNull();
  });
});
