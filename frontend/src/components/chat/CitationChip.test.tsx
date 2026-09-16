import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeCitation } from "@/test/fixtures";
import { AnswerText } from "@/components/chat/AnswerText";
import { CitationChip } from "@/components/chat/CitationChip";

describe("CitationChip", () => {
  it("is a labelled button that reports which citation was chosen", () => {
    const citation = makeCitation({ index: 2 });
    const onSelect = vi.fn();
    render(<CitationChip citation={citation} onSelect={onSelect} />);

    const chip = screen.getByRole("button", { name: "Source 2: handbook.pdf, p. 4 · Refunds" });
    fireEvent.click(chip);

    expect(chip).toHaveTextContent("2");
    expect(onSelect).toHaveBeenCalledWith(citation);
  });

  it("marks the active chip as pressed", () => {
    render(<CitationChip citation={makeCitation()} isActive onSelect={() => {}} />);

    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });
});

describe("AnswerText", () => {
  it("renders chips for known markers and leaves unknown markers as text", () => {
    render(
      <AnswerText
        text="Refunds take 14 days [1]. See also [9]."
        citations={[makeCitation({ index: 1 })]}
        activeIndex={null}
        onSelectCitation={() => {}}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByText(/See also \[9\]\./)).toBeInTheDocument();
  });

  it("renders HTML in answers as text, never as markup", () => {
    const { container } = render(
      <AnswerText text={'<img src=x onerror="alert(1)">'} citations={[]} activeIndex={null} onSelectCitation={() => {}} />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent('<img src=x onerror="alert(1)">');
  });
});
