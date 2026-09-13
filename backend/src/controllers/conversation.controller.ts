import type { Request, Response } from "express"
import { sendData } from "../lib/response"
import { getUserId } from "../middlewares/auth"
import { getWorkspace } from "../middlewares/workspace"
import { parseId } from "../schemas"
import {
    getConversationWithMessages,
    getConversations,
    removeConversation,
} from "../services/conversation.service"

const scopeOf = (req: Request) => ({ workspaceId: getWorkspace(req).id, userId: getUserId(req) })

export async function listConversationsHandler(req: Request, res: Response): Promise<void> {
    sendData(res, await getConversations(scopeOf(req)))
}

export async function getConversationHandler(req: Request, res: Response): Promise<void> {
    const conversationId = parseId(req.params.conversationId, "Conversation")
    sendData(res, await getConversationWithMessages(scopeOf(req), conversationId))
}

export async function deleteConversationHandler(req: Request, res: Response): Promise<void> {
    await removeConversation(scopeOf(req), parseId(req.params.conversationId, "Conversation"))
    sendData(res, { deleted: true })
}
