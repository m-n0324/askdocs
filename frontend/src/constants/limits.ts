export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** In order of preference: plain text formats are the smallest and fastest to index. */
export const ALLOWED_UPLOAD_EXTENSIONS = [".md", ".markdown", ".txt", ".pdf", ".docx"] as const;
export const UPLOAD_FORMATS_LABEL = "Markdown, TXT, PDF or DOCX";
export const TEXT_FILE_EXTENSIONS = [".md", ".markdown", ".txt"] as const;

export const PASSWORD_MIN_LENGTH = 8;
export const WORKSPACE_NAME_MAX_LENGTH = 80;
export const CHAT_MESSAGE_MAX_LENGTH = 2000;

export const CRAWL_DEPTH = { min: 0, max: 2, default: 1 } as const;
export const CRAWL_PAGES = { min: 1, max: 20, default: 10 } as const;

export const SOURCES_POLL_INTERVAL_MS = 2_000;
/**
 * How long a blob URL for an opened source file stays valid. The PDF tab still
 * uses it (reload, print, save), so we keep it a while and accept the small memory cost.
 */
export const OBJECT_URL_TTL_MS = 10 * 60_000;
