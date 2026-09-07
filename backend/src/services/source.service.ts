import { randomUUID } from "node:crypto"
import path from "node:path"
import { env } from "../config/env"
import { AppError, notFound } from "../lib/errors"
import { logger } from "../lib/logger"
import { enqueueIngestion, removeIngestionJob } from "../queues/ingestion.queue"
import {
    countSources,
    createFileSource,
    createUrlSource,
    deleteSource,
    findSource,
    listSources,
    toPublicSource,
    updateSourceStatus,
} from "../repositories/source.repository"
import type { CrawlOptions, Source, SourceRecord } from "../types/domain"
import { stripControlChars } from "../utils/text"
import { assertPublicUrl } from "../utils/url-safety"
import { findAllowedType } from "./file-types"
import { deleteStoredFile, readStoredFile, saveFile } from "./storage.service"
import { assertWithinQuota } from "./usage.service"

export interface UploadedFile {
    originalName: string
    mimeType: string
    buffer: Buffer
}

const MAX_NAME_LENGTH = 200

/** Display name only (we never use it as a path): strip folders and control characters. */
const toDisplayName = (fileName: string) =>
    stripControlChars(path.basename(fileName))
        .replace(/[\t\r\n]/g, " ")
        .slice(0, MAX_NAME_LENGTH) || "untitled"

/** Checks shared by file and URL sources, run before we store anything. */
async function assertCanAddSource(workspaceId: string): Promise<void> {
    if ((await countSources(workspaceId)) >= env.MAX_SOURCES_PER_WORKSPACE) {
        throw new AppError(
            409,
            "LIMIT_REACHED",
            `A workspace can have at most ${env.MAX_SOURCES_PER_WORKSPACE} sources.`,
        )
    }
    await assertWithinQuota(workspaceId)
}

/** Queue the job; if Redis is down, mark the source failed instead of leaving it "pending" forever. */
async function queueOrFail(source: SourceRecord): Promise<void> {
    try {
        await enqueueIngestion({ workspaceId: source.workspaceId, sourceId: source.id })
    } catch (err) {
        await updateSourceStatus(source.workspaceId, source.id, {
            status: "failed",
            error: "Could not queue the source for processing. Please try again.",
        })
        throw err
    }
}

export async function addFileSource(workspaceId: string, file: UploadedFile): Promise<Source> {
    const type = findAllowedType(file.originalName, file.mimeType)
    if (!type || !type.isValidContent(file.buffer)) {
        throw new AppError(
            415,
            "UNSUPPORTED_MEDIA_TYPE",
            "Only Markdown, plain-text (UTF-8), PDF and DOCX files are allowed",
        )
    }
    await assertCanAddSource(workspaceId)

    // Our own random file name: user input never becomes part of a path on disk
    const storageKey = `${workspaceId}/${randomUUID()}${type.extensions[0]}`
    await saveFile(storageKey, file.buffer)

    const source = await createFileSource({
        workspaceId,
        name: toDisplayName(file.originalName),
        storageKey,
        mimeType: type.mimeType,
        sizeBytes: file.buffer.length,
    })
    await queueOrFail(source)
    return toPublicSource(source)
}

export async function addUrlSource(
    workspaceId: string,
    input: { url: string; maxDepth?: number; maxPages?: number },
): Promise<Source> {
    // Checked again by the crawler for every page; this gives the user instant feedback
    const url = await assertPublicUrl(input.url)
    await assertCanAddSource(workspaceId)

    const crawlOptions: CrawlOptions = {
        maxDepth: Math.min(input.maxDepth ?? 1, env.CRAWL_MAX_DEPTH),
        maxPages: Math.min(input.maxPages ?? 10, env.CRAWL_MAX_PAGES),
    }
    const source = await createUrlSource({
        workspaceId,
        name: `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`.slice(
            0,
            MAX_NAME_LENGTH,
        ),
        url: url.toString(),
        crawlOptions,
    })
    await queueOrFail(source)
    return toPublicSource(source)
}

export async function getSources(workspaceId: string): Promise<Source[]> {
    return (await listSources(workspaceId)).map(toPublicSource)
}

export async function getSource(workspaceId: string, sourceId: string): Promise<Source> {
    const source = await findSource(workspaceId, sourceId)
    if (!source) throw notFound("Source")
    return toPublicSource(source)
}

export async function getSourceFile(
    workspaceId: string,
    sourceId: string,
): Promise<{ name: string; mimeType: string; data: Buffer }> {
    const source = await findSource(workspaceId, sourceId)
    if (!source?.storageKey || !source.mimeType) throw notFound("File")
    return {
        name: source.name,
        mimeType: source.mimeType,
        data: await readStoredFile(source.storageKey),
    }
}

/** Deletes the source row (its chunks + embeddings cascade), the queued job, and the stored file. */
export async function removeSource(workspaceId: string, sourceId: string): Promise<void> {
    const deleted = await deleteSource(workspaceId, sourceId)
    if (!deleted) throw notFound("Source")

    const cleanups = await Promise.allSettled([
        removeIngestionJob(sourceId),
        deleted.storageKey ? deleteStoredFile(deleted.storageKey) : Promise.resolve(),
    ])
    for (const result of cleanups) {
        if (result.status === "rejected") {
            logger.error({ err: result.reason, sourceId }, "Cleanup after source delete failed")
        }
    }
}
