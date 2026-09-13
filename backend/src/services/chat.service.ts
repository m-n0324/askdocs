import { env } from "../config/env"
import { notFound } from "../lib/errors"
import { logger } from "../lib/logger"
import { countTokens } from "../lib/tokens"
import { getLlmProvider, type ChatMessage, type TokenUsage } from "../llm"
import {
    ANSWER_PROMPT_VERSION,
    NO_ANSWER_TEXT,
    buildAnswerMessages,
    buildCondenseMessages,
} from "../prompts"
import {
    addExchange,
    createConversation,
    deleteConversation,
    findConversation,
    listRecentMessages,
} from "../repositories/conversation.repository"
import type { Citation, Conversation, Message } from "../types/domain"
import { selectCitedCitations, toCitations } from "../utils/citations"
import { retrieve } from "./retrieval.service"
import { assertWithinQuota, trackUsage } from "./usage.service"

/**
 * One chat turn, end to end:
 *
 *   1. load the conversation + its recent messages (the "memory")
 *   2. if there is history, rewrite the question into a standalone one (condense step)
 *   3. retrieve the most relevant chunks of THIS workspace
 *   4. no relevant chunks? answer "I don't know" without calling the LLM at all
 *   5. otherwise build the prompt (rules + sources + history + question) and ask the LLM
 *   6. keep only the citations the answer actually uses; save question + answer together;
 *      record token usage
 *
 * Steps 1-4 live in `prepareChat` and 5-6 in `completeChat`, so the streaming endpoint can
 * report errors as normal JSON before it switches the response to Server-Sent Events.
 */

export interface ChatInput {
    workspaceId: string
    userId: string
    message: string
    conversationId?: string
}

export interface PreparedChat {
    input: ChatInput
    conversation: Conversation
    /** True if this turn created the conversation: it is removed again if no answer gets saved. */
    isNewConversation: boolean
    askedAt: Date
    standaloneQuestion: string
    /** Candidate citations: source [n] in the prompt is candidates[n - 1]. */
    candidates: Citation[]
    /** null when retrieval found nothing relevant: we will answer "I don't know". */
    llmMessages: ChatMessage[] | null
    topScore: number
}

const TITLE_LENGTH = 60

const scopeOf = (input: ChatInput) => ({ workspaceId: input.workspaceId, userId: input.userId })

async function condenseQuestion(input: ChatInput, history: Message[]): Promise<string> {
    if (history.length === 0) return input.message

    const provider = getLlmProvider()
    const result = await provider.chat(buildCondenseMessages({ question: input.message, history }))
    await trackUsage({
        workspaceId: input.workspaceId,
        userId: input.userId,
        kind: "rewrite",
        model: provider.chatModel,
        usage: result.usage,
    })
    return result.text.trim() || input.message
}

export async function prepareChat(input: ChatInput): Promise<PreparedChat> {
    const askedAt = new Date()
    await assertWithinQuota(input.workspaceId)

    const existing = input.conversationId
        ? await findConversation(scopeOf(input), input.conversationId)
        : null
    if (input.conversationId && !existing) throw notFound("Conversation")

    const history = existing ? await listRecentMessages(existing.id, env.HISTORY_MESSAGES) : []
    const standaloneQuestion = await condenseQuestion(input, history)

    const retrieval = await retrieve(input.workspaceId, standaloneQuestion)
    await trackUsage({
        workspaceId: input.workspaceId,
        userId: input.userId,
        kind: "embedding",
        model: getLlmProvider().embeddingModel,
        usage: retrieval.usage,
    })

    // Created only now, after the steps that can fail, so failures don't leave empty conversations
    const conversation =
        existing ??
        (await createConversation(scopeOf(input), input.message.slice(0, TITLE_LENGTH).trim()))

    return {
        input,
        conversation,
        isNewConversation: !existing,
        askedAt,
        standaloneQuestion,
        candidates: toCitations(retrieval.chunks),
        llmMessages:
            retrieval.chunks.length > 0
                ? buildAnswerMessages({
                      question: standaloneQuestion,
                      history,
                      chunks: retrieval.chunks,
                  })
                : null,
        topScore: retrieval.topScore,
    }
}

/** Undo a prepared turn that will not be answered (client went away, or generation failed). */
export async function discardChat(prepared: PreparedChat): Promise<void> {
    if (prepared.isNewConversation) {
        await deleteConversation(scopeOf(prepared.input), prepared.conversation.id)
    }
}

/** True only when the whole answer is the no-answer reply, not when a real answer mentions it. */
const isNoAnswer = (text: string) => text.trim().startsWith(NO_ANSWER_TEXT.slice(0, -1))

/** Approximate usage for an answer that was cut short, so stopping early can't dodge the quota. */
function estimateUsage(messages: ChatMessage[], partialAnswer: string): TokenUsage {
    const promptTokens = messages.reduce((sum, m) => sum + countTokens(m.content), 0)
    const completionTokens = countTokens(partialAnswer)
    return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens }
}

/**
 * Asks the LLM (streaming when `onToken` is given). Returns the answer text, or the partial text
 * if `signal` aborted mid-stream. Token usage is recorded in every case, including failures.
 */
async function generateAnswer(
    prepared: PreparedChat,
    llmMessages: ChatMessage[],
    options: { onToken?: (delta: string) => void; signal?: AbortSignal },
): Promise<string> {
    const { input } = prepared
    const provider = getLlmProvider()
    const record = (usage: TokenUsage) =>
        trackUsage({
            workspaceId: input.workspaceId,
            userId: input.userId,
            kind: "chat",
            model: provider.chatModel,
            usage,
        })

    let partial = ""
    try {
        const result = options.onToken
            ? await provider.streamChat(llmMessages, {
                  signal: options.signal,
                  onToken: (delta) => {
                      partial += delta
                      options.onToken?.(delta)
                  },
              })
            : await provider.chat(llmMessages, { signal: options.signal })
        await record(result.usage)
        return result.text.trim() || NO_ANSWER_TEXT
    } catch (err) {
        await record(estimateUsage(llmMessages, partial))
        if (!options.signal?.aborted) throw err
        return partial.trim()
    }
}

/**
 * Generates the answer and saves question + answer. Returns the saved assistant message,
 * or null if the user stopped before any text arrived (then nothing is saved).
 */
export async function completeChat(
    prepared: PreparedChat,
    options: { onToken?: (delta: string) => void; signal?: AbortSignal } = {},
): Promise<Message | null> {
    const startedAt = Date.now()

    let answer: string
    try {
        if (options.signal?.aborted) {
            answer = "" // the client left before we started: don't pay for an answer nobody reads
        } else if (!prepared.llmMessages) {
            // Step 4: nothing relevant was retrieved. Skipping the LLM is cheaper AND cannot hallucinate.
            answer = NO_ANSWER_TEXT
            options.onToken?.(answer)
        } else {
            answer = await generateAnswer(prepared, prepared.llmMessages, options)
        }
    } catch (err) {
        await discardChat(prepared)
        throw err
    }

    if (!answer) {
        await discardChat(prepared)
        return null
    }

    const citations = isNoAnswer(answer) ? [] : selectCitedCitations(answer, prepared.candidates)
    const message = await addExchange(prepared.conversation.id, {
        question: { content: prepared.input.message, askedAt: prepared.askedAt },
        answer: { content: answer, citations },
    })

    logger.info(
        {
            conversationId: prepared.conversation.id,
            promptVersion: ANSWER_PROMPT_VERSION,
            retrieved: prepared.candidates.length,
            cited: citations.length,
            topScore: prepared.topScore,
            answered: !isNoAnswer(answer),
            stopped: options.signal?.aborted ?? false,
            ms: Date.now() - startedAt,
        },
        "Chat answer generated",
    )
    return message
}

/** Non-streaming chat: one request, one JSON response. */
export async function answerQuestion(input: ChatInput) {
    const prepared = await prepareChat(input)
    // Without an abort signal there is always an answer, so the message is never null here
    const message = (await completeChat(prepared)) as Message
    return {
        conversationId: prepared.conversation.id,
        standaloneQuestion: prepared.standaloneQuestion,
        message,
    }
}
