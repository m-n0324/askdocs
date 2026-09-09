import { cosineSimilarity } from "@langchain/core/utils/math"
import { describe, expect, it } from "vitest"
import { FakeProvider, fakeEmbedding } from "../../src/llm/fake.provider"

describe("FakeProvider", () => {
    it("produces normalised 1536-dim vectors where shared words mean higher similarity", () => {
        const question = fakeEmbedding("vacation days policy")
        const related = fakeEmbedding("Employees get 24 vacation days per year")
        const unrelated = fakeEmbedding("The server uses Redis for queues")

        expect(question).toHaveLength(1536)
        const [[toRelated, toUnrelated]] = cosineSimilarity([question], [related, unrelated])
        expect(toRelated).toBeGreaterThan(toUnrelated)
    })

    it("streams the same text it returns", async () => {
        const provider = new FakeProvider()
        const deltas: string[] = []

        const result = await provider.streamChat(
            [
                {
                    role: "user",
                    content:
                        '<source id="1" title="t" location="page 1">\nFact one. Fact two.\n</source>',
                },
            ],
            { onToken: (delta) => deltas.push(delta) },
        )

        expect(deltas.join("")).toBe(result.text)
        expect(result.text).toContain("[1]")
    })
})
