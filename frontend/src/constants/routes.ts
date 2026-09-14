export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  WORKSPACES: "/workspaces",
  workspace: (workspaceId: string) => `/workspaces/${workspaceId}`,
  chat: (workspaceId: string, conversationId?: string) =>
    conversationId
      ? `/workspaces/${workspaceId}/chat/${conversationId}`
      : `/workspaces/${workspaceId}/chat`,
  sources: (workspaceId: string) => `/workspaces/${workspaceId}/sources`,
  usage: (workspaceId: string) => `/workspaces/${workspaceId}/usage`,
} as const;
