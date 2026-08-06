import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";

import { cn } from "../../lib/cn";

const badgeStyles = cva(
  // rounded-sm = 8px radius; px-2 = 8px, py-1 = 4px (on-grid approximation of the ~22px target height)
  "inline-flex items-center gap-1 rounded-sm px-2 py-1 text-caption font-medium",
  {
    variants: {
      tone: {
        // Neutral is the default for intent-category badges — informational,
        // not a colorful status indicator.
        neutral: "bg-surface-sunken text-text-secondary",
        success: "bg-success/10 text-success",
        warning: "bg-warning/10 text-warning",
        danger: "bg-danger-subtle text-danger",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeStyles> {}

/** Status/intent-category label. Not removable, not interactive — see Tag
 * for the topical, potentially-removable chip variant. */
export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeStyles({ tone }), className)} {...props} />;
}
