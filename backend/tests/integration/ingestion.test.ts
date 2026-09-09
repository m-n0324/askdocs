import { beforeEach, describe, expect, it } from "vitest"
import { env } from "../../src/config/env"
import { fakeEmbedding } from "../../src/llm/fake.provider"
import { replaceChunksForSource } from "../../src/repositories/chunk.repository"
import { PermanentJobError } from "../../src/lib/errors"
import { prisma } from "../../src/lib/prisma"
import { createFileSource, findSource } from "../../src/repositories/source.repository"
import { ingestSource } from "../../src/services/ingestion.service"
import { saveFile } from "../../src/services/storage.service"
import { createTenant, resetDatabase } from "../helpers/db"
import { buildPdf } from "../helpers/pdf"

async function storePdf(workspaceId: string, data: Buffer) {
    const storageKey = `${workspaceId}/test-${Date.now()}.pdf`
    await saveFile(storageKey, data)
    return createFileSource({
        workspaceId,
        name: "handbook.pdf",
        storageKey,
        mimeType: "application/pdf",
        sizeBytes: data.length,
    })
}

describe("ingestion pipeline (parse -> chunk -> embed -> store)", () => {
    beforeEach(resetDatabase)

    it("turns a PDF into page-tagged chunks with embeddings and marks the source ready", async () => {
        const { workspace } = await createTenant()
        const pdf = buildPdf([
            ["Vacation policy", "Employees receive 24 days of paid vacation per year."],
            ["Remote work", "Employees may work remotely three days per week."],
        ])
        const source = await storePdf(workspace.id, pdf)

        await ingestSource({ workspaceId: workspace.id, sourceId: source.id })

        const updated = await findSource(workspace.id, source.id)
        expect(updated).toMatchObject({ status: "ready", chunkCount: 2, error: null })

        const rows = await prisma.$queryRaw<{ content: string; page: number; dims: number }[]>`
            SELECT content, (metadata->>'page')::int AS page, vector_dims(embedding) AS dims
            FROM chunks WHERE source_id = ${source.id}::uuid ORDER BY chunk_index`
        expect(rows.map((row) => row.page)).toEqual([1, 2])
        expect(rows[0].content).toContain("24 days of paid vacation")
        expect(rows[0].dims).toBe(1536)

        const usage = await prisma.usageEvent.findMany({ where: { workspaceId: workspace.id } })
        expect(usage.map((event) => event.kind)).toEqual(["embedding"])
    })

    it("turns a Markdown file into chunks tagged with their section heading", async () => {
        const { workspace } = await createTenant()
        const markdown = Buffer.from(
            "# Vacation\nEmployees receive 24 days of paid vacation.\n\n# Remote work\nUp to three remote days per week.",
        )
        const storageKey = `${workspace.id}/test-${Date.now()}.md`
        await saveFile(storageKey, markdown)
        const source = await createFileSource({
            workspaceId: workspace.id,
            name: "handbook.md",
            storageKey,
            mimeType: "text/markdown",
            sizeBytes: markdown.length,
        })

        await ingestSource({ workspaceId: workspace.id, sourceId: source.id })

        const rows = await prisma.$queryRaw<{ section: string }[]>`
            SELECT metadata->>'section' AS section FROM chunks
            WHERE source_id = ${source.id}::uuid ORDER BY chunk_index`
        expect(rows.map((row) => row.section)).toEqual(["Vacation", "Remote work"])
        expect(await findSource(workspace.id, source.id)).toMatchObject({
            status: "ready",
            chunkCount: 2,
        })
    })

    it("is idempotent: running the same job twice does not duplicate chunks", async () => {
        const { workspace } = await createTenant()
        const source = await storePdf(
            workspace.id,
            buildPdf([["Only page with some useful text."]]),
        )

        await ingestSource({ workspaceId: workspace.id, sourceId: source.id })
        await ingestSource({ workspaceId: workspace.id, sourceId: source.id })

        expect(await prisma.chunk.count({ where: { sourceId: source.id } })).toBe(1)
    })

    it("fails permanently (no retries) for a PDF with no extractable text", async () => {
        const { workspace } = await createTenant()
        const source = await storePdf(workspace.id, buildPdf([[]]))

        await expect(
            ingestSource({ workspaceId: workspace.id, sourceId: source.id }),
        ).rejects.toBeInstanceOf(PermanentJobError)
    })

    it("fails permanently for a corrupt PDF", async () => {
        const { workspace } = await createTenant()
        const source = await storePdf(
            workspace.id,
            Buffer.from("%PDF-1.4 this is not really a pdf"),
        )

        await expect(
            ingestSource({ workspaceId: workspace.id, sourceId: source.id }),
        ).rejects.toBeInstanceOf(PermanentJobError)
    })

    it("stores nothing if the source is deleted while chunks are being written", async () => {
        const { workspace } = await createTenant()
        const source = await storePdf(workspace.id, buildPdf([["Some text worth keeping."]]))
        await prisma.source.delete({ where: { id: source.id } })

        const stored = await replaceChunksForSource(workspace.id, source.id, [
            {
                chunkIndex: 0,
                content: "x",
                metadata: {},
                tokenCount: 1,
                embedding: fakeEmbedding("x"),
            },
        ])

        expect(stored).toBe(false)
        expect(await prisma.chunk.count()).toBe(0)
    })

    it("rejects a source that splits into too many passages", async () => {
        const { workspace } = await createTenant()
        const longPage = Array.from(
            { length: 40 },
            (_, i) => `Line ${i} with some repeated filler text.`,
        )
        const source = await storePdf(workspace.id, buildPdf([longPage, longPage, longPage]))
        const mutableEnv = env as { MAX_CHUNKS_PER_SOURCE: number }
        const original = mutableEnv.MAX_CHUNKS_PER_SOURCE
        mutableEnv.MAX_CHUNKS_PER_SOURCE = 1
        try {
            await expect(
                ingestSource({ workspaceId: workspace.id, sourceId: source.id }),
            ).rejects.toThrow(/too large/)
            expect(await prisma.chunk.count()).toBe(0) // rejected before paying for embeddings
        } finally {
            mutableEnv.MAX_CHUNKS_PER_SOURCE = original
        }
    })

    it("does nothing if the source was deleted before the job ran", async () => {
        const { workspace } = await createTenant()

        await expect(
            ingestSource({
                workspaceId: workspace.id,
                sourceId: "00000000-0000-4000-8000-000000000000",
            }),
        ).resolves.toBeUndefined()
    })
})
