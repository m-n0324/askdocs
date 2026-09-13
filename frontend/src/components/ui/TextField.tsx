import { useId, type InputHTMLAttributes } from "react";
import { cx } from "@/utils";

interface ITextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string | null;
  hint?: string;
}

export function TextField({ label, error, hint, className, ...inputProps }: ITextFieldProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="font-mono text-[11px] tracking-[0.14em] text-ink-muted uppercase">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={cx(
          "h-11 w-full rounded-xs border-b bg-transparent px-0.5 text-[15px] text-ink placeholder:text-ink-faint",
          "transition-colors duration-150 focus:outline-none focus-visible:outline-none",
          error ? "border-failed" : "border-rule-strong hover:border-ink-muted focus:border-accent",
        )}
        {...inputProps}
      />
      {message && (
        <p id={messageId} className={cx("text-[13px]", error ? "text-failed" : "text-ink-faint")}>
          {message}
        </p>
      )}
    </div>
  );
}
