import { ConfirmButton } from "@/components/ui";

interface IChatHeaderProps {
  title: string;
  onDelete: () => void;
  isDeleting: boolean;
}

export function ChatHeader({ title, onDelete, isDeleting }: IChatHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-rule pb-3">
      <h1 className="min-w-0 truncate text-sm font-medium text-ink-muted">{title}</h1>
      <ConfirmButton label="Delete" question="Delete this conversation?" onConfirm={onDelete} isLoading={isDeleting} />
    </header>
  );
}
