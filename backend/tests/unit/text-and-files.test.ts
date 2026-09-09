import { describe, expect, it } from "vitest"
import { extractPage } from "../../src/loaders/html.loader"
import {
    DOCX_MIME,
    MARKDOWN_MIME,
    PDF_MIME,
    TEXT_MIME,
    findAllowedType,
} from "../../src/services/file-types"
import { cleanText } from "../../src/utils/text"

describe("cleanText", () => {
    it("removes NUL/control characters that Postgres cannot store", () => {
        expect(cleanText("a\u0000b\u0007c")).toBe("abc")
    })

    it("re-joins words hyphenated across lines and collapses whitespace", () => {
        expect(cleanText("infor-\nmation   is\t\tkey\n\n\n\nnext")).toBe(
            "information is key\n\nnext",
        )
    })
})

describe("file type checks", () => {
    it("requires extension and MIME type to agree for binary formats", () => {
        expect(findAllowedType("report.PDF", PDF_MIME)?.mimeType).toBe(PDF_MIME)
        expect(findAllowedType("report.pdf", DOCX_MIME)).toBeUndefined()
        expect(findAllowedType("script.exe", PDF_MIME)).toBeUndefined()
    })

    it("accepts Markdown and text files whatever MIME type the browser guessed", () => {
        for (const browserMime of [
            "text/markdown",
            "text/x-markdown",
            "application/octet-stream",
            "",
        ]) {
            expect(findAllowedType("notes.md", browserMime)?.mimeType).toBe(MARKDOWN_MIME)
        }
        expect(findAllowedType("README.markdown", "text/plain")?.mimeType).toBe(MARKDOWN_MIME)
        expect(findAllowedType("notes.txt", "text/plain")?.mimeType).toBe(TEXT_MIME)
        expect(findAllowedType("notes.txt", PDF_MIME)).toBeUndefined()
    })

    it("checks the real content: magic bytes for PDF/DOCX", () => {
        const pdf = findAllowedType("a.pdf", PDF_MIME)!
        expect(pdf.isValidContent(Buffer.from("%PDF-1.7 ..."))).toBe(true)
        expect(pdf.isValidContent(Buffer.from("<html>not a pdf"))).toBe(false)
    })

    it("checks the real content: text files must be UTF-8 without binary bytes", () => {
        const txt = findAllowedType("a.txt", "text/plain")!
        expect(txt.isValidContent(Buffer.from("Hello — naïve café ✓\n# Heading"))).toBe(true)
        expect(txt.isValidContent(Buffer.from([0x4d, 0x5a, 0x00, 0x90]))).toBe(false) // an .exe header
        expect(txt.isValidContent(Buffer.from([0xc3, 0x28]))).toBe(false) // invalid UTF-8
        expect(txt.isValidContent(Buffer.from("h\u0000i", "utf16le"))).toBe(false) // UTF-16 has NUL bytes
    })
})

describe("extractPage", () => {
    const html = `<html><head><title>Pricing</title><script>track()</script></head>
        <body><nav><a href="/home">Home</a></nav>
        <main><h1>Plans</h1><p>Pro costs $20.</p><a href="/faq#top">FAQ</a></main>
        <footer>© 2026</footer></body></html>`

    it("keeps main content and drops navigation, footer, and scripts", () => {
        const page = extractPage(html, "https://shop.dev/pricing")

        expect(page.title).toBe("Pricing")
        expect(page.text).toContain("Pro costs $20.")
        expect(page.text).not.toContain("track()")
        expect(page.text).not.toContain("© 2026")
    })

    it("resolves links to absolute URLs", () => {
        const page = extractPage(html, "https://shop.dev/pricing")
        expect(page.links).toEqual(["https://shop.dev/home", "https://shop.dev/faq#top"])
    })
})
