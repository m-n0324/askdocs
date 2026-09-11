import type { Citation, RetrievedChunk } from "../types/domain"

const SNIPPET_LENGTH = 300

/** Source [n] in the prompt is chunks[n - 1], so citation indexes start at 1. */
export function toCitations(chunks: RetrievedChunk[]): Citation[] {
    return chunks.map((chunk, i) => ({
        index: i + 1,
        chunkId: chunk.id,
        sourceId: chunk.sourceId,
        sourceName: chunk.sourceName,
        sourceType: chunk.sourceType,
        page: chunk.metadata.page ?? null,
        section: chunk.metadata.section ?? chunk.metadata.title ?? null,
        url: chunk.metadata.url ?? null,
        snippet:
            chunk.content.length > SNIPPET_LENGTH
                ? `${chunk.content.slice(0, SNIPPET_LENGTH).trimEnd()}…`
                : chunk.content,
        score: Math.round(chunk.score * 1000) / 1000,
    }))
}

/** Finds every [n] (and [n, m]) marker in an answer. */
export function extractCitedIndexes(answer: string): Set<number> {
    const indexes = new Set<number>()
    for (const match of answer.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) {
        for (const part of match[1].split(",")) indexes.add(Number(part.trim()))
    }
    return indexes
}

/**
 * We send the model ~5 sources but it usually uses only some of them.
 * The UI should show only the ones the answer actually cites.
 */
export function selectCitedCitations(answer: string, candidates: Citation[]): Citation[] {
    const cited = extractCitedIndexes(answer)
    return candidates.filter((citation) => cited.has(citation.index))
}
