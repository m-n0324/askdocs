/**
 * An error we throw on purpose. The central error handler turns it into
 * a clean JSON response with the right status code. Anything that is NOT
 * an AppError is treated as a bug and becomes a generic 500.
 */
export class AppError extends Error {
    constructor(
        public readonly statusCode: number,
        public readonly code: string,
        message: string,
        public readonly details?: unknown,
    ) {
        super(message)
        this.name = "AppError"
    }
}

export const badRequest = (message: string, details?: unknown) =>
    new AppError(400, "VALIDATION_ERROR", message, details)

export const unauthorized = (message = "Authentication required") =>
    new AppError(401, "UNAUTHORIZED", message)

export const notFound = (what = "Resource") => new AppError(404, "NOT_FOUND", `${what} not found`)

export const conflict = (message: string) => new AppError(409, "CONFLICT", message)

/** The LLM vendor is throttling us (typical on free tiers), even after automatic retries. */
export const providerRateLimited = () =>
    new AppError(
        429,
        "PROVIDER_RATE_LIMITED",
        "The AI provider is limiting requests right now (free-tier quota). Please try again in a minute.",
    )

/** The configured model doesn't exist or was retired: an admin must update the model setting. */
export const providerUnavailable = () =>
    new AppError(
        503,
        "PROVIDER_UNAVAILABLE",
        "The AI model is not available right now. The server's model settings may need updating.",
    )

/**
 * A background-job failure that retrying cannot fix (corrupt file, no text, blocked by robots.txt).
 * The worker skips the remaining retries and marks the source as failed right away.
 */
export class PermanentJobError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "PermanentJobError"
    }
}
