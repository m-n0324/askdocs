import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants";
import type { IConversation } from "@/interfaces";
import { deleteConversation, getConversation, getConversations } from "@/services";

export const useConversationsQuery = (workspaceId: string) =>
  useQuery({
    queryKey: QUERY_KEYS.conversations.list(workspaceId),
    queryFn: () => getConversations(workspaceId),
  });

export const useConversationQuery = (workspaceId: string, conversationId: string | null, enabled = true) =>
  useQuery({
    queryKey: QUERY_KEYS.conversations.detail(workspaceId, conversationId ?? ""),
    queryFn: () => getConversation(workspaceId, conversationId ?? ""),
    enabled: enabled && conversationId !== null,
  });

export function useDeleteConversationMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => deleteConversation(workspaceId, conversationId),
    onSuccess: (_result, conversationId) => {
      queryClient.setQueryData<IConversation[]>(
        QUERY_KEYS.conversations.list(workspaceId),
        (previous = []) => previous.filter((conversation) => conversation.id !== conversationId),
      );
      queryClient.removeQueries({ queryKey: QUERY_KEYS.conversations.detail(workspaceId, conversationId) });
    },
  });
}
