import { describe, expect, test, vi } from "vitest";
import { mergeProps, TrussDebugInfo, trussProps, __injectTrussCSS } from "./runtime";

describe("trussProps", () => {
  test("merges static style hashes", () => {
    const result = trussProps({ display: "df", alignItems: "aic" }, { color: "black" });
    expect(result).toEqual({ className: "df aic black" });
  });

  test("last-write-wins for same property", () => {
    const result = trussProps({ display: "df" }, { display: "db" });
    expect(result).toEqual({ className: "db" });
  });

  test("handles space-separated class bundles", () => {
    const result = trussProps({ color: "black blue_h", display: "df" });
    expect(result).toEqual({ className: "black blue_h df" });
  });

  test("passes through custom className entries", () => {
    const result = trussProps({ className_custom: "custom", className_custom_2: "custom-2", display: "df" });
    expect(result).toEqual({ className: "custom custom-2 df" });
  });

  test("passes through custom inline style entries", () => {
    const result = trussProps({
      style_iconVars: { "--icon-primary": "red", "--icon-secondary": undefined },
      display: "df",
    });
    expect(result).toEqual({
      className: "df",
      style: { "--icon-primary": "red" },
    });
  });

  test("handles variable tuples with CSS variables", () => {
    const result = trussProps({ marginTop: ["mt_var", { "--marginTop": "16px" }] });
    expect(result).toEqual({
      className: "mt_var",
      style: { "--marginTop": "16px" },
    });
  });

  test("handles variable tuples with multiple CSS variables", () => {
    const result = trussProps({
      borderColor: ["bc_var bc_var_h", { "--borderColor": "red", "--h_borderColor": "blue" }],
    });
    expect(result).toEqual({
      className: "bc_var bc_var_h",
      style: { "--borderColor": "red", "--h_borderColor": "blue" },
    });
  });

  test("later custom inline styles override earlier variable tuple values", () => {
    const result = trussProps({
      marginTop: ["mt_var", { "--marginTop": "16px" }],
      style_iconVars: { "--marginTop": "24px" },
    });
    expect(result).toEqual({
      className: "mt_var",
      style: { "--marginTop": "24px" },
    });
  });

  test("later variable tuple values override earlier custom inline styles", () => {
    const result = trussProps({
      style_iconVars: { "--marginTop": "24px" },
      marginTop: ["mt_var", { "--marginTop": "16px" }],
    });
    expect(result).toEqual({
      className: "mt_var",
      style: { "--marginTop": "16px" },
    });
  });

  test("override replaces entire property bundle including pseudo classes", () => {
    const result = trussProps({ color: "black blue_h" }, { color: "white" });
    expect(result).toEqual({ className: "white" });
  });

  test("filters falsy values", () => {
    const result = trussProps({ display: "df" }, false, null, undefined, { color: "black" });
    expect(result).toEqual({ className: "df black" });
  });

  test("does not emit data-truss-src in Vitest", () => {
    const result = trussProps({
      display: ["df", new TrussDebugInfo("MyComponent.tsx:5")],
      color: "black",
    });
    expect(result).toEqual({
      className: "df black",
    });
  });

  test("still emits data-truss-src outside Vitest", async () => {
    const previousVitest = process.env.VITEST;

    delete process.env.VITEST;

    try {
      vi.resetModules();
      const runtime = await import("./runtime");
      const result = runtime.trussProps({
        display: ["df", new runtime.TrussDebugInfo("MyComponent.tsx:5")],
        color: "black",
      });

      expect(result).toEqual({
        className: "df black",
        "data-truss-src": "MyComponent.tsx:5",
      });
    } finally {
      if (previousVitest === undefined) {
        delete process.env.VITEST;
      } else {
        process.env.VITEST = previousVitest;
      }
      vi.resetModules();
    }
  });

  test("omits deduplicated debug sources in Vitest", () => {
    const result = trussProps(
      { display: ["df", new TrussDebugInfo("A.tsx:1")] },
      { color: ["black", new TrussDebugInfo("A.tsx:1")] },
    );
    expect(result).toEqual({
      className: "df black",
    });
  });

  test("handles variable tuple with debug info in Vitest without data-truss-src", () => {
    const result = trussProps({
      marginTop: ["mt_var", { "--marginTop": "16px" }, new TrussDebugInfo("File.tsx:3")],
    });
    expect(result).toEqual({
      className: "mt_var",
      style: { "--marginTop": "16px" },
    });
  });

  test("returns empty className for no inputs", () => {
    const result = trussProps();
    expect(result).toEqual({ className: "" });
  });

  test("throws for plain object values that are not Truss tuples", () => {
    expect(() => {
      trussProps({ color: { bad: true } as unknown as "black" });
    }).toThrowError(
      "Invalid Truss style value for `color`. trussProps only accepts generated Truss style hashes; use mergeProps for explicit className/style merging.",
    );
  });

  test("throws for tuple values with invalid payloads", () => {
    expect(() => {
      trussProps({ color: ["black", 123] as unknown as "black" });
    }).toThrowError(
      "Invalid Truss style value for `color`. trussProps only accepts generated Truss style hashes; use mergeProps for explicit className/style merging.",
    );
  });

  test("skips validation in production mode", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    try {
      vi.resetModules();
      const runtime = await import("./runtime");
      const result = runtime.trussProps({ color: { bad: true } as unknown as "black" });
      expect(result).toEqual({ className: "" });
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      vi.resetModules();
    }
  });
});

describe("mergeProps", () => {
  test("prepends explicit className", () => {
    const result = mergeProps("existing", undefined, { display: "df" });
    expect(result).toEqual({ className: "existing df" });
  });

  test("merges explicit style with CSS variables", () => {
    const result = mergeProps(
      undefined,
      { color: "red" },
      {
        marginTop: ["mt_var", { "--marginTop": "16px" }],
      },
    );
    expect(result).toEqual({
      className: "mt_var",
      style: { color: "red", "--marginTop": "16px" },
    });
  });

  test("CSS variables override explicit style keys if they collide", () => {
    // CSS variables (from Truss) should take precedence over explicit style
    const result = mergeProps(undefined, { "--marginTop": "8px" } as Record<string, unknown>, {
      marginTop: ["mt_var", { "--marginTop": "16px" }],
    });
    expect(result).toEqual({
      className: "mt_var",
      style: { "--marginTop": "16px" },
    });
  });

  test("handles both explicit className and style together", () => {
    const result = mergeProps("myClass", { fontSize: "14px" }, { display: "df", color: "black" });
    expect(result).toEqual({
      className: "myClass df black",
      style: { fontSize: "14px" },
    });
  });

  test("omits debug info in Vitest", () => {
    const result = mergeProps("existing", undefined, {
      display: ["df", new TrussDebugInfo("X.tsx:1")],
    });
    expect(result).toEqual({
      className: "existing df",
    });
  });
});

const hasDocument = typeof document !== "undefined";

describe.skipIf(!hasDocument)("__injectTrussCSS", () => {
  test("creates a style tag and injects CSS", () => {
    // Clean up any prior style tags
    document.querySelectorAll("style[data-truss]").forEach((el) => el.remove());

    __injectTrussCSS(".df { display: flex; }");

    const style = document.querySelector("style[data-truss]") as HTMLStyleElement;
    expect(style).not.toBeNull();
    expect(style.textContent).toContain(".df { display: flex; }");
  });

  test("appends to existing style tag", () => {
    document.querySelectorAll("style[data-truss]").forEach((el) => el.remove());

    __injectTrussCSS(".df { display: flex; }");
    __injectTrussCSS(".aic { align-items: center; }");

    const style = document.querySelector("style[data-truss]") as HTMLStyleElement;
    expect(style.textContent).toContain(".df { display: flex; }");
    expect(style.textContent).toContain(".aic { align-items: center; }");
  });

  test("deduplicates identical CSS text", () => {
    document.querySelectorAll("style[data-truss]").forEach((el) => el.remove());

    __injectTrussCSS(".df { display: flex; }");
    __injectTrussCSS(".df { display: flex; }");

    const style = document.querySelector("style[data-truss]") as HTMLStyleElement;
    // Should only appear once
    const count = (style.textContent?.match(/\.df/g) ?? []).length;
    expect(count).toBe(1);
  });

  test("deduplicates repeated merged bootstrap CSS chunks", () => {
    document.querySelectorAll("style[data-truss]").forEach((el) => el.remove());

    const cssText = "/* @truss p:3000 c:beamStatic */\n.beamStatic { display: flex; }";
    __injectTrussCSS(cssText);
    __injectTrussCSS(cssText);

    const style = document.querySelector("style[data-truss]") as HTMLStyleElement;
    expect(style.textContent).toBe("/* @truss p:3000 c:beamStatic */\n.beamStatic { display: flex; }");
  });

  test("recreates the cached style tag after removal", () => {
    document.querySelectorAll("style[data-truss]").forEach((el) => el.remove());

    __injectTrussCSS(".df { display: flex; }");
    const firstStyle = document.querySelector("style[data-truss]") as HTMLStyleElement;
    firstStyle.remove();

    __injectTrussCSS(".aic { align-items: center; }");

    const style = document.querySelector("style[data-truss]") as HTMLStyleElement;
    expect(style.textContent).toBe(".aic { align-items: center; }");
  });
});
