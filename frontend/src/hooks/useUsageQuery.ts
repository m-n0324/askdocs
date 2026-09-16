import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/constants";
import { getUsage } from "@/services";

export const useUsageQuery = (workspaceId: string) =>
  useQuery({ queryKey: QUERY_KEYS.usage(workspaceId), queryFn: () => getUsage(workspaceId) });
