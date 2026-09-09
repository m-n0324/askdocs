import { describe, expect, it } from "vitest"
import { loadDocx } from "../../src/loaders/docx.loader"
import { loadPdf } from "../../src/loaders/pdf.loader"
import { loadMarkdown, loadText } from "../../src/loaders/text.loader"
import { buildDocx } from "../helpers/docx"
import { buildPdf } from "../helpers/pdf"

describe("loadPdf", () => {
    it("returns one document per non-empty page, tagged with its page number", async () => {
        const docs = await loadPdf(buildPdf([["Page one text."], [], ["Page three text."]]))

        expect(docs.map((doc) => doc.metadata.page)).toEqual([1, 3])
        expect(docs[1].pageContent).toContain("Page three text.")
    })
})

describe("loadDocx", () => {
    it("splits a Word file into sections at headings, for section-level citations", async () => {
        const docx = await buildDocx([
            { paragraphs: ["Intro paragraph before any heading."] },
            {
                heading: "Refund Policy",
                paragraphs: ["Refunds take 5 business days.", "Contact support."],
            },
            { heading: "Shipping", paragraphs: ["We ship worldwide."] },
            { heading: "Empty Section", paragraphs: [] },
        ])

        const docs = await loadDocx(docx)

        expect(docs.map((doc) => doc.metadata.section)).toEqual([
            undefined,
            "Refund Policy",
            "Shipping",
        ])
        expect(docs[1].pageContent).toBe(
            "Refund Policy\n\nRefunds take 5 business days.\n\nContact support.",
        )
    })
})

describe("loadMarkdown", () => {
    it("splits at #, ## and ### headings so citations can name the section", () => {
        const markdown = [
            "Intro line before any heading.",
            "",
            "# Refund Policy",
            "Refunds take 5 business days.",
            "",
            "## Exceptions ##",
            "Gift cards are not refundable.",
            "",
            "#### Small heading stays inside its section",
            "Still part of Exceptions.",
        ].join("\n")

        const docs = loadMarkdown(Buffer.from(markdown))

        expect(docs.map((doc) => doc.metadata.section)).toEqual([
            undefined,
            "Refund Policy",
            "Exceptions",
        ])
        expect(docs[1].pageContent).toBe("# Refund Policy\nRefunds take 5 business days.")
        expect(docs[2].pageContent).toContain("Still part of Exceptions.")
    })

    it("ignores # lines inside fenced code blocks", () => {
        const markdown = [
            "# Setup",
            "```bash",
            "# install deps",
            "pnpm install",
            "```",
            "Done.",
        ].join("\n")

        const docs = loadMarkdown(Buffer.from(markdown))

        expect(docs).toHaveLength(1)
        expect(docs[0].metadata.section).toBe("Setup")
        expect(docs[0].pageContent).toContain("# install deps")
    })

    it("drops a UTF-8 byte-order mark and empty sections", () => {
        const docs = loadMarkdown(Buffer.from("\uFEFF# Empty\n\n# Real\nText here."))
        expect(docs.map((doc) => doc.metadata.section)).toEqual(["Real"])
    })
})

describe("loadText", () => {
    it("returns the whole file as one document (no pages or sections to cite)", () => {
        const docs = loadText(Buffer.from("\uFEFFLine one.\nLine two."))

        expect(docs).toHaveLength(1)
        expect(docs[0].pageContent).toBe("Line one.\nLine two.")
        expect(docs[0].metadata).toEqual({})
    })

    it("returns nothing for an empty or whitespace-only file", () => {
        expect(loadText(Buffer.from("  \n\t "))).toEqual([])
    })
})
