// Control characters other than tab/newline/carriage return. Postgres text cannot store NUL,
// and the rest are invisible noise from PDF extraction or pasted file names.
// eslint-disable-next-line no-control-regex -- matching control characters is the whole point
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000e-\u001f\u007f]/g

export function stripControlChars(text: string): string {
    return text.replace(CONTROL_CHARS, "")
}

/**
 * Normalise text extracted from PDFs, Word files, and web pages before chunking.
 * Messy whitespace wastes tokens and makes chunks less similar to clean questions.
 */
export function cleanText(raw: string): string {
    return (
        stripControlChars(raw)
            .replace(/\r\n?/g, "\n")
            // Re-join words hyphenated across a line break: "infor-\nmation" -> "information"
            .replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2")
            .replace(/[ \t\f\u00a0]+/g, " ") // tabs, form feeds, non-breaking spaces
            .replace(/ *\n */g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
    )
}
