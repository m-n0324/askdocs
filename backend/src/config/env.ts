import dotenv from "dotenv"
import { z } from "zod"

dotenv.config({ quiet: true })

/**
 * All configuration comes from environment variables and is validated once at startup.
 * If something required is missing we crash immediately with a clear message,
 * instead of failing later in the middle of a request.
 */
const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(8080),
    DEFAULT_LOG_LEVEL: z.string().default("info"),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    CORS_ORIGIN: z.string().default("http://localhost:3000"),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
    // The logger depends on env, so plain console is the only option here.
    console.error("Invalid environment configuration:\n" + z.prettifyError(parsed.error))
    process.exit(1)
}

const raw = parsed.data

export const env = {
    ...raw,
    port: raw.PORT,
    nodeEnv: raw.NODE_ENV,
    isProduction: raw.NODE_ENV === "production",
    isTest: raw.NODE_ENV === "test",
    logLevel: raw.DEFAULT_LOG_LEVEL,
} as const
