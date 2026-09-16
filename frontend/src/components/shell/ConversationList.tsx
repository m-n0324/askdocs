import Link from "next/link";
import { ROUTES } from "@/constants";
import type { IConversation } from "@/interfaces";
import { cx, formatRelativeTime } from "@/utils";

interface IConversationListProps {
  workspaceId: string;
  conversations: IConversation[];
  activeConversationId: string | null;
}

export function ConversationList({ workspaceId, conversations, activeConversationId }: IConversationListProps) {
  if (conversations.length === 0) {
    return <p className="px-2 py-1 text-[13px] text-ink-faint">No conversations yet.</p>;
  }

  return (
    <ul className="flex flex-col">
      {conversations.map((conversation) => {
        const isActive = conversation.id === activeConversationId;
        return (
          <li key={conversation.id}>
            <Link
              href={ROUTES.chat(workspaceId, conversation.id)}
              aria-current={isActive ? "page" : undefined}
              className={cx(
                "group flex flex-col gap-0.5 rounded-sm px-2 py-2 transition-colors",
                isActive ? "bg-paper-raised shadow-[inset_2px_0_0_var(--color-accent)]" : "hover:bg-paper/70",
              )}
            >
              <span className={cx("truncate text-[13.5px]", isActive ? "text-ink" : "text-ink-muted group-hover:text-ink")}>
                {conversation.title || "Untitled conversation"}
              </span>
              <span className="font-mono text-[10.5px] text-ink-faint">{formatRelativeTime(conversation.updatedAt)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
