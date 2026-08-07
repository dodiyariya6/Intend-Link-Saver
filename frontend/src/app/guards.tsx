import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../features/auth/AuthContext";
import { FullPageLoader } from "./FullPageLoader";

/** Protects a route: unauthenticated -> redirect to /login (preserving the
 * intended destination); status "idle" (still validating a stored token)
 * -> loading, not an immediate redirect, to avoid a flash-to-login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "idle") return <FullPageLoader />;
  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

/** For /login and /register: an already-authenticated user is redirected
 * to the app instead of seeing the auth form again. */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === "idle") return <FullPageLoader />;
  if (status === "authenticated") return <Navigate to="/" replace />;
  return <>{children}</>;
}
