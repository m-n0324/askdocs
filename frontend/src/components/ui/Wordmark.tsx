import { cx } from "@/utils";

/** The logo: the name with a citation marker, because every answer comes with sources. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-start font-display text-2xl leading-none text-ink", className)}>
      AskDocs
      <span
        aria-hidden
        className="ml-0.5 -translate-y-0.5 rounded-xs bg-accent-wash px-1 font-mono text-[9px] leading-[1.4] text-accent-strong"
      >
        1
      </span>
    </span>
  );
}
