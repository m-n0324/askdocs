import dotenv from "dotenv"
import { defineConfig, env } from "prisma/config"

dotenv.config({ quiet: true })

/**
 * Prisma CLI config (migrate, generate, studio).
 * The running app does NOT read this file: it connects through the pg driver adapter in src/lib/prisma.ts.
 */
export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: env("DATABASE_URL"),
    },
})
