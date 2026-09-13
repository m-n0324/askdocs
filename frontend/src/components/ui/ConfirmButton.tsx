import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

interface IConfirmButtonProps {
  /** Text on the first button, e.g. "Delete". */
  label: string;
  /** Question shown in place of the button, e.g. "Delete this workspace?". */
  question: string;
  confirmLabel?: string;
  onConfirm: () => void;
  isLoading?: boolean;
  /** Accessible name for the first button when the visible label is short. */
  ariaLabel?: string;
}

/** A two-step destructive action, done in the page instead of a browser dialog. */
export function ConfirmButton({
  label,
  question,
  confirmLabel = "Yes, delete",
  onConfirm,
  isLoading = false,
  ariaLabel,
}: IConfirmButtonProps) {
  const [isAsking, setIsAsking] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isAsking) confirmRef.current?.focus();
  }, [isAsking]);

  if (!isAsking) {
    return (
      <Button variant="ghost" size="sm" aria-label={ariaLabel} onClick={() => setIsAsking(true)}>
        {label}
      </Button>
    );
  }

  return (
    <span
      className="inline-flex animate-fade-in items-center gap-1.5"
      onKeyDown={(event) => {
        if (event.key === "Escape") setIsAsking(false);
      }}
    >
      <span className="text-[13px] text-ink-muted">{question}</span>
      <Button ref={confirmRef} variant="danger" size="sm" isLoading={isLoading} onClick={onConfirm}>
        {confirmLabel}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setIsAsking(false)}>
        Cancel
      </Button>
    </span>
  );
}
