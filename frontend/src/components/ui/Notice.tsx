import type { ReactNode } from "react";
import { cx } from "@/utils";

interface INoticeProps {
  tone?: "error" | "info";
  children: ReactNode;
  className?: string;
}

export function Notice({ tone = "error", children, className }: INoticeProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "border-l-2 py-2 pr-3 pl-3 text-sm",
        tone === "error" ? "border-failed bg-failed-wash text-failed" : "border-rule-strong bg-paper-sunk text-ink-muted",
        className,
      )}
    >
      {children}
    </div>
  );
}
