import type { ChatMessage } from "../llm/provider"
import type { Message } from "../types/domain"

/**
 * condense-question.v1: turns a follow-up ("what about its price?") into a standalone
 * question ("What is the price of the Pro plan?") BEFORE retrieval.
 *
 * Why: we search the vector DB with the question's embedding. "what about its price?" on its
 * own has no idea what "its" means, so it would retrieve the wrong chunks.
 */

export const CONDENSE_PROMPT_VERSION = "condense-question.v1"

const MAX_TURN_CHARS = 500

export const CONDENSE_SYSTEM_PROMPT = `Rewrite the user's follow-up question as a standalone question that can be understood without the conversation.
- Replace pronouns and references ("it", "they", "that plan") with what they refer to in the conversation.
- Keep the original language and meaning. Do not add new information.
- Do NOT answer the question.
- If it is already standalone, return it unchanged.
Output only the rewritten question.`

export function buildCondenseMessages(input: {
    question: string
    history: Message[]
}): ChatMessage[] {
    const transcript = input.history
        .map(
            (m) =>
                `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, MAX_TURN_CHARS)}`,
        )
        .join("\n")

    return [
        { role: "system", content: CONDENSE_SYSTEM_PROMPT },
        {
            role: "user",
            content: `Conversation:\n${transcript}\n\nFollow-up question: ${input.question}`,
        },
    ]
}
