import { describe, expect, it } from "vitest";
import { formatBytes, formatCitationLocation, formatNumber, formatRelativeTime, toPercent } from "@/utils/format";

describe("formatBytes", () => {
  it.each([
    [null, "—"],
    [0, "0 B"],
    [512, "512 B"],
    [1536, "1.5 KB"],
    [10 * 1024 * 1024, "10 MB"],
    [2.25 * 1024 * 1024, "2.3 MB"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatBytes(input)).toBe(expected);
  });
});

describe("formatNumber", () => {
  it("adds thousands separators", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-10-02T12:00:00.000Z").getTime();

  it.each([
    ["2026-10-02T11:59:30.000Z", "just now"],
    ["2026-10-02T11:55:00.000Z", "5m ago"],
    ["2026-10-02T09:00:00.000Z", "3h ago"],
    ["2026-09-30T12:00:00.000Z", "2d ago"],
  ])("formats %s as %s", (iso, expected) => {
    expect(formatRelativeTime(iso, now)).toBe(expected);
  });

  it("falls back to a date after a week and handles bad input", () => {
    expect(formatRelativeTime("2026-08-01T12:00:00.000Z", now)).toMatch(/Aug/);
    expect(formatRelativeTime("not a date", now)).toBe("—");
  });
});

describe("formatCitationLocation", () => {
  it("combines page and section when present", () => {
    expect(formatCitationLocation({ page: 4, section: "Refunds" })).toBe("p. 4 · Refunds");
    expect(formatCitationLocation({ page: 4, section: null })).toBe("p. 4");
    expect(formatCitationLocation({ page: null, section: "Intro" })).toBe("Intro");
    expect(formatCitationLocation({ page: null, section: null })).toBeNull();
  });
});

describe("toPercent", () => {
  it("rounds to one decimal and clamps to 0..100", () => {
    expect(toPercent(1, 3)).toBe(33.3);
    expect(toPercent(5, 0)).toBe(0);
    expect(toPercent(150, 100)).toBe(100);
  });
});
