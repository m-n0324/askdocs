import { Document } from "@langchain/core/documents"
import * as cheerio from "cheerio"
import mammoth from "mammoth"
import type { ChunkMetadata } from "../types/domain"

const HEADINGS = new Set(["h1", "h2", "h3"])

/**
 * Word files have no fixed "pages": page breaks depend on fonts, printer, and screen size.
 * So we cite by SECTION instead: we convert to HTML and start a new Document at every heading.
 */
export async function loadDocx(buffer: Buffer): Promise<Document<ChunkMetadata>[]> {
    const { value: html } = await mammoth.convertToHtml({ buffer })
    const $ = cheerio.load(html)

    const sections: { heading?: string; lines: string[] }[] = [{ lines: [] }]
    $("body")
        .children()
        .each((_, element) => {
            const text = $(element).text().trim()
            if (!text) return
            if (HEADINGS.has(element.tagName.toLowerCase())) {
                sections.push({ heading: text, lines: [] })
            } else {
                sections[sections.length - 1].lines.push(text)
            }
        })

    return sections
        .filter((section) => section.lines.length > 0)
        .map(
            (section) =>
                new Document({
                    // Keep the heading in the text: it carries meaning for retrieval
                    pageContent: [section.heading, ...section.lines].filter(Boolean).join("\n\n"),
                    metadata: section.heading ? { section: section.heading } : {},
                }),
        )
}
