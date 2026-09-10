import { __injectTrussCSS, useRuntimeStyle } from "@homebound/truss/runtime";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Css } from "./Css";
import "./test-fixtures/BuildOnly.css";

afterEach(cleanup);

describe("library css", () => {
  test("compiles side-effect-only CSS without executing build-only expressions", () => {
    // Given the side-effect fixture uses Css.setVar, which cannot execute in CssBuilder
    const r = render(<div className="build-only-css">compiled</div>);
    const el = r.container.firstChild as HTMLElement;
    expect(el).toHaveStyle({ display: "flex" });
    expect(getComputedStyle(el).getPropertyValue("--test-color")).toBe("red");
  });

  test("automatically includes library css file", () => {
    const r = render(<div className="beamStatic">beam</div>);
    const el = r.container.firstChild as HTMLElement;
    expect(el).toHaveStyle({ display: "flex" });
    const staticStyle = document.querySelector("style[data-truss]") as HTMLStyleElement;
    expect(staticStyle.textContent).toBe("");
    expect(
      Array.from(staticStyle.sheet!.cssRules)
        .filter((rule) => (rule as CSSStyleRule).selectorText === ".beamStatic")
        .map((rule) => rule.cssText),
    ).toEqual([".beamStatic { display: flex; }"]);
    expect(document.querySelectorAll("style[data-truss]").length).toBe(1);
    expect(document.styleSheets.length).toBe(1);
  });

  test("keeps the library's conflicting atomic rule over application delivery", () => {
    // Given library bootstrap defines mt_137px as margin-top: 23px
    // And this application module compiles the same class with margin-top: 137px
    const r = render(<div css={Css.mtPx(137).$}>conflicting</div>);
    const el = r.container.firstChild as HTMLElement;
    expect(el.className).toBe("mt_137px");
    expect(el).toHaveStyle({ marginTop: "23px" });
  });

  test("keeps runtime styles after the fixed static sheet during late injection", () => {
    __injectTrussCSS({
      rules: [{ priority: 3000, className: "injection-order-red", cssText: ".injection-order { color: red; }" }],
    });
    const r = render(<RuntimeStyleHarness />);
    const el = r.container.firstChild as HTMLElement;
    const runtimeStyle = document.querySelector("style[data-truss-runtime-style]") as HTMLStyleElement;
    const sheet = runtimeStyle.sheet;
    const staticStyle = document.querySelector("style[data-truss]") as HTMLStyleElement;
    const staticSheet = staticStyle.sheet;
    expect(el).toHaveStyle({ color: "rgb(0, 128, 0)" });

    __injectTrussCSS({
      rules: [{ priority: 3001, className: "injection-order-blue", cssText: ".injection-order { color: blue; }" }],
    });

    expect(runtimeStyle.previousElementSibling).toBe(staticStyle);
    expect(runtimeStyle.nextElementSibling).toBeNull();
    expect(staticStyle.sheet).toBe(staticSheet);
    expect(
      Array.from(staticSheet!.cssRules)
        .filter((rule) => (rule as CSSStyleRule).selectorText === ".injection-order")
        .map((rule) => rule.cssText),
    ).toEqual([".injection-order { color: red; }", ".injection-order { color: blue; }"]);
    expect(runtimeStyle.sheet).toBe(sheet);
    expect(el).toHaveStyle({ color: "rgb(0, 128, 0)" });
    r.unmount();
    expect(runtimeStyle.isConnected).toBe(false);
  });

  test("delivers dynamically imported arbitrary CSS after bootstrap", async () => {
    // Given bootstrap has already created the static sheet without the late selector
    const staticStyle = document.querySelector("style[data-truss]") as HTMLStyleElement;
    const sheet = staticStyle.sheet;
    expect(
      Array.from(sheet!.cssRules).filter((rule) => (rule as CSSStyleRule).selectorText === ".late-library-css"),
    ).toEqual([]);
    // And a mounted element uses the selector before its module is evaluated
    const r = render(<div className="late-library-css">late</div>);
    const el = r.container.firstChild as HTMLElement;
    expect(getComputedStyle(el).display).toBe("block");

    const late = await import("./test-fixtures/LateLibrary.css");

    expect(late.lateClassName).toBe("late-library-css");
    expect(el).toHaveStyle({ display: "flex" });
    // And a named import adds the virtual side effect for the same canonical source
    const named = await import("./test-fixtures/LateLibraryImport");
    expect(named.lateClassName).toBe("late-library-css");
    expect(
      Array.from(sheet!.cssRules)
        .filter((rule) => (rule as CSSStyleRule).selectorText === ".late-library-css")
        .map((rule) => rule.cssText),
    ).toEqual([".late-library-css { display: flex; }"]);
    expect(staticStyle.sheet).toBe(sheet);
    expect(staticStyle.textContent).toBe("");
    expect(document.querySelectorAll("style[data-truss]").length).toBe(1);
    expect(document.styleSheets.length).toBe(1);
  });
});

/** Mount a runtime rule before late static CSS delivery. */
function RuntimeStyleHarness() {
  useRuntimeStyle({ ".injection-order": { color: "green" } });
  return <div className="injection-order">ordered</div>;
}
