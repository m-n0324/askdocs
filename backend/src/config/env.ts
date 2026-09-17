import dotenv from "dotenv"
import { z } from "zod"

dotenv.config({ quiet: true })

/**
 * All configuration comes from environment variables and is validated once at startup.
 * If something required is missing we crash immediately with a clear message,
 * instead of failing later in the middle of a request.
 */
const envSchema = z
    .object({
        NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
        PORT: z.coerce.number().int().positive().default(8080),
        DEFAULT_LOG_LEVEL: z.string().default("info"),
        TRUST_PROXY: z.coerce.number().int().min(0).default(0),
        CORS_ORIGIN: z.string().default("http://localhost:3000"),

        DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
        REDIS_URL: z.string().default("redis://localhost:6379"),

        JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
        JWT_EXPIRES_IN: z.string().default("7d"),

        // "gemini" has a free tier (keys at aistudio.google.com); "fake" is offline canned answers,
        // for tests
        LLM_PROVIDER: z.enum(["openai", "gemini", "fake"]).default("openai"),
        OPENAI_API_KEY: z.string().optional(),
        OPENAI_CHAT_MODEL: z.string().default("gpt-4.1-mini"),
        OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
        GEMINI_API_KEY: z.string().optional(),
        // Flash-Lite answers in ~1s and streams. Full "Flash" models think silently first
        // (10-30s, ~8x the tokens) and have a much smaller free quota. The "-latest" alias follows
        // Google's current model, so retiring an old version doesn't break the app.
        GEMINI_CHAT_MODEL: z.string().default("gemini-flash-lite-latest"),
        GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
        // A hung LLM request would otherwise hold an SSE connection open for minutes
        LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),

        UPLOAD_DIR: z.string().default("./uploads"),
        MAX_UPLOAD_MB: z.coerce.number().positive().default(10),

        CHUNK_SIZE: z.coerce.number().int().positive().default(1000),
        CHUNK_OVERLAP: z.coerce.number().int().min(0).default(150),
        RETRIEVAL_CANDIDATES: z.coerce.number().int().positive().default(20),
        RETRIEVAL_TOP_K: z.coerce.number().int().positive().default(5),
        MMR_LAMBDA: z.coerce.number().min(0).max(1).default(0.7),
        MIN_RELEVANCE_SCORE: z.coerce.number().min(0).max(1).default(0.3),
        HISTORY_MESSAGES: z.coerce.number().int().min(0).default(6),

        CRAWL_MAX_DEPTH: z.coerce.number().int().min(0).default(2),
        CRAWL_MAX_PAGES: z.coerce.number().int().positive().default(20),

        RATE_LIMIT_API_PER_MIN: z.coerce.number().int().positive().default(300),
        RATE_LIMIT_AUTH_PER_MIN: z.coerce.number().int().positive().default(10),
        RATE_LIMIT_CHAT_PER_MIN: z.coerce.number().int().positive().default(20),
        RATE_LIMIT_UPLOAD_PER_MIN: z.coerce.number().int().positive().default(10),

        // Cost and abuse limits. MONTHLY_TOKEN_QUOTA is per workspace; 0 means "no quota".
        MONTHLY_TOKEN_QUOTA: z.coerce.number().int().min(0).default(1_000_000),
        MAX_WORKSPACES_PER_USER: z.coerce.number().int().positive().default(10),
        MAX_SOURCES_PER_WORKSPACE: z.coerce.number().int().positive().default(100),
        MAX_CHUNKS_PER_SOURCE: z.coerce.number().int().positive().default(2000),
    })
    .superRefine((value, ctx) => {
        if (value.LLM_PROVIDER === "openai" && !value.OPENAI_API_KEY) {
            ctx.addIssue({
                code: "custom",
                path: ["OPENAI_API_KEY"],
                message: "OPENAI_API_KEY is required when LLM_PROVIDER=openai",
            })
        }
        if (value.LLM_PROVIDER === "gemini" && !value.GEMINI_API_KEY) {
            ctx.addIssue({
                code: "custom",
                path: ["GEMINI_API_KEY"],
                message: "GEMINI_API_KEY is required when LLM_PROVIDER=gemini",
            })
        }
        if (value.CHUNK_OVERLAP >= value.CHUNK_SIZE) {
            ctx.addIssue({
                code: "custom",
                path: ["CHUNK_OVERLAP"],
                message: "CHUNK_OVERLAP must be smaller than CHUNK_SIZE",
            })
        }
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
