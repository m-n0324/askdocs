import Head from "next/head";
import { useRouter } from "next/router";
import { AuthGuard, UsageContainer } from "@/containers";
import { getRouteParam } from "@/utils";

export default function UsagePage() {
  const { query, isReady } = useRouter();
  const workspaceId = getRouteParam(query.workspaceId);

  return (
    <>
      <Head>
        <title>Usage · AskDocs</title>
      </Head>
      {isReady && workspaceId && (
        <AuthGuard>
          <UsageContainer workspaceId={workspaceId} />
        </AuthGuard>
      )}
    </>
  );
}
