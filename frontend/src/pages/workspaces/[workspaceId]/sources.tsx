import Head from "next/head";
import { useRouter } from "next/router";
import { AuthGuard, SourcesContainer } from "@/containers";
import { getRouteParam } from "@/utils";

export default function SourcesPage() {
  const { query, isReady } = useRouter();
  const workspaceId = getRouteParam(query.workspaceId);

  return (
    <>
      <Head>
        <title>Sources · AskDocs</title>
      </Head>
      {isReady && workspaceId && (
        <AuthGuard>
          <SourcesContainer workspaceId={workspaceId} />
        </AuthGuard>
      )}
    </>
  );
}
