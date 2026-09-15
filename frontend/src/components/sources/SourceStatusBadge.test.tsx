import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceStatusBadge } from "@/components/sources/SourceStatusBadge";

describe("SourceStatusBadge", () => {
  it.each([
    ["pending", "Queued"],
    ["processing", "Processing"],
    ["ready", "Ready"],
    ["failed", "Failed"],
  ] as const)("shows a label for %s", (status, label) => {
    render(<SourceStatusBadge status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("puts the failure reason in a tooltip", () => {
    render(<SourceStatusBadge status="failed" error="Could not read the PDF" />);

    expect(screen.getByText("Failed").closest("span")).toHaveAttribute("title", "Could not read the PDF");
  });

  it("does not show an error tooltip for healthy sources", () => {
    render(<SourceStatusBadge status="ready" error="stale error" />);

    expect(screen.getByText("Ready").closest("span")).not.toHaveAttribute("title");
  });
});
