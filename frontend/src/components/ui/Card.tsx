import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type HTMLAttributes } from "react";

import { cn } from "../../lib/cn";

const cardStyles = cva(
  ["rounded-lg bg-surface transition-shadow duration-180 ease-out", "shadow-xs"],
  {
    variants: {
      padding: {
        // px/py-6 = 24px = space-3 (default); px/py-8 = 32px = space-4 (hero cards)
        md: "p-6",
        lg: "p-8",
      },
      interactive: {
        true: "cursor-pointer border border-transparent hover:border-border hover:shadow-sm",
        false: "border border-border-subtle",
      },
    },
    defaultVariants: {
      padding: "md",
      interactive: false,
    },
  },
);

export interface CardProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardStyles> {}

/**
 * The core "saved knowledge" surface — treat contents as a small document,
 * not a database row. Border is nearly invisible at rest; separation comes
 * from the white-surface-on-warm-canvas contrast and shadow-xs, per the
 * design system's "prioritize typography over borders" principle.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding, interactive, ...props }, ref) => (
    <div ref={ref} className={cn(cardStyles({ padding, interactive }), className)} {...props} />
  ),
);

Card.displayName = "Card";

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  // mb-4 = 16px = space-2
  return <div className={cn("mb-4 flex items-start justify-between gap-2", className)} {...props} />;
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-2", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  // mt-4 = 16px = space-2
  return (
    <div className={cn("mt-4 flex items-center justify-between gap-2", className)} {...props} />
  );
}
