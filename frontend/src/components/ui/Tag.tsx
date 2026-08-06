import { X } from "lucide-react";
import type { HTMLAttributes } from "react";

import { cn } from "../../lib/cn";

export interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  /** If provided, renders a remove (×) affordance and calls this on click. */
  onRemove?: () => void;
  /** Accessible label for the remove button — required when onRemove is set. */
  removeLabel?: string;
}

/** A topical, user/AI-generated label — distinct from Badge (system status). */
export function Tag({ className, children, onRemove, removeLabel, ...props }: TagProps) {
  return (
    <span
      className={cn(
        // rounded-sm = 8px radius; px-2 = 8px, py-1 = 4px
        "inline-flex items-center gap-1 rounded-sm bg-surface-sunken px-2 py-1 text-caption text-text-secondary",
        className,
      )}
      {...props}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel ?? `Remove tag${typeof children === "string" ? `: ${children}` : ""}`}
          className="rounded-sm text-text-tertiary transition-colors duration-150 hover:text-text-primary focus-visible:outline-none focus-visible:shadow-focus"
        >
          <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
