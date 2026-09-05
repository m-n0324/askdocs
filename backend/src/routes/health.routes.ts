import { Router } from "express"
import { prisma } from "../lib/prisma"
import { redis } from "../lib/redis"

const healthRouter = Router()

/** Liveness: the process is up. Polled by Docker every few seconds, so it logs nothing. */
healthRouter.get("/health", (_req, res) => {
    res.status(200).json({
        success: true,
        message: "Health Check: Health Router up and running",
    })
})

/** Readiness: the API can reach its dependencies. */
healthRouter.get("/health/ready", async (_req, res) => {
    const [database, cache] = await Promise.allSettled([prisma.$queryRaw`SELECT 1`, redis.ping()])
    const checks = {
        database: database.status === "fulfilled",
        redis: cache.status === "fulfilled",
    }
    const isReady = checks.database && checks.redis
    res.status(isReady ? 200 : 503).json({ success: isReady, data: checks })
})

export { healthRouter }
