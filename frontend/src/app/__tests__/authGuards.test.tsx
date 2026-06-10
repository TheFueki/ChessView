import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Route, Routes, useLocation } from "react-router";
import { RequireAuth, RedirectIfAuthenticated } from "../router";
import { useUserStore, type AuthenticatedUser } from "@/entities/user";
import { renderWithProviders } from "@/test/render";

const USER: AuthenticatedUser = {
  id: "user-1",
  username: "Ada",
  email: "ada@example.test",
  rating: 1510,
  created_at: "2026-06-01T00:00:00Z",
};

function resetAuthState() {
  useUserStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    hasHydrated: true,
    isBootstrapping: false,
  });
}

function LoginProbe() {
  const location = useLocation();
  return (
    <div>
      <div>Login route</div>
      <div data-testid="login-search">{location.search}</div>
    </div>
  );
}

describe("auth route guards", () => {
  it("redirects unauthenticated users to login with the requested route preserved", async () => {
    resetAuthState();

    renderWithProviders(
      <Routes>
        <Route
          path="/analysis"
          element={
            <RequireAuth>
              <div>Analysis board</div>
            </RequireAuth>
          }
        />
        <Route path="/login" element={<LoginProbe />} />
      </Routes>,
      { route: "/analysis?gameId=game-7" },
    );

    expect(await screen.findByText("Login route")).toBeInTheDocument();
    expect(screen.getByTestId("login-search")).toHaveTextContent("redirectTo=%2Fanalysis%3FgameId%3Dgame-7");
  });

  it("renders protected content once the session is hydrated and authenticated", () => {
    resetAuthState();
    useUserStore.getState().setAuth(USER, "access-token", "refresh-token");
    useUserStore.getState().setHydrated(true);

    renderWithProviders(
      <Routes>
        <Route
          path="/lobby"
          element={
            <RequireAuth>
              <div>Lobby route</div>
            </RequireAuth>
          }
        />
      </Routes>,
      { route: "/lobby" },
    );

    expect(screen.getByText("Lobby route")).toBeInTheDocument();
  });

  it("sends authenticated users away from login to a safe post-auth path", async () => {
    resetAuthState();
    useUserStore.getState().setAuth(USER, "access-token", "refresh-token");
    useUserStore.getState().setHydrated(true);

    renderWithProviders(
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <div>Login form</div>
            </RedirectIfAuthenticated>
          }
        />
        <Route path="/puzzles" element={<div>Puzzle route</div>} />
      </Routes>,
      { route: "/login?redirectTo=/puzzles" },
    );

    expect(await screen.findByText("Puzzle route")).toBeInTheDocument();
    expect(screen.queryByText("Login form")).not.toBeInTheDocument();
  });
});
