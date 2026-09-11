import { maximalMarginalRelevance } from "@langchain/core/utils/math"
import { env } from "../config/env"
import { getLlmProvider } from "../llm"
import type { TokenUsage } from "../llm/provider"
import { searchSimilarChunks } from "../repositories/chunk.repository"
import type { RetrievedChunk } from "../types/domain"

/**
 * RETRIEVAL in three steps:
 *
 * 1. Embed the question: the same model that embedded the chunks turns the question into a vector.
 * 2. Similarity search: ask Postgres for the RETRIEVAL_CANDIDATES (20) closest chunks in THIS workspace.
 *    "Closest" = highest cosine similarity = pointing in the most similar direction = similar meaning.
 * 3. Filter + re-rank:
 *    - drop candidates below MIN_RELEVANCE_SCORE: if nothing is left, the honest answer is "I don't know".
 *    - re-rank with MMR (Maximal Marginal Relevance) and keep the best RETRIEVAL_TOP_K (5).
 *
 * Why MMR? Plain top-5 often returns 5 near-identical chunks (the same paragraph from overlapping
 * chunks, or a repeated header). MMR picks each next chunk by balancing "relevant to the question"
 * against "different from what I already picked":
 *     score = λ · sim(question, chunk) − (1 − λ) · max sim(chunk, already-picked)
 * λ = 0.7 leans towards relevance. It costs no API calls: we reuse the vectors we already have.
 * A cross-encoder or LLM re-ranker would judge relevance better but adds latency and cost.
 * See docs/ARCHITECTURE.md for that trade-off.
 */

export interface RetrievalOptions {
    candidates: number
    topK: number
    minScore: number
    lambda: number
}

export interface RetrievalResult {
    chunks: RetrievedChunk[]
    topScore: number
    usage: TokenUsage
}

const defaultOptions = (): RetrievalOptions => ({
    candidates: env.RETRIEVAL_CANDIDATES,
    topK: env.RETRIEVAL_TOP_K,
    minScore: env.MIN_RELEVANCE_SCORE,
    lambda: env.MMR_LAMBDA,
})

export function rerankWithMmr(
    queryEmbedding: number[],
    candidates: RetrievedChunk[],
    topK: number,
    lambda: number,
): RetrievedChunk[] {
    const k = Math.min(topK, candidates.length)
    if (k === 0) return []
    const picked = maximalMarginalRelevance(
        queryEmbedding,
        candidates.map((candidate) => candidate.embedding),
        lambda,
        k,
    )
    return picked.map((index) => candidates[index])
}

export async function retrieve(
    workspaceId: string,
    question: string,
    options: RetrievalOptions = defaultOptions(),
): Promise<RetrievalResult> {
    const { vectors, usage } = await getLlmProvider().embed([question], "query")
    const queryEmbedding = vectors[0]

    const candidates = await searchSimilarChunks(workspaceId, queryEmbedding, options.candidates)
    const relevant = candidates.filter((candidate) => candidate.score >= options.minScore)

    return {
        chunks: rerankWithMmr(queryEmbedding, relevant, options.topK, options.lambda),
        topScore: candidates[0]?.score ?? 0,
        usage,
    }
}
