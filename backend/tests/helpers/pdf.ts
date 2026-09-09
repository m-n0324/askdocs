/**
 * Builds a small but valid PDF in memory: one page per entry in `pages`, each line of text
 * drawn with Helvetica. Lets tests exercise the real PDF parser without binary fixtures.
 */
export function buildPdf(pages: string[][]): Buffer {
    const escape = (text: string) => text.replace(/([\\()])/g, "\\$1")
    const objects: string[] = []
    const add = (body: string) => objects.push(body) // object number = array position + 1

    add("<< /Type /Catalog /Pages 2 0 R >>")
    add("") // placeholder for the page tree, filled in once page numbers are known
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    const pageRefs: string[] = []
    for (const lines of pages) {
        const text = lines.map((line) => `(${escape(line)}) Tj T*`).join("\n")
        const stream = `BT /F1 12 Tf 14 TL 72 720 Td\n${text}\nET`
        add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`)
        const contentRef = objects.length
        add(
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
                `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentRef} 0 R >>`,
        )
        pageRefs.push(`${objects.length} 0 R`)
    }
    objects[1] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`

    let pdf = "%PDF-1.4\n"
    const offsets: number[] = []
    objects.forEach((body, i) => {
        offsets.push(Buffer.byteLength(pdf))
        pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
    })
    const xrefOffset = Buffer.byteLength(pdf)
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
    pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
    return Buffer.from(pdf)
}
