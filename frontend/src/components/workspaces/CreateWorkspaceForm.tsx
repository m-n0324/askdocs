import { useState, type FormEvent } from "react";
import { Button, TextField } from "@/components/ui";
import { WORKSPACE_NAME_MAX_LENGTH } from "@/constants";
import { validateWorkspaceName } from "@/utils";

interface ICreateWorkspaceFormProps {
  onCreate: (name: string) => Promise<unknown>;
  isCreating: boolean;
  serverError: string | null;
}

export function CreateWorkspaceForm({ onCreate, isCreating, serverError }: ICreateWorkspaceFormProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateWorkspaceName(name);
    setError(validationError);
    if (validationError) return;
    try {
      await onCreate(name.trim());
      setName("");
    } catch {
      // The container shows the server error; keep the typed name so the user can fix it.
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <TextField
        label="New workspace"
        placeholder="e.g. Product handbook"
        maxLength={WORKSPACE_NAME_MAX_LENGTH}
        value={name}
        error={error ?? serverError}
        onChange={(event) => setName(event.target.value)}
        className="flex-1"
      />
      <Button type="submit" isLoading={isCreating} className="sm:mt-[22px]">
        Create workspace
      </Button>
    </form>
  );
}
