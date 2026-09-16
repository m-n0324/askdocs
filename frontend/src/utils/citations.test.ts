import { describe, expect, it } from "vitest";
import { makeCitation } from "@/test/fixtures";
import { getCitedCitations, splitCitationMarkers } from "@/utils/citations";

const first = makeCitation({ index: 1 });
const second = makeCitation({ index: 2, chunkId: "chunk-2" });

describe("splitCitationMarkers", () => {
  it("turns markers into citation segments between text segments", () => {
    const segments = splitCitationMarkers("foo [1] bar [2]", [first, second]);

    expect(segments).toEqual([
      { type: "text", text: "foo " },
      { type: "citation", citation: first },
      { type: "text", text: " bar " },
      { type: "citation", citation: second },
    ]);
  });

  it("keeps markers without a matching citation as plain text", () => {
    const segments = splitCitationMarkers("see [7] and [1].", [first]);

    expect(segments).toEqual([
      { type: "text", text: "see [7] and " },
      { type: "citation", citation: first },
      { type: "text", text: "." },
    ]);
  });

  it("supports adjacent and grouped markers", () => {
    expect(splitCitationMarkers("a[1][2]", [first, second]).map((segment) => segment.type)).toEqual([
      "text",
      "citation",
      "citation",
    ]);
    expect(splitCitationMarkers("b [1, 2]", [first, second]).filter((s) => s.type === "citation")).toHaveLength(2);
  });

  it("returns one text segment when there are no citations", () => {
    expect(splitCitationMarkers("I don't know [1].", [])).toEqual([{ type: "text", text: "I don't know [1]." }]);
  });

  it("returns an empty list for empty text", () => {
    expect(splitCitationMarkers("", [first])).toEqual([]);
  });
});

describe("getCitedCitations", () => {
  it("returns only citations used in the text, sorted by index", () => {
    const third = makeCitation({ index: 3 });

    expect(getCitedCitations("x [3] y [1]", [first, second, third])).toEqual([first, third]);
  });
});
