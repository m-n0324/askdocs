import { beforeEach, describe, expect, it, vi } from "vitest"

// Replace Google's SDK with fakes: no network, but we still test OUR mapping code
const embedContent = vi.fn()
const generateContent = vi.fn()
const generateContentStream = vi.fn()
const constructorArgs: unknown[] = []

class FakeApiError extends Error {
    constructor(readonly status: number) {
        super(`HTTP ${status}`)
    }
}

vi.mock("@google/genai", () => ({
    ApiError: FakeApiError,
    GoogleGenAI: vi.fn().mockImplementation(function (options: unknown) {
        constructorArgs.push(options)
        return { models: { embedContent, generateContent, generateContentStream } }
    }),
}))

const { GeminiProvider } = await import("../../src/llm/gemini.provider")
const provider = new GeminiProvider({
    apiKey: "test-key",
    chatModel: "gemini-test",
    embeddingModel: "gemini-embedding-test",
    timeoutMs: 1000,
})

const usage = {
    promptTokenCount: 10,
    candidatesTokenCount: 4,
    thoughtsTokenCount: 6,
    totalTokenCount: 20,
}
const vector = (seed: number) => Array.from({ length: 1536 }, (_, i) => (i === seed ? 3 : 0))

beforeEach(() => {
    vi.clearAllMocks()
})

describe("GeminiProvider", () => {
    it("configures the SDK with the key, a timeout, and retries for rate limits", () => {
        expect(constructorArgs[0]).toMatchObject({
            apiKey: "test-key",
            httpOptions: { timeout: 1000, retryOptions: { attempts: expect.any(Number) } },
        })
    })

    it("sends the system prompt separately and maps assistant turns to Gemini's 'model' role", async () => {
        generateContent.mockResolvedValue({ text: "Hi there", usageMetadata: usage })

        const result = await provider.chat([
            { role: "system", content: "rules" },
            { role: "user", content: "hello" },
            { role: "assistant", content: "earlier answer" },
            { role: "user", content: "follow-up" },
        ])

        const request = generateContent.mock.calls[0][0]
        expect(request.model).toBe("gemini-test")
        expect(request.config.systemInstruction).toBe("rules")
        expect(request.contents).toEqual([
            { role: "user", parts: [{ text: "hello" }] },
            { role: "model", parts: [{ text: "earlier answer" }] },
            { role: "user", parts: [{ text: "follow-up" }] },
        ])
        // "Thinking" tokens are billed and count against quotas, so they count as completion tokens
        expect(result).toEqual({
            text: "Hi there",
            usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        })
    })

    it("forwards every streamed delta and keeps the last usage report", async () => {
        generateContentStream.mockResolvedValue(
            (async function* () {
                yield { text: "Hel" }
                yield { text: "lo", usageMetadata: { ...usage, totalTokenCount: 18 } }
                yield { text: undefined, usageMetadata: usage }
            })(),
        )
        const deltas: string[] = []

        const result = await provider.streamChat([{ role: "user", content: "hi" }], {
            onToken: (delta: string) => deltas.push(delta),
        })

        expect(deltas).toEqual(["Hel", "lo"])
        expect(result.text).toBe("Hello")
        expect(result.usage.totalTokens).toBe(20)
    })

    it("embeds documents in batches of 100 at 1536 dimensions, as unit vectors", async () => {
        embedContent.mockImplementation(async ({ contents }: { contents: string[] }) => ({
            embeddings: contents.map((_, i) => ({ values: vector(i) })),
        }))
        const texts = Array.from({ length: 150 }, (_, i) => `chunk ${i}`)

        const result = await provider.embed(texts)

        expect(embedContent).toHaveBeenCalledTimes(2)
        expect(embedContent.mock.calls[0][0].contents).toHaveLength(100)
        expect(embedContent.mock.calls[1][0].contents).toHaveLength(50)
        expect(embedContent.mock.calls[0][0].config).toMatchObject({
            taskType: "RETRIEVAL_DOCUMENT",
            outputDimensionality: 1536,
        })
        expect(result.vectors).toHaveLength(150)
        expect(result.vectors[0][0]).toBe(1) // 3 normalised to length 1
        expect(result.usage.promptTokens).toBeGreaterThan(0)
    })

    it("embeds questions with the query task type", async () => {
        embedContent.mockResolvedValue({ embeddings: [{ values: vector(0) }] })

        await provider.embed(["how many vacation days?"], "query")

        expect(embedContent.mock.calls[0][0].config.taskType).toBe("RETRIEVAL_QUERY")
    })

    it("rejects embeddings of the wrong size instead of storing them", async () => {
        embedContent.mockResolvedValue({ embeddings: [{ values: [0.1, 0.2] }] })

        await expect(provider.embed(["text"])).rejects.toThrow(/1536/)
    })

    it("turns a rate-limit error (after the SDK's retries) into a clear 429", async () => {
        generateContent.mockRejectedValue(new FakeApiError(429))

        await expect(provider.chat([{ role: "user", content: "hi" }])).rejects.toMatchObject({
            statusCode: 429,
            code: "PROVIDER_RATE_LIMITED",
        })
    })

    it("turns a retired or unknown model (404) into a clear 503", async () => {
        generateContentStream.mockRejectedValue(new FakeApiError(404))

        await expect(
            provider.streamChat([{ role: "user", content: "hi" }], { onToken: () => undefined }),
        ).rejects.toMatchObject({ statusCode: 503, code: "PROVIDER_UNAVAILABLE" })
    })

    it("lets other errors through unchanged", async () => {
        generateContent.mockRejectedValue(new FakeApiError(400))

        await expect(provider.chat([{ role: "user", content: "hi" }])).rejects.toBeInstanceOf(
            FakeApiError,
        )
    })
})
