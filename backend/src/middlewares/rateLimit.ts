import type { Request } from "express"
import { ipKeyGenerator, rateLimit } from "express-rate-limit"
import { RedisStore, type RedisReply } from "rate-limit-redis"
import { env } from "../config/env"
import { redis } from "../lib/redis"

/**
 * Rate limits live in Redis (not in process memory) so they hold across restarts and across
 * several API containers. Anonymous routes are limited per IP; logged-in routes per user.
 */

const ONE_MINUTE_MS = 60_000
const FIFTEEN_MINUTES_MS = 15 * ONE_MINUTE_MS

type KeyBy = "ip" | "user" | "email"

function keyFor(req: Request, keyBy: KeyBy): string {
    if (keyBy === "user" && req.userId) return `user:${req.userId}`
    if (keyBy === "email" && typeof req.body?.email === "string") {
        return `email:${req.body.email.trim().toLowerCase()}`
    }
    return ipKeyGenerator(req.ip ?? "")
}

function createLimiter(name: string, limit: number, keyBy: KeyBy, windowMs = ONE_MINUTE_MS) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: "draft-8", // sends RateLimit-* headers so clients can back off
        legacyHeaders: false,
        keyGenerator: (req: Request) => keyFor(req, keyBy),
        store: new RedisStore({
            prefix: `rl:${name}:`,
            sendCommand: (command: string, ...args: string[]) =>
                redis.call(command, ...args) as Promise<RedisReply>,
        }),
        handler: (_req, res) => {
            res.status(429).json({
                success: false,
                code: "RATE_LIMITED",
                message: "Too many requests. Please slow down and try again later.",
            })
        },
    })
}

/** Login/signup: low limit per IP to slow down password guessing. */
export const authLimiter = createLimiter("auth", env.RATE_LIMIT_AUTH_PER_MIN, "ip")

/** Login per target email: stops guessing ONE account's password from many IPs at once. */
export const loginEmailLimiter = createLimiter(
    "login-email",
    env.RATE_LIMIT_AUTH_PER_MIN,
    "email",
    FIFTEEN_MINUTES_MS,
)

/** Every API call by a logged-in user. */
export const apiLimiter = createLimiter("api", env.RATE_LIMIT_API_PER_MIN, "user")

/** Uploads are held in memory and cost embedding tokens, so they get a tight limit. */
export const uploadLimiter = createLimiter("upload", env.RATE_LIMIT_UPLOAD_PER_MIN, "user")

/** Chat calls the LLM, the expensive part, so it gets its own tighter limit. */
export const chatLimiter = createLimiter("chat", env.RATE_LIMIT_CHAT_PER_MIN, "user")
