import type { ChatStreamEvent, ICitation, IMessage, ISseFrame } from "@/interfaces";

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isMessage = (value: unknown): value is IMessage =>
  isObject(value) &&
  typeof value.id === "string" &&
  typeof value.content === "string" &&
  Array.isArray(value.citations);

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/**
 * Turns a raw SSE frame from /chat/stream into a typed event.
 * Returns null for unknown events or payloads that don't match the contract,
 * because the stream is external data and must not crash the UI.
 */
export function toChatStreamEvent(frame: ISseFrame): ChatStreamEvent | null {
  const data = parseJson(frame.data);
  if (!isObject(data)) return null;

  switch (frame.event) {
    case "meta":
      return typeof data.conversationId === "string"
        ? {
            type: "meta",
            conversationId: data.conversationId,
            standaloneQuestion: typeof data.standaloneQuestion === "string" ? data.standaloneQuestion : "",
          }
        : null;
    case "citations":
      return Array.isArray(data.citations)
        ? { type: "citations", citations: data.citations as ICitation[] }
        : null;
    case "token":
      return typeof data.delta === "string" ? { type: "token", delta: data.delta } : null;
    case "done":
      return isMessage(data.message) ? { type: "done", message: data.message } : null;
    case "error":
      return {
        type: "error",
        message: typeof data.message === "string" ? data.message : "The answer could not be generated.",
      };
    default:
      return null;
  }
}
