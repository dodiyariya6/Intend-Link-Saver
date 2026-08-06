import type { HTMLAttributes } from "react";

import { cn } from "../../lib/cn";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {}

/**
 * A single skeleton block — quiet opacity-pulse shimmer (1.4s, slow), never
 * a fast sweep. Shape/size is the caller's responsibility (via className)
 * so skeletons can mirror real content geometry exactly.
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn("animate-shimmer rounded-sm bg-surface-sunken", className)}
      {...props}
    />
  );
}

/**
 * A skeleton shaped like a link card, so layout doesn't shift when real
 * content replaces it. Composed from Skeleton blocks only.
 */
export function CardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="rounded-lg border border-border-subtle bg-surface p-6 shadow-xs"
    >
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className="size-4 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="mb-2 h-4 w-3/4" />
      <Skeleton className="mb-1 h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-5 w-16" />
      </div>
    </div>
  );
}
