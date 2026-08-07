/**
 * Right-aligned nav affordance: an avatar-placeholder circle (initial
 * letter — no real avatar system exists yet) + email + a logout action.
 * Composed entirely from existing primitives (Text/Button) — not a new
 * base UI component, just a feature-level composition.
 */
import { Button } from "../../../components/ui/Button";
import { Text } from "../../../components/ui/Typography";
import { useAuth } from "../AuthContext";
import { useLogout } from "../hooks/useLogout";

export function UserMenu() {
  const { user } = useAuth();
  const logout = useLogout();

  if (!user) return null;

  const initial = user.email.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-full bg-accent-subtle text-label font-semibold text-accent"
        >
          {initial}
        </span>
        <Text variant="body" tone="secondary" className="hidden sm:inline">
          {user.email}
        </Text>
      </div>
      <Button variant="ghost" size="sm" onClick={() => logout.mutate()} isLoading={logout.isPending}>
        Log out
      </Button>
    </div>
  );
}
