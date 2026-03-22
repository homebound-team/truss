import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { App } from "./App";
import { hasCssDeclaration } from "./testCssUtils";
import "@testing-library/jest-dom/vitest";

afterEach(() => {
  cleanup();
});

describe("App", () => {
  test("renders heading with correct styles", () => {
    render(<App />);
    const heading = screen.getByText("Truss + StyleX");
    expect(heading).toHaveStyle({ color: "#353535", fontSize: "24px" });
  });

  test("root container is a flex column centered with padding", () => {
    render(<App />);
    const root = screen.getByText("Truss + StyleX").parentElement!;
    expect(root).toHaveStyle({
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    });
  });

  test("body text has f14 + black styles", () => {
    render(<App />);
    const body = screen.getByText(/This demo uses the Truss DSL/);
    expect(body).toHaveStyle({ fontSize: "14px", color: "#353535" });
  });

  test("border box has border, padding, radius, cursor, and hover styles", () => {
    render(<App />);
    const box = screen.getByText("Border box with padding and radius");
    expect(box).toHaveStyle({
      borderStyle: "solid",
      borderWidth: "1px",
      borderRadius: ".25rem",
      cursor: "pointer",
    });
    expect(hasCssDeclaration(box, "border-color", { hover: false })).toBe(true);
    expect(hasCssDeclaration(box, "border-color", { hover: true })).toBe(true);
  });

  test("blue box has white text, cursor, and hover styles", () => {
    render(<App />);
    const box = screen.getByText("Blue background with white text");
    expect(box).toHaveStyle({ color: "#fcfcfa", cursor: "pointer" });
    expect(hasCssDeclaration(box, "background-color", { hover: false })).toBe(true);
    expect(hasCssDeclaration(box, "background-color", { hover: true })).toBe(true);
  });

  test("clicking button increments counter", async () => {
    render(<App />);
    const user = userEvent.setup();
    const button = screen.getByRole("button");
    await user.click(button);
    expect(screen.getByText("Clicked 1 times")).toBeInTheDocument();
  });

  test("conditional styles apply black below threshold", async () => {
    render(<App />);
    const user = userEvent.setup();
    const button = screen.getByRole("button");
    await user.click(button);
    const span = screen.getByText("Clicked 1 times");
    expect(span).toHaveStyle({ color: "#353535" });
  });

  test("conditional styles apply blue above threshold", async () => {
    render(<App />);
    const user = userEvent.setup();
    const button = screen.getByRole("button");
    for (let i = 0; i < 6; i++) {
      await user.click(button);
    }
    const span = screen.getByText("That's a lot!");
    expect(span).toHaveStyle({ color: "#526675" });
  });

  // marker/when() deferred to Phase 3
  test.skip("marker card renders with data attribute and child has class", () => {
    render(<App />);
    const markerCard = screen.getByText("Hover this card").parentElement!;
    const childSpan = screen.getByText(/I turn blue on parent hover/);
    // Both marker card and child should have class names applied
    expect(markerCard.className).toBeTruthy();
    expect(childSpan.className).toBeTruthy();
  });
});
