import { getEncoding } from "js-tiktoken"

// cl100k_base is the tokenizer used by OpenAI's text-embedding-3-* models.
const encoder = getEncoding("cl100k_base")

/** Exact token count for OpenAI embedding models; a close estimate for others. */
export function countTokens(text: string): number {
    return encoder.encode(text).length
}
