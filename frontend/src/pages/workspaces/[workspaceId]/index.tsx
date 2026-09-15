import { useRouter } from "next/router";
import { AuthGuard, WorkspaceIndexRedirect } from "@/containers";
import { getRouteParam } from "@/utils";

export default function WorkspaceIndexPage() {
  const { query, isReady } = useRouter();
  const workspaceId = getRouteParam(query.workspaceId);
  if (!isReady || !workspaceId) return null;

  return (
    <AuthGuard>
      <WorkspaceIndexRedirect workspaceId={workspaceId} />
    </AuthGuard>
  );
}
