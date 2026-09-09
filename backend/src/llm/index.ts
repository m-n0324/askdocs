import { env } from "../config/env"
import { logger } from "../lib/logger"
import { FakeProvider } from "./fake.provider"
import { OpenAiProvider } from "./openai.provider"
import type { LlmProvider } from "./provider"

let provider: LlmProvider | null = null

function createProvider(): LlmProvider {
    // env validation guarantees the matching API key exists for the chosen provider
    switch (env.LLM_PROVIDER) {
        case "openai":
            return new OpenAiProvider({
                apiKey: env.OPENAI_API_KEY ?? "",
                chatModel: env.OPENAI_CHAT_MODEL,
                embeddingModel: env.OPENAI_EMBEDDING_MODEL,
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
