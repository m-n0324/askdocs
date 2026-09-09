import pgvector from "pgvector"
import { Prisma } from "../generated/prisma/client"
import { prisma } from "../lib/prisma"
import type { ChunkMetadata, RetrievedChunk, SourceType } from "../types/domain"

/**
 * Prisma cannot read or write the `vector` column, so this file uses tagged-template raw SQL
 * (`$queryRaw` / `$executeRaw`). Every `${value}` becomes a bind parameter ($1, $2, ...),
 * never string concatenation, so these queries are safe from SQL injection.
 */

export interface NewChunk {
    chunkIndex: number
    content: string
    metadata: ChunkMetadata
    tokenCount: number
    embedding: number[]
}

const INSERT_BATCH_SIZE = 100

/**
 * Replace all chunks of a source in one transaction. Deleting first makes ingestion
 * idempotent: if a job is retried, we never end up with duplicate chunks.
 *
 * Returns false (and stores nothing) if the source no longer exists. `FOR SHARE` locks the
 * source row until we commit, so a user deleting it at the same moment simply waits for us,
 * and then the cascade removes these chunks too.
 */
export async function replaceChunksForSource(
    workspaceId: string,
    sourceId: string,
    chunks: NewChunk[],
): Promise<boolean> {
    return prisma.$transaction(
        async (tx) => {
            const source = await tx.$queryRaw<{ id: string }[]>`
                SELECT id FROM sources
                WHERE id = ${sourceId}::uuid AND workspace_id = ${workspaceId}::uuid
                FOR SHARE`
            if (source.length === 0) return false

            await tx.chunk.deleteMany({ where: { workspaceId, sourceId } })

            for (let start = 0; start < chunks.length; start += INSERT_BATCH_SIZE) {
                const rows = chunks.slice(start, start + INSERT_BATCH_SIZE).map(
                    (chunk) => Prisma.sql`(
                        gen_random_uuid(), ${workspaceId}::uuid, ${sourceId}::uuid,
                        ${chunk.chunkIndex}, ${chunk.content}, ${JSON.stringify(chunk.metadata)}::jsonb,
                        ${chunk.tokenCount}, ${pgvector.toSql(chunk.embedding)}::vector
                    )`,
                )
                await tx.$executeRaw`
                    INSERT INTO chunks
                        (id, workspace_id, source_id, chunk_index, content, metadata, token_count, embedding)
                    VALUES ${Prisma.join(rows)}
                `
            }
            return true
        },
        { timeout: 60_000 },
    )
}

interface SimilarChunkRow {
    id: string
    source_id: string
    source_name: string
    source_type: SourceType
    content: string
    metadata: ChunkMetadata
    embedding: string
    score: number
}

/**
 * Top-`limit` chunks of ONE workspace, closest to `queryEmbedding` by cosine distance.
 *
 * `<=>` is pgvector's cosine DISTANCE (0 = same direction, 2 = opposite),
 * so `1 - distance` gives cosine SIMILARITY, which is easier to reason about as a "score".
 *
 * Tenant isolation: `WHERE workspace_id = ...` is in the SQL itself. There is no code path
 * that searches across workspaces.
 *
 * Why the SET LOCAL lines: the HNSW index first finds the `ef_search` nearest vectors from ALL
 * tenants, and only then applies the WHERE filter. For a small workspace that could leave fewer
 * than `limit` rows. pgvector 0.8's iterative scan keeps searching until enough rows pass the
 * filter (strict_order keeps results sorted by exact distance).
 */
export async function searchSimilarChunks(
    workspaceId: string,
    queryEmbedding: number[],
    limit: number,
): Promise<RetrievedChunk[]> {
    const vector = pgvector.toSql(queryEmbedding)

    const rows = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('hnsw.iterative_scan', 'strict_order', true)`
        await tx.$queryRaw`SELECT set_config('hnsw.ef_search', ${String(Math.max(limit * 2, 40))}, true)`

        return tx.$queryRaw<SimilarChunkRow[]>`
            SELECT nearest.id, nearest.source_id, s.name AS source_name, s.type::text AS source_type,
                   nearest.content, nearest.metadata, nearest.embedding::text AS embedding,
                   nearest.score
            FROM (
                SELECT c.id, c.source_id, c.content, c.metadata, c.embedding,
                       1 - (c.embedding <=> ${vector}::vector) AS score
                FROM chunks c
                WHERE c.workspace_id = ${workspaceId}::uuid
                ORDER BY c.embedding <=> ${vector}::vector
                LIMIT ${limit}
            ) AS nearest
            JOIN sources s ON s.id = nearest.source_id
            ORDER BY nearest.score DESC
        `
    })

    return rows.map((row) => ({
        id: row.id,
        sourceId: row.source_id,
        sourceName: row.source_name,
        sourceType: row.source_type,
        content: row.content,
        metadata: row.metadata,
        score: Number(row.score),
        embedding: pgvector.fromSql(row.embedding) as number[],
    }))
}

export async function countChunksForSource(workspaceId: string, sourceId: string): Promise<number> {
    return prisma.chunk.count({ where: { workspaceId, sourceId } })
}
