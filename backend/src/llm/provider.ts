/**
 * The ONLY surface the rest of the app uses to talk to an LLM vendor.
 * Swapping OpenAI for another vendor (Anthropic, Gemini, a local model) means writing one new
 * class that implements this interface. No service code changes.
 */

export interface ChatMessage {
    role: "system" | "user" | "assistant"
    content: string
}

export interface TokenUsage {
    promptTokens: number
    completionTokens: number
    totalTokens: number
}

/**
 * Some embedding models (e.g. Gemini) embed a stored passage and a search question slightly
 * differently, because a question ("how many vacation days?") doesn't look like the passage that
 * answers it. Telling the model which one it is improves retrieval. Models without this ignore it.
 */
export type EmbeddingPurpose = "document" | "query"

export interface EmbeddingResult {
    vectors: number[][]
    usage: TokenUsage
}

export interface ChatResult {
    text: string
    usage: TokenUsage
}

export interface ChatOptions {
    /** Lets the caller cancel generation, e.g. when the browser closes the SSE connection. */
    signal?: AbortSignal
}

export interface StreamChatOptions extends ChatOptions {
    onToken: (delta: string) => void
}

export interface LlmProvider {
    readonly chatModel: string
    readonly embeddingModel: string

    /** One vector per input text, in the same order. */
    embed(texts: string[], purpose?: EmbeddingPurpose): Promise<EmbeddingResult>

    chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>

    /** Calls `onToken` for every piece of text as it arrives, then resolves with the full answer. */
    streamChat(messages: ChatMessage[], options: StreamChatOptions): Promise<ChatResult>
}

/** Must match the `vector(1536)` column in the database schema. */
export const EMBEDDING_DIMENSIONS = 1536
