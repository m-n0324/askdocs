/**
 * Shapes returned by the API. Repositories map snake_case DB rows into these camelCase objects.
 */

export interface User {
    id: string
    name: string
    email: string
    createdAt: string
}

export interface Workspace {
    id: string
    name: string
    createdAt: string
}

export type SourceType = "file" | "url"
export type SourceStatus = "pending" | "processing" | "ready" | "failed"

export interface CrawlOptions {
    maxDepth: number
    maxPages: number
}

export interface Source {
    id: string
    workspaceId: string
    type: SourceType
    name: string
    url: string | null
    mimeType: string | null
    sizeBytes: number | null
    status: SourceStatus
    error: string | null
    chunkCount: number
    createdAt: string
    updatedAt: string
}

/** Internal-only fields of a source that the API never exposes. */
export interface SourceRecord extends Source {
    storageKey: string | null
    crawlOptions: CrawlOptions | null
}

/** Where a chunk came from inside its source. Stored as JSONB on the chunk row. */
export interface ChunkMetadata {
    page?: number
    section?: string
    url?: string
    title?: string
}

/** A chunk returned by similarity search. */
export interface RetrievedChunk {
    id: string
    sourceId: string
    sourceName: string
    sourceType: SourceType
    content: string
    metadata: ChunkMetadata
    score: number // cosine similarity, 1 = identical direction, 0 = unrelated
    embedding: number[]
}

export interface Citation {
    index: number // the [n] marker used in the answer text
    chunkId: string
    sourceId: string
    sourceName: string
    sourceType: SourceType
    page: number | null
    section: string | null
    url: string | null
    snippet: string
    score: number
}

export type MessageRole = "user" | "assistant"

export interface Message {
    id: string
    role: MessageRole
    content: string
    citations: Citation[]
    createdAt: string
}

export interface Conversation {
    id: string
    title: string
    createdAt: string
    updatedAt: string
}

export type UsageKind = "chat" | "embedding" | "rewrite"
