import { AuthLayout } from "../../../app/layout/AuthLayout";
import { RegisterForm } from "../components/RegisterForm";

export function RegisterPage() {
  return (
    <AuthLayout title="Create your account">
      <RegisterForm />
    </AuthLayout>
  );
}
