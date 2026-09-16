import { authApi, unwrap } from "@/lib/api";
import type { IApiSuccess, IConversation, IConversationDetail, IDeleted } from "@/interfaces";

const conversationsPath = (workspaceId: string) => `/workspaces/${workspaceId}/conversations`;

export const getConversations = (workspaceId: string) =>
  authApi().url(conversationsPath(workspaceId)).get().json<IApiSuccess<IConversation[]>>().then(unwrap);

export const getConversation = (workspaceId: string, conversationId: string) =>
  authApi()
    .url(`${conversationsPath(workspaceId)}/${conversationId}`)
    .get()
    .json<IApiSuccess<IConversationDetail>>()
    .then(unwrap);

export const deleteConversation = (workspaceId: string, conversationId: string) =>
  authApi()
    .url(`${conversationsPath(workspaceId)}/${conversationId}`)
    .delete()
    .json<IApiSuccess<IDeleted>>()
    .then(unwrap);
