import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ToastProvider } from "../components/ui/Toast";
import { AuthProvider } from "../features/auth/AuthContext";
import { queryClient } from "./queryClient";

/** Composes app-wide providers, outermost to innermost:
 * QueryClient -> Toast -> Auth (Auth is innermost since its bootstrap
 * doesn't depend on the others, but keeping it close to where it's
 * consumed is easier to reason about). */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>{children}</AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
