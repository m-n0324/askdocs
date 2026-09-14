import Link from "next/link";
import { AuthLayout, SignupForm } from "@/components";
import { ROUTES } from "@/constants";
import { useSignupMutation } from "@/hooks";
import { getErrorMessage } from "@/utils";

export function SignupContainer() {
  const signup = useSignupMutation();

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Open a new desk"
      footer={
        <>
          Already have an account?{" "}
          <Link href={ROUTES.LOGIN} className="font-medium text-accent-strong underline-offset-4 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <SignupForm
        onSubmit={(values) => signup.mutate(values)}
        isSubmitting={signup.isPending}
        serverError={signup.isError ? getErrorMessage(signup.error) : null}
      />
    </AuthLayout>
  );
}
