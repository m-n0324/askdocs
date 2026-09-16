import type { ICitation } from "@/interfaces";

export type AnswerSegment =
  | { type: "text"; text: string }
  | { type: "citation"; citation: ICitation };

// Matches "[1]" and grouped markers such as "[1, 3]".
const MARKER_PATTERN = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

const appendText = (segments: AnswerSegment[], text: string): AnswerSegment[] => {
  if (!text) return segments;
  const last = segments[segments.length - 1];
  if (last?.type === "text") {
    return [...segments.slice(0, -1), { type: "text", text: last.text + text }];
  }
  return [...segments, { type: "text", text }];
};

/**
 * Splits answer text into plain text and citation chips.
 * "foo [1] bar" -> [text "foo ", chip 1, text " bar"].
 * Markers without a matching citation are kept as literal text.
 */
export function splitCitationMarkers(text: string, citations: ICitation[]): AnswerSegment[] {
  const byIndex = new Map(citations.map((citation) => [citation.index, citation]));
  let segments: AnswerSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(MARKER_PATTERN)) {
    const start = match.index;
    const found = match[1]
      .split(",")
      .map((part) => byIndex.get(Number(part.trim())))
      .filter((citation): citation is ICitation => citation !== undefined);

    if (found.length === 0) continue; // unknown marker: leave it inside the text

    segments = appendText(segments, text.slice(cursor, start));
    segments = [...segments, ...found.map((citation) => ({ type: "citation" as const, citation }))];
    cursor = start + match[0].length;
  }

  return appendText(segments, text.slice(cursor));
}

/** Citations whose [n] marker actually appears in the text, in index order. */
export function getCitedCitations(text: string, citations: ICitation[]): ICitation[] {
  const used = new Set(
    splitCitationMarkers(text, citations).flatMap((segment) =>
      segment.type === "citation" ? [segment.citation.index] : [],
    ),
  );
  return citations.filter((citation) => used.has(citation.index)).sort((a, b) => a.index - b.index);
}
