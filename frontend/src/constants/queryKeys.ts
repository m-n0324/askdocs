export const QUERY_KEYS = {
  me: ["me"] as const,
  workspaces: {
    all: ["workspaces"] as const,
  },
  sources: {
    list: (workspaceId: string) => ["workspaces", workspaceId, "sources"] as const,
  },
  conversations: {
    list: (workspaceId: string) => ["workspaces", workspaceId, "conversations"] as const,
    detail: (workspaceId: string, conversationId: string) =>
      ["workspaces", workspaceId, "conversations", conversationId] as const,
  },
  usage: (workspaceId: string) => ["workspaces", workspaceId, "usage"] as const,
} as const;
