import type { ReactNode } from "react";

import { Heading } from "../../components/ui/Typography";

export interface AuthLayoutProps {
  title: string;
  children: ReactNode;
}

/**
 * Centered layout for login/register/onboarding — no nav bar, generous
 * whitespace, a single narrow content column.
 */
export function AuthLayout({ title, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-96">
        <Heading level="h1" as="h1" className="mb-8 text-center">
          {title}
        </Heading>
        {children}
      </div>
    </div>
  );
}
