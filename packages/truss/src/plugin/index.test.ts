import { afterEach, describe, expect, test, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { tmpdir } from "os";
import { createHash } from "crypto";
import { trussPlugin } from "./index";

const tempDirs: string[] = [];

afterEach(() => {
  vi.useRealTimers();
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe("trussPlugin", () => {
  test.each([
    { command: "build", mode: "production", lib: false, expected: false },
    { command: "build", mode: "development", lib: false, expected: false },
    { command: "build", mode: "production", lib: { entry: "src/index.ts" }, expected: true },
    { command: "serve", mode: "development", lib: false, expected: true },
  ])("annotation policy: $command $mode lib=$lib", (scenario) => {
    // Given a mapping with a flex rule
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), { df: { kind: "static", defs: { display: "flex" } } });
    // And a plugin configured for this output type without CSS minification
    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(
      plugin.configResolved,
      {},
      {
        root,
        command: scenario.command,
        mode: scenario.mode,
        build: { lib: scenario.lib, cssMinify: false },
      },
    );
    invokeHook(plugin.buildStart, {});
    // And an application module using the flex rule
    runTransform(plugin, 'import { Css } from "./Css"; const s = Css.df.$;', join(root, "src", "App.tsx"));

    // When the stylesheet is served or emitted
    let css = "";
    let fileName = "";
    if (scenario.command === "serve") {
      css = getVirtualCss(plugin);
    } else {
      invokeHook(
        plugin.generateBundle,
        {
          emitFile(asset: { source: string; fileName: string }) {
            css = asset.source;
            fileName = asset.fileName;
          },
        },
        {},
        {},
      );
    }

    // Then only library and dev outputs carry merge annotations
    expect(css).toBe(
      ":root { --t-spacing: 8px; }\n" +
        (scenario.expected ? "/* @truss p:3000 c:df */\n" : "") +
        ".df { display: flex; }",
    );
    if (scenario.command === "build") {
      // And the asset name hashes the exact final stylesheet
      expect(fileName).toBe(`assets/truss-${createHash("sha256").update(css).digest("hex").slice(0, 8)}.css`);
    }
  });

  test("an annotated library build merges into an annotation-free application build", () => {
    // Given a mapping shared by a library and its consuming application
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
      black: { kind: "static", defs: { color: "black" } },
    });
    // And a library build containing an atomic rule and arbitrary CSS
    const library = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(library.configResolved, {}, { root, command: "build", mode: "production", build: { lib: {} } });
    invokeHook(library.buildStart, {});
    runTransform(library, 'import { Css } from "./Css"; const s = Css.df.$;', join(root, "src", "Lib.tsx"));
    runTransform(library, 'export const css = { body: "/* keep */ margin: 0;" };', join(root, "src", "Lib.css.ts"));
    invokeHook(
      library.generateBundle,
      {
        emitFile(asset: { source: string }) {
          writeFileSync(join(root, "library.css"), asset.source);
        },
      },
      {},
      {},
    );
    // And an application using the library stylesheet and an overlapping atomic rule
    const app = trussPlugin({ mapping: "./src/Css.json", libraries: ["./library.css"] });
    invokeHook(app.configResolved, {}, { root, command: "build", mode: "production" });
    invokeHook(app.buildStart, {});
    runTransform(app, 'import { Css } from "./Css"; const s = Css.df.black.$;', join(root, "src", "App.tsx"));

    // When the application emits its final stylesheet
    let css = "";
    invokeHook(
      app.generateBundle,
      {
        emitFile(asset: { source: string }) {
          css = asset.source;
        },
      },
      {},
      {},
    );

    // Then library rules survive, atomic rules are sorted and deduplicated, and user comments remain
    expect(css).toBe(
      [
        ":root { --t-spacing: 8px; }",
        ".black { color: black; }",
        ".df { display: flex; }",
        "body {",
        "  /* keep */ margin: 0;",
        "}",
      ].join("\n"),
    );
  });

  test("production source typos fail with a location and suggestion", () => {
    // Given a mapping with accent but no acent abbreviation
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), { accent: { kind: "static", defs: { color: "red" } } });
    // And a build using the default unsupported-pattern policy
    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {}, { root, command: "build", mode: "production" });
    invokeHook(plugin.buildStart, {});
    // And a component with a misspelled abbreviation on its second line
    const id = join(root, "src", "Button.tsx");
    const code = 'import { Css } from "./Css";\nconst el = <div css={Css.acent.$} />;';

    // When the component is transformed, then the build fails at the original source line
    expect(() => runTransform(plugin, code, id)).toThrow(
      `${id}:2:22: [truss] Unsupported pattern: Unknown abbreviation "acent". Did you mean "accent"?`,
    );
  });

  test("production rejects unsupported .css.ts in virtual load and transform", () => {
    // Given a mapping without atomic abbreviations
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {});
    // And an arbitrary CSS file with an unsupported spread
    const id = join(root, "src", "Button.css.ts");
    const code = "export const css = { ...styles };";
    writeFileSync(id, code);
    // And a build using the default unsupported-pattern policy
    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {}, { root, command: "build", mode: "production" });
    invokeHook(plugin.buildStart, {});
    const virtualId = invokeHook(plugin.resolveId, {}, "./Button.css.ts?truss-css", join(root, "src", "App.tsx"));
    expect(virtualId).toBe("\0truss-css:" + id.slice(0, -3));

    // When Vite loads then transforms the CSS, then both hooks reject the spread
    expect(() => invokeHook(plugin.load, {}, virtualId)).toThrow("spread elements in css.ts export");
    expect(() => runTransform(plugin, code, id)).toThrow("spread elements in css.ts export");
  });

  test("dev warns and sends an overlay for a non-typo error, then accepts corrected source", () => {
    // Given a mapping with a valid accent abbreviation
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), { accent: { kind: "static", defs: { color: "red" } } });
    // And a plugin using the default serve policy
    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {}, { root, command: "serve", mode: "development" });
    invokeHook(plugin.buildStart, {});
    // And a dev socket whose server close handler is always cleaned up
    const send = vi.fn();
    const on = vi.fn<(event: string, callback: () => void) => void>();
    invokeHook(plugin.configureServer, {}, { middlewares: { use() {} }, ws: { send }, httpServer: { on } });
    // And a component whose markerOf call is missing its required marker argument
    const id = join(root, "src", "Button.tsx");
    const code = 'import { Css } from "./Css";\nconst el = <div css={Css.markerOf().$} />;';
    const warn = vi.fn();

    try {
      // When the component is transformed, then compilation continues with a located Error warning
      const result = invokeHook(plugin.transform, { warn }, code, id);
      expect(result).toMatchObject({ code: expect.any(String) });
      expect(warn).toHaveBeenCalledTimes(1);
      const warning = warn.mock.calls[0][0];
      expect(warning).toBeInstanceOf(Error);
      expect(warning).toMatchObject({ id, loc: { file: id, line: 2, column: 21 } });
      expect(warning.message).toBe(
        `${id}:2:22: [truss] Unsupported pattern: markerOf() requires exactly one argument (a marker variable)`,
      );
      // And the dev server receives a Vite error overlay
      expect(send.mock.calls).toEqual([
        [
          {
            type: "error",
            err: { message: warning.message, stack: "", id, loc: warning.loc, plugin: "truss" },
          },
        ],
      ]);
      // And the component is corrected to use the configured accent abbreviation
      warn.mockClear();
      send.mockClear();
      // When Vite transforms the corrected component, then it sends no warning or error overlay
      const clean = invokeHook(plugin.transform, { warn }, code.replace("Css.markerOf().$", "Css.accent.$"), id);
      expect(clean).toMatchObject({ code: expect.any(String) });
      expect(warn).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    } finally {
      for (const [event, close] of on.mock.calls) {
        if (event === "close") close();
      }
    }
  });

  test("production warn override is nonfatal", () => {
    // Given a mapping with accent but no acent abbreviation
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), { accent: { kind: "static", defs: { color: "red" } } });
    // And a production plugin explicitly configured to warn about unsupported patterns
    const plugin = trussPlugin({ mapping: "./src/Css.json", unsupportedPattern: "warn" });
    invokeHook(plugin.configResolved, {}, { root, command: "build", mode: "production" });
    invokeHook(plugin.buildStart, {});
    // And a component containing a misspelled abbreviation
    const id = join(root, "src", "Button.tsx");
    const code = 'import { Css } from "./Css";\nconst el = <div css={Css.acent.$} />;';
    const warn = vi.fn();

    // When the component is transformed, then the override warns and compilation continues
    expect(invokeHook(plugin.transform, { warn }, code, id)).toMatchObject({ code: expect.any(String) });
    expect(warn).toHaveBeenCalledTimes(1);
  });

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
    // Given the library ships a Css.json with a df rule
    const root = createTempRoot();
    writeMapping(join(root, "node_modules", "@company", "library", "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });
    // And we're running the application build, pointing to the library's Css.json
    const plugin = trussPlugin({
      mapping: "./node_modules/@company/library/src/Css.json",
    });
    runConfigHooks(plugin, root);
    // When we see application src/Button.tsx importing Css from the library
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

        __injectTrussCSS({"rules":[{"priority":3000,"className":"beamStatic","cssText":".beamStatic { display: flex; }"}],"source":"libraries","order":0,"prelude":":root { --t-spacing: 8px; }"});
      `),
    );
  });

  test("test bootstrap serializes query metadata, properties, and split arbitrary rules", () => {
    // Given an application mapping without local rules
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {});
    // And library CSS with an unbounded media query, a property, and two arbitrary rules
    writeLibraryCss(root, [
      "/* @truss p:3200 c:wide */",
      "@media (min-width: 600px) { .wide { color: red; } }",
      "/* @truss @property */",
      '@property --color { syntax: "*"; inherits: false; }',
      "/* @truss arbitrary:start */",
      ".first { color: red; }",
      "@supports (display: grid) { .second { display: grid; } }",
      "/* @truss arbitrary:end */",
    ]);
    // And a test-mode plugin configured to bootstrap the library
    const plugin = trussPlugin({
      mapping: "./src/Css.json",
      libraries: ["./node_modules/@company/library/dist/truss.css"],
    });
    // When the plugin starts the build
    invokeHook(plugin.configResolved, {}, { root, command: "serve", mode: "test" });
    invokeHook(plugin.buildStart, {});

    // Then the bootstrap keeps the at-rule, the property, and both arbitrary rules
    expect(n(getTestCssModule(plugin))).toBe(
      n(`
        import { __injectTrussCSS } from "@homebound/truss/runtime";
        __injectTrussCSS({"rules":[{"priority":3200,"className":"wide","cssText":"@media (min-width: 600px) { .wide { color: red; } }","atRule":"@media (min-width: 600px)"}],"properties":[{"cssText":"@property --color { syntax: \\"*\\"; inherits: false; }","varName":"--color"}],"arbitraryRules":[".first { color: red; }","@supports (display: grid) { .second { display: grid; } }"],"source":"libraries","order":0,"prelude":":root { --t-spacing: 8px; }"});
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

    // When we transform an application file that uses both classes
    const result = runTransform(
      plugin,
      `import { Css } from "./Css"; const el = <div css={Css.df.$} className="beamStatic" />;`,
      join(root, "src", "App.tsx"),
    );

    // Then the file delivers the application's own df rule
    expect(n(result?.code ?? "")).toBe(
      n(`
        import { mergeProps, TrussDebugInfo, __injectTrussCSS } from "@homebound/truss/runtime";
        __injectTrussCSS({ rules: [{ priority: 3000, className: "df", cssText: ".df { display: flex; }" }] });
        const el = <div {...mergeProps("beamStatic", undefined, {
          display: ["df", new TrussDebugInfo("App.tsx:1")]
        })} />;
        import "virtual:truss:test-css";
      `),
    );

    // And the bootstrap keeps the library's conflicting df rule
    const bootstrapModule = getTestCssModule(plugin);
    expect(n(bootstrapModule)).toBe(
      n(`
        import { __injectTrussCSS } from "@homebound/truss/runtime";

        __injectTrussCSS({"rules":[{"priority":3000,"className":"df","cssText":".df { display: grid; }"}],"source":"libraries","order":0,"prelude":":root { --t-spacing: 8px; }"});
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
    // When we transform a file with no Truss usage
    const result = runTransform(plugin, "export const value = 1;", join(root, "src", "plain.ts"));
    // Then the file still imports the bootstrap
    expect(result?.code).toBe('export const value = 1;\nimport "virtual:truss:test-css";');
    // And the bootstrap only sets the spacing variable
    expect(n(getTestCssModule(plugin))).toBe(
      n(`
      import { __injectTrussCSS } from "@homebound/truss/runtime";
      __injectTrussCSS({"source":"libraries","order":0,"prelude":":root { --t-spacing: 8px; }"});
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
    // When we transform the late file
    const result = runTransform(plugin, code, `/@fs/${sourcePath}?v=1`);
    // Then the injection uses an aliased helper that avoids the existing exports
    expect(n(result?.code ?? "")).toBe(
      n(`
      import { Css } from "./Css";
      export const _injectTrussCSS = "occupied";
      export const __injectTrussCSS = "also occupied";
      export const css = { ".late": Css.df.$ };
      import "virtual:truss:test-css";
      import { __injectTrussCSS as __injectTrussCSS_1 } from "@homebound/truss/runtime";
      __injectTrussCSS_1({ arbitraryRules: [".late {\\n  display: flex;\\n}"], source: ${JSON.stringify(sourcePath)} });
    `),
    );
    // And the bootstrap module is unchanged
    expect(getTestCssModule(plugin)).toBe(bootstrap);
    // And the late file's own module delivers the same rule
    const resolvedId = invokeHook(plugin.resolveId, {}, "./Late.css.ts?truss-css", join(root, "src", "App.tsx"));
    expect(resolvedId).toBe("\0truss-test-css:" + sourcePath);
    expect(n(invokeHook(plugin.load, {}, resolvedId) as string)).toBe(
      n(`
      import "virtual:truss:test-css";
      import { __injectTrussCSS } from "@homebound/truss/runtime";
      __injectTrussCSS({"arbitraryRules":[".late {\\n  display: flex;\\n}"],"source":${JSON.stringify(sourcePath)}});
    `),
    );
  });

  test.each([
    {
      name: "a type-only declaration",
      imports: 'import type { RuntimeStyleCss } from "@homebound/truss/runtime";',
      expectedImports: 'import type { RuntimeStyleCss } from "@homebound/truss/runtime";',
      addedImport: 'import { __injectTrussCSS } from "@homebound/truss/runtime";',
      helper: "__injectTrussCSS",
    },
    {
      name: "a type-only helper declaration",
      imports: 'import type { __injectTrussCSS } from "@homebound/truss/runtime";',
      expectedImports: 'import type { __injectTrussCSS } from "@homebound/truss/runtime";',
      addedImport: 'import { __injectTrussCSS as __injectTrussCSS_1 } from "@homebound/truss/runtime";',
      helper: "__injectTrussCSS_1",
    },
    {
      name: "an inline type-only helper specifier",
      imports: 'import { type __injectTrussCSS } from "@homebound/truss/runtime";',
      expectedImports:
        'import { type __injectTrussCSS, __injectTrussCSS as __injectTrussCSS_1 } from "@homebound/truss/runtime";',
      addedImport: "",
      helper: "__injectTrussCSS_1",
    },
    {
      name: "a namespace import",
      imports: 'import * as runtime from "@homebound/truss/runtime";',
      expectedImports: 'import * as runtime from "@homebound/truss/runtime";',
      addedImport: 'import { __injectTrussCSS } from "@homebound/truss/runtime";',
      helper: "__injectTrussCSS",
    },
    {
      name: "an existing aliased value import",
      imports: 'import { __injectTrussCSS as inject } from "@homebound/truss/runtime";',
      expectedImports: 'import { __injectTrussCSS as inject } from "@homebound/truss/runtime";',
      addedImport: "",
      helper: "inject",
    },
    {
      name: "a value declaration after a type-only declaration",
      imports: `import type { RuntimeStyleCss } from "@homebound/truss/runtime";
        import { RuntimeStyle } from "@homebound/truss/runtime";`,
      expectedImports: `import type { RuntimeStyleCss } from "@homebound/truss/runtime";
        import { RuntimeStyle, __injectTrussCSS } from "@homebound/truss/runtime";`,
      addedImport: "",
      helper: "__injectTrussCSS",
    },
  ])("test mode injects arbitrary CSS with $name", (scenario) => {
    // Given an application mapping without atomic rules
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {});
    // And a test-mode plugin that injects CSS when the module evaluates
    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {}, { root, command: "serve", mode: "test" });
    invokeHook(plugin.buildStart, {});
    // And an arbitrary CSS module with an existing runtime import
    const sourcePath = join(root, "src", "Imports.css.ts");
    const code = `${scenario.imports}\nexport const css = { ".target": "color: red;" };`;

    // When we transform the module
    const result = runTransform(plugin, code, sourcePath);

    // Then the injection call uses a helper name that does not collide
    expect(n(result?.code ?? "")).toBe(
      n(`
        ${scenario.expectedImports}
        export const css = { ".target": "color: red;" };
        import "virtual:truss:test-css";
        ${scenario.addedImport}
        ${scenario.helper}({ arbitraryRules: [".target {\\n  color: red;\\n}"], source: ${JSON.stringify(sourcePath)} });
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
    // When we transform the importer
    const result = runTransform(plugin, 'import "./BuildOnly.css";', importer);
    // Then the import points at the compiled CSS module
    expect(result?.code).toBe('import "./BuildOnly.css.ts?truss-css";\nimport "virtual:truss:test-css";');
    // And that module injects the rule the setVar expression declares
    const resolvedId = invokeHook(plugin.resolveId, {}, "./BuildOnly.css.ts?truss-css", importer);
    expect(resolvedId).toBe("\0truss-test-css:" + sourcePath);
    const loaded = invokeHook(plugin.load, {}, resolvedId) as string;
    expect(n(loaded)).toBe(
      n(`
      import "virtual:truss:test-css";
      import { __injectTrussCSS } from "@homebound/truss/runtime";
      __injectTrussCSS({"arbitraryRules":[".build-only {\\n  --test-color: red;\\n}"],"source":${JSON.stringify(sourcePath)}});
    `),
    );
    // And the loaded module is not transformed again
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
    // When the bundle is generated
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
    // Then the arbitrary block follows codepoint source order
    expect(css).toBe(
      [
        ":root { --t-spacing: 8px; }",
        ".upper {",
        "  display: flex;",
        "}",
        "",
        ".lower {",
        "  display: flex;",
        "}",
      ].join("\n"),
    );
  });

  test("dev batches CSS changes after transforms and ignores unchanged CSS", () => {
    // Given a mapping with a flex rule
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), { df: { kind: "static", defs: { display: "flex" } } });
    // And a dev server with controlled update timing and a captured CSS endpoint
    vi.useFakeTimers();
    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {}, { root, command: "serve", mode: "development" });
    invokeHook(plugin.buildStart, {});
    const send = vi.fn();
    const use = vi.fn();
    const server = { middlewares: { use }, ws: { send }, httpServer: { on() {} } };
    invokeHook(plugin.configureServer, {}, server);

    // When Vite reports a file change before transforming it
    invokeHook(plugin.handleHotUpdate, {}, { server });
    vi.runAllTimers();

    // Then no stale stylesheet update is sent and no poller is running
    expect(send.mock.calls).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);

    // When an application module and a .css.ts module add CSS in the same turn
    const appId = join(root, "src", "App.tsx");
    const cssId = join(root, "src", "App.css.ts");
    const appCode = 'import { Css } from "./Css"; const s = Css.df.$;';
    const cssCode = 'export const css = { body: "color: red;" };';
    runTransform(plugin, appCode, appId);
    runTransform(plugin, cssCode, cssId);

    // Then notification is deferred and both changes share one timer
    expect(send.mock.calls).toEqual([]);
    expect(vi.getTimerCount()).toBe(1);
    vi.runAllTimers();
    expect(send.mock.calls).toEqual([[{ type: "custom", event: "truss:css-update" }]]);
    // And the endpoint already serves both completed transforms
    const end = vi.fn();
    use.mock.calls[0][0]({ url: "/virtual:truss.css" }, { setHeader() {}, end }, () => {});
    expect(end.mock.calls).toEqual([
      [
        [
          ":root { --t-spacing: 8px; }",
          "/* @truss p:3000 c:df */",
          ".df { display: flex; }",
          "/* @truss arbitrary:start */",
          "body {",
          "  color: red;",
          "}",
          "/* @truss arbitrary:end */",
        ].join("\n"),
      ],
    ]);

    // When Vite retransforms unchanged CSS or a module without styles
    send.mockClear();
    runTransform(plugin, appCode, appId);
    runTransform(plugin, cssCode, cssId);
    runTransform(plugin, "export const value = 1;", join(root, "src", "other.ts"));
    vi.runAllTimers();

    // Then no stylesheet is requested
    expect(send.mock.calls).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);

    // When a later .css.ts edit replaces its rules
    runTransform(plugin, 'export const css = { body: "color: blue;" };', cssId);
    vi.runAllTimers();

    // Then the edit gets one new notification without an initial file-change event
    expect(send.mock.calls).toEqual([[{ type: "custom", event: "truss:css-update" }]]);
  });

  test.each(["close", "buildStart"])("dev cancels pending CSS updates on %s", (event) => {
    // Given a mapping with a flex rule
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), { df: { kind: "static", defs: { display: "flex" } } });
    // And a dev server with a pending CSS update
    vi.useFakeTimers();
    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {}, { root, command: "serve", mode: "development" });
    invokeHook(plugin.buildStart, {});
    const send = vi.fn();
    const on = vi.fn();
    invokeHook(plugin.configureServer, {}, { middlewares: { use() {} }, ws: { send }, httpServer: { on } });
    runTransform(plugin, 'import { Css } from "./Css"; const s = Css.df.$;', join(root, "src", "App.tsx"));
    expect(vi.getTimerCount()).toBe(1);

    // When the server closes or the build state resets before notification
    if (event === "close") {
      expect(on.mock.calls[0][0]).toBe("close");
      on.mock.calls[0][1]();
    } else {
      invokeHook(plugin.buildStart, {});
    }

    // Then the pending timer is removed and no update is sent
    expect(vi.getTimerCount()).toBe(0);
    vi.runAllTimers();
    expect(send.mock.calls).toEqual([]);
  });

  test("dev runtime fetches initially and only subscribes to CSS changes", async () => {
    // Given the dev runtime and a browser with an existing Truss style element
    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    const id = invokeHook(plugin.resolveId, {}, "virtual:truss:runtime", undefined);
    const code = invokeHook(plugin.load, {}, id) as string;
    const style = { textContent: "" };
    const document = { getElementById: () => style };
    const fetch = vi.fn().mockResolvedValue({ text: async () => ".df { display: flex; }" });
    const on = vi.fn();

    // When the browser evaluates the runtime
    new Function("document", "fetch", "hot", code.replaceAll("import.meta.hot", "hot"))(document, fetch, { on });

    // Then it fetches once on startup and does not subscribe to Vite JS updates
    expect(fetch.mock.calls).toEqual([["/virtual:truss.css"]]);
    expect(on.mock.calls.map((call) => call[0])).toEqual(["truss:css-update"]);
    await vi.waitFor(() => expect(style.textContent).toBe(".df { display: flex; }"));

    // When the server reports changed CSS
    fetch.mockClear();
    fetch.mockResolvedValue({ text: async () => ".df { display: grid; }" });
    on.mock.calls[0][1]();

    // Then the browser fetches and applies the stylesheet once
    expect(fetch.mock.calls).toEqual([["/virtual:truss.css"]]);
    await vi.waitFor(() => expect(style.textContent).toBe(".df { display: grid; }"));
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
