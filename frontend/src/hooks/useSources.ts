import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS, SOURCES_POLL_INTERVAL_MS } from "@/constants";
import type { IAddUrlSourceInput, ISource } from "@/interfaces";
import { addUrlSource, deleteSource, getSources, uploadSource } from "@/services";

export const isSourceInProgress = (source: ISource) =>
  source.status === "pending" || source.status === "processing";

export const useSourcesQuery = (workspaceId: string) =>
  useQuery({
    queryKey: QUERY_KEYS.sources.list(workspaceId),
    queryFn: () => getSources(workspaceId),
    // Poll only while ingestion is running; stop as soon as everything settles.
    refetchInterval: (query) =>
      query.state.data?.some(isSourceInProgress) ? SOURCES_POLL_INTERVAL_MS : false,
  });

/** Puts a newly created source at the top of the cached list (the API returns newest first). */
function useAddSourceToCache(workspaceId: string) {
  const queryClient = useQueryClient();
  return (source: ISource) => {
    queryClient.setQueryData<ISource[]>(QUERY_KEYS.sources.list(workspaceId), (previous = []) => [
      source,
      ...previous,
    ]);
  };
}

export function useUploadSourceMutation(workspaceId: string) {
  const addToCache = useAddSourceToCache(workspaceId);
  return useMutation({
    mutationFn: (file: File) => uploadSource(workspaceId, file),
    onSuccess: addToCache,
  });
}

export function useAddUrlSourceMutation(workspaceId: string) {
  const addToCache = useAddSourceToCache(workspaceId);
  return useMutation({
    mutationFn: (input: IAddUrlSourceInput) => addUrlSource(workspaceId, input),
    onSuccess: addToCache,
  });
}

export function useDeleteSourceMutation(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sourceId: string) => deleteSource(workspaceId, sourceId),
    onSuccess: (_result, sourceId) => {
      queryClient.setQueryData<ISource[]>(QUERY_KEYS.sources.list(workspaceId), (previous = []) =>
        previous.filter((source) => source.id !== sourceId),
      );
    },
  });
}
