import pino from "pino"
import { env } from "../config/env"

/**
 * Default logger that needs to be used for all log related work.
 * Pretty output in development, JSON lines in production (easy to ship to CloudWatch etc).
 */
export const logger = pino({
    level: env.isTest ? "silent" : env.logLevel,
    redact: ["req.headers.authorization", "password", "*.password"],
    transport:
        env.nodeEnv === "development"
            ? {
                  target: "pino-pretty",
                  options: {
                      colorize: true,
                      translateTime: "SYS:standard",
                  },
              }
            : undefined,
})
