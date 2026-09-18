import { Document } from "@langchain/core/documents"
import fs from "node:fs/promises"
import path from "node:path"
import { env } from "../config/env"
import { prisma } from "../lib/prisma"
import { redis } from "../lib/redis"
import { getLlmProvider } from "../llm"
import { replaceChunksForSource } from "../repositories/chunk.repository"
import { createFileSource } from "../repositories/source.repository"
import { createUser } from "../repositories/user.repository"
import { createWorkspace } from "../repositories/workspace.repository"
import { chunkDocuments } from "../services/chunking.service"
import { retrieve } from "../services/retrieval.service"
import type { ChunkMetadata, RetrievedChunk } from "../types/domain"

/**
 * Retrieval evaluation: "when someone asks X, do we fetch the passage that answers X?"
 *
 * The answer can only be as good as the retrieved context, so this measures retrieval on its own:
 *   - hit rate@1:  the correct page is the FIRST chunk returned
 *   - hit rate@k:  the correct page is anywhere in the top k chunks sent to the LLM
 *   - MRR:         mean reciprocal rank: 1 if first, 1/2 if second, ... 0 if missing
 *   - no-answer accuracy: for questions the documents can't answer, did retrieval return
 *     nothing (so the app says "I don't know" instead of guessing)?
 *
 * It ingests eval/dataset.json into a throwaway workspace, runs every question through the real
 * retrieval code, prints a report, saves eval/results/latest-<provider>.json, and deletes the workspace.
 *
 *   pnpm eval                       # uses LLM_PROVIDER from .env (use "openai" for real numbers)
 */

const DATASET_PATH = path.resolve(__dirname, "../../eval/dataset.json")
const RESULTS_DIR = path.resolve(__dirname, "../../eval/results")

interface Dataset {
    documents: { name: string; pages: string[] }[]
    questions: { question: string; source: string | null; page: number | null }[]
}

interface QuestionResult {
    question: string
    expected: string
    rank: number | null // 1-based position of the correct chunk, null if not retrieved
    retrieved: string[]
    topScore: number
}

const describeChunk = (chunk: RetrievedChunk) =>
    `${chunk.sourceName} p.${chunk.metadata.page ?? "?"}`

async function ingestDataset(workspaceId: string, dataset: Dataset): Promise<number> {
    const provider = getLlmProvider()
    let totalChunks = 0
    for (const document of dataset.documents) {
        const source = await createFileSource({
            workspaceId,
            name: document.name,
            storageKey: `eval/${document.name}`,
            mimeType: "application/pdf",
            sizeBytes: 0,
        })
        const pages = document.pages.map(
            (text, i) =>
                new Document<ChunkMetadata>({ pageContent: text, metadata: { page: i + 1 } }),
        )
        const chunks = await chunkDocuments(pages)
        const { vectors } = await provider.embed(
            chunks.map((chunk) => chunk.content),
            "document",
        )
        await replaceChunksForSource(
            workspaceId,
            source.id,
            chunks.map((chunk, i) => ({ ...chunk, embedding: vectors[i] })),
        )
        totalChunks += chunks.length
    }
    return totalChunks
}

async function evaluate(workspaceId: string, dataset: Dataset): Promise<QuestionResult[]> {
    const results: QuestionResult[] = []
    for (const item of dataset.questions) {
        const { chunks, topScore } = await retrieve(workspaceId, item.question)
        const index = chunks.findIndex(
            (chunk) => chunk.sourceName === item.source && chunk.metadata.page === item.page,
        )
        results.push({
            question: item.question,
            expected: item.source ? `${item.source} p.${item.page}` : "(no answer)",
            rank: index === -1 ? null : index + 1,
            retrieved: chunks.map(describeChunk),
            topScore: Math.round(topScore * 1000) / 1000,
        })
    }
    return results
}

function summarize(results: QuestionResult[]) {
    const answerable = results.filter((r) => r.expected !== "(no answer)")
    const unanswerable = results.filter((r) => r.expected === "(no answer)")
    const ratio = (count: number, total: number) =>
        total === 0 ? 0 : Math.round((count / total) * 1000) / 1000

    return {
        questions: results.length,
        hitRateAt1: ratio(answerable.filter((r) => r.rank === 1).length, answerable.length),
        hitRateAtK: ratio(answerable.filter((r) => r.rank !== null).length, answerable.length),
        mrr: ratio(
            answerable.reduce((sum, r) => sum + (r.rank ? 1 / r.rank : 0), 0),
            answerable.length,
        ),
        noAnswerAccuracy: ratio(
            unanswerable.filter((r) => r.retrieved.length === 0).length,
            unanswerable.length,
        ),
    }
}

async function main() {
    const dataset = JSON.parse(await fs.readFile(DATASET_PATH, "utf8")) as Dataset
    const provider = getLlmProvider()

    // A throwaway tenant, so evaluation never touches real data. Deleting the user cascades to everything.
    const user = await createUser({
        name: "eval",
        email: `eval-${Date.now()}@askdocs.local`,
        passwordHash: "not-a-real-hash",
    })
    try {
        const workspace = await createWorkspace(user.id, "Evaluation")
        const chunkCount = await ingestDataset(workspace.id, dataset)
        const results = await evaluate(workspace.id, dataset)
        const summary = summarize(results)

        const report = {
            ranAt: new Date().toISOString(),
            config: {
                provider: env.LLM_PROVIDER,
                embeddingModel: provider.embeddingModel,
                chunkSize: env.CHUNK_SIZE,
                chunkOverlap: env.CHUNK_OVERLAP,
                candidates: env.RETRIEVAL_CANDIDATES,
                topK: env.RETRIEVAL_TOP_K,
                mmrLambda: env.MMR_LAMBDA,
                minRelevanceScore: env.MIN_RELEVANCE_SCORE,
                chunks: chunkCount,
            },
            summary,
            results,
        }

        process.stdout.write("\nPer question (rank of the correct page, or ✗):\n")
        for (const r of results) {
            const mark =
                r.expected === "(no answer)"
                    ? r.retrieved.length === 0
                        ? "✓ none"
                        : "✗ found"
                    : (r.rank ?? "✗")
            process.stdout.write(
                `  ${String(mark).padEnd(8)} ${r.question}  [top score ${r.topScore}]\n`,
            )
        }
        process.stdout.write(`\nSummary: ${JSON.stringify(summary, null, 2)}\n`)

        // One file per provider, so fake (keyword) numbers never get mistaken for real ones
        const resultsPath = path.join(RESULTS_DIR, `latest-${env.LLM_PROVIDER}.json`)
        await fs.mkdir(RESULTS_DIR, { recursive: true })
        await fs.writeFile(resultsPath, JSON.stringify(report, null, 2) + "\n")
        process.stdout.write(`Saved ${path.relative(process.cwd(), resultsPath)}\n`)
    } finally {
        await prisma.user.delete({ where: { id: user.id } })
        await prisma.$disconnect()
        await redis.quit()
    }
}

main().catch((err) => {
    process.stderr.write(`Evaluation failed: ${(err as Error).stack}\n`)
    process.exit(1)
})
