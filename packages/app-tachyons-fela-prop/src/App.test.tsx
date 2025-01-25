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
              class="a c d"
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

    expect(styleSheetsToString()).toMatchInlineSnapshot(`
      ".a {color: #353535;}
      .b {top: 8px;}
      .c:hover {color: #fcfcfa;}
      .d:hover {top: 8px;}"
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

function styleSheetsToString(): string {
  let result = "";
  for (const sheet of document.styleSheets) {
    if (sheet.cssRules) {
      for (const rule of sheet.cssRules) {
        result += `${rule.cssText}\n`;
      }
      result += "\n";
    }
  }
  return result.trim();
}
