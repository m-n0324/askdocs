import { useEffect, useRef } from "react";
import { Button, Eyebrow, Notice } from "@/components/ui";
import type { ICitation } from "@/interfaces";
import { formatCitationLocation, isPdf, isTextFile } from "@/utils";

interface ICitationPanelProps {
  citation: ICitation;
  onClose: () => void;
  onOpenSource: (citation: ICitation) => void;
  isOpening: boolean;
  openError: string | null;
}

const SCORE_DIGITS = 2;

const openLabel = (citation: ICitation) => {
  if (citation.sourceType === "url") return "Open website ↗";
  if (isPdf(citation.sourceName)) return `Open PDF${citation.page ? ` at p. ${citation.page}` : ""} ↗`;
  return isTextFile(citation.sourceName) ? "Open file ↗" : "Download file";
};

/** Side panel with the cited passage. Esc closes it and focus returns to the chip that opened it. */
export function CitationPanel({ citation, onClose, onOpenSource, isOpening, openError }: ICitationPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const location = formatCitationLocation(citation);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => opener?.focus();
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Close citation"
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 z-30 animate-fade-in bg-ink/25 lg:hidden"
      />
      <aside
        aria-label={`Citation ${citation.index}`}
        className="fixed inset-y-0 right-0 z-40 flex w-[min(26rem,92vw)] animate-slide-in flex-col border-l border-rule bg-paper-raised lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-[24rem] lg:shrink-0 lg:self-start"
      >
        <header className="flex items-center justify-between border-b border-rule px-6 py-3">
          <Eyebrow>
            Citation <span className="text-accent-strong">[{citation.index}]</span>
          </Eyebrow>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-xs px-1.5 py-0.5 font-mono text-[11px] tracking-[0.14em] text-ink-muted uppercase hover:bg-paper-sunk hover:text-ink"
          >
            Close <span aria-hidden>esc</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <h2 className="font-display text-[1.75rem] leading-tight break-words text-ink">{citation.sourceName}</h2>
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11.5px] text-ink-muted">
            <div className="flex gap-1.5">
              <dt className="text-ink-faint">type</dt>
              <dd>{citation.sourceType === "url" ? "website" : "file"}</dd>
            </div>
            {location && (
              <div className="flex gap-1.5">
                <dt className="text-ink-faint">at</dt>
                <dd>{location}</dd>
              </div>
            )}
            <div className="flex gap-1.5">
              <dt className="text-ink-faint">match</dt>
              <dd>{citation.score.toFixed(SCORE_DIGITS)}</dd>
            </div>
          </dl>
          {citation.url && (
            <p className="mt-2 truncate font-mono text-[11.5px] text-ink-faint" title={citation.url}>
              {citation.url}
            </p>
          )}

          <blockquote className="mt-6 border-l-2 border-accent pl-4 text-[14.5px] leading-7 whitespace-pre-wrap text-ink">
            {citation.snippet}
          </blockquote>
        </div>

        <footer className="flex flex-col gap-3 border-t border-rule px-6 py-4">
          {openError && <Notice>{openError}</Notice>}
          <Button variant="secondary" isLoading={isOpening} onClick={() => onOpenSource(citation)} className="self-start">
            {openLabel(citation)}
          </Button>
        </footer>
      </aside>
    </>
  );
}
