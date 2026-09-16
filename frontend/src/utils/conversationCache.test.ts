import { describe, expect, it } from "vitest";
import { makeMessage } from "@/test/fixtures";
import type { IConversationDetail } from "@/interfaces";
import { appendTurn } from "@/utils/conversationCache";

const userMessage = makeMessage({ id: "u", role: "user", content: "What is the refund window?" });
const assistantMessage = makeMessage({ id: "a", createdAt: "2026-10-02T10:00:05.000Z" });

describe("appendTurn", () => {
  it("creates a conversation when there is no cached one", () => {
    const result = appendTurn(undefined, { conversationId: "c1", userMessage, assistantMessage });

    expect(result.conversation).toMatchObject({ id: "c1", title: "What is the refund window?" });
    expect(result.messages).toEqual([userMessage, assistantMessage]);
  });

  it("appends to an existing conversation without mutating it", () => {
    const previous: IConversationDetail = {
      conversation: { id: "c1", title: "Old", createdAt: "x", updatedAt: "x" },
      messages: [makeMessage({ id: "old" })],
    };

    const result = appendTurn(previous, { conversationId: "c1", userMessage, assistantMessage });

    expect(result.messages.map((message) => message.id)).toEqual(["old", "u", "a"]);
    expect(result.conversation.updatedAt).toBe(assistantMessage.createdAt);
    expect(previous.messages).toHaveLength(1);
    expect(previous.conversation.updatedAt).toBe("x");
  });
});
