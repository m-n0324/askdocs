import { useRouter } from "next/router";
import { useEffect } from "react";
import { ROUTES } from "@/constants";
import { useSessionReady } from "@/hooks";
import { useSessionStore } from "@/stores";
import { FullPageLoading } from "@/containers/FullPageLoading";

/** "/" has no content of its own: it sends you to your workspaces or to login. */
export function HomeRedirectContainer() {
  const router = useRouter();
  const isReady = useSessionReady();
  const token = useSessionStore((state) => state.token);

  useEffect(() => {
    if (isReady) void router.replace(token ? ROUTES.WORKSPACES : ROUTES.LOGIN);
  }, [isReady, token, router]);

  return <FullPageLoading />;
}
