import type { Request, Response } from "express"
import { AppError } from "../lib/errors"
import { logger } from "../lib/logger"
import { sendData } from "../lib/response"
import { getUserId } from "../middlewares/auth"
import { getWorkspace } from "../middlewares/workspace"
import { chatSchema } from "../schemas"
import {
    answerQuestion,
    completeChat,
    discardChat,
    prepareChat,
    type ChatInput,
} from "../services/chat.service"
import { sendSseEvent, startSse } from "../utils/sse"

const toChatInput = (req: Request): ChatInput => ({
    ...chatSchema.parse(req.body),
    workspaceId: getWorkspace(req).id,
    userId: getUserId(req),
})

/** POST /chat: waits for the full answer and returns it as JSON. */
export async function chatHandler(req: Request, res: Response): Promise<void> {
    sendData(res, await answerQuestion(toChatInput(req)))
}

/**
 * POST /chat/stream: same answer, delivered token by token over Server-Sent Events.
 *
 * Event order: meta -> citations -> token (many) -> done   (or `error` at any point after meta)
 *
 * Everything that can fail with a normal HTTP error (validation, quota, unknown conversation)
 * happens in `prepareChat` BEFORE we switch to SSE, so the client still gets a proper status code.
 */
export async function streamChatHandler(req: Request, res: Response): Promise<void> {
    // If the user closes the tab or presses "Stop" (even during retrieval), stop paying for tokens
    // nobody will read. Registered first, so a disconnect at any point is noticed.
    const abort = new AbortController()
    res.on("close", () => {
        if (!res.writableFinished) abort.abort()
    })

    const prepared = await prepareChat(toChatInput(req))
    if (abort.signal.aborted) {
        await discardChat(prepared)
        return
    }

    startSse(res)
    sendSseEvent(res, "meta", {
        conversationId: prepared.conversation.id,
        standaloneQuestion: prepared.standaloneQuestion,
    })
    sendSseEvent(res, "citations", { citations: prepared.candidates })

    try {
        const message = await completeChat(prepared, {
            signal: abort.signal,
            onToken: (delta) => sendSseEvent(res, "token", { delta }),
        })
        if (message) sendSseEvent(res, "done", { message })
    } catch (err) {
        logger.error({ err, conversationId: prepared.conversation.id }, "Streaming chat failed")
        // Messages we wrote (e.g. "rate limit reached") are safe and useful; anything else stays generic
        const message =
            err instanceof AppError
                ? err.message
                : "Something went wrong while generating the answer."
        sendSseEvent(res, "error", { message })
    } finally {
        res.end()
    }
}
