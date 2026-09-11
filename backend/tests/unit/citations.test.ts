import { describe, expect, it } from "vitest"
import type { RetrievedChunk } from "../../src/types/domain"
import { extractCitedIndexes, selectCitedCitations, toCitations } from "../../src/utils/citations"

const chunk = (overrides: Partial<RetrievedChunk>): RetrievedChunk => ({
    id: "chunk-id",
    sourceId: "source-id",
    sourceName: "handbook.pdf",
    sourceType: "file",
    content: "Employees get 24 days of vacation.",
    metadata: { page: 3 },
    score: 0.81234,
    embedding: [],
    ...overrides,
})

describe("extractCitedIndexes", () => {
    it("finds single and grouped markers", () => {
        expect(extractCitedIndexes("A [1]. B [2, 4]. C [1].")).toEqual(new Set([1, 2, 4]))
    })

    it("ignores text without markers", () => {
        expect(extractCitedIndexes("No sources here (see page 3).")).toEqual(new Set())
    })
})

describe("toCitations", () => {
    it("numbers citations from 1 and maps page, section, and url", () => {
        const citations = toCitations([
            chunk({ metadata: { page: 3 } }),
            chunk({ sourceType: "url", metadata: { url: "https://x.dev/a", title: "Pricing" } }),
        ])

        expect(citations[0]).toMatchObject({
            index: 1,
            page: 3,
            section: null,
            url: null,
            score: 0.812,
        })
        expect(citations[1]).toMatchObject({
            index: 2,
            page: null,
            section: "Pricing",
            url: "https://x.dev/a",
        })
    })

    it("truncates long snippets", () => {
        const [citation] = toCitations([chunk({ content: "x".repeat(1000) })])
        expect(citation.snippet.length).toBeLessThanOrEqual(301)
        expect(citation.snippet.endsWith("…")).toBe(true)
    })
})

describe("selectCitedCitations", () => {
    it("keeps only the sources the answer actually cites", () => {
        const candidates = toCitations([chunk({ id: "a" }), chunk({ id: "b" }), chunk({ id: "c" })])

        const selected = selectCitedCitations("Vacation is 24 days [3].", candidates)

        expect(selected.map((citation) => citation.chunkId)).toEqual(["c"])
    })

    it("ignores markers that point to non-existent sources", () => {
        const candidates = toCitations([chunk({})])
        expect(selectCitedCitations("Made up [7].", candidates)).toEqual([])
    })
})
