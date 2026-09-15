import {
  CreateWorkspaceForm,
  Eyebrow,
  LoadingState,
  Notice,
  PageHeader,
  WorkspaceList,
  Wordmark,
} from "@/components";
import { useCreateWorkspaceMutation, useDeleteWorkspaceMutation, useLogout, useWorkspacesQuery } from "@/hooks";
import { useSessionStore } from "@/stores";
import { getErrorMessage } from "@/utils";

export function WorkspacesContainer() {
  const user = useSessionStore((state) => state.user);
  const logout = useLogout();
  const workspaces = useWorkspacesQuery();
  const createWorkspace = useCreateWorkspaceMutation();
  const deleteWorkspace = useDeleteWorkspaceMutation();

  const renderList = () => {
    if (workspaces.isPending) return <LoadingState label="Loading workspaces" />;
    if (workspaces.isError) return <Notice>Couldn&apos;t load workspaces: {getErrorMessage(workspaces.error)}</Notice>;
    if (workspaces.data.length === 0) {
      return (
        <p className="border-t border-ink pt-6 text-[15px] text-ink-muted">
          No workspaces yet. Create one above, then upload the documents it should answer from.
        </p>
      );
    }
    return (
      <WorkspaceList
        workspaces={workspaces.data}
        deletingId={deleteWorkspace.isPending ? (deleteWorkspace.variables ?? null) : null}
        onDelete={(workspaceId) => deleteWorkspace.mutate(workspaceId)}
      />
    );
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 sm:px-10">
      <header className="flex items-center justify-between border-b border-rule py-5">
        <Wordmark />
        <div className="flex items-center gap-4 text-[13px] text-ink-muted">
          <span className="hidden sm:inline">{user?.email}</span>
          <button type="button" onClick={logout} className="rounded-xs px-1.5 py-0.5 hover:text-ink hover:underline">
            Log out
          </button>
        </div>
      </header>

      <main className="flex-1 py-12 sm:py-16">
        <PageHeader
          eyebrow={user ? `Hello, ${user.name}` : "Workspaces"}
          title="Your workspaces"
          description="Each workspace is a separate shelf of sources. Answers never mix sources from different workspaces."
        />

        <div className="mt-12 max-w-xl">
          <CreateWorkspaceForm
            onCreate={(name) => createWorkspace.mutateAsync(name)}
            isCreating={createWorkspace.isPending}
            serverError={createWorkspace.isError ? getErrorMessage(createWorkspace.error) : null}
          />
        </div>

        <section aria-labelledby="workspace-index" className="mt-14">
          <Eyebrow className="mb-3">
            <span id="workspace-index">Index</span>
          </Eyebrow>
          {deleteWorkspace.isError && (
            <Notice className="mb-4">Couldn&apos;t delete: {getErrorMessage(deleteWorkspace.error)}</Notice>
          )}
          {renderList()}
        </section>
      </main>
    </div>
  );
}
