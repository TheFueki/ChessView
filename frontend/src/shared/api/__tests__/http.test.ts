import { beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpError } from "../http";
import { useUserStore, type AuthenticatedUser } from "@/entities/user";

const USER: AuthenticatedUser = {
  id: "user-1",
  username: "Ada",
  email: "ada@example.test",
  rating: 1510,
  created_at: "2026-06-01T00:00:00Z",
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

describe("http client", () => {
  beforeEach(() => {
    useUserStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      hasHydrated: true,
      isBootstrapping: false,
    });
  });

  it("adds json and bearer headers and prefixes API endpoints", async () => {
    useUserStore.getState().setAuth(USER, "access-token", "refresh-token");
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);

    await expect(http.post("/games", { rated: true })).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/games",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ rated: true }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer access-token",
        },
      }),
    );
  });

  it("does not set a json content type for FormData uploads", async () => {
    const formData = new FormData();
    formData.set("avatar", new Blob(["image"]));
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ uploaded: true })));
    vi.stubGlobal("fetch", fetchMock);

    await http.post("/profiles/me/avatar", formData);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/profiles/me/avatar",
      expect.objectContaining({
        body: formData,
        headers: {},
      }),
    );
  });

  it("wraps network failures in HttpError", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))));

    await expect(http.get("/profiles/me")).rejects.toMatchObject({
      name: "HttpError",
      status: 0,
      code: "NETWORK_ERROR",
      message: "offline",
    });
  });

  it("clears auth on authenticated 401 responses", async () => {
    window.history.pushState({}, "", "/login");
    useUserStore.getState().setAuth(USER, "expired-token", "refresh-token");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse({ detail: "Token expired", code: "AUTH_EXPIRED" }, { status: 401 }))),
    );

    await expect(http.get("/profiles/me")).rejects.toBeInstanceOf(HttpError);

    expect(useUserStore.getState().isAuthenticated).toBe(false);
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
