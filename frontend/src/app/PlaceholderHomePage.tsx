/**
 * NOT the real Dashboard (Module 9A explicitly excludes it) — this is only
 * the minimum content needed to demonstrate the authenticated shell and
 * route guards. Module 9B replaces this with the real dashboard (save box
 * + recent links feed).
 */
import { Inbox } from "lucide-react";

import { EmptyState } from "../components/feedback/EmptyState";
import { useAuth } from "../features/auth/AuthContext";
import { AppShell } from "./layout/AppShell";
import { UserMenu } from "../features/auth/components/UserMenu";

export function PlaceholderHomePage() {
  const { user } = useAuth();

  return (
    <AppShell activeNav="dashboard" navActions={<UserMenu />}>
      <EmptyState
        icon={Inbox}
        title={`Welcome${user ? `, ${user.email}` : ""}`}
        description="The dashboard isn't built yet — this placeholder just confirms the authenticated shell and route guards are working."
      />
    </AppShell>
  );
}
