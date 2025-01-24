import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { App } from "./App";
import "@testing-library/jest-dom/vitest";

describe("App", () => {
  test("renders hello world", () => {
    render(<App />);

    expect(screen.getByText(/Vite1/)).toBeInTheDocument();
  });

  test("clicking button increments counter", async () => {
    render(<App />);
    const user = userEvent.setup();

    const button = screen.getByRole("button");
    await user.click(button);

    expect(screen.getByText("count is 1")).toBeInTheDocument();
  });
});

afterEach(() => {
  cleanup();
});
