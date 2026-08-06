import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/cn";

const buttonStyles = cva(
  [
    "inline-flex items-center justify-center gap-1",
    "rounded-md font-sans text-label font-medium",
    "transition-colors duration-150 ease-out",
    "focus-visible:outline-none focus-visible:shadow-focus",
    "disabled:opacity-40 disabled:pointer-events-none",
    "active:scale-[0.98]", // documented press-feedback scale from the animation spec, not an arbitrary value
  ],
  {
    variants: {
      variant: {
        primary: "bg-accent text-text-onAccent hover:bg-accent-hover",
        secondary:
          "bg-surface text-text-primary border border-border hover:bg-surface-hover",
        ghost: "bg-transparent text-text-secondary hover:bg-surface-hover",
        destructive: "bg-danger text-text-onAccent hover:opacity-90",
      },
      size: {
        // heights: sm=32px, md=40px, lg=48px (native Tailwind h-8/h-10/h-12)
        // horizontal padding: sm=16px, md=24px, lg=32px (space-2/space-3/space-4)
        sm: "h-8 px-4",
        md: "h-10 px-6",
        lg: "h-12 px-8 text-body",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  /** Shows a spinner and disables the button — used for in-flight actions
   * (save, delete confirm) rather than a separate loading component. */
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonStyles({ variant, size }), className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

const iconButtonStyles = cva(
  [
    "inline-flex items-center justify-center",
    "rounded-md transition-colors duration-150 ease-out",
    "focus-visible:outline-none focus-visible:shadow-focus",
    "disabled:opacity-40 disabled:pointer-events-none",
    "active:scale-[0.98]", // documented press-feedback scale from the animation spec, not an arbitrary value
  ],
  {
    variants: {
      variant: {
        ghost: "bg-transparent text-text-secondary hover:bg-surface-hover",
        secondary: "bg-surface text-text-primary border border-border hover:bg-surface-hover",
      },
      size: {
        sm: "size-8",
        md: "size-10",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonStyles> {
  /** Required — icon-only buttons must always have an accessible name. */
  "aria-label": string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(iconButtonStyles({ variant, size }), className)} {...props} />
  ),
);

IconButton.displayName = "IconButton";
