import type { IUsage, UsageKind } from "@/interfaces";
import { formatNumber, toPercent } from "@/utils";

const KIND_LABELS: Record<UsageKind, { label: string; description: string }> = {
  chat: { label: "Chat", description: "Writing answers" },
  embedding: { label: "Embedding", description: "Indexing sources and questions" },
  rewrite: { label: "Rewrite", description: "Turning follow-ups into standalone questions" },
};

export function UsageBreakdown({ byKind, total }: { byKind: IUsage["byKind"]; total: number }) {
  if (byKind.length === 0) return <p className="text-sm text-ink-faint">No usage recorded this period.</p>;

  return (
    <ul className="border-t border-ink">
      {byKind.map((row) => {
        const meta = KIND_LABELS[row.kind] ?? { label: row.kind, description: "" };
        const percent = toPercent(row.totalTokens, total);
        return (
          <li key={row.kind} className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 border-b border-rule py-4">
            <div>
              <p className="text-[15px] font-medium text-ink">{meta.label}</p>
              <p className="text-[13px] text-ink-faint">{meta.description}</p>
            </div>
            <p className="text-right font-mono text-sm text-ink">
              {formatNumber(row.totalTokens)}
              <span className="ml-2 text-ink-faint">{percent}%</span>
            </p>
            <div aria-hidden className="col-span-2 h-1 bg-paper-sunk">
              <div className="h-full origin-left bg-ink" style={{ transform: `scaleX(${percent / 100})` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
