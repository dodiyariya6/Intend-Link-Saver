import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Heading, Text } from "../ui/Typography";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Optional single next-action, e.g. a Button. */
  action?: ReactNode;
}

/**
 * An absence, not a card — no background fill distinct from canvas.
 * Centered, generous vertical padding, a single quiet icon (never a large
 * illustration).
 */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <Icon className="mb-4 size-10 text-text-tertiary" strokeWidth={1.75} aria-hidden="true" />
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
