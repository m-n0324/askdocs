import { useState } from "react";
import { AddUrlForm, Eyebrow, LoadingState, Notice, PageHeader, SourcesTable, UploadDropzone } from "@/components";
import {
  isSourceInProgress,
  useAddUrlSourceMutation,
  useDeleteSourceMutation,
  useSourcesQuery,
  useUploadSourceMutation,
} from "@/hooks";
import type { ISource } from "@/interfaces";
import { getErrorMessage, validateUploadFile } from "@/utils";
import { WorkspaceLayoutContainer } from "@/containers/WorkspaceLayoutContainer";

const summarize = (sources: ISource[]) => {
  const ready = sources.filter((source) => source.status === "ready").length;
  const inProgress = sources.filter(isSourceInProgress).length;
  const failed = sources.filter((source) => source.status === "failed").length;
  return [`${sources.length} total`, `${ready} ready`, inProgress && `${inProgress} in progress`, failed && `${failed} failed`]
    .filter(Boolean)
    .join(" · ");
};

export function SourcesContainer({ workspaceId }: { workspaceId: string }) {
  const sources = useSourcesQuery(workspaceId);
  const upload = useUploadSourceMutation(workspaceId);
  const addUrl = useAddUrlSourceMutation(workspaceId);
  const deleteSource = useDeleteSourceMutation(workspaceId);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  const handleFiles = async (files: File[]) => {
    const invalid = files.map(validateUploadFile).filter((error): error is string => error !== null);
    const valid = files.filter((file) => validateUploadFile(file) === null);
    let serverErrors: string[] = [];
    // One at a time keeps the backend's ingestion queue (and the UI) predictable.
    for (const file of valid) {
      try {
        await upload.mutateAsync(file);
      } catch (error) {
        serverErrors = [...serverErrors, `${file.name}: ${getErrorMessage(error)}`];
      }
    }
    setUploadErrors([...invalid, ...serverErrors]);
  };

  const renderTable = () => {
    if (sources.isPending) return <LoadingState label="Loading sources" />;
    if (sources.isError) return <Notice>Couldn&apos;t load sources: {getErrorMessage(sources.error)}</Notice>;
    if (sources.data.length === 0) {
      return <p className="border-t border-ink pt-6 text-[15px] text-ink-muted">No sources yet. Add a file or a website above.</p>;
    }
    return (
      <>
        <p className="mb-3 font-mono text-[11.5px] text-ink-faint">{summarize(sources.data)}</p>
        <SourcesTable
          sources={sources.data}
          deletingId={deleteSource.isPending ? (deleteSource.variables ?? null) : null}
          onDelete={(sourceId) => deleteSource.mutate(sourceId)}
        />
      </>
    );
  };

  return (
    <WorkspaceLayoutContainer workspaceId={workspaceId} section="sources">
      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-10 sm:py-14">
        <PageHeader
          eyebrow="Knowledge"
          title="Sources"
          description="Everything the assistant may answer from. New sources are split into passages and indexed in the background, which can take a minute."
        />

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <section aria-labelledby="upload-heading">
            <Eyebrow className="mb-3">
              <span id="upload-heading">Upload files</span>
            </Eyebrow>
            <UploadDropzone onFiles={handleFiles} isUploading={upload.isPending} />
            {uploadErrors.length > 0 && (
              <Notice className="mt-3">
                <ul className="flex flex-col gap-1">
                  {uploadErrors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </Notice>
            )}
          </section>
          <section aria-labelledby="url-heading" className="lg:border-l lg:border-rule lg:pl-10">
            <Eyebrow className="mb-3">
              <span id="url-heading">Add a website</span>
            </Eyebrow>
            <AddUrlForm onSubmit={(input) => addUrl.mutateAsync(input)} isSubmitting={addUrl.isPending} />
            {addUrl.isError && <Notice className="mt-3">{getErrorMessage(addUrl.error)}</Notice>}
          </section>
        </div>

        <section aria-label="All sources" className="mt-14">
          {deleteSource.isError && (
            <Notice className="mb-4">Couldn&apos;t delete: {getErrorMessage(deleteSource.error)}</Notice>
          )}
          {renderTable()}
        </section>
      </div>
    </WorkspaceLayoutContainer>
  );
}
