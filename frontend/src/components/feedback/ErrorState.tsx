import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

import { Heading, Text } from "../ui/Typography";

export interface ErrorStateProps {
  title: string;
  description?: string;
  /** Typically a "Retry" Button. */
  action?: ReactNode;
}

/**
 * Same structural pattern as EmptyState, but for a real failure: icon in
 * danger tone, plain-language explanation (never raw error codes/stack
 * traces), and a concrete next step.
 */
export function ErrorState({ title, description, action }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center py-16 text-center">
      <AlertCircle className="mb-4 size-10 text-danger" strokeWidth={1.75} aria-hidden="true" />
      <Heading level="h3">{title}</Heading>
      {description && (
        <Text variant="body" className="mt-1 max-w-prose">
          {description}
        </Text>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
