import { setImmediate as nextTick } from "node:timers/promises"
import {
    EMBEDDING_DIMENSIONS,
    type ChatMessage,
    type ChatOptions,
    type ChatResult,
    type EmbeddingResult,
    type LlmProvider,
    type StreamChatOptions,
    type TokenUsage,
} from "./provider"

/**
 * A deterministic, offline stand-in for a real LLM. Used by the automated tests and for
 * running the app without an API key (LLM_PROVIDER=fake).
 *
 * Embeddings: "hashed bag of words". Each word is hashed into one of 1536 slots and the vector
 * is normalised. Texts sharing words get a higher cosine similarity, so retrieval behaves
 * sensibly (keyword-level, not semantic).
 *
 * Chat: echoes the first sentence of source [1], or the follow-up question when asked to rewrite.
 * It is NOT smart. It only exercises the pipeline.
 */

const STOP_WORDS = new Set([
    "the",
    "and",
    "for",
    "are",
    "was",
    "what",
    "how",
    "does",
    "did",
    "with",
    "this",
    "that",
    "from",
    "about",
    "into",
    "can",
    "you",
    "your",
    "our",
    "has",
    "have",
    "who",
    "why",
    "when",
])

const tokenize = (text: string): string[] =>
    (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
        (word) => word.length > 2 && !STOP_WORDS.has(word),
    )

/** FNV-1a: a tiny, fast, well-distributed string hash. */
const hash = (word: string): number => {
    let h = 0x811c9dc5
    for (let i = 0; i < word.length; i++) {
        h ^= word.charCodeAt(i)
        h = Math.imul(h, 0x01000193)
    }
    return h >>> 0
}

export function fakeEmbedding(text: string): number[] {
    const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0)
    for (const word of tokenize(text)) vector[hash(word) % EMBEDDING_DIMENSIONS] += 1

    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
    // An all-zero vector has no direction; pgvector rejects it for cosine distance. Use a fixed axis instead.
    if (norm === 0) return vector.map((_, i) => (i === 0 ? 1 : 0))
    return vector.map((value) => value / norm)
}

const estimateTokens = (text: string) => Math.ceil(text.length / 4)

const usageFor = (messages: ChatMessage[], answer: string): TokenUsage => {
    const promptTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0)
    const completionTokens = estimateTokens(answer)
    return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens }
}

function fakeAnswer(messages: ChatMessage[]): string {
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? ""

    const firstSource = lastUser.match(/<source id="1"[^>]*>\s*([\s\S]*?)<\/source>/)
    if (firstSource) {
        const firstSentence = firstSource[1]
            .trim()
            .split(/(?<=[.!?])\s/)[0]
            .slice(0, 300)
        return `According to the sources, ${firstSentence} [1]`
    }

    const followUp = lastUser.match(/Follow-up question:\s*([\s\S]+)$/)
    return followUp ? followUp[1].trim() : lastUser
}

export class FakeProvider implements LlmProvider {
    readonly chatModel = "fake-chat"
    readonly embeddingModel = "fake-embedding"

    async embed(texts: string[]): Promise<EmbeddingResult> {
        const promptTokens = texts.reduce((sum, text) => sum + estimateTokens(text), 0)
        return {
            vectors: texts.map(fakeEmbedding),
            usage: { promptTokens, completionTokens: 0, totalTokens: promptTokens },
        }
    }

    async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
        options.signal?.throwIfAborted()
        const text = fakeAnswer(messages)
        return { text, usage: usageFor(messages, text) }
    }

    async streamChat(messages: ChatMessage[], options: StreamChatOptions): Promise<ChatResult> {
        const text = fakeAnswer(messages)
        for (const piece of text.match(/\S+\s*/g) ?? []) {
            options.signal?.throwIfAborted()
            options.onToken(piece)
            await nextTick()
        }
        return { text, usage: usageFor(messages, text) }
    }
}
