import type { ElementType, HTMLAttributes } from "react";

import { cn } from "../../lib/cn";

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  as?: ElementType;
}

/**
 * Centers content within the design system's max-width (1200px), with
 * generous horizontal margin — the single most important decision behind
 * "doesn't look like a dashboard": content never stretches edge-to-edge.
 */
export function Container({ as, className, ...props }: ContainerProps) {
  const Tag = as ?? "div";
  return <Tag className={cn("mx-auto w-full max-w-content px-6", className)} {...props} />;
}
