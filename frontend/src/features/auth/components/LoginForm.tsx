import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { ApiError } from "../../../api/client";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Text } from "../../../components/ui/Typography";
import { useLogin } from "../hooks/useLogin";
import { validateEmail, validatePassword } from "../validation";

interface LocationState {
  from?: { pathname: string };
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const emailError = validateEmail(email);
    const passwordError = password ? undefined : "Password is required";
    setFieldErrors({ email: emailError, password: passwordError });
    if (emailError || passwordError) return;

    login.mutate(
      { email, password },
      {
        onSuccess: () => {
          const state = location.state as LocationState | null;
          navigate(state?.from?.pathname ?? "/", { replace: true });
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 401) {
            setFormError("Incorrect email or password.");
          } else {
            setFormError("Something went wrong. Please try again.");
          }
        },
      },
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <Input
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
      />

      {formError && (
        <p role="alert" className="text-body text-danger">
          {formError}
        </p>
      )}

      <Button type="submit" size="lg" isLoading={login.isPending} className="mt-2">
        Log in
      </Button>

      <Text variant="body" className="text-center">
        Don&rsquo;t have an account?{" "}
        <Link to="/register" className="font-medium text-accent hover:text-accent-hover">
          Create one
        </Link>
      </Text>
    </form>
  );
}
