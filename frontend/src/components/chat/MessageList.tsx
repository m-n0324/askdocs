import { Fragment, useEffect, useRef } from "react";
import type { IChatTurn, ICitation, IMessage } from "@/interfaces";
import { AssistantAnswer, PendingAnswer, Question } from "@/components/chat/MessageParts";

export interface IActiveCitation {
  /** Which answer the chip belongs to: the same [1] can appear in many answers. */
  messageKey: string;
  citation: ICitation;
}

interface IMessageListProps {
  messages: IMessage[];
  turn: IChatTurn;
  activeCitation: IActiveCitation | null;
  onSelectCitation: (selection: IActiveCitation) => void;
  onRetry: () => void;
}

export const PENDING_MESSAGE_KEY = "pending";
// Keep following the stream only if the reader is already near the bottom.
const STICK_TO_BOTTOM_PX = 160;

export function MessageList({ messages, turn, activeCitation, onSelectCitation, onRetry }: IMessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const activeIndexFor = (messageKey: string) =>
    activeCitation?.messageKey === messageKey ? activeCitation.citation.index : null;

  useEffect(() => {
    const end = endRef.current;
    if (!end) return;
    if (end.getBoundingClientRect().top - window.innerHeight < STICK_TO_BOTTOM_PX) {
      end.scrollIntoView({ block: "end" });
    }
  }, [messages.length, turn.status, turn.answer]);

  const isTurnVisible = turn.status !== "idle";

  return (
    <div className="flex flex-col">
      {messages.map((message) => (
        <Fragment key={message.id}>
          {message.role === "user" ? (
            <Question text={message.content} />
          ) : (
            <AssistantAnswer
              message={message}
              activeIndex={activeIndexFor(message.id)}
              onSelectCitation={(citation) => onSelectCitation({ messageKey: message.id, citation })}
            />
          )}
        </Fragment>
      ))}

      {isTurnVisible && (
        <>
          <Question text={turn.question} />
          <PendingAnswer
            turn={turn}
            activeIndex={activeIndexFor(PENDING_MESSAGE_KEY)}
            onSelectCitation={(citation) => onSelectCitation({ messageKey: PENDING_MESSAGE_KEY, citation })}
            onRetry={onRetry}
          />
        </>
      )}
      <div ref={endRef} aria-hidden />
    </div>
  );
}
