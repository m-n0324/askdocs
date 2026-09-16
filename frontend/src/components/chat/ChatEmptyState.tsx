import Link from "next/link";
import { Eyebrow } from "@/components/ui";

interface IChatEmptyStateProps {
  hasReadySources: boolean;
  sourcesHref: string;
}

export function ChatEmptyState({ hasReadySources, sourcesHref }: IChatEmptyStateProps) {
  return (
    <div className="animate-rise py-10 sm:py-16">
      <Eyebrow>New conversation</Eyebrow>
      <h1 className="mt-3 max-w-xl font-display text-[clamp(2.5rem,1.8rem+3vw,4rem)] leading-[0.98] text-ink">
        What would you like to <em className="text-accent">find out</em>?
      </h1>
      {hasReadySources ? (
        <p className="mt-5 max-w-md text-[15px] leading-7 text-ink-muted">
          Answers come only from this workspace&apos;s sources. Click a numbered marker to see the exact passage it
          came from.
        </p>
      ) : (
        <div className="mt-6 max-w-md border-l-2 border-accent pl-4">
          <p className="text-[15px] leading-7 text-ink-muted">
            This workspace has no ready sources yet, so there&apos;s nothing to answer from.
          </p>
          <Link
            href={sourcesHref}
            className="mt-2 inline-block text-[15px] font-medium text-accent-strong underline decoration-1 underline-offset-4 hover:text-accent"
          >
            Upload sources first →
          </Link>
        </div>
      )}
    </div>
  );
}
