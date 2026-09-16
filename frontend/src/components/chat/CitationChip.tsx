import type { ICitation } from "@/interfaces";
import { cx, formatCitationLocation } from "@/utils";

interface ICitationChipProps {
  citation: ICitation;
  isActive?: boolean;
  onSelect: (citation: ICitation) => void;
}

/** The small superscript [n] inside an answer. It's a real button, so it works with the keyboard. */
export function CitationChip({ citation, isActive = false, onSelect }: ICitationChipProps) {
  const location = formatCitationLocation(citation);
  const label = `Source ${citation.index}: ${citation.sourceName}${location ? `, ${location}` : ""}`;

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isActive}
      title={label}
      onClick={() => onSelect(citation)}
      className={cx(
        "relative -top-[0.45em] mx-[1px] inline-flex h-[1.35em] min-w-[1.35em] items-center justify-center rounded-xs px-1",
        "align-baseline font-mono text-[10.5px] leading-none font-medium transition-colors duration-150",
        isActive
          ? "bg-accent text-paper-raised"
          : "bg-accent-wash text-accent-strong hover:bg-accent hover:text-paper-raised",
      )}
    >
      {citation.index}
    </button>
  );
}
