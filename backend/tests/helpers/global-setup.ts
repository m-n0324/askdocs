import { execSync } from "node:child_process"
import { testEnv } from "./test-env"

/**
 * Runs once before the integration tests: bring the TEST database schema up to date.
 * (Global setup runs outside the test workers, so `test.env` is not applied here: pass it explicitly.)
 */
export default function setup(): void {
    execSync("pnpm exec prisma migrate deploy", {
        stdio: "pipe",
        env: { ...process.env, DATABASE_URL: testEnv.DATABASE_URL },
    })
}
