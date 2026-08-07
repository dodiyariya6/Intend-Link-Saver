import type { ReactNode } from "react";

import { cn } from "../../lib/cn";
import { Text } from "./Typography";

export interface NavBarProps {
  /** Wordmark / product name, rendered as text — no icon logo in V1. */
  brand: ReactNode;
  /** Primary nav links (e.g. NavLink elements). */
  children?: ReactNode;
  /** Right-aligned user/session affordance (e.g. a "Log out" button). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Top navigation only — no permanent left sidebar, per the design system.
 * Height 64px, hairline bottom border for separation from canvas (no
 * shadow needed).
 */
export function NavBar({ brand, children, actions, className }: NavBarProps) {
  return (
    <header className={cn("h-16 border-b border-border-subtle bg-surface", className)}>
      {/* flex-nowrap + overflow-x-auto: on a narrow viewport the row
          scrolls horizontally instead of wrapping onto multiple lines,
          which would blow out the fixed 64px header height and clip
          content (there's no mobile nav collapse pattern yet — this is
          the documented "secondary priority" fallback from the
          architecture plan, just correctly non-broken). */}
      <div className="mx-auto flex h-16 max-w-content flex-nowrap items-center justify-between gap-4 overflow-x-auto px-6">
        <div className="flex shrink-0 items-center gap-8">
          <Text as="span" variant="body" tone="primary" className="whitespace-nowrap font-semibold text-h3">
            {brand}
          </Text>
          {children && <nav className="flex items-center gap-2 whitespace-nowrap">{children}</nav>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">{actions}</div>}
      </div>
    </header>
  );
}

export interface NavLinkItemProps {
  children: ReactNode;
  /** Marks the current route — renders the accent-tinted active pill. */
  active?: boolean;
  href?: string;
  onClick?: () => void;
}

/**
 * A plain nav-link-style item, not icon+label sidebar-style. Active state
 * is an accent-subtle pill with accent text, never a bare underline (per
 * "minimal use of accent color" — the pill is the one place it appears).
 */
export function NavLinkItem({ children, active, href, onClick }: NavLinkItemProps) {
  const Comp = href ? "a" : "button";
  return (
    <Comp
      href={href}
      onClick={onClick}
      className={cn(
        "rounded-md px-4 py-2 text-label font-medium transition-colors duration-150 ease-out",
        "focus-visible:outline-none focus-visible:shadow-focus",
        active
          ? "bg-accent-subtle text-accent"
          : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
      )}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Comp>
  );
}
