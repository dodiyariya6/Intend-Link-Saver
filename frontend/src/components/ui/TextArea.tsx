import { forwardRef, useId, type TextareaHTMLAttributes } from "react";

import { cn } from "../../lib/cn";

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, helperText, error, id, className, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    const helperId = `${textareaId}-helper`;
    const hasError = Boolean(error);

    return (
      <div className="flex flex-col">
        {label && (
          <label htmlFor={textareaId} className="mb-2 text-label font-medium text-text-secondary">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            // min-h-24 = 96px per spec; px-4 = 16px, py-3 = 12px
            "min-h-24 rounded-md border bg-surface px-4 py-3 text-body text-text-primary",
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

TextArea.displayName = "TextArea";
