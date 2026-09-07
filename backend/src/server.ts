import { createApp } from "./app"
import { env } from "./config/env"
import { logger } from "./lib/logger"
import { prisma } from "./lib/prisma"
import { redis } from "./lib/redis"
import { ingestionQueue } from "./queues/ingestion.queue"

const app = createApp()

const server = app.listen(env.port, () => {
    logger.info(`Server is running on http://localhost:${env.port}`)
})

/** On SIGTERM (docker stop, deploys) finish in-flight requests, then close connections. */
function shutdown(signal: string) {
    logger.info({ signal }, "Shutting down API")
    server.close(async () => {
        await ingestionQueue.close()
        await prisma.$disconnect()
        await redis.quit()
        process.exit(0)
    })
    // Long SSE streams could keep the server open forever; give up after 10s
    setTimeout(() => process.exit(1), 10_000).unref()
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))
