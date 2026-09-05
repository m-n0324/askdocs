import { Redis } from "ioredis"
import { env } from "../config/env"
import { logger } from "./logger"

/**
 * Shared Redis connection, used by the BullMQ queue and the rate limiter.
 * BullMQ requires `maxRetriesPerRequest: null` so blocking commands are never cut off.
 */
export const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })

redis.on("error", (err) => logger.error({ err }, "Redis connection error"))
