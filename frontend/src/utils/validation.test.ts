import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES } from "@/constants";
import {
  validateChatMessage,
  isHttpUrl,
  validateEmail,
  validateIntegerInRange,
  validatePassword,
  validateUploadFile,
  validateUrl,
  validateWorkspaceName,
} from "@/utils/validation";

describe("validation", () => {
  it("validates email addresses", () => {
    expect(validateEmail("ada@example.com")).toBeNull();
    expect(validateEmail("")).toMatch(/required/);
    expect(validateEmail("ada@")).toMatch(/valid/);
  });

  it("requires passwords of at least 8 characters", () => {
    expect(validatePassword("12345678")).toBeNull();
    expect(validatePassword("1234567")).toMatch(/8 characters/);
  });

  it("limits workspace names to 1-80 characters", () => {
    expect(validateWorkspaceName("Docs")).toBeNull();
    expect(validateWorkspaceName("   ")).not.toBeNull();
    expect(validateWorkspaceName("x".repeat(81))).not.toBeNull();
  });

  it("accepts Markdown, TXT, PDF and DOCX files up to 10 MB", () => {
    expect(validateUploadFile({ name: "notes.md", size: 100 })).toBeNull();
    expect(validateUploadFile({ name: "README.markdown", size: 100 })).toBeNull();
    expect(validateUploadFile({ name: "notes.TXT", size: 100 })).toBeNull();
    expect(validateUploadFile({ name: "a.PDF", size: 100 })).toBeNull();
    expect(validateUploadFile({ name: "a.docx", size: MAX_UPLOAD_BYTES })).toBeNull();
    expect(validateUploadFile({ name: "page.html", size: 100 })).toMatch(/Markdown, TXT, PDF or DOCX/);
    expect(validateUploadFile({ name: "a.pdf", size: MAX_UPLOAD_BYTES + 1 })).toMatch(/10 MB/);
    expect(validateUploadFile({ name: "a.pdf", size: 0 })).toMatch(/empty/);
  });

  it("accepts only http(s) URLs", () => {
    expect(validateUrl("https://example.com/docs")).toBeNull();
    expect(validateUrl("example.com")).not.toBeNull();
    expect(validateUrl("ftp://example.com")).toMatch(/http/);
  });

  it("only treats http(s) URLs as safe to open", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("data:text/html,hi")).toBe(false);
    expect(isHttpUrl("not a url")).toBe(false);
  });

  it("checks integer ranges", () => {
    expect(validateIntegerInRange(10, 1, 20)).toBeNull();
    expect(validateIntegerInRange(0, 1, 20)).not.toBeNull();
    expect(validateIntegerInRange(1.5, 1, 20)).not.toBeNull();
  });

  it("requires a non-empty chat message under 2000 characters", () => {
    expect(validateChatMessage("Hi")).toBeNull();
    expect(validateChatMessage("  ")).not.toBeNull();
    expect(validateChatMessage("x".repeat(2001))).not.toBeNull();
  });
});
