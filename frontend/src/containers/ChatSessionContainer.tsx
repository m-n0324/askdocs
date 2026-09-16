import { useRouter } from "next/router";
import { useCallback, useState } from "react";
import {
  ChatEmptyState,
  ChatHeader,
  CitationPanel,
  Composer,
  LoadingState,
  MessageList,
  Notice,
  type IActiveCitation,
} from "@/components";
import { ROUTES } from "@/constants";
import {
  useChatStream,
  useConversationQuery,
  useDeleteConversationMutation,
  useOpenSource,
  useSourcesQuery,
} from "@/hooks";
import type { ICitation } from "@/interfaces";
import { getErrorMessage } from "@/utils";

interface IChatSessionContainerProps {
  workspaceId: string;
  conversationId: string | null;
  onConversationCreated: (conversationId: string) => void;
}

export function ChatSessionContainer({ workspaceId, conversationId, onConversationCreated }: IChatSessionContainerProps) {
  const router = useRouter();
  const [activeCitation, setActiveCitation] = useState<IActiveCitation | null>(null);
  const stream = useChatStream({ workspaceId, conversationId, onConversationCreated });
  // Only load history while no turn is on screen: the server copy would duplicate the question it shows.
  const isTurnIdle = stream.turn.status === "idle";
  const conversation = useConversationQuery(workspaceId, conversationId, isTurnIdle);
  const sources = useSourcesQuery(workspaceId);
  const openSource = useOpenSource(workspaceId);
  const deleteConversation = useDeleteConversationMutation(workspaceId);

  const messages = conversation.data?.messages ?? [];
  const hasReadySources = sources.data?.some((source) => source.status === "ready") ?? true;
  const isEmpty = messages.length === 0 && isTurnIdle;
  const isLoadingHistory =
    isTurnIdle && conversationId !== null && conversation.isPending && conversation.fetchStatus !== "idle";

  const resetOpenSource = openSource.reset;
  const selectCitation = useCallback(
    (selection: IActiveCitation) => {
      resetOpenSource(); // clear an "open source" error left over from another citation
      setActiveCitation(selection);
    },
    [resetOpenSource],
  );
  const closeCitation = useCallback(() => setActiveCitation(null), []);

  const handleDelete = () => {
    if (!conversationId) return;
    deleteConversation.mutate(conversationId, {
      onSuccess: () => void router.replace(ROUTES.chat(workspaceId)),
    });
  };

  const renderBody = () => {
    if (isLoadingHistory) return <LoadingState label="Loading conversation" />;
    if (conversation.isError && isTurnIdle) {
      return <Notice>Couldn&apos;t load this conversation: {getErrorMessage(conversation.error)}</Notice>;
    }
    if (isEmpty) return <ChatEmptyState hasReadySources={hasReadySources} sourcesHref={ROUTES.sources(workspaceId)} />;
    return (
      <MessageList
        messages={messages}
        turn={stream.turn}
        activeCitation={activeCitation}
        onSelectCitation={selectCitation}
        onRetry={() => void stream.send(stream.turn.question)}
      />
    );
  };

  return (
    <div className="flex flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pt-6 sm:px-10 sm:pt-10">
          {conversation.data && (
            <ChatHeader
              title={conversation.data.conversation.title || "Untitled conversation"}
              onDelete={handleDelete}
              isDeleting={deleteConversation.isPending}
            />
          )}
          {deleteConversation.isError && (
            <Notice className="mt-3">Couldn&apos;t delete: {getErrorMessage(deleteConversation.error)}</Notice>
          )}
          <div className="flex-1 py-8">{renderBody()}</div>
        </div>
        <div className="sticky bottom-0 bg-gradient-to-t from-paper from-70% to-transparent pt-6 pb-4 sm:pb-6">
          <div className="mx-auto w-full max-w-3xl px-5 sm:px-10">
            <Composer onSend={(text) => void stream.send(text)} onStop={stream.stop} isStreaming={stream.isStreaming} />
          </div>
        </div>
      </div>

      {activeCitation && (
        <CitationPanel
          citation={activeCitation.citation}
          onClose={closeCitation}
          onOpenSource={(citation: ICitation) => openSource.mutate(citation)}
          isOpening={openSource.isPending}
          openError={openSource.isError ? getErrorMessage(openSource.error) : null}
        />
      )}
    </div>
  );
}
