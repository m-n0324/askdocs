import { Document } from "@langchain/core/documents"
import { describe, expect, it } from "vitest"
import { chunkDocuments } from "../../src/services/chunking.service"
import type { ChunkMetadata } from "../../src/types/domain"

const sentence = (i: number) => `Sentence number ${i} talks about topic ${i % 7}.`
const longText = Array.from({ length: 60 }, (_, i) => sentence(i)).join(" ")

describe("chunkDocuments", () => {
    it("splits long text into chunks no larger than chunkSize", async () => {
        const chunks = await chunkDocuments(
            [new Document({ pageContent: longText, metadata: {} })],
            {
                chunkSize: 300,
                chunkOverlap: 50,
            },
        )

        expect(chunks.length).toBeGreaterThan(5)
        for (const chunk of chunks) expect(chunk.content.length).toBeLessThanOrEqual(300)
    })

    it("overlaps consecutive chunks so no sentence is lost at a boundary", async () => {
        const chunks = await chunkDocuments(
            [new Document({ pageContent: longText, metadata: {} })],
            {
                chunkSize: 300,
                chunkOverlap: 80,
            },
        )

        for (let i = 1; i < chunks.length; i++) {
            const previousTail = chunks[i - 1].content.slice(-40)
            const firstWords = chunks[i].content.slice(0, 20)
            expect(chunks[i - 1].content).toContain(firstWords)
            expect(previousTail.length).toBeGreaterThan(0)
        }
        // Every original sentence survives in at least one chunk
        for (let i = 0; i < 60; i++) {
            expect(chunks.some((chunk) => chunk.content.includes(sentence(i)))).toBe(true)
        }
    })

    it("keeps page metadata and never mixes two pages in one chunk", async () => {
        const pages = [
            new Document<ChunkMetadata>({
                pageContent: "Alpha ".repeat(80),
                metadata: { page: 1 },
            }),
            new Document<ChunkMetadata>({ pageContent: "Beta ".repeat(80), metadata: { page: 2 } }),
        ]

        const chunks = await chunkDocuments(pages, { chunkSize: 200, chunkOverlap: 20 })

        for (const chunk of chunks) {
            if (chunk.metadata.page === 1) expect(chunk.content).not.toContain("Beta")
            if (chunk.metadata.page === 2) expect(chunk.content).not.toContain("Alpha")
        }
        expect(new Set(chunks.map((chunk) => chunk.metadata.page))).toEqual(new Set([1, 2]))
    })

    it("numbers chunks sequentially across documents and counts tokens", async () => {
        const docs = [
            new Document({
                pageContent: "First page with enough text to keep.",
                metadata: { page: 1 },
            }),
            new Document({
                pageContent: "Second page with enough text to keep.",
                metadata: { page: 2 },
            }),
        ]

        const chunks = await chunkDocuments(docs, { chunkSize: 500, chunkOverlap: 0 })

        expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual([0, 1])
        expect(chunks[0].tokenCount).toBeGreaterThan(0)
    })

    it("drops empty pages and tiny fragments", async () => {
        const docs = [
            new Document({ pageContent: "   \n\n  ", metadata: { page: 1 } }),
            new Document({ pageContent: "12", metadata: { page: 2 } }),
        ]

        expect(await chunkDocuments(docs, { chunkSize: 500, chunkOverlap: 0 })).toEqual([])
    })
})
