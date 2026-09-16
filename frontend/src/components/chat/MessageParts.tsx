import { Button, Eyebrow, Notice } from "@/components/ui";
import type { IChatTurn, ICitation, IMessage } from "@/interfaces";
import { getCitedCitations } from "@/utils";
import { AnswerText } from "@/components/chat/AnswerText";
import { SourceNotes } from "@/components/chat/SourceNotes";

interface ICitationProps {
  activeIndex: number | null;
  onSelectCitation: (citation: ICitation) => void;
}

/** The user's question, set like a heading so each exchange reads like an entry. */
export function Question({ text }: { text: string }) {
  return (
    <div className="mt-10 animate-rise border-t border-rule pt-6 first:mt-0 first:border-t-0 first:pt-0">
      <Eyebrow>You asked</Eyebrow>
      <p className="mt-2 font-display text-[1.7rem] leading-[1.2] whitespace-pre-wrap text-ink">{text}</p>
    </div>
  );
}

export function AssistantAnswer({ message, activeIndex, onSelectCitation }: ICitationProps & { message: IMessage }) {
  const cited = getCitedCitations(message.content, message.citations);
  return (
    <article className="mt-5">
      <AnswerText
        text={message.content}
        citations={message.citations}
        activeIndex={activeIndex}
        onSelectCitation={onSelectCitation}
      />
      <SourceNotes citations={cited} activeIndex={activeIndex} onSelectCitation={onSelectCitation} />
    </article>
  );
}

const searchingLabel = (turn: IChatTurn) =>
  turn.citations.length > 0
    ? `Reading ${turn.citations.length} passage${turn.citations.length === 1 ? "" : "s"}`
    : "Searching your sources";

/** The answer that is still streaming in (or failed). */
export function PendingAnswer({
  turn,
  activeIndex,
  onSelectCitation,
  onRetry,
}: ICitationProps & { turn: IChatTurn; onRetry: () => void }) {
  const isStreaming = turn.status === "streaming";

  return (
    // aria-busy makes screen readers wait for the full answer instead of reading every token.
    <article className="mt-5" aria-live="polite" aria-busy={isStreaming}>
      {isStreaming && !turn.answer && (
        <p className="flex items-center gap-2 font-mono text-[11.5px] tracking-[0.12em] text-ink-faint uppercase">
          <span aria-hidden className="size-1.5 animate-breathe rounded-full bg-accent" />
          {searchingLabel(turn)}…
        </p>
      )}
      {turn.answer && (
        <AnswerText
          text={turn.answer}
          citations={turn.citations}
          activeIndex={activeIndex}
          onSelectCitation={onSelectCitation}
          showCaret={isStreaming}
        />
      )}
      {turn.status === "error" && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Notice className="flex-1">{turn.error}</Notice>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </article>
  );
}
