import { authApi, unwrap } from "@/lib/api";
import type { ChatStreamEvent, IApiSuccess, IChatInput, IChatResponse, ISseFrame } from "@/interfaces";
import { createSseParser, toChatStreamEvent } from "@/utils";

const chatPath = (workspaceId: string) => `/workspaces/${workspaceId}/chat`;

/** Non-streaming chat. The UI uses streamChat; this is handy for scripts and tests. */
export const sendChat = (workspaceId: string, input: IChatInput) =>
  authApi().url(chatPath(workspaceId)).post(input).json<IApiSuccess<IChatResponse>>().then(unwrap);

interface IStreamOptions {
  signal: AbortSignal;
  onEvent: (event: ChatStreamEvent) => void;
}

/**
 * POSTs a question and reads the Server-Sent Events answer.
 *
 * EventSource can't POST or send an Authorization header, so we read the
 * response body ourselves and feed it to our SSE parser. Errors before the
 * stream starts (401, 429, ...) are normal JSON and throw an ApiError.
 */
export async function streamChat(workspaceId: string, input: IChatInput, { signal, onEvent }: IStreamOptions) {
  const response = await authApi({ signal })
    .url(`${chatPath(workspaceId)}/stream`)
    .headers({ Accept: "text/event-stream" })
    .post(input)
    .res();

  if (!response.body) throw new Error("Your browser can't read streamed answers.");

  const emit = (frames: ISseFrame[]) =>
    frames.forEach((frame) => {
      const event = toChatStreamEvent(frame);
      if (event) onEvent(event);
    });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();

  try {
    let chunk = await reader.read();
    while (!chunk.done) {
      emit(parser.push(decoder.decode(chunk.value, { stream: true })));
      chunk = await reader.read();
    }
    emit(parser.push(decoder.decode()));
    emit(parser.flush());
  } finally {
    // Close the connection if we stopped early (abort or an error in onEvent).
    reader.cancel().catch(() => undefined);
  }
}
