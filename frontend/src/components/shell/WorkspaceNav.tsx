import Link from "next/link";
import type { ReactNode } from "react";
import { Eyebrow, Wordmark } from "@/components/ui";
import { ROUTES } from "@/constants";
import { cx } from "@/utils";

export type WorkspaceSection = "chat" | "sources" | "usage";

interface IWorkspaceNavProps {
  workspaceId: string;
  workspaceName: string;
  activeSection: WorkspaceSection;
  /** The conversation list (or its loading / error state). */
  conversations: ReactNode;
  userLabel: string;
  onLogout: () => void;
}

const SECTIONS: { id: WorkspaceSection; label: string; href: (workspaceId: string) => string }[] = [
  { id: "chat", label: "Chat", href: (workspaceId) => ROUTES.chat(workspaceId) },
  { id: "sources", label: "Sources", href: ROUTES.sources },
  { id: "usage", label: "Usage", href: ROUTES.usage },
];

export function WorkspaceNav({
  workspaceId,
  workspaceName,
  activeSection,
  conversations,
  userLabel,
  onLogout,
}: IWorkspaceNavProps) {
  return (
    <nav aria-label="Workspace" className="flex h-full flex-col">
      <div className="border-b border-rule px-5 pt-5 pb-4">
        <Link href={ROUTES.WORKSPACES} className="inline-block" aria-label="AskDocs — all workspaces">
          <Wordmark className="text-xl" />
        </Link>
        <Link
          href={ROUTES.WORKSPACES}
          className="mt-5 block font-mono text-[11px] tracking-[0.14em] text-ink-faint uppercase hover:text-ink"
        >
          ← All workspaces
        </Link>
        <p className="mt-1.5 font-display text-2xl leading-tight break-words text-ink">{workspaceName}</p>
      </div>

      <ul className="flex flex-col gap-0.5 border-b border-rule px-3 py-3">
        {SECTIONS.map((section) => {
          const isActive = section.id === activeSection;
          return (
            <li key={section.id}>
              <Link
                href={section.href(workspaceId)}
                aria-current={isActive ? "page" : undefined}
                className={cx(
                  "flex items-center justify-between rounded-sm px-2 py-1.5 text-sm transition-colors",
                  isActive ? "bg-paper-raised font-medium text-ink" : "text-ink-muted hover:bg-paper/70 hover:text-ink",
                )}
              >
                {section.label}
                {isActive && <span aria-hidden className="size-1.5 rounded-full bg-accent" />}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="flex min-h-0 flex-1 flex-col px-3 pt-4">
        <div className="mb-2 flex items-center justify-between px-2">
          <Eyebrow>Conversations</Eyebrow>
          <Link
            href={ROUTES.chat(workspaceId)}
            className="rounded-xs px-1.5 py-0.5 text-[12.5px] font-medium text-accent-strong hover:bg-accent-wash"
          >
            + New chat
          </Link>
        </div>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-4">{conversations}</div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-rule px-5 py-3">
        <span className="min-w-0 truncate text-[13px] text-ink-muted">{userLabel}</span>
        <button
          type="button"
          onClick={onLogout}
          className="shrink-0 rounded-xs px-1.5 py-0.5 text-[13px] text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
