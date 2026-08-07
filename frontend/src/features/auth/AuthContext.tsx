/**
 * Session/auth state — the one piece of genuinely cross-cutting client
 * state in the app, per the architecture plan (everything else is either
 * server state via TanStack Query or local component state).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import * as authApi from "../../api/auth";
import { AUTH_TOKEN_KEY, onUnauthorized } from "../../api/client";
import type { LoginPayload, RegisterPayload, User } from "../../api/types";

export type AuthStatus = "idle" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  /** True right after a 401 cleared a previously-authenticated session —
   * consumed by the login page to show a "session expired" banner. */
  sessionExpired: boolean;
  clearSessionExpired: () => void;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

// Exported (in addition to the useAuth hook below) so tests can render a
// fixed auth state without hitting the real bootstrap/API flow.
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [sessionExpired, setSessionExpired] = useState(false);

  // Boot: validate any stored token against the real backend rather than
  // trusting its mere presence — an expired/tampered token should not
  // produce a flash of "authenticated" UI.
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        if (!cancelled) setStatus("unauthenticated");
        return;
      }
      try {
        const me = await authApi.getCurrentUser();
        if (!cancelled) {
          setUser(me);
          setStatus("authenticated");
        }
      } catch {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        if (!cancelled) {
          setUser(null);
          setStatus("unauthenticated");
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  // Global 401 handling: any API call anywhere in the app that comes back
  // unauthorized clears the session, so route guards naturally redirect
  // to /login on next render.
  useEffect(
    () =>
      onUnauthorized(() => {
        const wasAuthenticated = Boolean(localStorage.getItem(AUTH_TOKEN_KEY));
        localStorage.removeItem(AUTH_TOKEN_KEY);
        setUser(null);
        setStatus("unauthenticated");
        if (wasAuthenticated) setSessionExpired(true);
      }),
    [],
  );

  const login = useCallback(async (payload: LoginPayload) => {
    const token = await authApi.loginUser(payload);
    localStorage.setItem(AUTH_TOKEN_KEY, token.access_token);
    const me = await authApi.getCurrentUser();
    setUser(me);
    setStatus("authenticated");
  }, []);

  const register = useCallback(
    async (payload: RegisterPayload) => {
      await authApi.registerUser(payload);
      // Auto-login after successful registration, per the UX plan.
      await login(payload);
    },
    [login],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logoutUser();
    } catch {
      // Best-effort: tokens are stateless server-side, so the client
      // discarding it below is what actually matters.
    }
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setUser(null);
    setStatus("unauthenticated");
  }, []);

  const clearSessionExpired = useCallback(() => setSessionExpired(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, sessionExpired, clearSessionExpired, login, register, logout }),
    [user, status, sessionExpired, clearSessionExpired, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
