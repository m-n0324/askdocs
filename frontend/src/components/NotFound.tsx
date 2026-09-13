import Link from "next/link";
import { Eyebrow, Wordmark } from "@/components/ui";
import { ROUTES } from "@/constants";

export function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col px-6 py-8 sm:px-12">
      <Link href={ROUTES.HOME} aria-label="AskDocs home" className="self-start">
        <Wordmark />
      </Link>
      <div className="m-auto max-w-xl animate-rise py-16">
        <Eyebrow>Error 404</Eyebrow>
        <h1 className="mt-3 font-display text-[clamp(3rem,2rem+5vw,6rem)] leading-[0.92] text-ink">
          No source for <em className="text-accent">this page.</em>
        </h1>
        <p className="mt-5 text-[15px] leading-7 text-ink-muted">
          The address may be mistyped, or the workspace was deleted.
        </p>
        <Link
          href={ROUTES.HOME}
          className="mt-8 inline-block text-[15px] font-medium text-accent-strong underline decoration-1 underline-offset-4 hover:text-accent"
        >
          Back to your workspaces →
        </Link>
      </div>
    </div>
  );
}
