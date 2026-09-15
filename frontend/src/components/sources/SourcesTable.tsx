import { ConfirmButton } from "@/components/ui";
import type { ISource } from "@/interfaces";
import { formatBytes, formatNumber, formatRelativeTime, getFileExtension } from "@/utils";
import { SourceStatusBadge } from "@/components/sources/SourceStatusBadge";

interface ISourcesTableProps {
  sources: ISource[];
  deletingId: string | null;
  onDelete: (sourceId: string) => void;
}

const typeLabel = (source: ISource) =>
  source.type === "url" ? "WEB" : getFileExtension(source.name).replace(".", "").toUpperCase() || "FILE";

const HEAD_CELL = "py-2 pr-4 text-left font-mono text-[10.5px] font-normal tracking-[0.14em] text-ink-faint uppercase";
const CELL = "py-3.5 pr-4 align-top";

export function SourcesTable({ sources, deletingId, onDelete }: ISourcesTableProps) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink">
            <th scope="col" className={HEAD_CELL}>Name</th>
            <th scope="col" className={HEAD_CELL}>Status</th>
            <th scope="col" className={`${HEAD_CELL} text-right`}>Chunks</th>
            <th scope="col" className={`${HEAD_CELL} text-right`}>Size</th>
            <th scope="col" className={HEAD_CELL}>Added</th>
            <th scope="col" className={HEAD_CELL}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => (
            <tr key={source.id} className="border-b border-rule transition-colors hover:bg-paper-raised/70">
              <td className={`${CELL} max-w-[22rem]`}>
                <div className="flex items-baseline gap-2">
                  <span className="shrink-0 font-mono text-[10px] text-ink-faint">{typeLabel(source)}</span>
                  <span className="truncate font-medium text-ink" title={source.name}>
                    {source.name}
                  </span>
                </div>
                {source.url && <p className="mt-0.5 truncate pl-9 text-[12.5px] text-ink-faint">{source.url}</p>}
              </td>
              <td className={CELL}>
                <SourceStatusBadge status={source.status} error={source.error} />
                {source.status === "failed" && source.error && (
                  <p className="mt-1 max-w-[16rem] text-[12.5px] leading-snug text-failed">{source.error}</p>
                )}
              </td>
              <td className={`${CELL} text-right font-mono text-[13px] text-ink-muted`}>
                {formatNumber(source.chunkCount)}
              </td>
              <td className={`${CELL} text-right font-mono text-[13px] whitespace-nowrap text-ink-muted`}>
                {formatBytes(source.sizeBytes)}
              </td>
              <td className={`${CELL} font-mono text-[12.5px] whitespace-nowrap text-ink-muted`}>
                <time dateTime={source.createdAt}>{formatRelativeTime(source.createdAt)}</time>
              </td>
              <td className={`${CELL} text-right whitespace-nowrap`}>
                <ConfirmButton
                  label="Delete"
                  ariaLabel={`Delete ${source.name}`}
                  question="Remove it?"
                  confirmLabel="Remove"
                  isLoading={deletingId === source.id}
                  onConfirm={() => onDelete(source.id)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
