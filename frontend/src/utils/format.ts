import type { ICitation } from "@/interfaces";

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");
const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const BYTE_UNITS = ["B", "KB", "MB", "GB"] as const;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const RELATIVE_DAYS_LIMIT = 7;

export function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(value);
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes < 0) return "—";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${BYTE_UNITS[unit]}`;
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : DATE_FORMAT.format(date);
}

/** "just now", "5m ago", "3h ago", "2d ago", then a plain date. */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "—";
  const diff = Math.max(0, now - time);
  if (diff < MINUTE_MS) return "just now";
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}m ago`;
  if (diff < DAY_MS) return `${Math.floor(diff / HOUR_MS)}h ago`;
  if (diff < RELATIVE_DAYS_LIMIT * DAY_MS) return `${Math.floor(diff / DAY_MS)}d ago`;
  return formatDate(iso);
}

/** "p. 4 · Pricing" / "p. 4" / "Pricing" / null. */
export function formatCitationLocation(citation: Pick<ICitation, "page" | "section">): string | null {
  const parts = [citation.page !== null ? `p. ${citation.page}` : null, citation.section].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Ratio clamped to 0..100, rounded to one decimal. */
export function toPercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 1000) / 10));
}
