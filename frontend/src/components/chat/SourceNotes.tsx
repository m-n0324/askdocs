import type { ICitation } from "@/interfaces";
import { cx, formatCitationLocation } from "@/utils";

interface ISourceNotesProps {
  citations: ICitation[];
  activeIndex: number | null;
  onSelectCitation: (citation: ICitation) => void;
}

/** Footnote-style list of the sources an answer actually cites. */
export function SourceNotes({ citations, activeIndex, onSelectCitation }: ISourceNotesProps) {
  if (citations.length === 0) return null;

  return (
    <ol className="mt-4 flex flex-col border-t border-rule pt-3" aria-label="Sources">
      {citations.map((citation) => {
        const location = formatCitationLocation(citation);
        return (
          <li key={citation.index}>
            <button
              type="button"
              onClick={() => onSelectCitation(citation)}
              className={cx(
                "flex w-full items-baseline gap-3 rounded-xs px-1 py-1 text-left text-[13px] transition-colors",
                activeIndex === citation.index ? "bg-accent-wash" : "hover:bg-paper-sunk",
              )}
            >
              <span className="w-5 shrink-0 font-mono text-[11px] text-accent-strong">[{citation.index}]</span>
              <span className="min-w-0 truncate text-ink">{citation.sourceName}</span>
              {location && <span className="shrink-0 font-mono text-[11px] text-ink-faint">{location}</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
