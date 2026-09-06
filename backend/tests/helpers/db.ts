import { prisma } from "../../src/lib/prisma"
import { fakeEmbedding } from "../../src/llm/fake.provider"
import { replaceChunksForSource } from "../../src/repositories/chunk.repository"
import { createFileSource } from "../../src/repositories/source.repository"
import { signup } from "../../src/services/auth.service"
import { addWorkspace } from "../../src/services/workspace.service"
import type { ChunkMetadata } from "../../src/types/domain"

/** Wipes every table between tests. CASCADE follows the foreign keys. */
export async function resetDatabase(): Promise<void> {
    await prisma.$executeRawUnsafe(
        "TRUNCATE users, workspaces, sources, chunks, conversations, messages, usage_events CASCADE",
    )
}

let counter = 0

/** A fresh user with one workspace, plus a token for API calls. */
export async function createTenant(name = "tenant") {
    counter += 1
    const { token, user } = await signup({
        name,
        email: `${name}-${counter}-${Date.now()}@test.dev`,
        password: "password123",
    })
    const workspace = await addWorkspace(user.id, `${name} workspace`)
    return { token, user, workspace }
}

/** Inserts a "ready" source with the given chunks, embedded with the fake provider. */
export async function seedSource(
    workspaceId: string,
    name: string,
    chunks: { content: string; metadata?: ChunkMetadata }[],
) {
    const source = await createFileSource({
        workspaceId,
        name,
        storageKey: `${workspaceId}/${name}`,
        mimeType: "application/pdf",
        sizeBytes: 100,
    })
    await replaceChunksForSource(
        workspaceId,
        source.id,
        chunks.map((chunk, i) => ({
            chunkIndex: i,
            content: chunk.content,
            metadata: chunk.metadata ?? { page: i + 1 },
            tokenCount: 10,
            embedding: fakeEmbedding(chunk.content),
        })),
    )
    await prisma.source.update({
        where: { id: source.id },
        data: { status: "ready", chunkCount: chunks.length },
    })
    return source
}
