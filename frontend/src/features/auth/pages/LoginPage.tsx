import { useEffect } from "react";

import { AuthLayout } from "../../../app/layout/AuthLayout";
import { Text } from "../../../components/ui/Typography";
import { useAuth } from "../AuthContext";
import { LoginForm } from "../components/LoginForm";

export function LoginPage() {
  const { sessionExpired, clearSessionExpired } = useAuth();

  // Clear the banner once shown so navigating away and back doesn't
  // re-surface a stale "session expired" message.
  useEffect(() => () => clearSessionExpired(), [clearSessionExpired]);

  return (
    <AuthLayout title="Log in">
      {sessionExpired && (
        <div className="mb-4 rounded-md bg-danger-subtle px-4 py-3" role="status">
          <Text variant="body" className="text-danger">
            Your session expired. Please log in again.
          </Text>
        </div>
      )}
      <LoginForm />
    </AuthLayout>
  );
}
