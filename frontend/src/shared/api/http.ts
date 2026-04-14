/**
 * HTTP client with JWT auth header injection.
 */

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
  return getPersistedAccessToken();
}

function isFormDataBody(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
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

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (error) {
    throw new HttpError(
      error instanceof Error ? error.message : "Unable to reach the backend right now.",
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
    }

    throw new HttpError(
      errorBody.detail || `HTTP ${response.status}`,
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
  get: <T>(endpoint: string) => request<T>(endpoint),
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
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),
};
