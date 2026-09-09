import { AIMessage, AIMessageChunk, type BaseMessage } from "@langchain/core/messages"
import { describe, expect, it, vi } from "vitest"

// Replace LangChain's OpenAI classes with fakes: no network, but we still test OUR mapping code
const invoke = vi.fn()
const stream = vi.fn()
const embedDocuments = vi.fn()
vi.mock("@langchain/openai", () => ({
    ChatOpenAI: vi.fn().mockImplementation(function () {
        return { invoke, stream }
    }),
    OpenAIEmbeddings: vi.fn().mockImplementation(function () {
        return { embedDocuments }
    }),
}))

const { OpenAiProvider } = await import("../../src/llm/openai.provider")
const provider = new OpenAiProvider({
    apiKey: "sk-test",
    chatModel: "gpt-test",
    embeddingModel: "emb-test",
    timeoutMs: 1000,
})
const usage = { input_tokens: 10, output_tokens: 5, total_tokens: 15 }

describe("OpenAiProvider", () => {
    it("maps roles to LangChain messages and returns text + usage", async () => {
        invoke.mockResolvedValue(new AIMessage({ content: "Hi there", usage_metadata: usage }))

        const result = await provider.chat([
            { role: "system", content: "rules" },
            { role: "user", content: "hello" },
            { role: "assistant", content: "earlier answer" },
        ])

        const sent = invoke.mock.calls[0][0] as BaseMessage[]
        expect(sent.map((m) => m.type)).toEqual(["system", "human", "ai"])
        expect(result).toEqual({
            text: "Hi there",
            usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        })
    })

    it("forwards every streamed delta and picks up usage from the final chunk", async () => {
        stream.mockResolvedValue(
            (async function* () {
                yield new AIMessageChunk({ content: "Hel" })
                yield new AIMessageChunk({ content: "lo" })
                yield new AIMessageChunk({ content: "", usage_metadata: usage })
            })(),
        )
        const deltas: string[] = []

        const result = await provider.streamChat([{ role: "user", content: "hi" }], {
            onToken: (delta: string) => deltas.push(delta),
        })

        expect(deltas).toEqual(["Hel", "lo"])
        expect(result.text).toBe("Hello")
        expect(result.usage.totalTokens).toBe(15)
    })

    it("embeds texts and counts their tokens", async () => {
        embedDocuments.mockResolvedValue([[0.1], [0.2]])

        const result = await provider.embed(["hello world", "second text"])

        expect(result.vectors).toEqual([[0.1], [0.2]])
        expect(result.usage.promptTokens).toBeGreaterThan(0)
        expect(result.usage.completionTokens).toBe(0)
    })
})
