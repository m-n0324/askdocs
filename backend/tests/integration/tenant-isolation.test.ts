import { beforeEach, describe, expect, it } from "vitest"
import { fakeEmbedding } from "../../src/llm/fake.provider"
import { searchSimilarChunks } from "../../src/repositories/chunk.repository"
import { answerQuestion } from "../../src/services/chat.service"
import { retrieve } from "../../src/services/retrieval.service"
import { createTenant, resetDatabase, seedSource } from "../helpers/db"

/**
 * The most important guarantee of a multi-tenant RAG system:
 * a question in workspace A can NEVER retrieve or cite workspace B's documents,
 * even when B's documents are a perfect match for the question.
 */
describe("tenant isolation in retrieval", () => {
    const secret = "The launch code for project Falcon is 7-4-2-9."

    beforeEach(resetDatabase)

    it("similarity search only returns chunks from the requested workspace", async () => {
        const alice = await createTenant("alice")
        const bob = await createTenant("bob")
        await seedSource(alice.workspace.id, "alice.pdf", [
            { content: "Alice's notes about gardening." },
        ])
        await seedSource(bob.workspace.id, "bob-secret.pdf", [{ content: secret }])

        const results = await searchSimilarChunks(alice.workspace.id, fakeEmbedding(secret), 20)

        expect(results.length).toBeGreaterThan(0)
        expect(results.every((chunk) => chunk.sourceName === "alice.pdf")).toBe(true)
        expect(results.some((chunk) => chunk.content.includes("Falcon"))).toBe(false)
    })

    it("retrieval with an exact-match question finds nothing in a workspace that lacks the data", async () => {
        const alice = await createTenant("alice")
        const bob = await createTenant("bob")
        await seedSource(bob.workspace.id, "bob-secret.pdf", [{ content: secret }])

        const forAlice = await retrieve(alice.workspace.id, secret)
        const forBob = await retrieve(bob.workspace.id, secret)

        expect(forAlice.chunks).toEqual([])
        expect(forBob.chunks[0].content).toBe(secret)
    })

    it("chat in one workspace never cites another workspace's sources", async () => {
        const alice = await createTenant("alice")
        const bob = await createTenant("bob")
        await seedSource(bob.workspace.id, "bob-secret.pdf", [{ content: secret }])

        const result = await answerQuestion({
            workspaceId: alice.workspace.id,
            userId: alice.user.id,
            message: "What is the launch code for project Falcon?",
        })

        expect(result.message.citations).toEqual([])
        expect(result.message.content).not.toContain("7-4-2-9")
    })

    it("still returns a full top-k for a small tenant next to a large one (HNSW iterative scan)", async () => {
        const small = await createTenant("small")
        const large = await createTenant("large")
        const topic = "quarterly revenue report numbers"
        await seedSource(
            large.workspace.id,
            "large.pdf",
            Array.from({ length: 300 }, (_, i) => ({ content: `${topic} variant ${i}` })),
        )
        await seedSource(
            small.workspace.id,
            "small.pdf",
            Array.from({ length: 5 }, (_, i) => ({ content: `${topic} small ${i}` })),
        )

        const results = await searchSimilarChunks(small.workspace.id, fakeEmbedding(topic), 5)

        expect(results).toHaveLength(5)
        expect(results.every((chunk) => chunk.sourceName === "small.pdf")).toBe(true)
    })
})
