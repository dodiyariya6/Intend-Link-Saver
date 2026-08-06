import type { ReactNode } from "react";

import { NavBar, NavLinkItem } from "../../components/ui/NavBar";
import { Container } from "./Container";

export interface AppShellProps {
  /** Which top-nav item is active — kept as a plain prop here since
   * routing itself isn't wired up yet (no pages this module). */
  activeNav?: "dashboard" | "search";
  navActions?: ReactNode;
  children: ReactNode;
}

/**
 * The authenticated layout: top nav (no permanent sidebar) + a
 * max-width-constrained content area with generous vertical rhythm.
 */
export function AppShell({ activeNav, navActions, children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-canvas">
      <NavBar brand="Intend Link Saver" actions={navActions}>
        <NavLinkItem active={activeNav === "dashboard"}>Dashboard</NavLinkItem>
        <NavLinkItem active={activeNav === "search"}>Search</NavLinkItem>
      </NavBar>
      <Container as="main" className="py-8">
        {children}
      </Container>
    </div>
  );
}
