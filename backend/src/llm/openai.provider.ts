import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages"
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai"
import { countTokens } from "../lib/tokens"
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

interface OpenAiProviderConfig {
    apiKey: string
    chatModel: string
    embeddingModel: string
    timeoutMs: number
}

const toLangChainMessage = (message: ChatMessage): BaseMessage => {
    if (message.role === "system") return new SystemMessage(message.content)
    if (message.role === "assistant") return new AIMessage(message.content)
    return new HumanMessage(message.content)
}

const toUsage = (usage?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
}): TokenUsage => ({
    promptTokens: usage?.input_tokens ?? 0,
    completionTokens: usage?.output_tokens ?? 0,
    totalTokens: usage?.total_tokens ?? 0,
})

/** OpenAI via LangChain's wrappers, which give us retries, batching, and streaming for free. */
export class OpenAiProvider implements LlmProvider {
    readonly chatModel: string
    readonly embeddingModel: string
    private readonly chatClient: ChatOpenAI
    private readonly embeddingClient: OpenAIEmbeddings

    constructor(config: OpenAiProviderConfig) {
        this.chatModel = config.chatModel
        this.embeddingModel = config.embeddingModel
        this.chatClient = new ChatOpenAI({
            apiKey: config.apiKey,
            model: config.chatModel,
            temperature: 0.1, // low temperature: we want faithful answers, not creative ones
            maxRetries: 2,
            timeout: config.timeoutMs,
            streamUsage: true, // ask OpenAI to send token usage at the end of a stream
        })
        this.embeddingClient = new OpenAIEmbeddings({
            apiKey: config.apiKey,
            model: config.embeddingModel,
            dimensions: EMBEDDING_DIMENSIONS,
            batchSize: 256,
            maxRetries: 3,
            timeout: config.timeoutMs,
        })
    }

    async embed(texts: string[]): Promise<EmbeddingResult> {
        const vectors = await this.embeddingClient.embedDocuments(texts)
        // LangChain's embeddings wrapper doesn't surface usage, so we count tokens ourselves.
        const promptTokens = texts.reduce((sum, text) => sum + countTokens(text), 0)
        return {
            vectors,
            usage: { promptTokens, completionTokens: 0, totalTokens: promptTokens },
        }
    }

    async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
        const response = await this.chatClient.invoke(messages.map(toLangChainMessage), {
            signal: options.signal,
        })
        return { text: response.text, usage: toUsage(response.usage_metadata) }
    }

    async streamChat(messages: ChatMessage[], options: StreamChatOptions): Promise<ChatResult> {
        const stream = await this.chatClient.stream(messages.map(toLangChainMessage), {
            signal: options.signal,
        })

        let text = ""
        let usage = toUsage()
        for await (const chunk of stream) {
            const delta = chunk.text
            if (delta) {
                text += delta
                options.onToken(delta)
            }
            if (chunk.usage_metadata) usage = toUsage(chunk.usage_metadata)
        }
        return { text, usage }
    }
}
