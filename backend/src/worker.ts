import { Job, QueueEvents, UnrecoverableError, Worker } from "bullmq"
import { AppError, PermanentJobError } from "./lib/errors"
import { logger } from "./lib/logger"
import { prisma } from "./lib/prisma"
import { redis } from "./lib/redis"
import {
    INGESTION_QUEUE_NAME,
    ingestionQueue,
    type IngestionJobData,
} from "./queues/ingestion.queue"
import { updateSourceStatus } from "./repositories/source.repository"
import { ingestSource } from "./services/ingestion.service"

/**
 * The background worker: a separate process from the API, so heavy ingestion never slows
 * down chat requests. Run several copies to ingest faster (`docker compose up --scale worker=3`).
 */

const MAX_ERROR_LENGTH = 500
const GENERIC_FAILURE = "Processing failed. Please delete the source and try again."
const INTERRUPTED = "Processing was interrupted. Please delete the source and try again."

const worker = new Worker<IngestionJobData>(
    INGESTION_QUEUE_NAME,
    async (job) => {
        try {
            await ingestSource(job.data)
        } catch (err) {
            logger.error({ err, jobId: job.id, attempt: job.attemptsMade + 1 }, "Ingestion failed")
            // Errors we wrote for users (corrupt file, blocked URL...) are permanent: retrying won't
            // help, so UnrecoverableError tells BullMQ to stop. Their message is safe to show.
            const isRetryableAppError = err instanceof AppError && err.statusCode === 429
            if (
                err instanceof PermanentJobError ||
                (err instanceof AppError && !isRetryableAppError)
            ) {
                throw new UnrecoverableError(err.message.slice(0, MAX_ERROR_LENGTH))
            }
            // Anything else (DB, LLM rate limits, a bug) may be temporary, so BullMQ retries. Only
            // messages we wrote reach the UI; raw error details stay in our logs.
            const message = isRetryableAppError ? err.message : GENERIC_FAILURE
            throw new Error(message, { cause: err })
        }
    },
    { connection: redis, concurrency: 2 },
)

worker.on("error", (err) => logger.error({ err }, "Worker error"))

/**
 * Marks the source "failed" once its job has FINALLY failed (no retries left).
 * QueueEvents also reports jobs that "stalled" because a worker crashed or was killed mid-job:
 * those never reach the catch block above, and without this they would stay "processing" forever.
 */
const queueEvents = new QueueEvents(INGESTION_QUEUE_NAME, { connection: redis.duplicate() })

queueEvents.on("failed", async ({ jobId, failedReason }) => {
    try {
        const job = await Job.fromId<IngestionJobData>(ingestionQueue, jobId)
        if (!job || (await job.getState()) !== "failed") return // a retry is still scheduled
        await updateSourceStatus(job.data.workspaceId, job.data.sourceId, {
            status: "failed",
            error: failedReason.includes("stalled") ? INTERRUPTED : failedReason,
        })
    } catch (err) {
        logger.error({ err, jobId }, "Could not mark source as failed")
    }
})

logger.info("Ingestion worker started")

async function shutdown(signal: string) {
    logger.info({ signal }, "Shutting down worker")
    await worker.close() // waits for in-flight jobs to finish
    await queueEvents.close()
    await prisma.$disconnect()
    await redis.quit()
    process.exit(0)
}

process.on("SIGTERM", () => void shutdown("SIGTERM"))
process.on("SIGINT", () => void shutdown("SIGINT"))
