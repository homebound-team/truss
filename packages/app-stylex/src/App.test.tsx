import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { App } from "./App";
import "@testing-library/jest-dom/vitest";

if (process.env.JB_IDE_PORT) {
  vi.setConfig({ testTimeout: 100_000 });
}

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

  test("border box has border, borderColor, padding, and radius", () => {
    render(<App />);
    const box = screen.getByText("Border box with padding and radius");
    expect(box).toHaveStyle({
      borderStyle: "solid",
      borderWidth: "1px",
      borderColor: "#353535",
      borderRadius: ".25rem",
    });
  });

  test("blue box has blue background and white text", () => {
    render(<App />);
    const box = screen.getByText("Blue background with white text");
    expect(box).toHaveStyle({
      backgroundColor: "#526675",
      color: "#fcfcfa",
    });
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
});
