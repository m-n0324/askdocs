import { useRouter } from "next/router";
import { useEffect } from "react";
import { ROUTES } from "@/constants";
import { FullPageLoading } from "@/containers/FullPageLoading";

/** /workspaces/[id] has no page of its own; chat is the default section. */
export function WorkspaceIndexRedirect({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();

  useEffect(() => {
    void router.replace(ROUTES.chat(workspaceId));
  }, [router, workspaceId]);

  return <FullPageLoading />;
}
