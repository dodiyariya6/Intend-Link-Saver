import { forwardRef, useId, type InputHTMLAttributes } from "react";

import { cn } from "../../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Helper text shown below the field when there's no error. */
  helperText?: string;
  /** Error message — shown instead of helperText, flips the field to the
   * danger border/text color. */
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, helperText, error, id, className, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const helperId = `${inputId}-helper`;
    const hasError = Boolean(error);

    return (
      <div className="flex flex-col">
        {label && (
          // mb-2 = 8px = design token space-1, per spec ("space-1 above the field")
          <label htmlFor={inputId} className="mb-2 text-label font-medium text-text-secondary">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            // h-10 = 40px; px-4 = 16px = space-2 horizontal padding
            "h-10 rounded-md border bg-surface px-4 text-body text-text-primary",
            "placeholder:text-text-tertiary",
            "transition-colors duration-150 ease-out",
            "focus:outline-none focus:shadow-focus",
            hasError
              ? "border-danger focus:border-danger"
              : "border-border focus:border-accent",
            "disabled:opacity-40 disabled:pointer-events-none",
            className,
          )}
          aria-invalid={hasError || undefined}
          aria-describedby={helperText || error ? helperId : undefined}
          {...props}
        />
        {(helperText || error) && (
          // mt-1 = 4px = design token space-0.5, the sanctioned micro-gap
          <span
            id={helperId}
            className={cn("mt-1 text-caption", hasError ? "text-danger" : "text-text-tertiary")}
          >
            {error ?? helperText}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
