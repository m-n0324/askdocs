import { useRouter } from "next/router";
import { useCallback } from "react";
import { ROUTES } from "@/constants";
import { useChatSessionKey } from "@/hooks";
import { ChatSessionContainer } from "@/containers/ChatSessionContainer";
import { WorkspaceLayoutContainer } from "@/containers/WorkspaceLayoutContainer";

interface IChatContainerProps {
  workspaceId: string;
  /** From the URL: /chat (null) or /chat/[conversationId]. */
  conversationId: string | null;
}

export function ChatContainer({ workspaceId, conversationId }: IChatContainerProps) {
  const router = useRouter();
  const { sessionKey, claimConversation } = useChatSessionKey(conversationId);

  const handleConversationCreated = useCallback(
    (newConversationId: string) => {
      claimConversation(newConversationId);
      // Shallow: only the URL changes; the page (and the answer still streaming in) stays mounted.
      void router.replace(ROUTES.chat(workspaceId, newConversationId), undefined, { shallow: true, scroll: false });
    },
    [claimConversation, router, workspaceId],
  );

  return (
    <WorkspaceLayoutContainer workspaceId={workspaceId} section="chat" activeConversationId={conversationId}>
      {/* A new key = a fresh chat view (e.g. after clicking another conversation or "New chat"). */}
      <ChatSessionContainer
        key={sessionKey}
        workspaceId={workspaceId}
        conversationId={conversationId}
        onConversationCreated={handleConversationCreated}
      />
    </WorkspaceLayoutContainer>
  );
}
