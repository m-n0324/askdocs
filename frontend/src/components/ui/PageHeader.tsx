import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/Eyebrow";

interface IPageHeaderProps {
  eyebrow: string;
  title: string;
  description?: ReactNode;
}

export function PageHeader({ eyebrow, title, description }: IPageHeaderProps) {
  return (
    <header className="animate-rise">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-2 font-display text-[clamp(2.75rem,2rem+3vw,4.5rem)] leading-[0.95] tracking-[-0.01em] text-ink">
        {title}
      </h1>
      {description && <p className="mt-4 max-w-xl text-[15px] leading-7 text-ink-muted">{description}</p>}
    </header>
  );
}
