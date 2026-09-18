import { cosineSimilarity } from "@langchain/core/utils/math"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Replace the Ollama client with fakes: no local server needed, but we still test OUR mapping code
const chat = vi.fn()
const embed = vi.fn()
const clientConfigs: { host: string }[] = []

vi.mock("ollama", () => ({
    Ollama: vi.fn().mockImplementation(function (config: { host: string }) {
        clientConfigs.push(config)
        return { chat, embed }
    }),
}))

const { OllamaProvider } = await import("../../src/llm/ollama.provider")
const provider = new OllamaProvider({
    baseUrl: "http://localhost:11434",
    chatModel: "qwen2.5:3b",
    embeddingModel: "nomic-embed-text",
    contextWindow: 8192,
    timeoutMs: 1000,
})

class FakeResponseError extends Error {
    name = "ResponseError"
    constructor(readonly status_code: number) {
        super(`status ${status_code}`)
    }
}

const vector768 = (seed: number) => Array.from({ length: 768 }, (_, i) => (i === seed ? 2 : 0.5))

beforeEach(() => {
    vi.clearAllMocks()
})

describe("OllamaProvider", () => {
    it("talks to the configured local server", async () => {
        chat.mockResolvedValue({ message: { content: "ok" }, prompt_eval_count: 1, eval_count: 1 })
        await provider.chat([{ role: "user", content: "hi" }])
        expect(clientConfigs.at(-1)?.host).toBe("http://localhost:11434")
    })

    it("sends messages as-is with a large enough context window, and maps token counts", async () => {
        chat.mockResolvedValue({
            message: { content: "Hi there" },
            prompt_eval_count: 12,
            eval_count: 3,
        })

        const result = await provider.chat([
            { role: "system", content: "rules" },
            { role: "user", content: "hello" },
        ])

        const request = chat.mock.calls[0][0]
        expect(request).toMatchObject({
            model: "qwen2.5:3b",
            messages: [
                { role: "system", content: "rules" },
                { role: "user", content: "hello" },
            ],
            options: { temperature: 0.1, num_ctx: 8192 },
            keep_alive: "30m", // stays loaded between questions
        })
        expect(result).toEqual({
            text: "Hi there",
            usage: { promptTokens: 12, completionTokens: 3, totalTokens: 15 },
        })
    })

    it("streams message deltas and reads usage from the final chunk", async () => {
        chat.mockResolvedValue(
            (async function* () {
                yield { message: { content: "Hel" }, done: false }
                yield { message: { content: "lo" }, done: false }
                yield { message: { content: "" }, done: true, prompt_eval_count: 20, eval_count: 2 }
            })(),
        )
        const deltas: string[] = []

        const result = await provider.streamChat([{ role: "user", content: "hi" }], {
            onToken: (delta: string) => deltas.push(delta),
        })

        expect(chat.mock.calls[0][0].stream).toBe(true)
        expect(deltas).toEqual(["Hel", "lo"])
        expect(result).toEqual({
            text: "Hello",
            usage: { promptTokens: 20, completionTokens: 2, totalTokens: 22 },
        })
    })

    it("adds nomic's task prefixes so passages and questions are embedded differently", async () => {
        embed.mockResolvedValue({ embeddings: [vector768(0)], prompt_eval_count: 5 })

        await provider.embed(["a passage"], "document")
        await provider.embed(["a question"], "query")

        expect(embed.mock.calls[0][0].input).toEqual(["search_document: a passage"])
        expect(embed.mock.calls[1][0].input).toEqual(["search_query: a question"])
    })

    it("pads smaller vectors to 1536 numbers without changing their similarity", async () => {
        const a = vector768(1)
        const b = vector768(2)
        embed.mockResolvedValue({ embeddings: [a, b], prompt_eval_count: 8 })

        const result = await provider.embed(["one", "two"])

        expect(result.vectors[0]).toHaveLength(1536)
        expect(result.vectors[0].slice(768).every((value) => value === 0)).toBe(true)
        const [[before]] = cosineSimilarity([a], [b])
        const [[after]] = cosineSimilarity([result.vectors[0]], [result.vectors[1]])
        expect(after).toBeCloseTo(before, 10)
        expect(result.usage.promptTokens).toBe(8)
    })

    it("embeds in batches", async () => {
        embed.mockImplementation(async ({ input }: { input: string[] }) => ({
            embeddings: input.map(() => vector768(0)),
            prompt_eval_count: input.length,
        }))

        const result = await provider.embed(Array.from({ length: 70 }, (_, i) => `chunk ${i}`))

        expect(embed).toHaveBeenCalledTimes(2)
        expect(result.vectors).toHaveLength(70)
        expect(result.usage.promptTokens).toBe(70)
    })

    it("refuses embedding models that produce more than 1536 numbers", async () => {
        embed.mockResolvedValue({ embeddings: [new Array(4096).fill(0.1)], prompt_eval_count: 1 })

        await expect(provider.embed(["text"])).rejects.toMatchObject({
            code: "PROVIDER_UNAVAILABLE",
        })
    })

    it("explains when Ollama isn't running or the model isn't pulled", async () => {
        chat.mockRejectedValueOnce(new TypeError("fetch failed"))
        await expect(provider.chat([{ role: "user", content: "hi" }])).rejects.toMatchObject({
            statusCode: 503,
            code: "PROVIDER_UNAVAILABLE",
        })

        chat.mockRejectedValueOnce(new FakeResponseError(404))
        await expect(provider.chat([{ role: "user", content: "hi" }])).rejects.toMatchObject({
            code: "PROVIDER_UNAVAILABLE",
        })

        chat.mockRejectedValueOnce(new FakeResponseError(400))
        await expect(provider.chat([{ role: "user", content: "hi" }])).rejects.toBeInstanceOf(
            FakeResponseError,
        )
    })
})
