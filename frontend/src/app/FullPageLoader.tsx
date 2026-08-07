import { Loader2 } from "lucide-react";

/** Shown while auth status is being resolved (token validation on boot) —
 * avoids a flash of the login page for a user with a valid stored token. */
export function FullPageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas" role="status" aria-live="polite">
      <Loader2 className="size-8 animate-spin text-text-tertiary" strokeWidth={1.75} aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
