import { ApiError, GoogleGenAI, type Content } from "@google/genai"
import { providerRateLimited, providerUnavailable } from "../lib/errors"
import { logger } from "../lib/logger"
import { countTokens } from "../lib/tokens"
import {
    EMBEDDING_DIMENSIONS,
    type ChatMessage,
    type ChatOptions,
    type ChatResult,
    type EmbeddingPurpose,
    type EmbeddingResult,
    type LlmProvider,
    type StreamChatOptions,
    type TokenUsage,
} from "./provider"

/**
 * Google Gemini via the official @google/genai SDK. Free API keys: https://aistudio.google.com
 *
 * Differences from OpenAI that this class hides from the rest of the app:
 * - The system prompt is a separate `systemInstruction`, not a message, and the assistant's
 *   role is called "model".
 * - Embeddings: gemini-embedding-001 returns 3072 numbers by default; we ask for 1536 so the
 *   database column stays `vector(1536)`. We also pass a task type (document vs question).
 * - Free-tier rate limits are tight, so the SDK retries 429/5xx with exponential backoff.
 */

interface GeminiProviderConfig {
    apiKey: string
    chatModel: string
    embeddingModel: string
    timeoutMs: number
}

// The Gemini API accepts at most 100 texts per embedding request
const EMBED_BATCH_SIZE = 100

// Retries with exponential backoff: waits ~2s, 4s, 8s, 16s, 32s. Long enough to outlast a
// per-minute free-tier limit. A daily limit will still fail after this, with a clear message.
const RETRY_OPTIONS = { attempts: 6, initialDelay: 2, maxDelay: 60 }

const TASK_TYPES: Record<EmbeddingPurpose, string> = {
    document: "RETRIEVAL_DOCUMENT",
    query: "RETRIEVAL_QUERY",
}

/** Splits our chat messages into Gemini's `systemInstruction` + `contents`. */
function toGeminiRequest(messages: ChatMessage[]): {
    systemInstruction?: string
    contents: Content[]
} {
    const system = messages
        .filter((message) => message.role === "system")
        .map((message) => message.content)
        .join("\n\n")
    const contents = messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
        }))
    return { systemInstruction: system || undefined, contents }
}

interface GeminiUsage {
    promptTokenCount?: number
    candidatesTokenCount?: number
    thoughtsTokenCount?: number
    totalTokenCount?: number
}

/** "Thinking" tokens are billed and count against quotas, so we count them as completion tokens. */
const toUsage = (usage?: GeminiUsage): TokenUsage => {
    const promptTokens = usage?.promptTokenCount ?? 0
    const completionTokens = (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0)
    return {
        promptTokens,
        completionTokens,
        totalTokens: usage?.totalTokenCount ?? promptTokens + completionTokens,
    }
}

/**
 * Scales a vector to length 1. Google recommends this for reduced dimensions. Cosine similarity
 * doesn't strictly need it, but unit vectors keep every distance measure consistent.
 */
const normalize = (vector: number[]): number[] => {
    const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
    return length === 0 ? vector : vector.map((value) => value / length)
}

/**
 * Turns the Gemini errors a person can act on into clear messages:
 * - 429 (after the SDK's own retries): out of free quota, try again later
 * - 404: the model was retired or doesn't exist for this key, so the admin must change the setting
 */
const rethrowFor =
    (model: string) =>
    (err: unknown): never => {
        if (err instanceof ApiError && err.status === 429) throw providerRateLimited()
        if (err instanceof ApiError && err.status === 404) {
            logger.error(
                { model, err },
                `Gemini model "${model}" is not available for this API key. Set GEMINI_CHAT_MODEL / GEMINI_EMBEDDING_MODEL in backend/.env to a current model.`,
            )
            throw providerUnavailable()
        }
        throw err
    }

export class GeminiProvider implements LlmProvider {
    readonly chatModel: string
    readonly embeddingModel: string
    private readonly client: GoogleGenAI

    constructor(config: GeminiProviderConfig) {
        this.chatModel = config.chatModel
        this.embeddingModel = config.embeddingModel
        this.client = new GoogleGenAI({
            apiKey: config.apiKey,
            httpOptions: { timeout: config.timeoutMs, retryOptions: RETRY_OPTIONS },
        })
    }

    async embed(texts: string[], purpose: EmbeddingPurpose = "document"): Promise<EmbeddingResult> {
        const vectors: number[][] = []
        for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
            const batch = texts.slice(start, start + EMBED_BATCH_SIZE)
            const response = await this.client.models
                .embedContent({
                    model: this.embeddingModel,
                    contents: batch,
                    config: {
                        taskType: TASK_TYPES[purpose],
                        outputDimensionality: EMBEDDING_DIMENSIONS,
                    },
                })
                .catch(rethrowFor(this.embeddingModel))

            const values = (response.embeddings ?? []).map((embedding) => embedding.values ?? [])
            if (
                values.length !== batch.length ||
                values.some((v) => v.length !== EMBEDDING_DIMENSIONS)
            ) {
                throw new Error(
                    `Gemini returned ${values.length} embeddings for ${batch.length} texts; expected ${EMBEDDING_DIMENSIONS} numbers each`,
                )
            }
            vectors.push(...values.map(normalize))
        }

        // The Gemini API doesn't report embedding token counts; this is a close estimate
        const promptTokens = texts.reduce((sum, text) => sum + countTokens(text), 0)
        return { vectors, usage: { promptTokens, completionTokens: 0, totalTokens: promptTokens } }
    }

    async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
        const { systemInstruction, contents } = toGeminiRequest(messages)
        const response = await this.client.models
            .generateContent({
                model: this.chatModel,
                contents,
                config: { systemInstruction, temperature: 0.1, abortSignal: options.signal },
            })
            .catch(rethrowFor(this.chatModel))
        return { text: response.text ?? "", usage: toUsage(response.usageMetadata) }
    }

    async streamChat(messages: ChatMessage[], options: StreamChatOptions): Promise<ChatResult> {
        const { systemInstruction, contents } = toGeminiRequest(messages)
        const stream = await this.client.models
            .generateContentStream({
                model: this.chatModel,
                contents,
                config: { systemInstruction, temperature: 0.1, abortSignal: options.signal },
            })
            .catch(rethrowFor(this.chatModel))

        let text = ""
        let usage = toUsage()
        try {
            for await (const chunk of stream) {
                const delta = chunk.text
                if (delta) {
                    text += delta
                    options.onToken(delta)
                }
                // Each chunk may carry a running total; the last one is the final count
                if (chunk.usageMetadata) usage = toUsage(chunk.usageMetadata)
            }
        } catch (err) {
            rethrowFor(this.chatModel)(err)
        }
        return { text, usage }
    }
}
