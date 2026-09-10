import http from "node:http"
import type { AddressInfo } from "node:net"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { badRequest, PermanentJobError } from "../../src/lib/errors"

// The real SSRF guard would (correctly) block our 127.0.0.1 test server. Here it allows
// localhost but treats any /private path as a private address, so redirect checks are still tested.
vi.mock("../../src/utils/url-safety", () => ({
    assertPublicUrl: async (raw: string) => {
        const url = new URL(raw)
        if (url.pathname.startsWith("/private")) throw badRequest("URL points to a private address")
        return url
    },
}))

const { crawlWebsite } = await import("../../src/services/crawler.service")

const page = (title: string, body: string) =>
    `<html><head><title>${title}</title></head><body><nav>Menu</nav><main>${body}</main></body></html>`

const PAGES: Record<string, string> = {
    "/": page(
        "Home",
        `<p>Welcome to the fruit shop.</p>
         <a href="/a">A</a> <a href="/b">B</a> <a href="/a#section">A again</a>
         <a href="/secret">Secret</a> <a href="/menu.pdf">PDF</a>
         <a href="https://other.example/page">Other site</a> <a href="/redirect">Redirect</a>`,
    ),
    "/a": page("Apples", `<p>Apples are red.</p><a href="/a/deeper">Deeper</a>`),
    "/a/deeper": page("Deep", "<p>Deep page about apple seeds.</p>"),
    "/b": page("Bananas", "<p>Bananas are yellow.</p>"),
    "/secret": page("Secret", "<p>Disallowed by robots.</p>"),
    "/private/admin": page("Admin", "<p>Internal admin data.</p>"),
}

const requested: string[] = []
let server: http.Server
let baseUrl: string

beforeAll(async () => {
    server = http.createServer((req, res) => {
        const path = req.url ?? "/"
        requested.push(path)
        if (path === "/robots.txt") {
            res.writeHead(200, { "Content-Type": "text/plain" })
            res.end("User-agent: *\nDisallow: /secret\nDisallow: /blocked-start\nCrawl-delay: 0.01")
        } else if (path === "/redirect") {
            res.writeHead(302, { Location: "/private/admin" })
            res.end()
        } else if (PAGES[path]) {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
            res.end(PAGES[path])
        } else {
            res.writeHead(404)
            res.end()
        }
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

beforeEach(() => {
    requested.length = 0
})

describe("crawlWebsite", () => {
    it("crawls same-origin links breadth-first up to maxDepth, one document per page", async () => {
        const docs = await crawlWebsite(`${baseUrl}/`, { maxDepth: 1, maxPages: 10 })

        expect(docs.map((doc) => doc.metadata.title)).toEqual(["Home", "Apples", "Bananas"])
        expect(docs[1].metadata.url).toBe(`${baseUrl}/a`)
        expect(docs[1].pageContent).toContain("Apples are red.")
        expect(docs[0].pageContent).not.toContain("Menu") // navigation stripped
        expect(requested).not.toContain("/a/deeper") // depth 2
    })

    it("respects robots.txt, skips files and other sites, and fetches each page once", async () => {
        await crawlWebsite(`${baseUrl}/`, { maxDepth: 1, maxPages: 10 })

        expect(requested).not.toContain("/secret")
        expect(requested).not.toContain("/menu.pdf")
        expect(requested.filter((path) => path === "/a")).toHaveLength(1)
    })

    it("never follows a redirect into a private address", async () => {
        const docs = await crawlWebsite(`${baseUrl}/`, { maxDepth: 1, maxPages: 10 })

        expect(requested).toContain("/redirect")
        expect(requested).not.toContain("/private/admin")
        expect(docs.some((doc) => doc.pageContent.includes("Internal admin data"))).toBe(false)
    })

    it("stops at maxPages and goes deeper when allowed", async () => {
        const limited = await crawlWebsite(`${baseUrl}/`, { maxDepth: 2, maxPages: 2 })
        expect(limited).toHaveLength(2)

        const deep = await crawlWebsite(`${baseUrl}/a`, { maxDepth: 1, maxPages: 10 })
        expect(deep.map((doc) => doc.metadata.title)).toEqual(["Apples", "Deep"])
    })

    it("fails permanently when robots.txt disallows the start page", async () => {
        await expect(
            crawlWebsite(`${baseUrl}/blocked-start`, { maxDepth: 0, maxPages: 1 }),
        ).rejects.toBeInstanceOf(PermanentJobError)
    })

    it("surfaces the error when the start page itself cannot be loaded", async () => {
        // A 404 won't fix itself, so it fails permanently (no pointless retries)
        const failure = crawlWebsite(`${baseUrl}/does-not-exist`, { maxDepth: 0, maxPages: 1 })
        await expect(failure).rejects.toBeInstanceOf(PermanentJobError)
        await expect(failure).rejects.toThrow("HTTP 404")
    })
})
