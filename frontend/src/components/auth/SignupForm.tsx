import { useState, type FormEvent } from "react";
import { Button, Notice, TextField } from "@/components/ui";
import { PASSWORD_MIN_LENGTH } from "@/constants";
import type { ISignupInput } from "@/interfaces";
import { validateEmail, validateName, validatePassword } from "@/utils";

interface ISignupFormProps {
  onSubmit: (values: ISignupInput) => void;
  isSubmitting: boolean;
  serverError: string | null;
}

type FieldErrors = Partial<Record<keyof ISignupInput, string | null>>;

export function SignupForm({ onSubmit, isSubmitting, serverError }: ISignupFormProps) {
  const [values, setValues] = useState<ISignupInput>({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {
      name: validateName(values.name),
      email: validateEmail(values.email),
      password: validatePassword(values.password),
    };
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    onSubmit({ name: values.name.trim(), email: values.email.trim(), password: values.password });
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
      <TextField
        label="Name"
        autoComplete="name"
        value={values.name}
        error={errors.name}
        onChange={(event) => setValues({ ...values, name: event.target.value })}
      />
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
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        value={values.password}
        error={errors.password}
        onChange={(event) => setValues({ ...values, password: event.target.value })}
      />
      {serverError && <Notice>{serverError}</Notice>}
      <Button type="submit" isLoading={isSubmitting} className="mt-2 w-full">
        Create account
      </Button>
    </form>
  );
}
