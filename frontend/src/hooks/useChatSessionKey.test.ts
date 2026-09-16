import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useChatSessionKey } from "@/hooks/useChatSessionKey";

describe("useChatSessionKey", () => {
  it("keeps the session when the URL changes to the conversation it just created", () => {
    const { result, rerender } = renderHook(({ id }) => useChatSessionKey(id), {
      initialProps: { id: null as string | null },
    });
    const initialKey = result.current.sessionKey;

    act(() => result.current.claimConversation("new-id"));
    rerender({ id: "new-id" });

    expect(result.current.sessionKey).toBe(initialKey);
  });

  it("starts a new session when the user opens a different conversation", () => {
    const { result, rerender } = renderHook(({ id }) => useChatSessionKey(id), {
      initialProps: { id: "a" as string | null },
    });
    const initialKey = result.current.sessionKey;

    rerender({ id: "b" });
    expect(result.current.sessionKey).not.toBe(initialKey);

    const keyForB = result.current.sessionKey;
    rerender({ id: null });
    expect(result.current.sessionKey).not.toBe(keyForB);
  });
});
