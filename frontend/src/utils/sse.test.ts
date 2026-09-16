import { describe, expect, it } from "vitest";
import { createSseParser } from "@/utils/sse";

describe("createSseParser", () => {
  it("parses a complete frame with an event name and JSON data", () => {
    const parser = createSseParser();

    const frames = parser.push('event: token\ndata: {"delta":"Hi"}\n\n');

    expect(frames).toEqual([{ event: "token", data: '{"delta":"Hi"}' }]);
  });

  it("parses several frames delivered in one chunk", () => {
    const parser = createSseParser();

    const frames = parser.push("event: a\ndata: 1\n\nevent: b\ndata: 2\n\n");

    expect(frames).toEqual([
      { event: "a", data: "1" },
      { event: "b", data: "2" },
    ]);
  });

  it("waits for the rest of a frame that is split across chunks", () => {
    const parser = createSseParser();

    expect(parser.push("event: tok")).toEqual([]);
    expect(parser.push('en\ndata: {"del')).toEqual([]);
    expect(parser.push('ta":"x"}\n')).toEqual([]);
    expect(parser.push("\n")).toEqual([{ event: "token", data: '{"delta":"x"}' }]);
  });

  it("joins multi-line data with newlines", () => {
    const parser = createSseParser();

    const frames = parser.push("data: first line\ndata: second line\n\n");

    expect(frames).toEqual([{ event: "message", data: "first line\nsecond line" }]);
  });

  it("handles CRLF line endings, even when \\r and \\n arrive in different chunks", () => {
    const parser = createSseParser();

    expect(parser.push("event: meta\r\ndata: {}\r")).toEqual([]);
    expect(parser.push("\n\r\n")).toEqual([{ event: "meta", data: "{}" }]);
  });

  it("ignores comments and frames without data", () => {
    const parser = createSseParser();

    const frames = parser.push(": keep-alive\n\nevent: ping\n\ndata: real\n\n");

    expect(frames).toEqual([{ event: "message", data: "real" }]);
  });

  it("keeps the value exactly, only removing one leading space", () => {
    const parser = createSseParser();

    const frames = parser.push("data:no-space\n\ndata:   indented\n\n");

    expect(frames.map((frame) => frame.data)).toEqual(["no-space", "  indented"]);
  });

  it("emits a last frame without a trailing blank line on flush", () => {
    const parser = createSseParser();

    expect(parser.push("event: done\ndata: {}")).toEqual([]);
    expect(parser.flush()).toEqual([{ event: "done", data: "{}" }]);
  });

  it("returns nothing on flush when the buffer is empty", () => {
    const parser = createSseParser();
    parser.push("data: x\n\n");

    expect(parser.flush()).toEqual([]);
  });
});
