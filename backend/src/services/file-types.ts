/**
 * The upload allow-list. A file is accepted only if its extension, its declared MIME type,
 * AND its actual content all agree. The extension and MIME type come from the browser and can be
 * faked; the content check looks at the real bytes:
 * - PDF and DOCX start with fixed "magic bytes"
 * - text files (Markdown, TXT) have no magic bytes, so they must decode as UTF-8 and contain no
 *   NUL bytes, which rules out executables and other binary files renamed to .txt
 */

export const PDF_MIME = "application/pdf"
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
export const MARKDOWN_MIME = "text/markdown"
export const TEXT_MIME = "text/plain"

export interface AllowedFileType {
    extensions: readonly string[]
    /** The MIME type we store and serve the file with. */
    mimeType: string
    /** The MIME types browsers may send for this kind of file. */
    acceptedMimeTypes: readonly string[]
    isValidContent: (buffer: Buffer) => boolean
}

const startsWith = (magic: Buffer) => (buffer: Buffer) =>
    buffer.subarray(0, magic.length).equals(magic)

export function isUtf8Text(buffer: Buffer): boolean {
    if (buffer.includes(0)) return false
    try {
        new TextDecoder("utf-8", { fatal: true }).decode(buffer)
        return true
    } catch {
        return false
    }
}

// Browsers label text files inconsistently: a .md file often arrives as
// "application/octet-stream" or with no type at all. The content check above is what protects us.
const TEXT_LIKE_MIME_TYPES = [
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    "application/octet-stream",
    "",
]

/** Listed in order of preference: plain text formats are smallest and fastest to index. */
export const ALLOWED_FILE_TYPES: readonly AllowedFileType[] = [
    {
        extensions: [".md", ".markdown"],
        mimeType: MARKDOWN_MIME,
        acceptedMimeTypes: TEXT_LIKE_MIME_TYPES,
        isValidContent: isUtf8Text,
    },
    {
        extensions: [".txt"],
        mimeType: TEXT_MIME,
        acceptedMimeTypes: TEXT_LIKE_MIME_TYPES,
        isValidContent: isUtf8Text,
    },
    {
        extensions: [".pdf"],
        mimeType: PDF_MIME,
        acceptedMimeTypes: [PDF_MIME],
        isValidContent: startsWith(Buffer.from("%PDF-")),
    },
    {
        extensions: [".docx"],
        mimeType: DOCX_MIME,
        acceptedMimeTypes: [DOCX_MIME],
        // .docx files are ZIP archives, which always start with "PK\x03\x04"
        isValidContent: startsWith(Buffer.from([0x50, 0x4b, 0x03, 0x04])),
    },
]

export function findAllowedType(fileName: string, mimeType: string): AllowedFileType | undefined {
    const lowerName = fileName.toLowerCase()
    return ALLOWED_FILE_TYPES.find(
        (type) =>
            type.extensions.some((extension) => lowerName.endsWith(extension)) &&
            type.acceptedMimeTypes.includes(mimeType),
    )
}
