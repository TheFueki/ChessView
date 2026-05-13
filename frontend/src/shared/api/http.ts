import { getPersistedAccessToken, useUserStore } from "@/entities/user";
import { API_BASE_URL } from "@/shared/config";

export class HttpError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status = 500, code: string | null = null) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}

function getAccessToken(): string | null {
  const state = useUserStore.getState();
  return state.accessToken || getPersistedAccessToken();
}

function isFormDataBody(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

/**
 *                                            URL
 */
function buildUrl(base: string, endpoint: string): string {
  const baseUrl = base.endsWith("/") ? base.slice(0, -1) : base;
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${baseUrl}${path}`;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();
  const isFormData = isFormDataBody(options.body);
  
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!isFormData) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const fullUrl = buildUrl(API_BASE_URL, endpoint);

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new HttpError(
      error instanceof Error ? error.message : "Network failure",
      0,
      "NETWORK_ERROR",
    );
  }

  if (!response.ok) {
    const errorBody = await response
      .json()
      .catch(() => ({ detail: "Request failed", code: null }));

    if (response.status === 401 && token) {
      useUserStore.getState().clearAuth();
      if (!window.location.pathname.includes('/login')) {
        window.location.href = "/login";
      }
    }

    throw new HttpError(
      errorBody.detail || errorBody.message || `Error ${response.status}`,
      response.status,
      errorBody.code ?? null,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const http = {
  get: <T>(endpoint: string) => 
    request<T>(endpoint, { method: "GET" }),

  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: "POST",
      body: isFormDataBody(body) ? body : body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: "PUT",
      body: isFormDataBody(body) ? body : body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: "PATCH",
      body: isFormDataBody(body) ? body : body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string) => 
    request<T>(endpoint, { method: "DELETE" }),
};