import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { App } from "./App";
import "@testing-library/jest-dom/vitest";

if (process.env.JB_IDE_PORT) {
  vi.setConfig({ testTimeout: 100_000 });
}

describe("App", () => {
  test("renders hello world", () => {
    const r = render(<App />);
    expect(screen.getByText(/Vite1/)).toBeInTheDocument();
    expect(r.baseElement).toMatchInlineSnapshot(`
      <body>
        <div>
          <div>
            <h1
              class="a b"
            >
              Vite1
            </h1>
            <h1
              style="color: rgb(53, 53, 53);"
            >
              Vite2
            </h1>
            <div>
              <button>
                count is 
                0
              </button>
            </div>
          </div>
        </div>
      </body>
    `);
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
