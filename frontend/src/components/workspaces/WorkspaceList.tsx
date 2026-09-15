import Link from "next/link";
import { ConfirmButton } from "@/components/ui";
import { ROUTES } from "@/constants";
import type { IWorkspace } from "@/interfaces";
import { formatDate } from "@/utils";

interface IWorkspaceListProps {
  workspaces: IWorkspace[];
  deletingId: string | null;
  onDelete: (workspaceId: string) => void;
}

/** An index of workspaces: numbered rows separated by hairline rules. */
export function WorkspaceList({ workspaces, deletingId, onDelete }: IWorkspaceListProps) {
  return (
    <ol className="border-t border-ink">
      {workspaces.map((workspace, position) => (
        <li
          key={workspace.id}
          className="group grid animate-rise grid-cols-[2.5rem_1fr] items-baseline gap-x-4 border-b border-rule py-5 sm:grid-cols-[3rem_1fr_auto]"
        >
          <span className="font-mono text-xs text-ink-faint">{String(position + 1).padStart(2, "0")}</span>
          <div className="min-w-0">
            <Link
              href={ROUTES.chat(workspace.id)}
              className="font-display text-3xl leading-tight text-ink decoration-accent decoration-1 underline-offset-4 transition-colors hover:text-accent-strong hover:underline"
            >
              {workspace.name}
            </Link>
            <p className="mt-1 font-mono text-[11px] tracking-wide text-ink-faint">
              Created {formatDate(workspace.createdAt)}
            </p>
          </div>
          <div className="col-start-2 mt-3 flex items-center gap-2 sm:col-start-3 sm:mt-0">
            <ConfirmButton
              label="Delete"
              ariaLabel={`Delete ${workspace.name}`}
              question="Delete it and all its sources?"
              isLoading={deletingId === workspace.id}
              onConfirm={() => onDelete(workspace.id)}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
