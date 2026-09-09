import { afterEach, describe, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
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

        __injectTrussCSS("/* @truss p:3000 c:beamStatic */\\n.beamStatic { display: flex; }", {"source":"libraries","order":0,"prelude":":root { --t-spacing: 8px; }"});
      `),
    );
  });

  test("test mode keeps conflicting library CSS separate from per-file application CSS", () => {
    // Given an application mapping that defines df as display: flex
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });
    // And the library's df class deliberately differs from the application's flex rule
    writeLibraryCss(root, ["/* @truss p:3000 c:df */", ".df { display: grid; }"]);

    // And a test-mode plugin configured with that conflicting library
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

        __injectTrussCSS("/* @truss p:3000 c:df */\\n.df { display: grid; }", {"source":"libraries","order":0,"prelude":":root { --t-spacing: 8px; }"});
      `),
    );
  });

  test("test mode bootstraps spacing without libraries or local CSS", () => {
    // Given an application mapping with no libraries
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {});
    // And a test-mode plugin before any application CSS is transformed
    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {}, { root, command: "serve", mode: "test" });
    invokeHook(plugin.buildStart, {});
    const result = runTransform(plugin, "export const value = 1;", join(root, "src", "plain.ts"));
    expect(result?.code).toBe('export const value = 1;\nimport "virtual:truss:test-css";');
    expect(n(getTestCssModule(plugin))).toBe(
      n(`
      import { __injectTrussCSS } from "@homebound/truss/runtime";
      __injectTrussCSS("", {"source":"libraries","order":0,"prelude":":root { --t-spacing: 8px; }"});
    `),
    );
  });

  test("test mode delivers late arbitrary CSS at module evaluation without import collisions", () => {
    // Given an application mapping with a flex rule
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), { df: { kind: "static", defs: { display: "flex" } } });
    // And a bootstrap already loaded before the arbitrary file is discovered
    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {}, { root, command: "serve", mode: "test" });
    invokeHook(plugin.buildStart, {});
    const bootstrap = getTestCssModule(plugin);
    // And a late file whose exports occupy the usual injection helper names
    const sourcePath = join(root, "src", "Late.css.ts");
    const code = `import { Css } from "./Css";
      export const _injectTrussCSS = "occupied";
      export const __injectTrussCSS = "also occupied";
      export const css = { ".late": Css.df.$ };`;
    writeFileSync(sourcePath, code);
    const result = runTransform(plugin, code, `/@fs/${sourcePath}?v=1`);
    expect(n(result?.code ?? "")).toBe(
      n(`
      import { __injectTrussCSS as _injectTrussCSS2 } from "@homebound/truss/runtime";
      import { Css } from "./Css";
      export const _injectTrussCSS = "occupied";
      export const __injectTrussCSS = "also occupied";
      export const css = { ".late": Css.df.$ };
      import "virtual:truss:test-css";
      _injectTrussCSS2("/* @truss arbitrary:start */\\n.late {\\n  display: flex;\\n}\\n/* @truss arbitrary:end */", { source: ${JSON.stringify(sourcePath)} });
    `),
    );
    expect(getTestCssModule(plugin)).toBe(bootstrap);
    const resolvedId = invokeHook(plugin.resolveId, {}, "./Late.css.ts?truss-css", join(root, "src", "App.tsx"));
    expect(resolvedId).toBe("\0truss-test-css:" + sourcePath);
    expect(n(invokeHook(plugin.load, {}, resolvedId) as string)).toBe(
      n(`
      import "virtual:truss:test-css";
      import { __injectTrussCSS } from "@homebound/truss/runtime";
      __injectTrussCSS("/* @truss arbitrary:start */\\n.late {\\n  display: flex;\\n}\\n/* @truss arbitrary:end */", {"source":${JSON.stringify(sourcePath)}});
    `),
    );
  });

  test("test mode compiles side-effect-only CSS without evaluating build-only expressions", () => {
    // Given a CSS file with a setVar expression that cannot execute in CssBuilder
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {});
    const sourcePath = join(root, "src", "BuildOnly.css.ts");
    writeFileSync(
      sourcePath,
      'import { Css } from "./Css"; export const css = { ".build-only": Css.setVar({ "--test-color": "red" }).$ };',
    );
    // And a test-mode plugin receiving a side-effect-only import
    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {}, { root, command: "serve", mode: "test" });
    invokeHook(plugin.buildStart, {});
    const importer = join(root, "src", "App.tsx");
    const result = runTransform(plugin, 'import "./BuildOnly.css";', importer);
    expect(result?.code).toBe('import "./BuildOnly.css.ts?truss-css";\nimport "virtual:truss:test-css";');
    const resolvedId = invokeHook(plugin.resolveId, {}, "./BuildOnly.css.ts?truss-css", importer);
    expect(resolvedId).toBe("\0truss-test-css:" + sourcePath);
    const loaded = invokeHook(plugin.load, {}, resolvedId) as string;
    expect(n(loaded)).toBe(
      n(`
      import "virtual:truss:test-css";
      import { __injectTrussCSS } from "@homebound/truss/runtime";
      __injectTrussCSS("/* @truss arbitrary:start */\\n.build-only {\\n  --test-color: red;\\n}\\n/* @truss arbitrary:end */", {"source":${JSON.stringify(sourcePath)}});
    `),
    );
    expect(runTransform(plugin, loaded, resolvedId as string)).toBeNull();
  });

  test("production arbitrary CSS follows codepoint source order instead of discovery order", () => {
    // Given an application mapping with a flex rule
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), { df: { kind: "static", defs: { display: "flex" } } });
    // And arbitrary files discovered in reverse codepoint order
    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {}, { root, command: "build", mode: "production" });
    invokeHook(plugin.buildStart, {});
    runTransform(
      plugin,
      'import { Css } from "./Css"; export const css = { ".lower": Css.df.$ };',
      join(root, "src", "a.css.ts"),
    );
    runTransform(
      plugin,
      'import { Css } from "./Css"; export const css = { ".upper": Css.df.$ };',
      join(root, "src", "Z.css.ts"),
    );
    let css = "";
    invokeHook(
      plugin.generateBundle,
      {
        emitFile(asset: { source: string }) {
          css = asset.source;
        },
      },
      {},
      {},
    );
    expect(css).toBe(
      [
        ":root { --t-spacing: 8px; }",
        "/* @truss arbitrary:start */",
        ".upper {",
        "  display: flex;",
        "}",
        "",
        ".lower {",
        "  display: flex;",
        "}",
        "/* @truss arbitrary:end */",
      ].join("\n"),
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
    expect(html).toBe(
      '<html><head>    <script type="module" src="/virtual:truss:runtime"></script>\n  </head><body></body></html>',
    );
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
    expect(html).toBe(
      '<html><head>\n      <link rel="stylesheet" href="__TRUSS_CSS_HASH__">\n  </head><body></body></html>',
    );
  });

  test("production html is idempotent across multiple builds (e.g. Storybook)", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });

    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {} as any, { root, command: "build", mode: "production" } as any);

    // Simulate a second build pass receiving HTML that already has a patched truss link
    const alreadyPatched = [
      "<html><head>",
      '    <link rel="stylesheet" href="/assets/truss-abcd1234.css">',
      "  </head><body></body></html>",
    ].join("\n");
    const html = invokeHook(plugin.transformIndexHtml, {} as any, alreadyPatched) as any;
    // The old hashed link should be stripped and replaced with a single placeholder
    expect(html).toBe(
      '<html><head>\n      <link rel="stylesheet" href="__TRUSS_CSS_HASH__">\n  </head><body></body></html>',
    );
    // Only one truss CSS link should exist (the placeholder)
    const linkCount = (html.match(/<link[^>]*TRUSS_CSS_HASH/g) || []).length;
    expect(linkCount).toBe(1);
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
        ":root { --t-spacing: 8px; }",
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
        ":root { --t-spacing: 8px; }",
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

  test("includes app .css.ts arbitrary blocks in merged CSS output", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
      blue: { kind: "static", defs: { color: "#526675" } },
    });

    // Library ships a truss.css with an atomic rule and an arbitrary block from its own .css.ts
    const libCssDir = join(root, "node_modules", "@company", "library", "dist");
    mkdirSync(libCssDir, { recursive: true });
    writeFileSync(
      join(libCssDir, "truss.css"),
      [
        "/* @truss p:3000 c:blue */",
        ".blue { color: #526675; }",
        "/* @truss arbitrary:start */",
        ".lib-grid td { background-color: #fcfcfa; }",
        "/* @truss arbitrary:end */",
      ].join("\n"),
      "utf8",
    );

    // App has a .css.ts file with its own CSS
    const appCssTsPath = join(root, "src", "App.css.ts");
    mkdirSync(dirname(appCssTsPath), { recursive: true });
    writeFileSync(
      appCssTsPath,
      ['import { Css } from "./Css";', "export const css = {", '  ".app-container": Css.df.$,', "};"].join("\n"),
      "utf8",
    );

    const plugin = trussPlugin({
      mapping: "./src/Css.json",
      libraries: ["./node_modules/@company/library/dist/truss.css"],
    });
    invokeHook(plugin.configResolved, {} as any, { root, command: "serve", mode: "development" } as any);
    invokeHook(plugin.buildStart, {} as any);

    // App file imports the .css.ts — triggers import rewriting
    runTransform(
      plugin,
      `import { css } from "./App.css.ts"; const el = <div className={css} />;`,
      join(root, "src", "App.tsx"),
    );

    // Simulate resolving and loading the virtual CSS module
    const resolvedId = invokeHook(plugin.resolveId, {} as unknown, "./App.css.ts?truss-css", appCssTsPath);
    expect(resolvedId).toBeTruthy();
    invokeHook(plugin.load, {} as unknown, resolvedId);

    // The merged CSS should include both the library's arbitrary block and the app's .css.ts content
    const css = getVirtualCss(plugin);
    expect(css).toBe(
      [
        ":root { --t-spacing: 8px; }",
        "/* @truss p:3000 c:blue */",
        ".blue { color: #526675; }",
        "/* @truss arbitrary:start */",
        ".lib-grid td { background-color: #fcfcfa; }",
        "/* @truss arbitrary:end */",
        "/* @truss arbitrary:start */",
        ".app-container {",
        "  display: flex;",
        "}",
        "/* @truss arbitrary:end */",
      ].join("\n"),
    );
  });

  test("includes app .css.ts blocks when imported with bare .css extension", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
      blue: { kind: "static", defs: { color: "#526675" } },
    });

    const libCssDir = join(root, "node_modules", "@company", "library", "dist");
    mkdirSync(libCssDir, { recursive: true });
    writeFileSync(
      join(libCssDir, "truss.css"),
      ["/* @truss p:3000 c:blue */", ".blue { color: #526675; }"].join("\n"),
      "utf8",
    );

    // App has a .css.ts file
    const appCssTsPath = join(root, "src", "App.css.ts");
    mkdirSync(dirname(appCssTsPath), { recursive: true });
    writeFileSync(
      appCssTsPath,
      ['import { Css } from "./Css";', "export const css = {", '  ".app-container": Css.df.$,', "};"].join("\n"),
      "utf8",
    );

    const plugin = trussPlugin({
      mapping: "./src/Css.json",
      libraries: ["./node_modules/@company/library/dist/truss.css"],
    });
    invokeHook(plugin.configResolved, {} as any, { root, command: "serve", mode: "development" } as any);
    invokeHook(plugin.buildStart, {} as any);

    // The importing file uses bare `from "./App.css"` (no .ts) — rewriteCssTsImports
    // detects the .css.ts file on disk and adds a ?truss-css side-effect import
    const result = runTransform(
      plugin,
      `import { css } from "./App.css"; const el = <div className={css} />;`,
      join(root, "src", "Page.tsx"),
    );
    expect(n(result?.code ?? "")).toBe(
      n(`
        import { css } from "./App.css";
        import "./App.css.ts?truss-css";
        const el = <div className={css} />;
      `),
    );

    // Simulate Vite resolving and loading the virtual CSS module
    const resolvedId = invokeHook(plugin.resolveId, {} as unknown, "./App.css.ts?truss-css", appCssTsPath);
    expect(resolvedId).toBeTruthy();
    invokeHook(plugin.load, {} as unknown, resolvedId);

    // The .css.ts content should be in the merged output
    const css = getVirtualCss(plugin);
    expect(css).toBe(
      [
        ":root { --t-spacing: 8px; }",
        "/* @truss p:3000 c:blue */",
        ".blue { color: #526675; }",
        "/* @truss arbitrary:start */",
        ".app-container {",
        "  display: flex;",
        "}",
        "/* @truss arbitrary:end */",
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
        ":root { --t-spacing: 8px; }",
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
