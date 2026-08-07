/**
 * Thin fetch wrapper — the only place that knows about HTTP. Every
 * `api/*` module calls through this; feature code never calls `fetch`
 * directly. Injects the auth header, normalizes non-2xx responses into a
 * typed ApiError, and notifies listeners on 401 so session state can be
 * cleared app-wide without this module needing to know about React.
 */

export const AUTH_TOKEN_KEY = "auth_token";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/** Subscribe to global 401 events (e.g. an expired/invalid token). Returns an unsubscribe function. */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip attaching the Authorization header even if a token is stored
   * (used for register/login, where a stale token shouldn't be sent). */
  skipAuth?: boolean;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, skipAuth, headers: headersInit, ...rest } = options;

  const headers = new Headers(headersInit);
  headers.set("Content-Type", "application/json");

  if (!skipAuth) {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    unauthorizedListeners.forEach((listener) => listener());
  }

  if (!response.ok) {
    let detail = response.statusText || `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (typeof data?.detail === "string") detail = data.detail;
    } catch {
      // response body wasn't JSON (or was empty) — keep the fallback detail
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
