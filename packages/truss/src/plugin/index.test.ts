import { afterEach, describe, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { tmpdir } from "os";
import { trussPlugin } from "./index";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe("trussPlugin", () => {
  test("uses the configured mapping for library files", () => {
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
        const el = <div className="df" />;
      `),
    );
  });

  test("skips all node_modules files", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });
    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    runConfigHooks(plugin, root);
    // Code inside node_modules is never transformed
    const result = runTransform(
      plugin,
      `import { Css } from "./Css"; const el = <div css={Css.df.$} />;`,
      join(root, "node_modules", "acme-ui", "src", "Button.tsx"),
    );
    expect(result).toBeNull();
  });

  test("transforms application files importing library Css.ts", () => {
    const root = createTempRoot();
    writeMapping(join(root, "node_modules", "@company", "library", "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });
    // Given we're running the application build, pointing to the library's Css.json
    const plugin = trussPlugin({
      mapping: "./node_modules/@company/library/src/Css.json",
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
        const el = <div className="df" />;
      `),
    );
  });

  test("test mode bootstraps library CSS for modules without local Truss usage", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });
    writeLibraryCss(root, ["/* @truss p:3000 c:beamStatic */", ".beamStatic { display: flex; }"]);

    const plugin = trussPlugin({
      mapping: "./src/Css.json",
      libraries: ["./node_modules/@company/library/dist/truss.css"],
    });
    invokeHook(plugin.configResolved, {} as any, { root, command: "serve", mode: "test" } as any);
    invokeHook(plugin.buildStart, {} as any);

    const result = runTransform(
      plugin,
      `export const el = <div className="beamStatic" />;`,
      join(root, "src", "LibraryOnly.tsx"),
    );
    expect(n(result?.code ?? "")).toBe(
      n(`
        export const el = <div className="beamStatic" />;
        import "virtual:truss:test-css";
      `),
    );
    const bootstrapModule = getTestCssModule(plugin);
    expect(n(bootstrapModule)).toBe(
      n(`
        import { __injectTrussCSS } from "@homebound/truss/runtime";

        __injectTrussCSS("/* @truss p:3000 c:beamStatic */\\n.beamStatic { display: flex; }");
      `),
    );
  });

  test("test mode relies on the bootstrap module instead of per-file CSS injection", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });
    writeLibraryCss(root, ["/* @truss p:3000 c:beamStatic */", ".beamStatic { display: flex; }"]);

    const plugin = trussPlugin({
      mapping: "./src/Css.json",
      libraries: ["./node_modules/@company/library/dist/truss.css"],
    });
    invokeHook(plugin.configResolved, {} as any, { root, command: "serve", mode: "test" } as any);
    invokeHook(plugin.buildStart, {} as any);

    const result = runTransform(
      plugin,
      `import { Css } from "./Css"; const el = <div css={Css.df.$} className="beamStatic" />;`,
      join(root, "src", "App.tsx"),
    );

    expect(n(result?.code ?? "")).toBe(
      n(`
        import { mergeProps, TrussDebugInfo, __injectTrussCSS } from "@homebound/truss/runtime";
        __injectTrussCSS("/* @truss p:3000 c:df */\\n.df { display: flex; }");
        const el = <div {...mergeProps("beamStatic", undefined, {
          display: ["df", new TrussDebugInfo("App.tsx:1")]
        })} />;
        import "virtual:truss:test-css";
      `),
    );

    const bootstrapModule = getTestCssModule(plugin);
    expect(n(bootstrapModule)).toBe(
      n(`
        import { __injectTrussCSS } from "@homebound/truss/runtime";

        __injectTrussCSS("/* @truss p:3000 c:beamStatic */\\n.beamStatic { display: flex; }\\n/* @truss p:3000 c:df */\\n.df { display: flex; }");
      `),
    );
  });

  test("dev html injects the runtime without a stylesheet link", () => {
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

  test("production html injects a placeholder stylesheet link for truss.css", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });

    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {} as any, { root, command: "build", mode: "production" } as any);

    const html = invokeHook(plugin.transformIndexHtml, {} as any, "<html><head></head><body></body></html>") as any;
    // The placeholder is replaced with the content-hashed filename in writeBundle
    expect(html).toBe(
      '<html><head>    <link rel="stylesheet" href="__TRUSS_CSS_HASH__">\n  </head><body></body></html>',
    );
  });

  test("production html strips dev-only virtual:truss.css link", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });

    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {} as any, { root, command: "build", mode: "production" } as any);

    const html = invokeHook(
      plugin.transformIndexHtml,
      {} as any,
      '<html><head>\n    <link rel="stylesheet" href="/virtual:truss.css" />\n  </head><body></body></html>',
    ) as any;
    expect(html).not.toContain("virtual:truss.css");
    expect(html).toContain("__TRUSS_CSS_HASH__");
  });

  test("dev virtual CSS orders static base rules before variable rules for the same property", () => {
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

  test("CSS output includes priority annotations", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
      black: { kind: "static", defs: { color: "#353535" } },
    });

    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {} as any, { root, command: "serve", mode: "development" } as any);
    invokeHook(plugin.buildStart, {} as any);

    runTransform(plugin, `import { Css } from "./Css"; const s = Css.df.black.$;`, join(root, "src", "App.tsx"));

    const css = getVirtualCss(plugin);
    expect(css).toBe(
      [
        "/* @truss p:3000 c:black */",
        ".black { color: #353535; }",
        "/* @truss p:3000 c:df */",
        ".df { display: flex; }",
      ].join("\n"),
    );
  });

  test("merges library truss.css with app CSS", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
      black: { kind: "static", defs: { color: "#353535" } },
      blue: { kind: "static", defs: { color: "#526675" } },
    });

    // Write a pre-compiled library truss.css with some overlapping and unique rules
    const libCssDir = join(root, "node_modules", "@company", "library", "dist");
    mkdirSync(libCssDir, { recursive: true });
    writeFileSync(
      join(libCssDir, "truss.css"),
      [
        "/* @truss p:3000 c:black */",
        ".black { color: #353535; }",
        "/* @truss p:3000 c:blue */",
        ".blue { color: #526675; }",
        "/* @truss p:3000 c:fdc */",
        ".fdc { flex-direction: column; }",
      ].join("\n"),
      "utf8",
    );

    const plugin = trussPlugin({
      mapping: "./src/Css.json",
      libraries: ["./node_modules/@company/library/dist/truss.css"],
    });
    invokeHook(plugin.configResolved, {} as any, { root, command: "serve", mode: "development" } as any);
    invokeHook(plugin.buildStart, {} as any);

    // App uses df and black (black overlaps with library)
    runTransform(plugin, `import { Css } from "./Css"; const s = Css.df.black.$;`, join(root, "src", "App.tsx"));

    const css = getVirtualCss(plugin);

    // All unique rules present, deduplicated (black from both sources appears once),
    // sorted by priority then alphabetically by class name
    expect(css).toBe(
      [
        "/* @truss p:3000 c:black */",
        ".black { color: #353535; }",
        "/* @truss p:3000 c:blue */",
        ".blue { color: #526675; }",
        "/* @truss p:3000 c:df */",
        ".df { display: flex; }",
        "/* @truss p:3000 c:fdc */",
        ".fdc { flex-direction: column; }",
      ].join("\n"),
    );
  });

  test("merges library @property declarations with app CSS", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      mt: { kind: "variable", props: ["marginTop"], incremented: true },
    });

    // Library ships a truss.css with a variable rule and @property
    const libCssDir = join(root, "node_modules", "@company", "library", "dist");
    mkdirSync(libCssDir, { recursive: true });
    writeFileSync(
      join(libCssDir, "truss.css"),
      [
        "/* @truss p:4000.5 c:mt_var */",
        ".mt_var { margin-top: var(--marginTop); }",
        "/* @truss @property */",
        '@property --marginTop { syntax: "*"; inherits: false; }',
        "/* @truss p:3000 c:blue */",
        ".blue { color: #526675; }",
      ].join("\n"),
      "utf8",
    );

    const plugin = trussPlugin({
      mapping: "./src/Css.json",
      libraries: ["./node_modules/@company/library/dist/truss.css"],
    });
    invokeHook(plugin.configResolved, {} as any, { root, command: "serve", mode: "development" } as any);
    invokeHook(plugin.buildStart, {} as any);

    // App also uses mt(x), producing the same mt_var rule
    runTransform(
      plugin,
      `import { Css } from "./Css"; const x = 2; const s = Css.mt(x).$;`,
      join(root, "src", "App.tsx"),
    );

    const css = getVirtualCss(plugin);

    // Rules sorted by priority, mt_var deduplicated, @property deduplicated
    expect(css).toBe(
      [
        "/* @truss p:3000 c:blue */",
        ".blue { color: #526675; }",
        "/* @truss p:4000.5 c:mt_var */",
        ".mt_var { margin-top: var(--marginTop); }",
        "/* @truss @property */",
        '@property --marginTop { syntax: "*"; inherits: false; }',
      ].join("\n"),
    );
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

function writeLibraryCss(root: string, lines: string[]): void {
  const libCssDir = join(root, "node_modules", "@company", "library", "dist");
  mkdirSync(libCssDir, { recursive: true });
  writeFileSync(join(libCssDir, "truss.css"), lines.join("\n"), "utf8");
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
    mw(fakeReq, fakeRes, () => {});
  }

  return css;
}

function getTestCssModule(plugin: ReturnType<typeof trussPlugin>): string {
  const resolvedId = invokeHook(plugin.resolveId, {} as unknown, "virtual:truss:test-css", undefined);
  expect(resolvedId).toBe("\0virtual:truss:test-css");

  const moduleCode = invokeHook(plugin.load, {} as unknown, resolvedId);
  expect(typeof moduleCode).toBe("string");
  return moduleCode as string;
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
