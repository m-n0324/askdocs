import {
  ALLOWED_UPLOAD_EXTENSIONS,
  UPLOAD_FORMATS_LABEL,
  CHAT_MESSAGE_MAX_LENGTH,
  MAX_UPLOAD_BYTES,
  PASSWORD_MIN_LENGTH,
  WORKSPACE_NAME_MAX_LENGTH,
} from "@/constants";
import { getFileExtension } from "@/utils/files";

// Every validator returns an error message, or null when the value is valid.
type ValidationResult = string | null;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX_LENGTH = 80;

export function validateEmail(email: string): ValidationResult {
  if (!email.trim()) return "Email is required.";
  return EMAIL_PATTERN.test(email.trim()) ? null : "Enter a valid email address.";
}

export function validatePassword(password: string): ValidationResult {
  if (!password) return "Password is required.";
  return password.length >= PASSWORD_MIN_LENGTH
    ? null
    : `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
}

export function validateName(name: string): ValidationResult {
  if (!name.trim()) return "Name is required.";
  return name.trim().length <= NAME_MAX_LENGTH ? null : `Keep it under ${NAME_MAX_LENGTH} characters.`;
}

export function validateWorkspaceName(name: string): ValidationResult {
  if (!name.trim()) return "Give the workspace a name.";
  return name.trim().length <= WORKSPACE_NAME_MAX_LENGTH
    ? null
    : `Names can be at most ${WORKSPACE_NAME_MAX_LENGTH} characters.`;
}

export function validateUploadFile(file: { name: string; size: number }): ValidationResult {
  const extension = getFileExtension(file.name);
  if (!(ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(extension)) {
    return `"${file.name}" isn't supported. Upload a ${UPLOAD_FORMATS_LABEL} file.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) return `"${file.name}" is larger than 10 MB.`;
  if (file.size === 0) return `"${file.name}" is empty.`;
  return null;
}

/** True only for absolute http(s) URLs, so `javascript:` or `data:` links can never be opened. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateUrl(value: string): ValidationResult {
  if (!value.trim()) return "Enter a website URL.";
  if (!URL.canParse(value.trim())) return "Enter a full URL, e.g. https://example.com/docs";
  return isHttpUrl(value) ? null : "Use an http:// or https:// address.";
}

export function validateIntegerInRange(value: number, min: number, max: number): ValidationResult {
  return Number.isInteger(value) && value >= min && value <= max ? null : `Use a whole number from ${min} to ${max}.`;
}

export function validateChatMessage(message: string): ValidationResult {
  if (!message.trim()) return "Type a question first.";
  return message.length <= CHAT_MESSAGE_MAX_LENGTH
    ? null
    : `Questions can be at most ${CHAT_MESSAGE_MAX_LENGTH} characters.`;
}
