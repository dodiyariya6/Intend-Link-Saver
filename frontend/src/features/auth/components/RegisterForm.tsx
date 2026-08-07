import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError } from "../../../api/client";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Text } from "../../../components/ui/Typography";
import { useRegister } from "../hooks/useRegister";
import { validateConfirmPassword, validateEmail, validatePassword } from "../validation";

interface FieldErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const register = useRegister();
  const navigate = useNavigate();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const errors: FieldErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
      confirmPassword: validateConfirmPassword(password, confirmPassword),
    };
    setFieldErrors(errors);
    if (errors.email || errors.password || errors.confirmPassword) return;

    register.mutate(
      { email, password },
      {
        onSuccess: () => navigate("/", { replace: true }),
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) {
            setFormError("An account with this email already exists.");
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
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        helperText={fieldErrors.password ? undefined : "At least 8 characters"}
      />
      <Input
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={fieldErrors.confirmPassword}
      />

      {formError && (
        <p role="alert" className="text-body text-danger">
          {formError}
          {formError.includes("already exists") && (
            <>
              {" "}
              <Link to="/login" className="font-medium text-accent hover:text-accent-hover">
                Log in instead
              </Link>
            </>
          )}
        </p>
      )}

      <Button type="submit" size="lg" isLoading={register.isPending} className="mt-2">
        Create account
      </Button>

      <Text variant="body" className="text-center">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-accent hover:text-accent-hover">
          Log in
        </Link>
      </Text>
    </form>
  );
}
