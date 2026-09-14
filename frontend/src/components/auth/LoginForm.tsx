import { useState, type FormEvent } from "react";
import { Button, Notice, TextField } from "@/components/ui";
import type { ILoginInput } from "@/interfaces";
import { validateEmail } from "@/utils";

interface ILoginFormProps {
  onSubmit: (values: ILoginInput) => void;
  isSubmitting: boolean;
  serverError: string | null;
}

type FieldErrors = Partial<Record<keyof ILoginInput, string | null>>;

export function LoginForm({ onSubmit, isSubmitting, serverError }: ILoginFormProps) {
  const [values, setValues] = useState<ILoginInput>({ email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {
      email: validateEmail(values.email),
      // Only check presence here; the length rule is for creating a password.
      password: values.password ? null : "Password is required.",
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    onSubmit({ email: values.email.trim(), password: values.password });
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
      <TextField
        label="Email"
        type="email"
        autoComplete="email"
        value={values.email}
        error={errors.email}
        onChange={(event) => setValues({ ...values, email: event.target.value })}
      />
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        value={values.password}
        error={errors.password}
        onChange={(event) => setValues({ ...values, password: event.target.value })}
      />
      {serverError && <Notice>{serverError}</Notice>}
      <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
        Log in
      </Button>
    </form>
  );
}
