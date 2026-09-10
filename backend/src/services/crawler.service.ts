import { Document } from "@langchain/core/documents"
import { setTimeout as sleep } from "node:timers/promises"
import robotsParser from "robots-parser"
import { PermanentJobError } from "../lib/errors"
import { logger } from "../lib/logger"
import { extractPage, type ExtractedPage } from "../loaders/html.loader"
import type { ChunkMetadata, CrawlOptions } from "../types/domain"
import { cleanText } from "../utils/text"
import { assertPublicUrl } from "../utils/url-safety"

const USER_AGENT = "AskDocsBot/1.0"
const FETCH_TIMEOUT_MS = 10_000
const MAX_PAGE_BYTES = 2 * 1024 * 1024
const MAX_REDIRECTS = 3
const POLITE_DELAY_MS = 300
const MAX_CRAWL_DELAY_MS = 5_000
const SKIPPED_EXTENSIONS =
    /\.(pdf|docx?|xlsx?|pptx?|zip|gz|png|jpe?g|gif|webp|svg|mp4|mp3|css|js|xml|json)$/i

class HttpStatusError extends Error {
    constructor(
        readonly status: number,
        url: string,
    ) {
        super(`HTTP ${status} for ${url}`)
    }
}

/**
 * Fetch with SSRF checks on EVERY hop: a public URL may redirect to http://169.254.169.254,
 * so we follow redirects ourselves and re-check each target.
 */
async function safeFetch(
    rawUrl: string,
    accept: string,
): Promise<{ url: URL; response: Response }> {
    let url = await assertPublicUrl(rawUrl)
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
        const response = await fetch(url, {
            redirect: "manual",
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            headers: { "User-Agent": USER_AGENT, Accept: accept },
        })
        const location = response.headers.get("location")
        if (response.status >= 300 && response.status < 400 && location) {
            await response.body?.cancel()
            url = await assertPublicUrl(new URL(location, url).toString())
            continue
        }
        return { url, response }
    }
    throw new Error(`Too many redirects for ${rawUrl}`)
}

/** Reads the body but stops at `maxBytes`, so a huge page can't exhaust our memory. */
async function readTextWithLimit(response: Response, maxBytes: number): Promise<string> {
    if (!response.body) return ""
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let received = 0
    let text = ""
    for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        received += value.byteLength
        if (received > maxBytes) {
            await reader.cancel()
            break
        }
        text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
}

type Robots = ReturnType<typeof robotsParser>

async function loadRobots(origin: string): Promise<Robots | null> {
    const robotsUrl = `${origin}/robots.txt`
    try {
        const { response } = await safeFetch(robotsUrl, "text/plain")
        // No robots.txt (404 etc.) means everything is allowed
        if (!response.ok) return null
        return robotsParser(robotsUrl, await readTextWithLimit(response, 512 * 1024))
    } catch (err) {
        logger.warn({ err, robotsUrl }, "Could not read robots.txt, assuming allowed")
        return null
    }
}

async function fetchPage(url: string): Promise<(ExtractedPage & { url: string }) | null> {
    const { url: finalUrl, response } = await safeFetch(url, "text/html")
    if (!response.ok) throw new HttpStatusError(response.status, url)
    if (!(response.headers.get("content-type") ?? "").includes("text/html")) {
        await response.body?.cancel()
        return null
    }
    const html = await readTextWithLimit(response, MAX_PAGE_BYTES)
    return { ...extractPage(html, finalUrl.toString()), url: finalUrl.toString() }
}

/** Same page with a different #fragment is the same page. */
const normalize = (url: string) => {
    const parsed = new URL(url)
    parsed.hash = ""
    return parsed.toString()
}

/**
 * Breadth-first crawl starting at `startUrl`, staying on the same origin.
 * Depth 0 = only the start page, depth 1 = plus the pages it links to, and so on.
 * Returns one Document per page, with the page URL and title as metadata for citations.
 */
export async function crawlWebsite(
    startUrl: string,
    options: CrawlOptions,
): Promise<Document<ChunkMetadata>[]> {
    const start = await assertPublicUrl(startUrl)
    const robots = await loadRobots(start.origin)
    const delayMs = Math.min(
        (robots?.getCrawlDelay(USER_AGENT) ?? 0) * 1000 || POLITE_DELAY_MS,
        MAX_CRAWL_DELAY_MS,
    )

    const startKey = normalize(start.toString())
    if (robots?.isDisallowed(startKey, USER_AGENT)) {
        throw new PermanentJobError("robots.txt does not allow crawling this URL")
    }

    const queue: { url: string; depth: number }[] = [{ url: startKey, depth: 0 }]
    const seen = new Set([startKey])
    const documents: Document<ChunkMetadata>[] = []

    while (queue.length > 0 && documents.length < options.maxPages) {
        const { url, depth } = queue.shift()!
        if (robots?.isDisallowed(url, USER_AGENT)) continue

        let page: Awaited<ReturnType<typeof fetchPage>>
        try {
            page = await fetchPage(url)
        } catch (err) {
            // If the very first page fails, the whole crawl is pointless: surface the reason.
            // 4xx (not found, forbidden) won't change on retry, so fail permanently.
            if (depth === 0 && err instanceof HttpStatusError && err.status < 500) {
                throw new PermanentJobError(`The website responded with HTTP ${err.status}`)
            }
            if (depth === 0) throw err
            logger.warn({ err, url }, "Skipping page that failed to load")
            continue
        }
        if (!page) continue

        const text = cleanText(page.text)
        if (text) {
            documents.push(
                new Document({ pageContent: text, metadata: { url: page.url, title: page.title } }),
            )
        }

        if (depth < options.maxDepth) {
            for (const link of page.links) {
                const candidate = new URL(link)
                const key = normalize(link)
                const isCrawlable =
                    candidate.origin === start.origin &&
                    !SKIPPED_EXTENSIONS.test(candidate.pathname) &&
                    !seen.has(key)
                if (isCrawlable) {
                    seen.add(key)
                    queue.push({ url: key, depth: depth + 1 })
                }
            }
        }

        if (queue.length > 0) await sleep(delayMs)
    }

    return documents
}
