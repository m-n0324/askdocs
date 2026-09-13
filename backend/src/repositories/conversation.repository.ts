import type { Message as MessageRow } from "../generated/prisma/client"
import { prisma } from "../lib/prisma"
import type { Citation, Conversation, Message } from "../types/domain"

const toConversation = (row: {
    id: string
    title: string
    createdAt: Date
    updatedAt: Date
}): Conversation => ({
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
})

const toMessage = (row: MessageRow): Message => ({
    id: row.id,
    role: row.role,
    content: row.content,
    citations: row.citations as unknown as Citation[],
    createdAt: row.createdAt.toISOString(),
})

// Safety caps so one request can never load an unbounded number of rows
const MAX_LISTED_CONVERSATIONS = 100
const MAX_LISTED_MESSAGES = 500

/** Conversations are private to the user who started them, inside one workspace. */
interface Scope {
    workspaceId: string
    userId: string
}

export async function createConversation(scope: Scope, title: string): Promise<Conversation> {
    return toConversation(await prisma.conversation.create({ data: { ...scope, title } }))
}

export async function listConversations(scope: Scope): Promise<Conversation[]> {
    const rows = await prisma.conversation.findMany({
        where: scope,
        orderBy: { updatedAt: "desc" },
        take: MAX_LISTED_CONVERSATIONS,
    })
    return rows.map(toConversation)
}

export async function findConversation(
    scope: Scope,
    conversationId: string,
): Promise<Conversation | null> {
    const row = await prisma.conversation.findFirst({ where: { ...scope, id: conversationId } })
    return row ? toConversation(row) : null
}

export async function deleteConversation(scope: Scope, conversationId: string): Promise<boolean> {
    const { count } = await prisma.conversation.deleteMany({
        where: { ...scope, id: conversationId },
    })
    return count > 0
}

/** Callers must have checked the conversation belongs to the current scope. */
export async function listMessages(conversationId: string): Promise<Message[]> {
    const rows = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "asc" },
        take: MAX_LISTED_MESSAGES,
    })
    return rows.map(toMessage)
}

/** The most recent `limit` messages, returned oldest-first so they read like a transcript. */
export async function listRecentMessages(
    conversationId: string,
    limit: number,
): Promise<Message[]> {
    if (limit === 0) return []
    const rows = await prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        take: limit,
    })
    return rows.reverse().map(toMessage)
}

/**
 * Saves one question + answer pair in a single transaction, and bumps the conversation so it
 * sorts to the top of the list. Saving both together means a failed answer never leaves a
 * question without a reply in the history.
 * Explicit timestamps keep the order right (inside one transaction, the DB's now() is identical).
 */
export async function addExchange(
    conversationId: string,
    exchange: {
        question: { content: string; askedAt: Date }
        answer: { content: string; citations: Citation[] }
    },
): Promise<Message> {
    const [, answerRow] = await prisma.$transaction([
        prisma.message.create({
            data: {
                conversationId,
                role: "user",
                content: exchange.question.content,
                createdAt: exchange.question.askedAt,
            },
        }),
        prisma.message.create({
            data: {
                conversationId,
                role: "assistant",
                content: exchange.answer.content,
                citations: exchange.answer.citations.map((citation) => ({ ...citation })),
                createdAt: new Date(),
            },
        }),
        prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
        }),
    ])
    return toMessage(answerRow)
}
