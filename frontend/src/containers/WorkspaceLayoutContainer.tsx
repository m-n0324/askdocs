import type { ReactNode } from "react";
import {
  ConversationList,
  LoadingState,
  NotFound,
  Notice,
  WorkspaceNav,
  WorkspaceShell,
  type WorkspaceSection,
} from "@/components";
import { useConversationsQuery, useLogout, useWorkspacesQuery } from "@/hooks";
import { useSessionStore } from "@/stores";
import { getErrorMessage } from "@/utils";
import { FullPageLoading } from "@/containers/FullPageLoading";

interface IWorkspaceLayoutContainerProps {
  workspaceId: string;
  section: WorkspaceSection;
  activeConversationId?: string | null;
  children: ReactNode;
}

/** Loads what the sidebar needs (workspace name, conversations, user) and wraps the page in the shell. */
export function WorkspaceLayoutContainer({
  workspaceId,
  section,
  activeConversationId = null,
  children,
}: IWorkspaceLayoutContainerProps) {
  const user = useSessionStore((state) => state.user);
  const logout = useLogout();
  // There is no GET /workspaces/:id, so the name comes from the (cached) list.
  const workspaces = useWorkspacesQuery();
  const conversations = useConversationsQuery(workspaceId);

  if (workspaces.isPending) return <FullPageLoading />;
  if (workspaces.isError) {
    return (
      <div className="p-8">
        <Notice>Couldn&apos;t load this workspace: {getErrorMessage(workspaces.error)}</Notice>
      </div>
    );
  }

  const workspace = workspaces.data.find((item) => item.id === workspaceId);
  if (!workspace) return <NotFound />;

  const conversationList = conversations.isPending ? (
    <div className="px-2 py-1">
      <LoadingState />
    </div>
  ) : conversations.isError ? (
    <p className="px-2 text-[13px] text-failed">Couldn&apos;t load conversations.</p>
  ) : (
    <ConversationList
      workspaceId={workspaceId}
      conversations={conversations.data}
      activeConversationId={activeConversationId}
    />
  );

  return (
    <WorkspaceShell
      title={workspace.name}
      nav={
        <WorkspaceNav
          workspaceId={workspaceId}
          workspaceName={workspace.name}
          activeSection={section}
          conversations={conversationList}
          userLabel={user?.name ?? user?.email ?? ""}
          onLogout={logout}
        />
      }
    >
      {children}
    </WorkspaceShell>
  );
}
