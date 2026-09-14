import Link from "next/link";
import { AuthLayout, LoginForm } from "@/components";
import { ROUTES } from "@/constants";
import { useLoginMutation } from "@/hooks";
import { getErrorMessage } from "@/utils";

export function LoginContainer() {
  const login = useLoginMutation();

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Log in to your desk"
      footer={
        <>
          New here?{" "}
          <Link href={ROUTES.SIGNUP} className="font-medium text-accent-strong underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm
        onSubmit={(values) => login.mutate(values)}
        isSubmitting={login.isPending}
        serverError={login.isError ? getErrorMessage(login.error) : null}
      />
    </AuthLayout>
  );
}
