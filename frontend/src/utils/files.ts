import { TEXT_FILE_EXTENSIONS } from "@/constants";

export function getFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

/** Markdown and plain text: the browser can show them directly, no viewer or download needed. */
export function isTextFile(fileName: string): boolean {
  return (TEXT_FILE_EXTENSIONS as readonly string[]).includes(getFileExtension(fileName));
}

export function isPdf(fileName: string, mimeType?: string | null): boolean {
  return mimeType === "application/pdf" || getFileExtension(fileName) === ".pdf";
}
