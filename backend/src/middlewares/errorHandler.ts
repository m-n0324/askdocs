import type { NextFunction, Request, Response } from "express"
import { MulterError } from "multer"
import { ZodError } from "zod"
import { AppError } from "../lib/errors"
import { logger } from "../lib/logger"

interface ErrorBody {
    success: false
    code: string
    message: string
    details?: unknown
}

/** Errors thrown by express.json() carry a `type` field. */
const bodyParserErrorType = (err: unknown): string | undefined =>
    typeof err === "object" && err !== null && "type" in err && typeof err.type === "string"
        ? err.type
        : undefined

/**
 * Express and body-parser mark errors that are the CLIENT's fault (e.g. an unsupported charset)
 * with a 4xx `status` and `expose: true`. Those are safe to pass through instead of a 500.
 */
function exposedClientStatus(err: unknown): number | null {
    if (typeof err !== "object" || err === null || !("expose" in err) || err.expose !== true) {
        return null
    }
    const status = "status" in err ? Number(err.status) : NaN
    return status >= 400 && status < 500 ? status : null
}

function toResponse(err: unknown): { status: number; body: ErrorBody } {
    if (err instanceof AppError) {
        return {
            status: err.statusCode,
            body: { success: false, code: err.code, message: err.message, details: err.details },
        }
    }
    if (err instanceof ZodError) {
        return {
            status: 400,
            body: {
                success: false,
                code: "VALIDATION_ERROR",
                message: err.issues[0]?.message ?? "Invalid request",
                details: err.issues.map((issue) => ({
                    path: issue.path.join("."),
                    message: issue.message,
                })),
            },
        }
    }
    if (err instanceof MulterError) {
        const tooLarge = err.code === "LIMIT_FILE_SIZE"
        return {
            status: tooLarge ? 413 : 400,
            body: {
                success: false,
                code: tooLarge ? "PAYLOAD_TOO_LARGE" : "VALIDATION_ERROR",
                message: tooLarge ? "File is too large" : err.message,
            },
        }
    }
    const parserError = bodyParserErrorType(err)
    if (parserError === "entity.parse.failed") {
        return {
            status: 400,
            body: { success: false, code: "VALIDATION_ERROR", message: "Malformed JSON body" },
        }
    }
    if (parserError === "entity.too.large") {
        return {
            status: 413,
            body: {
                success: false,
                code: "PAYLOAD_TOO_LARGE",
                message: "Request body is too large",
            },
        }
    }
    const clientStatus = exposedClientStatus(err)
    if (clientStatus) {
        return {
            status: clientStatus,
            body: { success: false, code: "VALIDATION_ERROR", message: (err as Error).message },
        }
    }
    return {
        status: 500,
        body: { success: false, code: "INTERNAL_ERROR", message: "Internal Server Error" },
    }
}

/**
 * The single place where errors become HTTP responses. Express 5 forwards errors thrown in
 * async handlers here automatically. Unexpected errors are logged in full but the client only
 * sees a generic message, so stack traces and SQL never leak.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
    const { status, body } = toResponse(err)

    if (status >= 500) {
        logger.error({ err, method: req.method, path: req.originalUrl }, "Unhandled Exception")
    }

    if (res.headersSent) {
        // e.g. an SSE stream already started: we can't send a JSON error anymore
        res.end()
        return
    }
    res.status(status).json(body)
}
