import { afterEach, describe, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { tmpdir } from "os";
import { trussPlugin } from "./index";

const tempDirs: string[] = [];

afterEach(function () {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe("trussPlugin", function () {
  test("uses the configured mapping for library files", function () {
    // Given we have a src/Css.json
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });
    // And are the application itself, or library in vitest, pointing to src/Css.json
    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    runConfigHooks(plugin, root);
    // When we see an import from Css
    const result = runTransform(
      plugin,
      `import { Css } from "./Css"; const el = <div css={Css.df.$} />;`,
      join(root, "src", "Button.tsx"),
    );
    // Then it is rewritten
    expect(n(result?.code ?? "")).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        const el = <div {...trussProps({ display: "df" })} />;
      `),
    );
  });

  test("skips node_modules files unless package is in externalPackages", function () {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });
    // Given we're the application or library in vitest, using src/Css.json
    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    runConfigHooks(plugin, root);
    // And we have code that is not in an externalPackages
    const result = runTransform(
      plugin,
      `import { Css } from "./Css"; const el = <div css={Css.df.$} />;`,
      join(root, "node_modules", "acme-ui", "src", "Button.tsx"),
    );
    // Then it is not transformed
    expect(result).toBeNull();
  });

  test("transforms whitelisted external package files", function () {
    const root = createTempRoot();
    writeMapping(join(root, "node_modules", "@company", "library", "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });
    // Given we're running the application build, pointing to the library's Css.json
    const plugin = trussPlugin({
      mapping: "./node_modules/@company/library/src/Css.json",
      externalPackages: ["@company/library"],
    });
    runConfigHooks(plugin, root);
    const result = runTransform(
      plugin,
      `import { Css } from "./Css.js"; const el = <div css={Css.df.$} />;`,
      join(root, "node_modules", "@company", "library", "src", "Button.tsx"),
    );
    expect(n(result?.code ?? "")).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        const el = <div {...trussProps({ display: "df" })} />;
      `),
    );
  });

  test("transforms application files importing library Css.ts", function () {
    const root = createTempRoot();
    writeMapping(join(root, "node_modules", "@company", "library", "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });
    // Given we're running the application build, pointing to the library's Css.json
    const plugin = trussPlugin({
      mapping: "./node_modules/@company/library/src/Css.json",
      externalPackages: ["@company/library"],
    });
    runConfigHooks(plugin, root);
    // And we have application src/Button.tsx importing Css from the library
    const result = runTransform(
      plugin,
      `import { Css } from "@company/library"; const el = <div css={Css.df.$} />;`,
      join(root, "src", "Button.tsx"),
    );
    // Then it gets transformed
    expect(n(result?.code ?? "")).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        const el = <div {...trussProps({ display: "df" })} />;
      `),
    );
  });

  test("transforms tsup-bundled library file where Css is created via new CssBuilder", function () {
    const root = createTempRoot();
    writeMapping(join(root, "node_modules", "@company", "library", "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });
    const plugin = trussPlugin({
      mapping: "./node_modules/@company/library/src/Css.json",
      externalPackages: ["@company/library"],
    });
    runConfigHooks(plugin, root);
    // Simulate tsup-bundled output: Css is a local variable, not an import
    const result = runTransform(
      plugin,
      [
        `import { trussProps } from "@homebound/truss/runtime";`,
        `var CssBuilder = class _CssBuilder { constructor(opts) { this.opts = opts; } };`,
        `var Css = new CssBuilder({ rules: {}, enabled: true });`,
        `const el = <div css={Css.df.$} />;`,
        `const el2 = jsx("div", { css: Css.df.$ });`,
      ].join("\n"),
      join(root, "node_modules", "@company", "library", "dist", "index.js"),
    );
    expect(n(result?.code ?? "")).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        var CssBuilder = class _CssBuilder { constructor(opts) { this.opts = opts; } };
        var Css = new CssBuilder({ rules: {}, enabled: true });
        const el = <div {...trussProps({ display: "df" })} />;
        const el2 = jsx("div", { css: { display: "df" } });
      `),
    );
  });

  test("skips tsup-bundled files not in externalPackages", function () {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });
    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    runConfigHooks(plugin, root);
    // A bundled file in node_modules that is NOT whitelisted
    const result = runTransform(
      plugin,
      [
        `var CssBuilder = class _CssBuilder { constructor(opts) { this.opts = opts; } };`,
        `var Css = new CssBuilder({ rules: {}, enabled: true });`,
        `const el = <div css={Css.df.$} />;`,
      ].join("\n"),
      join(root, "node_modules", "other-lib", "dist", "index.js"),
    );
    expect(result).toBeNull();
  });

  test("dev html injects the runtime without a stylesheet link", function () {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });

    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {} as any, { root, command: "serve", mode: "development" } as any);

    const html = invokeHook(plugin.transformIndexHtml, {} as any, "<html><head></head><body></body></html>") as any;
    expect(html).toBeTypeOf("string");
    expect(html.includes('<script type="module" src="/virtual:truss:runtime"></script>')).toBe(true);
    expect(html.includes("/virtual:truss.css")).toBe(false);
  });

  test("dev virtual CSS orders static base rules before variable rules for the same property", function () {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      w100: { kind: "static", defs: { width: "100%" } },
      w: { kind: "variable", props: ["width"], incremented: true },
      df: { kind: "static", defs: { display: "flex" } },
      fg1: { kind: "static", defs: { flexGrow: "1" } },
      aic: { kind: "static", defs: { alignItems: "center" } },
    });

    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    // Configure as dev server so the global registry is used
    invokeHook(plugin.configResolved, {} as any, { root, command: "serve", mode: "development" } as any);
    invokeHook(plugin.buildStart, {} as any);

    // File 1: introduces w_var first, along with other unrelated rules
    runTransform(
      plugin,
      `import { Css } from "./Css"; const x = getWidth(); const s = Css.df.w(x).$;`,
      join(root, "src", "DynamicWidth.tsx"),
    );
    // File 2: introduces fg1 and aic — these go between w_var and w100 in insertion order
    runTransform(plugin, `import { Css } from "./Css"; const s = Css.fg1.aic.$;`, join(root, "src", "Layout.tsx"));
    // File 3: introduces w100 AFTER several other rules were already registered
    runTransform(plugin, `import { Css } from "./Css"; const s = Css.w100.$;`, join(root, "src", "StaticWidth.tsx"));

    // Simulate the dev middleware fetching CSS
    const css = getVirtualCss(plugin);

    // The static w100 rule must appear before the variable w_var rule,
    // even though w_var was registered first and many rules were inserted between them
    const w100Idx = css.indexOf(".w100 {");
    const wVarIdx = css.indexOf(".w_var {");
    expect(w100Idx).toBeGreaterThan(-1);
    expect(wVarIdx).toBeGreaterThan(-1);
    expect(w100Idx).toBeLessThan(wVarIdx);
  });
});

function n(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "truss-test-"));
  tempDirs.push(root);
  return root;
}

function writeMapping(path: string, abbreviations: Record<string, Record<string, unknown>>): void {
  mkdirSync(dirname(path), { recursive: true });
  const mapping = {
    increment: 8,
    abbreviations,
  };
  writeFileSync(path, `${JSON.stringify(mapping, null, 2)}\n`, "utf8");
}

function runConfigHooks(plugin: ReturnType<typeof trussPlugin>, root: string): void {
  invokeHook(plugin.configResolved, {} as any, { root } as any);
  invokeHook(plugin.buildStart, {} as any);
}

function runTransform(
  plugin: ReturnType<typeof trussPlugin>,
  code: string,
  id: string,
): { code: string; map: any } | null {
  const result = invokeHook(plugin.transform, {} as any, code, id);
  if (!result || typeof result !== "object" || !("code" in result)) {
    return null;
  }
  return result as { code: string; map: any };
}

/** Simulate the dev virtual CSS endpoint by invoking configureServer and calling the middleware. */
function getVirtualCss(plugin: ReturnType<typeof trussPlugin>): string {
  let css = "";
  const middlewares: Array<(req: unknown, res: unknown, next: unknown) => void> = [];
  const fakeServer = {
    middlewares: {
      use(fn: (req: unknown, res: unknown, next: unknown) => void) {
        middlewares.push(fn);
      },
    },
    httpServer: { on() {} },
  };

  // Register the middleware
  invokeHook(plugin.configureServer, {} as unknown, fakeServer);

  // Call each middleware with a matching request
  const fakeReq = { url: "/virtual:truss.css" };
  const fakeRes = {
    setHeader() {},
    end(content: string) {
      css = content;
    },
  };

  for (const mw of middlewares) {
    mw(fakeReq, fakeRes, function () {});
  }

  return css;
}

function invokeHook(hook: unknown, thisArg: unknown, ...args: unknown[]): unknown {
  if (!hook) return null;
  if (typeof hook === "function") {
    return hook.call(thisArg, ...args);
  }
  if (typeof hook === "object" && hook !== null && "handler" in hook) {
    const handler = (hook as { handler?: unknown }).handler;
    if (typeof handler === "function") {
      return handler.call(thisArg, ...args);
    }
  }

  return null;
}
