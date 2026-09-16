import type { ISseFrame } from "@/interfaces";

export interface ISseParser {
  /** Feed the next decoded text chunk; returns every frame completed by it. */
  push: (chunk: string) => ISseFrame[];
  /** Call once the stream ends to emit a final frame that had no trailing blank line. */
  flush: () => ISseFrame[];
}

const DEFAULT_EVENT = "message";

/**
 * Incremental Server-Sent Events parser.
 *
 * Network chunks don't line up with SSE frames: one chunk may hold half a
 * line, or several frames at once. So we buffer text until we see complete
 * lines, and only emit a frame when we reach the blank line that ends it.
 */
export function createSseParser(): ISseParser {
  let pendingText = "";
  let eventName = DEFAULT_EVENT;
  let dataLines: string[] = [];

  const takeFrame = (): ISseFrame | null => {
    const frame = dataLines.length > 0 ? { event: eventName, data: dataLines.join("\n") } : null;
    eventName = DEFAULT_EVENT;
    dataLines = [];
    return frame;
  };

  const readLine = (line: string): ISseFrame | null => {
    if (line === "") return takeFrame();
    if (line.startsWith(":")) return null; // comment / keep-alive

    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const rawValue = colon === -1 ? "" : line.slice(colon + 1);
    const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;

    if (field === "event") eventName = value || DEFAULT_EVENT;
    if (field === "data") dataLines = [...dataLines, value];
    return null;
  };

  const readLines = (lines: string[]): ISseFrame[] =>
    lines.map(readLine).filter((frame): frame is ISseFrame => frame !== null);

  return {
    push(chunk) {
      pendingText += chunk;
      // A trailing "\r" might be the first half of a "\r\n" split across chunks, so keep it for later.
      const holdBack = pendingText.endsWith("\r") ? 1 : 0;
      const ready = pendingText.slice(0, pendingText.length - holdBack);
      const lines = ready.split(/\r\n|\r|\n/);
      // The last piece has no line break after it yet: keep it buffered.
      pendingText = (lines.pop() ?? "") + pendingText.slice(pendingText.length - holdBack);
      return readLines(lines);
    },
    flush() {
      const rest = pendingText.replace(/\r$/, "");
      pendingText = "";
      const frames = rest ? readLines([rest]) : [];
      const last = takeFrame();
      return last ? [...frames, last] : frames;
    },
  };
}
