import type { ReactNode } from "react";
import { Eyebrow, Wordmark } from "@/components/ui";

interface IAuthLayoutProps {
  eyebrow: string;
  title: string;
  children: ReactNode;
  footer: ReactNode;
}

/** Two-column editorial layout: a masthead on the left, the form on the right. */
export function AuthLayout({ eyebrow, title, children, footer }: IAuthLayoutProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative flex flex-col justify-between gap-12 border-b border-rule px-6 py-8 sm:px-10 lg:border-r lg:border-b-0 lg:px-14 lg:py-12">
        <Wordmark />
        <div className="max-w-xl animate-rise">
          <h1 className="font-display text-[clamp(2.75rem,2rem+4vw,5.5rem)] leading-[0.92] tracking-[-0.02em] text-ink">
            Answers from your documents, <em className="text-accent">with receipts.</em>
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-7 text-ink-muted">
            Upload Markdown, text, PDF or Word files, or whole websites. Ask in plain language. Every sentence points back to the
            page it came from.
          </p>
        </div>
        <figure className="hidden max-w-md border-t border-rule pt-4 lg:block">
          <blockquote className="font-display text-xl leading-snug text-ink-muted italic">
            “Refunds are issued within 14 days of the request
            <sup className="ml-0.5 rounded-xs bg-accent-wash px-1 font-mono text-[10px] text-accent-strong not-italic">
              1
            </sup>
            .”
          </blockquote>
          <figcaption className="mt-2 font-mono text-[11px] tracking-wide text-ink-faint">
            [1] billing-policy.pdf · p. 4 · Refunds
          </figcaption>
        </figure>
      </section>

      <section className="flex items-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="w-full max-w-sm animate-rise [animation-delay:80ms]">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-2 font-display text-4xl leading-tight text-ink">{title}</h2>
          <div className="mt-8">{children}</div>
          <div className="mt-8 border-t border-rule pt-4 text-sm text-ink-muted">{footer}</div>
        </div>
      </section>
    </div>
  );
}
