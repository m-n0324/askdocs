import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useCallback } from "react";
import { ROUTES } from "@/constants";
import type { IAuthResponse } from "@/interfaces";
import { login, signup } from "@/services";
import { useSessionStore } from "@/stores";

/** Shared success path: forget the previous user's cached data, then save the new session. */
function useStartSession() {
  const queryClient = useQueryClient();
  const setSession = useSessionStore((state) => state.setSession);
  return useCallback(
    (session: IAuthResponse) => {
      queryClient.clear();
      setSession(session);
    },
    [queryClient, setSession],
  );
}

export function useLoginMutation() {
  const startSession = useStartSession();
  return useMutation({ mutationFn: login, onSuccess: startSession });
}

export function useSignupMutation() {
  const startSession = useStartSession();
  return useMutation({ mutationFn: signup, onSuccess: startSession });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const clearSession = useSessionStore((state) => state.clearSession);
  return useCallback(() => {
    clearSession();
    queryClient.clear();
    void router.replace(ROUTES.LOGIN);
  }, [clearSession, queryClient, router]);
}
