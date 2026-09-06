import os from "node:os"
import path from "node:path"

/**
 * Environment for the test run. Tests never touch your dev data:
 * - a separate database (askdocs_test, created by docker/postgres/init)
 * - Redis database #1 instead of #0, so a running dev worker never picks up test jobs
 * - the fake LLM provider, so tests are free, offline, and deterministic
 */
export const testEnv = {
    NODE_ENV: "test",
    DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? "postgresql://askdocs:askdocs@localhost:5433/askdocs_test",
    REDIS_URL: process.env.TEST_REDIS_URL ?? "redis://:askdocs@localhost:6379/1",
    JWT_SECRET: "test-secret-that-is-at-least-32-characters-long",
    LLM_PROVIDER: "fake",
    UPLOAD_DIR: path.join(os.tmpdir(), "askdocs-test-uploads"),
    MIN_RELEVANCE_SCORE: "0.2",
    MONTHLY_TOKEN_QUOTA: "0",
    // High limits so the suite itself is never rate limited
    RATE_LIMIT_API_PER_MIN: "10000",
    RATE_LIMIT_AUTH_PER_MIN: "10000",
    RATE_LIMIT_CHAT_PER_MIN: "10000",
    RATE_LIMIT_UPLOAD_PER_MIN: "10000",
}
