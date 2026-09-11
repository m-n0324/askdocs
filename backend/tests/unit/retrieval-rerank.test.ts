import { describe, expect, it } from "vitest"
import { rerankWithMmr } from "../../src/services/retrieval.service"
import type { RetrievedChunk } from "../../src/types/domain"

const chunk = (id: string, embedding: number[], score = 0.9): RetrievedChunk => ({
    id,
    sourceId: "s",
    sourceName: "doc",
    sourceType: "file",
    content: id,
    metadata: {},
    score,
    embedding,
})

describe("rerankWithMmr", () => {
    const query = [1, 0, 0]

    it("prefers a different chunk over a near-duplicate of one already picked", () => {
        const candidates = [
            chunk("best", [0.96, 0.28, 0]),
            chunk("duplicate-of-best", [0.95, 0.31, 0.01]),
            chunk("different-angle", [0.8, 0, 0.6]),
        ]

        const picked = rerankWithMmr(query, candidates, 2, 0.5)

        expect(picked.map((c) => c.id)).toEqual(["best", "different-angle"])
    })

    it("with lambda = 1 behaves like plain similarity ranking", () => {
        const candidates = [
            chunk("a", [0.9, 0.1, 0]),
            chunk("b", [0.9, 0.11, 0]),
            chunk("c", [0.5, 0.5, 0.5]),
        ]

        const picked = rerankWithMmr(query, candidates, 2, 1)

        expect(picked.map((c) => c.id)).toEqual(["a", "b"])
    })

    it("never returns more than topK or more than it was given", () => {
        expect(rerankWithMmr(query, [chunk("only", [1, 0, 0])], 5, 0.7)).toHaveLength(1)
        expect(rerankWithMmr(query, [], 5, 0.7)).toEqual([])
    })
})
