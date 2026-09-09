import { Document } from "@langchain/core/documents"
import type { ChunkMetadata } from "../types/domain"

/** Upload validation guarantees UTF-8; we only drop the optional byte-order mark editors add. */
const decode = (buffer: Buffer) => buffer.toString("utf8").replace(/^\uFEFF/, "")

/** Plain text has no pages or headings, so the whole file is one document (cited by file name). */
export function loadText(buffer: Buffer): Document<ChunkMetadata>[] {
    const text = decode(buffer)
    return text.trim() ? [new Document({ pageContent: text, metadata: {} })] : []
}

// "# Title", "## Title" or "### Title", optionally closed with trailing #s ("## Title ##")
const HEADING = /^(#{1,3})\s+(.+?)\s*#*\s*$/
const CODE_FENCE = /^\s*(```|~~~)/

/**
 * Markdown is split into one document per #, ## or ### section, like Word files, so a citation
 * can say: section "Refund Policy". Smaller headings (####) stay inside their section.
 * Lines inside ``` code blocks are never headings: in a shell snippet, "# install" is a comment.
 */
export function loadMarkdown(buffer: Buffer): Document<ChunkMetadata>[] {
    const sections: { heading?: string; lines: string[] }[] = [{ lines: [] }]
    let isInCodeBlock = false

    for (const line of decode(buffer).split(/\r?\n/)) {
        if (CODE_FENCE.test(line)) isInCodeBlock = !isInCodeBlock
        const heading = isInCodeBlock ? null : line.match(HEADING)
        if (heading) sections.push({ heading: heading[2], lines: [] })
        sections[sections.length - 1].lines.push(line)
    }

    // A section is worth keeping only if it has text besides its heading line
    const hasBody = (section: { heading?: string; lines: string[] }) =>
        (section.heading ? section.lines.slice(1) : section.lines).some((line) => line.trim())

    return sections.filter(hasBody).map(
        (section) =>
            new Document({
                // The heading line stays in the text: it carries meaning for retrieval
                pageContent: section.lines.join("\n").trim(),
                metadata: section.heading ? { section: section.heading } : {},
            }),
    )
}
