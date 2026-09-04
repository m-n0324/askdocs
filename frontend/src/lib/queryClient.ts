import { QueryClient } from "@tanstack/react-query";
import { QUERY_STALE_TIME_MS } from "@/constants";
import { isClientError } from "@/lib/apiError";

const MAX_RETRIES = 1;

export const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => !isClientError(error) && failureCount < MAX_RETRIES,
      },
    },
  });
