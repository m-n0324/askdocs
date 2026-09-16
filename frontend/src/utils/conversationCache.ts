import type { IConversationDetail, IMessage } from "@/interfaces";

const TITLE_MAX_LENGTH = 60;

interface ICompletedTurn {
  conversationId: string;
  userMessage: IMessage;
  assistantMessage: IMessage;
}

/**
 * Returns a NEW conversation detail with a finished question/answer pair appended.
 * Used to show the turn immediately, before the refetch brings the server copy.
 */
export function appendTurn(
  previous: IConversationDetail | undefined,
  turn: ICompletedTurn,
): IConversationDetail {
  const now = turn.assistantMessage.createdAt;
  const conversation = previous?.conversation ?? {
    id: turn.conversationId,
    title: turn.userMessage.content.slice(0, TITLE_MAX_LENGTH),
    createdAt: turn.userMessage.createdAt,
    updatedAt: now,
  };
  return {
    conversation: { ...conversation, updatedAt: now },
    messages: [...(previous?.messages ?? []), turn.userMessage, turn.assistantMessage],
  };
}
