import { Queue } from "bullmq"
import { redis } from "../lib/redis"

/**
 * Why a queue? Parsing + embedding a big PDF can take a minute. Doing it inside the upload
 * request would make the user wait and could time out. Instead the API saves the file,
 * puts a small job in Redis, and answers immediately with status "pending".
 * A separate worker process (src/worker.ts) picks the job up. If it crashes, BullMQ retries.
 */

export const INGESTION_QUEUE_NAME = "ingestion"

export interface IngestionJobData {
    workspaceId: string
    sourceId: string
}

export const INGESTION_JOB_ATTEMPTS = 3

export const ingestionQueue = new Queue<IngestionJobData>(INGESTION_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
        attempts: INGESTION_JOB_ATTEMPTS,
        backoff: { type: "exponential", delay: 5_000 }, // 5s, 10s, 20s
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
    },
})

export async function enqueueIngestion(data: IngestionJobData): Promise<void> {
    // jobId = sourceId: adding the same source twice is a no-op instead of a duplicate job
    await ingestionQueue.add("ingest-source", data, { jobId: data.sourceId })
}

/** Best effort: a job that already started cannot be removed, and that is fine. */
export async function removeIngestionJob(sourceId: string): Promise<void> {
    await ingestionQueue.remove(sourceId)
}
