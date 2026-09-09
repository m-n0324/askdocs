import JSZip from "jszip"

/** Builds a minimal valid .docx: `[heading, ...paragraphs]` per section. */
export async function buildDocx(
    sections: { heading?: string; paragraphs: string[] }[],
): Promise<Buffer> {
    const escape = (text: string) =>
        text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    const paragraph = (text: string, style?: string) =>
        `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t>${escape(text)}</w:t></w:r></w:p>`

    const body = sections
        .map((section) =>
            [
                section.heading ? paragraph(section.heading, "Heading1") : "",
                ...section.paragraphs.map((p) => paragraph(p)),
            ].join(""),
        )
        .join("")

    const zip = new JSZip()
    zip.file(
        "[Content_Types].xml",
        `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    )
    zip.file(
        "_rels/.rels",
        `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    )
    zip.file(
        "word/document.xml",
        `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
    )
    return zip.generateAsync({ type: "nodebuffer" })
}
