import cors from "cors"
import express from "express"
import helmet from "helmet"
import { pinoHttp } from "pino-http"
import { env } from "./config/env"
import { logger } from "./lib/logger"
import { errorHandler } from "./middlewares/errorHandler"
import { notFound } from "./middlewares/notFound"
import { apiRouter } from "./routes"

export function createApp() {
    const app = express()

    // Behind nginx, trust X-Forwarded-For so req.ip (used by the rate limiter) is the real client
    app.set("trust proxy", env.TRUST_PROXY)

    app.use(helmet())
    app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()) }))
    app.use(express.json({ limit: "100kb" }))
    app.use(express.urlencoded({ extended: true, limit: "100kb" }))

    // One structured log line per request, with method, url, status, and duration
    app.use(
        pinoHttp({
            logger,
            autoLogging: { ignore: (req) => req.url?.startsWith("/api/health") ?? false },
        }),
    )

    // Routes
    app.use("/api", apiRouter)

    // 404 Handler
    app.use(notFound)

    // Global Error Handler
    app.use(errorHandler)

    return app
}
