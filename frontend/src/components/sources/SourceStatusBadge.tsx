import type { SourceStatus } from "@/interfaces";
import { cx } from "@/utils";

const STATUS_STYLES: Record<SourceStatus, { label: string; className: string; dot: string }> = {
  pending: { label: "Queued", className: "bg-pending-wash text-pending", dot: "bg-pending animate-breathe" },
  processing: { label: "Processing", className: "bg-pending-wash text-pending", dot: "bg-pending animate-breathe" },
  ready: { label: "Ready", className: "bg-ready-wash text-ready", dot: "bg-ready" },
  failed: { label: "Failed", className: "bg-failed-wash text-failed", dot: "bg-failed" },
};

interface ISourceStatusBadgeProps {
  status: SourceStatus;
  /** Why ingestion failed; shown as a tooltip on the badge. */
  error?: string | null;
}

export function SourceStatusBadge({ status, error }: ISourceStatusBadgeProps) {
  const style = STATUS_STYLES[status];
  const tooltip = status === "failed" && error ? error : undefined;

  return (
    <span
      title={tooltip}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-xs px-1.5 py-0.5 font-mono text-[10.5px] tracking-[0.08em] uppercase",
        style.className,
      )}
    >
      <span aria-hidden className={cx("size-1.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}
