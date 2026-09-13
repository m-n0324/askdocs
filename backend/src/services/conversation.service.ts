import { notFound } from "../lib/errors"
import {
    deleteConversation,
    findConversation,
    listConversations,
    listMessages,
} from "../repositories/conversation.repository"
import type { Conversation, Message } from "../types/domain"

interface Scope {
    workspaceId: string
    userId: string
}

export const getConversations = (scope: Scope): Promise<Conversation[]> => listConversations(scope)

export async function getConversationWithMessages(
    scope: Scope,
    conversationId: string,
): Promise<{ conversation: Conversation; messages: Message[] }> {
    const conversation = await findConversation(scope, conversationId)
    if (!conversation) throw notFound("Conversation")
    return { conversation, messages: await listMessages(conversation.id) }
}

export async function removeConversation(scope: Scope, conversationId: string): Promise<void> {
    if (!(await deleteConversation(scope, conversationId))) throw notFound("Conversation")
}
