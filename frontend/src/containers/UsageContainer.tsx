import { LoadingState, Notice, PageHeader, UsageSummary } from "@/components";
import { useUsageQuery } from "@/hooks";
import { getErrorMessage } from "@/utils";
import { WorkspaceLayoutContainer } from "@/containers/WorkspaceLayoutContainer";

export function UsageContainer({ workspaceId }: { workspaceId: string }) {
  const usage = useUsageQuery(workspaceId);

  const renderBody = () => {
    if (usage.isPending) return <LoadingState label="Loading usage" />;
    if (usage.isError) return <Notice>Couldn&apos;t load usage: {getErrorMessage(usage.error)}</Notice>;
    return <UsageSummary usage={usage.data} />;
  };

  return (
    <WorkspaceLayoutContainer workspaceId={workspaceId} section="usage">
      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-10 sm:py-14">
        <PageHeader
          eyebrow="Ledger"
          title="Usage"
          description="Tokens are the units the language model reads and writes. Every question, answer, and indexed passage uses some."
        />
        <div className="mt-12">{renderBody()}</div>
      </div>
    </WorkspaceLayoutContainer>
  );
}
