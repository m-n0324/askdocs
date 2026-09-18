import { env } from "../config/env"
import { logger } from "../lib/logger"
import { FakeProvider } from "./fake.provider"
import { GeminiProvider } from "./gemini.provider"
import { OllamaProvider } from "./ollama.provider"
import { OpenAiProvider } from "./openai.provider"
import type { LlmProvider } from "./provider"

let provider: LlmProvider | null = null

function createProvider(): LlmProvider {
    // env validation guarantees the matching API key exists for the chosen provider (Ollama needs none)
    switch (env.LLM_PROVIDER) {
        case "openai":
            return new OpenAiProvider({
                apiKey: env.OPENAI_API_KEY ?? "",
                chatModel: env.OPENAI_CHAT_MODEL,
                embeddingModel: env.OPENAI_EMBEDDING_MODEL,
                timeoutMs: env.LLM_TIMEOUT_MS,
            })
        case "gemini":
            return new GeminiProvider({
                apiKey: env.GEMINI_API_KEY ?? "",
                chatModel: env.GEMINI_CHAT_MODEL,
                embeddingModel: env.GEMINI_EMBEDDING_MODEL,
                timeoutMs: env.LLM_TIMEOUT_MS,
            })
        case "ollama":
            return new OllamaProvider({
                baseUrl: env.OLLAMA_BASE_URL,
                chatModel: env.OLLAMA_CHAT_MODEL,
                embeddingModel: env.OLLAMA_EMBEDDING_MODEL,
                contextWindow: env.OLLAMA_CONTEXT_WINDOW,
                timeoutMs: env.LLM_TIMEOUT_MS,
            })
        case "fake":
            if (env.isProduction) {
                logger.warn("LLM_PROVIDER=fake in production: answers are canned, not real.")
            }
            return new FakeProvider()
    }
}

/** Returns the configured provider (created once, on first use). */
export function getLlmProvider(): LlmProvider {
    provider ??= createProvider()
    return provider
}

export type { ChatMessage, LlmProvider, TokenUsage } from "./provider"
