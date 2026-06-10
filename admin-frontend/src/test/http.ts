import { vi } from "vitest";
import { API_BASE_URL } from "../AdminApp";
import { adminDatasets } from "./fixtures";

export interface FetchCall {
  path: string;
  method: string;
  body?: unknown;
  authorization?: string | null;
}

type RouteValue = unknown | Response | Promise<unknown | Response> | (() => unknown | Response | Promise<unknown | Response>);

type Routes = Record<string, RouteValue>;

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

export function adminRoutes(overrides: Routes = {}): Routes {
  return {
    "GET /admin/users": adminDatasets.users,
    "GET /admin/tournaments": adminDatasets.tournaments,
    "GET /admin/scheduled-matches": adminDatasets.matches,
    "GET /admin/games": adminDatasets.games,
    "GET /admin/shop-items": adminDatasets.shopItems,
    "GET /admin/logs": adminDatasets.logs,
    "GET /admin/payments": adminDatasets.payments,
    "GET /admin/face-verification/sessions": adminDatasets.verificationSessions,
    ...overrides,
  };
}

export function installFetchMock(routes: Routes) {
  const calls: FetchCall[] = [];

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const path = url.startsWith(API_BASE_URL) ? url.slice(API_BASE_URL.length) : url;
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;

    calls.push({
      path,
      method,
      body,
      authorization: new Headers(init?.headers).get("Authorization"),
    });

    const route = routes[`${method} ${path}`];
    if (route === undefined) {
      return new Response(`Unhandled ${method} ${path}`, { status: 500 });
    }

    const value = typeof route === "function" ? await route() : await route;
    if (value instanceof Response) {
      return value;
    }

    return jsonResponse(value);
  });

  vi.stubGlobal("fetch", fetchMock);

  return { calls, fetchMock };
}
