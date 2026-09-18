import { Ollama, type ChatResponse } from "ollama"
import { providerUnavailable } from "../lib/errors"
import { logger } from "../lib/logger"
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
 * Local models via Ollama (https://ollama.com): free, private (documents never leave your
 * machine), no API key, no rate limits. Slower than cloud models on a laptop, and small models
 * follow instructions less reliably.
 *
 * Things this class handles:
 * - Context window: Ollama's default is only a few thousand tokens and it silently cuts longer
 *   prompts. Our prompt (rules + 5 passages + history) can be longer, so we set `num_ctx`.
 * - Vector size: local embedding models produce fewer numbers than the 1536 our database stores
 *   (nomic-embed-text: 768). We pad with zeros. Zero-padding changes neither dot products nor
 *   vector lengths, so cosine similarity, and therefore search, is exactly the same.
 * - Task prefixes: nomic-embed-text was trained to see "search_document: " in front of passages
 *   and "search_query: " in front of questions, and retrieves better with them.
 */

interface OllamaProviderConfig {
    baseUrl: string
    chatModel: string
    embeddingModel: string
    contextWindow: number
    timeoutMs: number
}

const EMBED_BATCH_SIZE = 64

// Ollama unloads a model after 5 idle minutes, and reloading takes ~30s on a laptop.
// Keeping it in memory for 30 minutes makes the first question of a session fast too.
const KEEP_ALIVE = "30m"

/** Prefixes some open embedding models expect. Add an entry when you switch to another model. */
const TASK_PREFIXES: Record<string, Partial<Record<EmbeddingPurpose, string>>> = {
    "nomic-embed-text": { document: "search_document: ", query: "search_query: " },
    "mxbai-embed-large": { query: "Represent this sentence for searching relevant passages: " },
}

const prefixFor = (model: string, purpose: EmbeddingPurpose) =>
    TASK_PREFIXES[model.split(":")[0]]?.[purpose] ?? ""

/** Pads to 1536 numbers with zeros and scales to length 1 (cosine similarity is unaffected). */
function toStoredVector(vector: number[]): number[] {
    const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
    const padding = new Array<number>(EMBEDDING_DIMENSIONS - vector.length).fill(0)
    return [...vector.map((value) => value / length), ...padding]
}

const toUsage = (response?: Pick<ChatResponse, "prompt_eval_count" | "eval_count">): TokenUsage => {
    const promptTokens = response?.prompt_eval_count ?? 0
    const completionTokens = response?.eval_count ?? 0
    return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens }
}

/** The client's 4xx/5xx error class isn't exported, so we recognise it by its fields. */
const httpStatusOf = (err: unknown): number | undefined =>
    err instanceof Error && err.name === "ResponseError" && "status_code" in err
        ? Number(err.status_code)
        : undefined

export class OllamaProvider implements LlmProvider {
    readonly chatModel: string
    readonly embeddingModel: string

    constructor(private readonly config: OllamaProviderConfig) {
        this.chatModel = config.chatModel
        this.embeddingModel = config.embeddingModel
    }

    /**
     * A client whose requests stop when the caller aborts (Stop button) or after the timeout.
     * The Ollama client takes no per-request signal, so we hand it a fetch that adds one.
     */
    private client(signal?: AbortSignal): Ollama {
        const timeout = AbortSignal.timeout(this.config.timeoutMs)
        const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
        return new Ollama({
            host: this.config.baseUrl,
            fetch: (input, init) => fetch(input, { ...init, signal: combined }),
        })
    }

    /** Turns "Ollama isn't running" and "model not pulled" into a clear log line and a 503. */
    private rethrowFor(model: string) {
        return (err: unknown): never => {
            if (err instanceof TypeError && err.message === "fetch failed") {
                logger.error(
                    { err, baseUrl: this.config.baseUrl },
                    `Cannot reach Ollama at ${this.config.baseUrl}. Is it running? (ollama serve)`,
                )
                throw providerUnavailable()
            }
            if (httpStatusOf(err) === 404) {
                logger.error(
                    { err, model },
                    `Ollama model "${model}" is not installed. Run: ollama pull ${model}`,
                )
                throw providerUnavailable()
            }
            throw err
        }
    }

    private chatOptions() {
        return { temperature: 0.1, num_ctx: this.config.contextWindow }
    }

    async embed(texts: string[], purpose: EmbeddingPurpose = "document"): Promise<EmbeddingResult> {
        const prefix = prefixFor(this.embeddingModel, purpose)
        const vectors: number[][] = []
        let promptTokens = 0

        for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
            const batch = texts.slice(start, start + EMBED_BATCH_SIZE)
            const response = await this.client()
                .embed({
                    model: this.embeddingModel,
                    input: batch.map((text) => prefix + text),
                    keep_alive: KEEP_ALIVE,
                })
                .catch(this.rethrowFor(this.embeddingModel))

            const tooLarge = response.embeddings.find((v) => v.length > EMBEDDING_DIMENSIONS)
            if (tooLarge) {
                logger.error(
                    { model: this.embeddingModel, dimensions: tooLarge.length },
                    `Embedding model "${this.embeddingModel}" returns ${tooLarge.length} numbers; AskDocs stores at most ${EMBEDDING_DIMENSIONS}. Use e.g. nomic-embed-text or mxbai-embed-large.`,
                )
                throw providerUnavailable()
            }
            vectors.push(...response.embeddings.map(toStoredVector))
            promptTokens += response.prompt_eval_count ?? 0
        }

        return { vectors, usage: { promptTokens, completionTokens: 0, totalTokens: promptTokens } }
    }

    async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
        const response = await this.client(options.signal)
            .chat({
                model: this.chatModel,
                messages,
                stream: false,
                keep_alive: KEEP_ALIVE,
                options: this.chatOptions(),
            })
            .catch(this.rethrowFor(this.chatModel))
        return { text: response.message.content, usage: toUsage(response) }
    }

    async streamChat(messages: ChatMessage[], options: StreamChatOptions): Promise<ChatResult> {
        const stream = await this.client(options.signal)
            .chat({
                model: this.chatModel,
                messages,
                stream: true,
                keep_alive: KEEP_ALIVE,
                options: this.chatOptions(),
            })
            .catch(this.rethrowFor(this.chatModel))

        let text = ""
        let usage = toUsage()
        for await (const chunk of stream) {
            const delta = chunk.message.content
            if (delta) {
                text += delta
                options.onToken(delta)
            }
            if (chunk.done) usage = toUsage(chunk) // token counts arrive with the last chunk
        }
        return { text, usage }
    }
}
