import request from "supertest"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

// env is read once per test file, so set the limits before the app is imported
vi.stubEnv("MONTHLY_TOKEN_QUOTA", "100")
vi.stubEnv("MAX_WORKSPACES_PER_USER", "2")
vi.stubEnv("MAX_SOURCES_PER_WORKSPACE", "1")
vi.stubEnv("RATE_LIMIT_AUTH_PER_MIN", "3")

const { createApp } = await import("../../src/app")
const { prisma } = await import("../../src/lib/prisma")
const { redis } = await import("../../src/lib/redis")
const { createTenant, resetDatabase, seedSource } = await import("../helpers/db")

const app = createApp()
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

beforeAll(async () => {
    // Rate-limit counters live in Redis for a minute; start every run from zero
    const keys = await redis.keys("rl:*")
    if (keys.length > 0) await redis.del(...keys)
})

beforeEach(resetDatabase)

describe("monthly token quota (cost control)", () => {
    it("blocks chat and new sources once the workspace has used its quota", async () => {
        const { token, workspace, user } = await createTenant()

        const usage = await request(app)
            .get(`/api/workspaces/${workspace.id}/usage`)
            .set(auth(token))
            .expect(200)
        expect(usage.body.data.monthlyQuota).toBe(100)

        await prisma.usageEvent.create({
            data: {
                workspaceId: workspace.id,
                userId: user.id,
                kind: "chat",
                model: "m",
                totalTokens: 100,
            },
        })

        const chat = await request(app)
            .post(`/api/workspaces/${workspace.id}/chat/stream`)
            .set(auth(token))
            .send({ message: "How long is vacation?" })
            .expect(429)
        // Rejected with a normal JSON error BEFORE the response switched to SSE
        expect(chat.body.code).toBe("QUOTA_EXCEEDED")

        await request(app)
            .post(`/api/workspaces/${workspace.id}/sources/url`)
            .set(auth(token))
            .send({ url: "https://8.8.8.8/" })
            .expect(429)
    })
})

describe("abuse limits", () => {
    it("caps workspaces per user", async () => {
        const { token } = await createTenant() // already owns 1 workspace

        await request(app)
            .post("/api/workspaces")
            .set(auth(token))
            .send({ name: "Two" })
            .expect(201)
        const third = await request(app)
            .post("/api/workspaces")
            .set(auth(token))
            .send({ name: "Three" })
            .expect(409)
        expect(third.body.code).toBe("LIMIT_REACHED")
    })

    it("caps sources per workspace", async () => {
        const { token, workspace } = await createTenant()
        await seedSource(workspace.id, "first.pdf", [{ content: "One source is the limit here." }])

        const response = await request(app)
            .post(`/api/workspaces/${workspace.id}/sources/url`)
            .set(auth(token))
            .send({ url: "https://8.8.8.8/" })
            .expect(409)
        expect(response.body.code).toBe("LIMIT_REACHED")
    })

    it("rate limits login attempts", async () => {
        const attempt = () =>
            request(app)
                .post("/api/auth/login")
                .send({ email: "nobody@test.dev", password: "wrong-password" })

        for (let i = 0; i < 3; i++) await attempt().expect(401)
        const blocked = await attempt().expect(429)
        expect(blocked.body.code).toBe("RATE_LIMITED")
    })
})

describe("health and unknown routes", () => {
    it("reports liveness and readiness", async () => {
        await request(app).get("/api/health").expect(200)
        const ready = await request(app).get("/api/health/ready").expect(200)
        expect(ready.body.data).toEqual({ database: true, redis: true })
    })

    it("returns a JSON 404 for unknown routes", async () => {
        const response = await request(app).get("/api/nope").expect(404)
        expect(response.body).toMatchObject({ success: false, code: "NOT_FOUND" })
    })
})
