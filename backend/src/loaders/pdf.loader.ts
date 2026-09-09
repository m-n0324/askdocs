import { Document } from "@langchain/core/documents"
import { PDFParse } from "pdf-parse"
import type { ChunkMetadata } from "../types/domain"

/**
 * One Document per PDF page, so every chunk knows its page number and citations can say "page 4".
 * Scanned PDFs (images only) produce no text. We would need OCR for those.
 */
export async function loadPdf(buffer: Buffer): Promise<Document<ChunkMetadata>[]> {
    const parser = new PDFParse({ data: new Uint8Array(buffer) })
    try {
        const result = await parser.getText()
        return result.pages
            .filter((page) => page.text.trim().length > 0)
            .map((page) => new Document({ pageContent: page.text, metadata: { page: page.num } }))
    } finally {
        await parser.destroy()
    }
}
