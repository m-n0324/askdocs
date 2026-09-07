import type { Source as SourceRow } from "../generated/prisma/client"
import { prisma } from "../lib/prisma"
import type { CrawlOptions, Source, SourceRecord, SourceStatus } from "../types/domain"

// Matches MAX_SOURCES_PER_WORKSPACE's default; a safety cap so one query can't return everything
const MAX_LISTED_SOURCES = 500

const toRecord = (row: SourceRow): SourceRecord => ({
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type,
    name: row.name,
    url: row.url,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    status: row.status,
    error: row.error,
    chunkCount: row.chunkCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    storageKey: row.storageKey,
    crawlOptions: row.crawlOptions as CrawlOptions | null,
})

/** Strip internal fields before sending a source to the client. */
export function toPublicSource(record: SourceRecord): Source {
    const { storageKey: _storageKey, crawlOptions: _crawlOptions, ...source } = record
    return source
}

export async function createFileSource(input: {
    workspaceId: string
    name: string
    storageKey: string
    mimeType: string
    sizeBytes: number
}): Promise<SourceRecord> {
    return toRecord(await prisma.source.create({ data: { ...input, type: "file" } }))
}

export async function createUrlSource(input: {
    workspaceId: string
    name: string
    url: string
    crawlOptions: CrawlOptions
}): Promise<SourceRecord> {
    const row = await prisma.source.create({
        data: { ...input, crawlOptions: { ...input.crawlOptions }, type: "url" },
    })
    return toRecord(row)
}

export async function listSources(workspaceId: string): Promise<SourceRecord[]> {
    const rows = await prisma.source.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: MAX_LISTED_SOURCES,
    })
    return rows.map(toRecord)
}

export async function countSources(workspaceId: string): Promise<number> {
    return prisma.source.count({ where: { workspaceId } })
}

export async function findSource(
    workspaceId: string,
    sourceId: string,
): Promise<SourceRecord | null> {
    const row = await prisma.source.findFirst({ where: { id: sourceId, workspaceId } })
    return row ? toRecord(row) : null
}

export async function updateSourceStatus(
    workspaceId: string,
    sourceId: string,
    update: { status: SourceStatus; error?: string | null; chunkCount?: number },
): Promise<void> {
    await prisma.source.updateMany({
        where: { id: sourceId, workspaceId },
        data: { status: update.status, error: update.error ?? null, chunkCount: update.chunkCount },
    })
}

/** Chunks are removed by ON DELETE CASCADE. Returns the deleted row so the caller can clean up files. */
export async function deleteSource(
    workspaceId: string,
    sourceId: string,
): Promise<SourceRecord | null> {
    const existing = await findSource(workspaceId, sourceId)
    if (!existing) return null
    // deleteMany (not delete) so two concurrent deletes give one 200 and one 404, never a crash
    const { count } = await prisma.source.deleteMany({ where: { id: sourceId, workspaceId } })
    return count > 0 ? existing : null
}
