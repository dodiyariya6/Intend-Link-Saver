import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { NavBar, NavLinkItem } from "../../components/ui/NavBar";
import { Container } from "./Container";

export interface AppShellProps {
  activeNav?: "dashboard" | "search";
  navActions?: ReactNode;
  children: ReactNode;
}

/**
 * The authenticated layout: top nav (no permanent sidebar) + a
 * max-width-constrained content area with generous vertical rhythm.
 */
export function AppShell({ activeNav, navActions, children }: AppShellProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh bg-canvas">
      <NavBar brand="Intend Link Saver" actions={navActions}>
        <NavLinkItem active={activeNav === "dashboard"} onClick={() => navigate("/")}>
          Dashboard
        </NavLinkItem>
        <NavLinkItem active={activeNav === "search"} onClick={() => navigate("/search")}>
          Search
        </NavLinkItem>
      </NavBar>
      <Container as="main" className="py-8">
        {children}
      </Container>
    </div>
  );
}
