import dotenv from "dotenv"
import { defineConfig } from "prisma/config"

dotenv.config({ quiet: true })

/**
 * Prisma CLI config (migrate, generate, studio).
 * The running app does NOT read this file: it connects through the pg driver adapter in src/lib/prisma.ts.
 *
 * DATABASE_URL may be missing: `prisma generate` (run by `pnpm install`) doesn't need a database,
 * so installing works before backend/.env exists. Commands that do need it (migrate, studio)
 * fail with a clear "datasource url" error instead.
 */
export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: process.env.DATABASE_URL ?? "",
    },
})
