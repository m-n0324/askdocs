import request from "supertest"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createApp } from "../../src/app"
import { providerRateLimited } from "../../src/lib/errors"
import { prisma } from "../../src/lib/prisma"
import { FakeProvider } from "../../src/llm/fake.provider"
import { NO_ANSWER_TEXT } from "../../src/prompts"
import { createTenant, resetDatabase, seedSource } from "../helpers/db"
import { buildPdf } from "../helpers/pdf"
import { parseSseBody } from "../helpers/sse"

const app = createApp()
const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

beforeEach(resetDatabase)

describe("auth", () => {
    const credentials = { name: "Asha", email: "Asha@Example.com", password: "password123" }

    it("signs up, logs in (email is case-insensitive), and returns the current user", async () => {
        const signup = await request(app).post("/api/auth/signup").send(credentials).expect(201)
        expect(signup.body.data.user).toMatchObject({ name: "Asha", email: "asha@example.com" })
        expect(signup.body.data.user).not.toHaveProperty("passwordHash")

        const login = await request(app)
            .post("/api/auth/login")
            .send({ email: "ASHA@example.com", password: "password123" })
            .expect(200)

        const me = await request(app)
            .get("/api/auth/me")
            .set(auth(login.body.data.token))
            .expect(200)
        expect(me.body.data.user.email).toBe("asha@example.com")
    })

    it("rejects duplicate emails, wrong passwords, and bad input", async () => {
        await request(app).post("/api/auth/signup").send(credentials).expect(201)
        await request(app).post("/api/auth/signup").send(credentials).expect(409)

        const wrong = await request(app)
            .post("/api/auth/login")
            .send({ email: credentials.email, password: "nope-nope" })
            .expect(401)
        expect(wrong.body).toMatchObject({ success: false, code: "UNAUTHORIZED" })

        const invalid = await request(app)
            .post("/api/auth/signup")
            .send({ name: "", email: "not-an-email", password: "short" })
            .expect(400)
        expect(invalid.body.code).toBe("VALIDATION_ERROR")
        expect(invalid.body.details.length).toBeGreaterThanOrEqual(3)
    })

    it("protects routes and rejects forged tokens", async () => {
        await request(app).get("/api/workspaces").expect(401)
        await request(app).get("/api/workspaces").set(auth("not.a.jwt")).expect(401)
    })
})

describe("workspaces and tenant scoping over HTTP", () => {
    it("creates, lists, and deletes a workspace", async () => {
        const { token } = await createTenant()

        const created = await request(app)
            .post("/api/workspaces")
            .set(auth(token))
            .send({ name: "Research" })
            .expect(201)
        const list = await request(app).get("/api/workspaces").set(auth(token)).expect(200)
        expect(list.body.data.map((w: { name: string }) => w.name)).toContain("Research")

        await request(app)
            .delete(`/api/workspaces/${created.body.data.id}`)
            .set(auth(token))
            .expect(200)
        await request(app)
            .get(`/api/workspaces/${created.body.data.id}/sources`)
            .set(auth(token))
            .expect(404)
    })

    it("returns 404 (not 403) for every route of someone else's workspace", async () => {
        const alice = await createTenant("alice")
        const bob = await createTenant("bob")
        const source = await seedSource(alice.workspace.id, "alice.pdf", [{ content: "private" }])
        const base = `/api/workspaces/${alice.workspace.id}`

        await request(app).get(`${base}/sources`).set(auth(bob.token)).expect(404)
        await request(app).get(`${base}/sources/${source.id}`).set(auth(bob.token)).expect(404)
        await request(app).get(`${base}/sources/${source.id}/file`).set(auth(bob.token)).expect(404)
        await request(app).delete(`${base}/sources/${source.id}`).set(auth(bob.token)).expect(404)
        await request(app).get(`${base}/conversations`).set(auth(bob.token)).expect(404)
        await request(app).get(`${base}/usage`).set(auth(bob.token)).expect(404)
        await request(app)
            .post(`${base}/chat`)
            .set(auth(bob.token))
            .send({ message: "hi" })
            .expect(404)
        await request(app).delete(base).set(auth(bob.token)).expect(404)

        // Alice's data is untouched
        expect(await prisma.source.count({ where: { workspaceId: alice.workspace.id } })).toBe(1)
    })

    it("returns 404 for malformed ids instead of a database error", async () => {
        const { token, workspace } = await createTenant()
        await request(app).get("/api/workspaces/not-a-uuid/sources").set(auth(token)).expect(404)
        await request(app)
            .get(`/api/workspaces/${workspace.id}/sources/123`)
            .set(auth(token))
            .expect(404)
    })
})

describe("sources", () => {
    it("accepts a valid PDF upload and queues it as pending", async () => {
        const { token, workspace } = await createTenant()

        const response = await request(app)
            .post(`/api/workspaces/${workspace.id}/sources/upload`)
            .set(auth(token))
            .attach("file", buildPdf([["Hello world from a PDF."]]), {
                filename: "notes.pdf",
                contentType: "application/pdf",
            })
            .expect(201)

        expect(response.body.data).toMatchObject({
            name: "notes.pdf",
            type: "file",
            status: "pending",
        })
        expect(response.body.data).not.toHaveProperty("storageKey")

        const file = await request(app)
            .get(`/api/workspaces/${workspace.id}/sources/${response.body.data.id}/file`)
            .set(auth(token))
            .expect(200)
        expect(file.headers["content-type"]).toContain("application/pdf")
    })

    it("accepts Markdown and text files even when the browser sends a generic MIME type", async () => {
        const { token, workspace } = await createTenant()
        const markdown = "# Refund Policy\n\nRefunds take **5 business days**."

        const md = await request(app)
            .post(`/api/workspaces/${workspace.id}/sources/upload`)
            .set(auth(token))
            .attach("file", Buffer.from(markdown), {
                filename: "policy.md",
                contentType: "application/octet-stream",
            })
            .expect(201)
        expect(md.body.data).toMatchObject({ name: "policy.md", mimeType: "text/markdown" })

        const txt = await request(app)
            .post(`/api/workspaces/${workspace.id}/sources/upload`)
            .set(auth(token))
            .attach("file", Buffer.from("Plain notes."), {
                filename: "notes.txt",
                contentType: "text/plain",
            })
            .expect(201)
        expect(txt.body.data.mimeType).toBe("text/plain")

        // The original file can be opened again, as UTF-8 text
        const file = await request(app)
            .get(`/api/workspaces/${workspace.id}/sources/${md.body.data.id}/file`)
            .set(auth(token))
            .expect(200)
        expect(file.headers["content-type"]).toMatch(/^text\/markdown; charset=utf-8/)
        expect(file.text).toBe(markdown)
    })

    it("rejects binary files renamed to .txt or .md", async () => {
        const { token, workspace } = await createTenant()
        const executable = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00])

        for (const filename of ["notes.txt", "notes.md"]) {
            await request(app)
                .post(`/api/workspaces/${workspace.id}/sources/upload`)
                .set(auth(token))
                .attach("file", executable, { filename, contentType: "text/plain" })
                .expect(415)
        }
    })

    it("rejects files whose content does not match their type", async () => {
        const { token, workspace } = await createTenant()

        const fakePdf = await request(app)
            .post(`/api/workspaces/${workspace.id}/sources/upload`)
            .set(auth(token))
            .attach("file", Buffer.from("MZ executable bytes"), {
                filename: "invoice.pdf",
                contentType: "application/pdf",
            })
            .expect(415)
        expect(fakePdf.body.code).toBe("UNSUPPORTED_MEDIA_TYPE")

        await request(app)
            .post(`/api/workspaces/${workspace.id}/sources/upload`)
            .set(auth(token))
            // An unsupported type (HTML could carry scripts if it were ever served back)
            .attach("file", Buffer.from("<script>alert(1)</script>"), {
                filename: "page.html",
                contentType: "text/html",
            })
            .expect(415)

        await request(app)
            .post(`/api/workspaces/${workspace.id}/sources/upload`)
            .set(auth(token))
            .expect(400)
    })

    it("blocks URLs that point at private networks (SSRF)", async () => {
        const { token, workspace } = await createTenant()
        for (const url of [
            "http://127.0.0.1:6379",
            "http://169.254.169.254/latest",
            "http://localhost",
        ]) {
            await request(app)
                .post(`/api/workspaces/${workspace.id}/sources/url`)
                .set(auth(token))
                .send({ url })
                .expect(400)
        }
        expect(await prisma.source.count()).toBe(0)
    })

    it("deleting a source deletes its chunks and embeddings", async () => {
        const { token, workspace } = await createTenant()
        const source = await seedSource(workspace.id, "doc.pdf", [
            { content: "one" },
            { content: "two" },
        ])
        expect(await prisma.chunk.count({ where: { sourceId: source.id } })).toBe(2)

        await request(app)
            .delete(`/api/workspaces/${workspace.id}/sources/${source.id}`)
            .set(auth(token))
            .expect(200)

        expect(await prisma.chunk.count({ where: { sourceId: source.id } })).toBe(0)
        await request(app)
            .get(`/api/workspaces/${workspace.id}/sources/${source.id}`)
            .set(auth(token))
            .expect(404)
    })
})

describe("chat", () => {
    const handbook = [
        { content: "Employees receive 24 days of paid vacation per year.", metadata: { page: 3 } },
        {
            content: "The remote work policy allows three remote days per week.",
            metadata: { page: 7 },
        },
    ]

    it("answers with citations that point at the exact page", async () => {
        const { token, workspace } = await createTenant()
        await seedSource(workspace.id, "handbook.pdf", handbook)

        const response = await request(app)
            .post(`/api/workspaces/${workspace.id}/chat`)
            .set(auth(token))
            .send({ message: "How many vacation days do employees receive?" })
            .expect(200)

        const { message, conversationId } = response.body.data
        expect(message.role).toBe("assistant")
        expect(message.content).toContain("[1]")
        expect(message.citations[0]).toMatchObject({
            index: 1,
            sourceName: "handbook.pdf",
            page: 3,
        })
        expect(conversationId).toBeTruthy()
    })

    it("says it doesn't know when nothing relevant is retrieved, without citations", async () => {
        const { token, workspace } = await createTenant()
        await seedSource(workspace.id, "handbook.pdf", handbook)

        const response = await request(app)
            .post(`/api/workspaces/${workspace.id}/chat`)
            .set(auth(token))
            .send({ message: "Who won the football world cup?" })
            .expect(200)

        expect(response.body.data.message).toMatchObject({ content: NO_ANSWER_TEXT, citations: [] })
    })

    it("streams meta -> citations -> tokens -> done over SSE and persists the conversation", async () => {
        const { token, workspace } = await createTenant()
        await seedSource(workspace.id, "handbook.pdf", handbook)

        const response = await request(app)
            .post(`/api/workspaces/${workspace.id}/chat/stream`)
            .set(auth(token))
            .send({ message: "What is the remote work policy?" })
            .expect(200)
            .expect("Content-Type", /text\/event-stream/)

        const events = parseSseBody(response.text)
        const names = events.map((e) => e.event)
        expect(names[0]).toBe("meta")
        expect(names[1]).toBe("citations")
        expect(names.at(-1)).toBe("done")
        expect(names.filter((name) => name === "token").length).toBeGreaterThan(1)

        const streamed = events
            .filter((e) => e.event === "token")
            .map((e) => (e.data as { delta: string }).delta)
            .join("")
        const done = events.at(-1)?.data as {
            message: { content: string; citations: { page: number }[] }
        }
        expect(streamed).toBe(done.message.content)
        expect(done.message.citations[0].page).toBe(7)

        const { conversationId } = events[0].data as { conversationId: string }
        const history = await request(app)
            .get(`/api/workspaces/${workspace.id}/conversations/${conversationId}`)
            .set(auth(token))
            .expect(200)
        expect(history.body.data.messages.map((m: { role: string }) => m.role)).toEqual([
            "user",
            "assistant",
        ])
    })

    it("continues a conversation, and keeps conversations private to their user", async () => {
        const alice = await createTenant("alice")
        await seedSource(alice.workspace.id, "handbook.pdf", handbook)
        const base = `/api/workspaces/${alice.workspace.id}`

        const first = await request(app)
            .post(`${base}/chat`)
            .set(auth(alice.token))
            .send({ message: "How many vacation days?" })
            .expect(200)
        const conversationId = first.body.data.conversationId

        await request(app)
            .post(`${base}/chat`)
            .set(auth(alice.token))
            .send({ message: "And remote work days?", conversationId })
            .expect(200)

        const list = await request(app)
            .get(`${base}/conversations`)
            .set(auth(alice.token))
            .expect(200)
        expect(list.body.data).toHaveLength(1)
        const messages = await prisma.message.count({ where: { conversationId } })
        expect(messages).toBe(4)

        await request(app)
            .post(`${base}/chat`)
            .set(auth(alice.token))
            .send({ message: "hi", conversationId: "00000000-0000-4000-8000-000000000000" })
            .expect(404)

        await request(app)
            .delete(`${base}/conversations/${conversationId}`)
            .set(auth(alice.token))
            .expect(200)
        expect(await prisma.message.count({ where: { conversationId } })).toBe(0)
    })

    it("leaves no half-saved conversation when the LLM fails", async () => {
        const { token, workspace } = await createTenant()
        await seedSource(workspace.id, "handbook.pdf", handbook)
        const failure = vi
            .spyOn(FakeProvider.prototype, "streamChat")
            .mockRejectedValueOnce(new Error("LLM is down"))

        const response = await request(app)
            .post(`/api/workspaces/${workspace.id}/chat/stream`)
            .set(auth(token))
            .send({ message: "How many vacation days?" })
            .expect(200)

        const events = parseSseBody(response.text).map((e) => e.event)
        expect(events.at(-1)).toBe("error")
        expect(await prisma.conversation.count()).toBe(0)
        expect(await prisma.message.count()).toBe(0)
        failure.mockRestore()
    })

    it("tells the user why streaming failed when the reason is safe to show", async () => {
        const { token, workspace } = await createTenant()
        await seedSource(workspace.id, "handbook.pdf", handbook)
        const limited = vi
            .spyOn(FakeProvider.prototype, "streamChat")
            .mockRejectedValueOnce(providerRateLimited())

        const response = await request(app)
            .post(`/api/workspaces/${workspace.id}/chat/stream`)
            .set(auth(token))
            .send({ message: "How many vacation days?" })
            .expect(200)

        const last = parseSseBody(response.text).at(-1)
        expect(last?.event).toBe("error")
        expect((last?.data as { message: string }).message).toMatch(/limiting requests/)
        limited.mockRestore()
    })

    it("keeps citations when an answer only partly says it doesn't know", async () => {
        const { token, workspace } = await createTenant()
        await seedSource(workspace.id, "handbook.pdf", handbook)
        const partial = vi.spyOn(FakeProvider.prototype, "chat").mockResolvedValueOnce({
            text: `Vacation is 24 days [1]. About parking: ${NO_ANSWER_TEXT}`,
            usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        })

        const response = await request(app)
            .post(`/api/workspaces/${workspace.id}/chat`)
            .set(auth(token))
            .send({ message: "How many vacation days and where do I park?" })
            .expect(200)

        expect(response.body.data.message.citations).toHaveLength(1)
        partial.mockRestore()
    })

    it("records token usage per workspace", async () => {
        const { token, workspace } = await createTenant()
        await seedSource(workspace.id, "handbook.pdf", handbook)
        await request(app)
            .post(`/api/workspaces/${workspace.id}/chat`)
            .set(auth(token))
            .send({ message: "How many vacation days?" })
            .expect(200)

        const usage = await request(app)
            .get(`/api/workspaces/${workspace.id}/usage`)
            .set(auth(token))
            .expect(200)

        expect(usage.body.data.totals.totalTokens).toBeGreaterThan(0)
        expect(usage.body.data.byKind.map((k: { kind: string }) => k.kind).sort()).toEqual([
            "chat",
            "embedding",
        ])
    })
})
