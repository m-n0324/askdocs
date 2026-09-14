import Router from "next/router";
import { ROUTES } from "@/constants";
import { useSessionStore } from "@/stores/useSessionStore";

export function getAuthToken(): string | null {
  return useSessionStore.getState().token;
}

/** Central 401 handler: the token is missing or expired, so drop it and go to /login. */
export function handleUnauthorized(): void {
  useSessionStore.getState().clearSession();
  if (typeof window !== "undefined" && Router.pathname !== ROUTES.LOGIN) {
    void Router.replace(ROUTES.LOGIN);
  }
}
