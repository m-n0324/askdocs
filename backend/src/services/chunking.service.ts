import type { Document } from "@langchain/core/documents"
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { env } from "../config/env"
import { countTokens } from "../lib/tokens"
import type { ChunkMetadata } from "../types/domain"
import { cleanText } from "../utils/text"

/**
 * CHUNKING: splitting long documents into small pieces before embedding.
 *
 * Why not embed the whole document? An embedding is ONE vector summarising the text. A
 * 50-page PDF squeezed into one vector is a blurry average, and we couldn't fit it into
 * the prompt anyway. Small chunks give sharp vectors and let us send only relevant parts.
 *
 * RecursiveCharacterTextSplitter tries to cut at the most natural boundary first:
 * paragraphs ("\n\n"), then lines ("\n"), then words (" "), and only then characters.
 *
 * OVERLAP: consecutive chunks share ~150 characters, so a sentence cut at a boundary still
 * appears whole in at least one chunk.
 *
 * Sizes are in characters (1000 chars ≈ 250 tokens of English).
 */

export interface TextChunk {
    chunkIndex: number
    content: string
    metadata: ChunkMetadata
    tokenCount: number
}

export interface ChunkingOptions {
    chunkSize: number
    chunkOverlap: number
}

// Fragments shorter than this (a lone page number, a stray heading) carry no useful meaning
const MIN_CHUNK_CHARS = 20

export async function chunkDocuments(
    documents: Document<ChunkMetadata>[],
    options: ChunkingOptions = { chunkSize: env.CHUNK_SIZE, chunkOverlap: env.CHUNK_OVERLAP },
): Promise<TextChunk[]> {
    const splitter = new RecursiveCharacterTextSplitter(options)
    const chunks: TextChunk[] = []

    // Split each document (page / section / web page) separately, so a chunk never spans
    // two pages and its page number in the citation is always correct.
    for (const document of documents) {
        const pieces = await splitter.splitText(cleanText(document.pageContent))
        for (const piece of pieces) {
            const content = piece.trim()
            if (content.length < MIN_CHUNK_CHARS) continue
            chunks.push({
                chunkIndex: chunks.length,
                content,
                metadata: { ...document.metadata },
                tokenCount: countTokens(content),
            })
        }
    }
    return chunks
}
