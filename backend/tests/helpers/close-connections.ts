import { afterAll } from "vitest"

// Close open connections after each test file so the test process can exit cleanly.
// Imported lazily: importing at the top would load src/config/env before a test file
// has a chance to adjust process.env (see quota-and-health.test.ts).
afterAll(async () => {
    const { ingestionQueue } = await import("../../src/queues/ingestion.queue")
    const { prisma } = await import("../../src/lib/prisma")
    const { redis } = await import("../../src/lib/redis")
    await ingestionQueue.close()
    await prisma.$disconnect()
    await redis.quit()
})
