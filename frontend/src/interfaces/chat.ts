import type { SourceType } from "@/interfaces/source";

export interface ICitation {
  /** The [n] marker used in the answer text. */
  index: number;
  chunkId: string;
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  page: number | null;
  section: string | null;
  url: string | null;
  snippet: string;
  score: number;
}

export type MessageRole = "user" | "assistant";

export interface IMessage {
  id: string;
  role: MessageRole;
  content: string;
  citations: ICitation[];
  createdAt: string;
}

export interface IConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface IConversationDetail {
  conversation: IConversation;
  messages: IMessage[];
}

export interface IChatInput {
  message: string;
  conversationId?: string;
}

export interface IChatResponse {
  conversationId: string;
  standaloneQuestion: string;
  message: IMessage;
}

/** Events sent by POST /chat/stream, in the order they arrive. */
export type ChatStreamEvent =
  | { type: "meta"; conversationId: string; standaloneQuestion: string }
  | { type: "citations"; citations: ICitation[] }
  | { type: "token"; delta: string }
  | { type: "done"; message: IMessage }
  | { type: "error"; message: string };

export type ChatTurnStatus = "idle" | "streaming" | "error";

/** The question currently being answered (it's not in the conversation history yet). */
export interface IChatTurn {
  status: ChatTurnStatus;
  question: string;
  answer: string;
  /** Candidate passages from the `citations` event; markers in `answer` point at these. */
  citations: ICitation[];
  error: string | null;
}
