import { describe, expect, it } from "vitest";
import { getFileExtension, isPdf, isTextFile } from "@/utils/files";

describe("file helpers", () => {
  it("reads the lower-cased extension", () => {
    expect(getFileExtension("Notes.MD")).toBe(".md");
    expect(getFileExtension("no-extension")).toBe("");
  });

  it("recognises Markdown and plain text files", () => {
    expect(isTextFile("notes.md")).toBe(true);
    expect(isTextFile("README.markdown")).toBe(true);
    expect(isTextFile("todo.TXT")).toBe(true);
    expect(isTextFile("report.pdf")).toBe(false);
    expect(isTextFile("letter.docx")).toBe(false);
  });

  it("recognises PDFs by name or MIME type", () => {
    expect(isPdf("report.PDF")).toBe(true);
    expect(isPdf("download", "application/pdf")).toBe(true);
    expect(isPdf("notes.md")).toBe(false);
  });
});
