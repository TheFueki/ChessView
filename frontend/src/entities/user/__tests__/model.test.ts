import { describe, expect, it } from "vitest";
import { getPersistedAccessToken, useUserStore, type AuthenticatedUser } from "../model";

const USER: AuthenticatedUser = {
  id: "user-1",
  username: "Ada",
  email: "ada@example.test",
  rating: 1510,
  created_at: "2026-06-01T00:00:00Z",
};

function resetUserStore() {
  useUserStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    hasHydrated: true,
    isBootstrapping: false,
  });
}

describe("user auth store", () => {
  it("persists tokens for session recovery", () => {
    resetUserStore();

    useUserStore.getState().setAuth(USER, "persisted-access", "persisted-refresh");

    expect(getPersistedAccessToken()).toBe("persisted-access");
    expect(JSON.parse(localStorage.getItem("chessview-auth") ?? "{}")).toMatchObject({
      state: {
        accessToken: "persisted-access",
        refreshToken: "persisted-refresh",
        isAuthenticated: true,
      },
    });
  });

  it("clears persisted auth when logging out", () => {
    resetUserStore();
    useUserStore.getState().setAuth(USER, "access-token", "refresh-token");

    useUserStore.getState().logout();

    expect(useUserStore.getState().isAuthenticated).toBe(false);
    expect(getPersistedAccessToken()).toBeNull();
    expect(JSON.parse(localStorage.getItem("chessview-auth") ?? "{}")).toMatchObject({
      state: {
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      },
    });
  });
});
