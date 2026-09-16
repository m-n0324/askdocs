import { describe, expect, it } from "vitest";
import { makeCitation, makeMessage } from "@/test/fixtures";
import { toChatStreamEvent } from "@/utils/chatEvents";

describe("toChatStreamEvent", () => {
  it("maps each known event to a typed object", () => {
    const citation = makeCitation();
    const message = makeMessage();

    expect(toChatStreamEvent({ event: "meta", data: '{"conversationId":"c1","standaloneQuestion":"q"}' })).toEqual({
      type: "meta",
      conversationId: "c1",
      standaloneQuestion: "q",
    });
    expect(toChatStreamEvent({ event: "citations", data: JSON.stringify({ citations: [citation] }) })).toEqual({
      type: "citations",
      citations: [citation],
    });
    expect(toChatStreamEvent({ event: "token", data: '{"delta":"Hel"}' })).toEqual({ type: "token", delta: "Hel" });
    expect(toChatStreamEvent({ event: "done", data: JSON.stringify({ message }) })).toEqual({ type: "done", message });
    expect(toChatStreamEvent({ event: "error", data: '{"message":"Quota exceeded"}' })).toEqual({
      type: "error",
      message: "Quota exceeded",
    });
  });

  it("returns null for unknown events, invalid JSON and wrong shapes", () => {
    expect(toChatStreamEvent({ event: "ping", data: "{}" })).toBeNull();
    expect(toChatStreamEvent({ event: "token", data: "not json" })).toBeNull();
    expect(toChatStreamEvent({ event: "token", data: '{"delta":5}' })).toBeNull();
    expect(toChatStreamEvent({ event: "done", data: '{"message":{}}' })).toBeNull();
  });
});
