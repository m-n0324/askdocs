import * as cheerio from "cheerio"

export interface ExtractedPage {
    title: string
    text: string
    links: string[] // absolute URLs found on the page
}

// Elements that are navigation, chrome, or code rather than content.
const NOISE_SELECTORS =
    "script, style, noscript, svg, iframe, form, nav, header, footer, aside, [role=navigation], [aria-hidden=true]"

/** Turns raw HTML into readable text plus outgoing links. */
export function extractPage(html: string, pageUrl: string): ExtractedPage {
    const $ = cheerio.load(html)

    const links: string[] = []
    $("a[href]").each((_, element) => {
        const href = $(element).attr("href")
        if (!href) return
        try {
            links.push(new URL(href, pageUrl).toString())
        } catch {
            // ignore malformed hrefs
        }
    })

    const title = $("title").first().text().trim() || $("h1").first().text().trim() || pageUrl

    $(NOISE_SELECTORS).remove()
    // Prefer the main content area when the page marks one
    const root = $("main").length ? $("main") : $("article").length ? $("article") : $("body")

    // Put line breaks after block elements so words from different paragraphs don't glue together
    root.find("p, div, li, h1, h2, h3, h4, h5, h6, br, tr, section").after("\n")

    return { title, text: root.text(), links }
}
