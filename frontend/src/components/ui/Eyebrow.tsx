import type { ReactNode } from "react";
import { cx } from "@/utils";

/** Small mono, uppercase label used above headings and for metadata. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("font-mono text-[11px] tracking-[0.16em] text-ink-muted uppercase", className)}>{children}</p>
  );
}
