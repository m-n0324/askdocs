import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/constants";
import { cx, validateChatMessage } from "@/utils";

interface IComposerProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
}

// Show the character counter once the user gets close to the limit.
const COUNTER_THRESHOLD = CHAT_MESSAGE_MAX_LENGTH - 200;

export function Composer({ onSend, onStop, isStreaming }: IComposerProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const hintId = useId();

  const submit = () => {
    if (isStreaming) return;
    const validationError = validateChatMessage(text);
    setError(validationError);
    if (validationError) return;
    onSend(text.trim());
    setText("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter adds a new line. Ignore Enter while an IME is composing text.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-sm border border-rule-strong bg-paper-raised shadow-[0_8px_24px_-16px_oklch(20%_0.02_60/0.35)] transition-colors focus-within:border-ink-muted">
      <label htmlFor={inputId} className="sr-only">
        Ask a question about your sources
      </label>
      <textarea
        id={inputId}
        rows={2}
        value={text}
        maxLength={CHAT_MESSAGE_MAX_LENGTH}
        placeholder="Ask anything about your sources…"
        aria-describedby={hintId}
        aria-invalid={error ? true : undefined}
        onChange={(event) => {
          setText(event.target.value);
          if (error) setError(null);
        }}
        onKeyDown={handleKeyDown}
        className="block max-h-56 min-h-14 w-full resize-none bg-transparent px-4 pt-3.5 text-[15px] leading-6 text-ink [field-sizing:content] placeholder:text-ink-faint focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3 px-3 pt-1 pb-2.5">
        <p id={hintId} className={cx("pl-1 font-mono text-[10.5px] tracking-wide", error ? "text-failed" : "text-ink-faint")}>
          {error ?? (
            <>
              <span className="hidden sm:inline">Enter to send · Shift+Enter for a new line</span>
              {text.length > COUNTER_THRESHOLD && (
                <span className="sm:ml-3">
                  {text.length}/{CHAT_MESSAGE_MAX_LENGTH}
                </span>
              )}
            </>
          )}
        </p>
        {isStreaming ? (
          <Button variant="secondary" size="sm" onClick={onStop}>
            <span aria-hidden className="size-2 rounded-[1px] bg-ink" />
            Stop
          </Button>
        ) : (
          <Button type="submit" size="sm" disabled={!text.trim()}>
            Ask
          </Button>
        )}
      </div>
    </form>
  );
}
