import Head from "next/head";
import { AuthGuard, WorkspacesContainer } from "@/containers";

export default function WorkspacesPage() {
  return (
    <>
      <Head>
        <title>Workspaces · AskDocs</title>
      </Head>
      <AuthGuard>
        <WorkspacesContainer />
      </AuthGuard>
    </>
  );
}
