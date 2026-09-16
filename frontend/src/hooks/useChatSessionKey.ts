import { useCallback, useState } from "react";

interface ISessionState {
  key: number;
  /** The conversation this chat session is showing (or just created). */
  conversationId: string | null;
  /** The conversation id from the URL the last time we rendered. */
  routeConversationId: string | null;
}

/**
 * Decides when the chat view must start fresh.
 *
 * Opening another conversation (or "New chat") should reset the view, but when
 * a stream creates a conversation we change the URL ourselves, and that must
 * NOT throw away the answer that is still streaming in.
 */
export function useChatSessionKey(routeConversationId: string | null) {
  const [session, setSession] = useState<ISessionState>({
    key: 0,
    conversationId: routeConversationId,
    routeConversationId,
  });

  // Adjusting state while rendering when a prop changes (React's recommended alternative to an effect).
  if (session.routeConversationId !== routeConversationId) {
    const isOwnConversation = routeConversationId !== null && routeConversationId === session.conversationId;
    setSession({
      key: isOwnConversation ? session.key : session.key + 1,
      conversationId: routeConversationId,
      routeConversationId,
    });
  }

  const claimConversation = useCallback((conversationId: string) => {
    setSession((previous) => ({ ...previous, conversationId }));
  }, []);

  return { sessionKey: session.key, claimConversation };
}
