import Head from "next/head";
import { useRouter } from "next/router";
import { AuthGuard, ChatContainer } from "@/containers";
import { getRouteParam } from "@/utils";

/**
 * One page for both /chat and /chat/[conversationId] (an optional catch-all route).
 * Shallow routing only keeps state when the URL stays on the SAME page file,
 * so when a new chat gets its id mid-stream we can swap the URL without
 * remounting and losing the answer that's streaming in.
 */
export default function ChatPage() {
  const { query, isReady } = useRouter();
  const workspaceId = getRouteParam(query.workspaceId);
  const conversationId = getRouteParam(query.conversationId) ?? null;

  return (
    <>
      <Head>
        <title>Chat · AskDocs</title>
      </Head>
      {isReady && workspaceId && (
        <AuthGuard>
          <ChatContainer workspaceId={workspaceId} conversationId={conversationId} />
        </AuthGuard>
      )}
    </>
  );
}
