import { __injectTrussCSS, useRuntimeStyle } from "@homebound/truss/runtime";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

afterEach(cleanup);

describe("library css", () => {
  test("automatically includes library css file", () => {
    const r = render(<div className="beamStatic">beam</div>);
    const el = r.container.firstChild as HTMLElement;
    expect(el).toHaveStyle({ display: "flex" });
    expect(document.querySelector("style[data-truss]")?.textContent).toBe("");
    expect(document.querySelectorAll("style[data-truss-chunk]").length).toBeGreaterThan(0);
  });

  test("keeps runtime styles in place between injected chunks", () => {
    __injectTrussCSS(".injection-order { color: red; }");
    const r = render(<RuntimeStyleHarness />);
    const el = r.container.firstChild as HTMLElement;
    const runtimeStyle = document.querySelector("style[data-truss-runtime-style]") as HTMLStyleElement;
    const sheet = runtimeStyle.sheet;
    expect(el).toHaveStyle({ color: "rgb(0, 128, 0)" });

    __injectTrussCSS(".injection-order { color: blue; }");

    expect(runtimeStyle.previousElementSibling?.textContent).toBe(".injection-order { color: red; }");
    expect(runtimeStyle.nextElementSibling?.textContent).toBe(".injection-order { color: blue; }");
    expect(runtimeStyle.sheet).toBe(sheet);
    expect(el).toHaveStyle({ color: "rgb(0, 0, 255)" });
    r.unmount();
    expect(runtimeStyle.isConnected).toBe(false);
  });
});

/** Mount a runtime rule between two module CSS chunks. */
function RuntimeStyleHarness() {
  useRuntimeStyle({ ".injection-order": { color: "green" } });
  return <div className="injection-order">ordered</div>;
}
