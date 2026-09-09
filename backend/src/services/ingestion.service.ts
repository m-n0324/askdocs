import type { Document } from "@langchain/core/documents"
import { env } from "../config/env"
import { PermanentJobError } from "../lib/errors"
import { logger } from "../lib/logger"
import { getLlmProvider } from "../llm"
import { loadDocx } from "../loaders/docx.loader"
import { loadPdf } from "../loaders/pdf.loader"
import { loadMarkdown, loadText } from "../loaders/text.loader"
import { replaceChunksForSource } from "../repositories/chunk.repository"
import { findSource, updateSourceStatus } from "../repositories/source.repository"
import type { ChunkMetadata, SourceRecord } from "../types/domain"
import { chunkDocuments } from "./chunking.service"
import { crawlWebsite } from "./crawler.service"
import { DOCX_MIME, MARKDOWN_MIME, PDF_MIME, TEXT_MIME } from "./file-types"
import { readStoredFile } from "./storage.service"
import { assertWithinQuota, trackUsage } from "./usage.service"

/**
 * The ingestion pipeline, run by the background worker for one source:
 *
 *   load (PDF pages / DOCX sections / crawled web pages)
 *     -> clean -> chunk -> embed -> store chunks + vectors in pgvector -> status "ready"
 */

async function loadFileDocuments(source: SourceRecord): Promise<Document<ChunkMetadata>[]> {
    if (!source.storageKey) throw new PermanentJobError("File is missing from storage")
    const buffer = await readStoredFile(source.storageKey)
    try {
        if (source.mimeType === MARKDOWN_MIME) return loadMarkdown(buffer)
        if (source.mimeType === TEXT_MIME) return loadText(buffer)
        if (source.mimeType === PDF_MIME) return await loadPdf(buffer)
        if (source.mimeType === DOCX_MIME) return await loadDocx(buffer)
    } catch (err) {
        // A corrupt file will be just as corrupt on the next attempt. Parser details go to the log only.
        logger.warn({ err, sourceId: source.id }, "File could not be parsed")
        throw new PermanentJobError(
            "Could not read the file. It may be corrupt or password-protected.",
        )
    }
    throw new PermanentJobError(`Unsupported file type: ${source.mimeType}`)
}

async function loadDocuments(source: SourceRecord): Promise<Document<ChunkMetadata>[]> {
    if (source.type === "file") return loadFileDocuments(source)
    if (!source.url) throw new PermanentJobError("Source has no URL")
    return crawlWebsite(
        source.url,
        source.crawlOptions ?? { maxDepth: 0, maxPages: env.CRAWL_MAX_PAGES },
    )
}

function noTextMessage(source: SourceRecord): string {
    if (source.type === "url") return "No readable text was found on the website."
    if (source.mimeType === PDF_MIME) {
        return "No text could be extracted. Scanned (image-only) PDFs are not supported."
    }
    return "The file contains no text."
}

export async function ingestSource(job: { workspaceId: string; sourceId: string }): Promise<void> {
    const { workspaceId, sourceId } = job
    const source = await findSource(workspaceId, sourceId)
    if (!source) {
        logger.info({ sourceId }, "Source was deleted before ingestion, skipping")
        return
    }

    const startedAt = Date.now()
    await updateSourceStatus(workspaceId, sourceId, { status: "processing" })

    const documents = await loadDocuments(source)
    const chunks = await chunkDocuments(documents)
    if (chunks.length === 0) {
        throw new PermanentJobError(noTextMessage(source))
    }

    if (chunks.length > env.MAX_CHUNKS_PER_SOURCE) {
        throw new PermanentJobError(
            `This source is too large (${chunks.length} passages, the limit is ${env.MAX_CHUNKS_PER_SOURCE}). Split it into smaller files.`,
        )
    }

    // Embedding is the expensive step: re-check before paying for it.
    // The source may have been deleted while we were parsing, or the quota used up meanwhile.
    if (!(await findSource(workspaceId, sourceId))) return
    await assertWithinQuota(workspaceId)

    const provider = getLlmProvider()
    const { vectors, usage } = await provider.embed(
        chunks.map((chunk) => chunk.content),
        "document",
    )
    await trackUsage({
        workspaceId,
        userId: null,
        kind: "embedding",
        model: provider.embeddingModel,
        usage,
    })

    const stored = await replaceChunksForSource(
        workspaceId,
        sourceId,
        chunks.map((chunk, i) => ({ ...chunk, embedding: vectors[i] })),
    )
    if (!stored) {
        logger.info({ sourceId }, "Source was deleted during ingestion, discarding chunks")
        return
    }
    await updateSourceStatus(workspaceId, sourceId, { status: "ready", chunkCount: chunks.length })

    logger.info(
        {
            sourceId,
            documents: documents.length,
            chunks: chunks.length,
            tokens: usage.totalTokens,
            ms: Date.now() - startedAt,
        },
        "Source ingested",
    )
}
