import { useRouter } from "next/router";
import { useEffect, type ReactNode } from "react";
import { ROUTES } from "@/constants";
import { useSessionReady } from "@/hooks";
import { useSessionStore } from "@/stores";
import { FullPageLoading } from "@/containers/FullPageLoading";

/**
 * For /login and /signup: logged-in users go straight to their workspaces.
 * This also performs the redirect right after a successful login/signup,
 * because saving the session sets the token.
 */
export function GuestGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isReady = useSessionReady();
  const token = useSessionStore((state) => state.token);

  useEffect(() => {
    if (isReady && token) void router.replace(ROUTES.WORKSPACES);
  }, [isReady, token, router]);

  if (!isReady || token) return <FullPageLoading />;
  return children;
}
