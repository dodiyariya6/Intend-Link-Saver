import type { ReactNode } from "react";

import { ToastProvider } from "../components/ui/Toast";

/**
 * Composes app-wide providers. Only ToastProvider exists yet — auth/query
 * providers land with their respective modules (not part of the reusable
 * UI component library built here).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
