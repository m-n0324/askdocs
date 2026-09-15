import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants";
import type { IWorkspace } from "@/interfaces";
import { createWorkspace, deleteWorkspace, getWorkspaces } from "@/services";

export const useWorkspacesQuery = () =>
  useQuery({ queryKey: QUERY_KEYS.workspaces.all, queryFn: getWorkspaces });

export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWorkspace,
    onSuccess: (workspace) => {
      queryClient.setQueryData<IWorkspace[]>(QUERY_KEYS.workspaces.all, (previous = []) => [
        workspace,
        ...previous,
      ]);
    },
  });
}

export function useDeleteWorkspaceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWorkspace,
    onSuccess: (_result, workspaceId) => {
      queryClient.setQueryData<IWorkspace[]>(QUERY_KEYS.workspaces.all, (previous = []) =>
        previous.filter((workspace) => workspace.id !== workspaceId),
      );
    },
  });
}
