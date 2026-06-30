import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LearningModes } from "@/ui/subject/LearningModes";

afterEach(cleanup);

describe("LearningModes — the time-by-duration SELECTOR (really switches the cell's mode)", () => {
  it("selecting an available mode calls onSelect with that mode", () => {
    const onSelect = vi.fn();
    render(<LearningModes modes={{ heavy: true, light: true, review: 0 }} active="heavy" onSelect={onSelect} accent="#3f74e8" />);
    fireEvent.click(screen.getByRole("button", { name: /Lección corta/ }));
    expect(onSelect).toHaveBeenCalledWith("light");
  });

  it("an unavailable mode is disabled and never fires onSelect", () => {
    const onSelect = vi.fn();
    render(<LearningModes modes={{ heavy: false, light: true, review: 0 }} active="light" onSelect={onSelect} accent="#3f74e8" />);
    const heavy = screen.getByRole("button", { name: /Misión grande/ });
    expect(heavy).toBeDisabled();
    fireEvent.click(heavy);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("review is always available (a 5-min recall of this cell) and the active mode is aria-pressed", () => {
    render(<LearningModes modes={{ heavy: false, light: false, review: 0 }} active="review" onSelect={() => {}} accent="#3f74e8" />);
    const review = screen.getByRole("button", { name: /Repaso/ });
    expect(review).not.toBeDisabled();
    expect(review).toHaveAttribute("aria-pressed", "true");
  });
});
