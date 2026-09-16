import type { ICitation } from "@/interfaces";
import { splitCitationMarkers } from "@/utils";
import { CitationChip } from "@/components/chat/CitationChip";

interface IAnswerTextProps {
  text: string;
  citations: ICitation[];
  activeIndex: number | null;
  onSelectCitation: (citation: ICitation) => void;
  showCaret?: boolean;
}

/**
 * Renders answer text as plain text + citation chips.
 * Answers come from untrusted documents, so we never inject HTML:
 * React escapes every text segment for us.
 */
export function AnswerText({ text, citations, activeIndex, onSelectCitation, showCaret = false }: IAnswerTextProps) {
  const segments = splitCitationMarkers(text, citations);

  return (
    <div className="text-[15.5px] leading-[1.75] whitespace-pre-wrap text-ink">
      {segments.map((segment, position) =>
        segment.type === "text" ? (
          <span key={position}>{segment.text}</span>
        ) : (
          <CitationChip
            key={position}
            citation={segment.citation}
            isActive={activeIndex === segment.citation.index}
            onSelect={onSelectCitation}
          />
        ),
      )}
      {showCaret && (
        <span aria-hidden className="ml-0.5 inline-block h-[1.1em] w-[0.5em] translate-y-[0.2em] animate-caret bg-accent" />
      )}
    </div>
  );
}
