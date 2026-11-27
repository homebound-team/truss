import { afterEach, describe, expect, test } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { tmpdir } from "os";
import { trussEsbuildPlugin } from "./esbuild-plugin";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe("trussEsbuildPlugin", () => {
  test.each([
    {
      file: "Button.tsx",
      source: "const el = <div css={Css.markerOf().$} />;",
      message: "markerOf() requires exactly one argument (a marker variable)",
    },
    {
      file: "Button.css.ts",
      source: "export const css = { ...styles };",
      message: "spread elements in css.ts export",
    },
  ])("rejects diagnostics from $file: $source", (scenario) => {
    // Given a mapping without atomic abbreviations
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {});
    // And an esbuild plugin whose source and arbitrary CSS transforms must both reject diagnostics
    const plugin = trussEsbuildPlugin({ mapping: join(root, "src", "Css.json") });
    const { onLoadCallback } = setupPlugin(plugin, join(root, "dist"));
    // And a module containing an unsupported pattern
    const id = join(root, "src", scenario.file);
    const contents = `import { Css } from "./Css";\n${scenario.source}`;

    // When esbuild loads the module, then it rejects the unsupported pattern
    expect(() => onLoadCallback({ path: id, contents })).toThrow(scenario.message);
  });

  test("transforms source files via onLoad", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });

    const plugin = trussEsbuildPlugin({ mapping: join(root, "src", "Css.json") });
    const { onLoadCallback } = setupPlugin(plugin, join(root, "dist"));

    // Simulate esbuild calling onLoad for a .tsx file
    const result = onLoadCallback({
      path: join(root, "src", "Button.tsx"),
      contents: `import { Css } from "./Css"; const el = <div css={Css.df.$} />;`,
    });

    expect(result).toBeDefined();
    expect(result!.loader).toBe("tsx");
    expect(n(result!.contents)).toBe(
      n(`
        const el = <div className="df" />;
      `),
    );
  });

  test("returns undefined for files without Css usage", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });

    const plugin = trussEsbuildPlugin({ mapping: join(root, "src", "Css.json") });
    const { onLoadCallback } = setupPlugin(plugin, join(root, "dist"));

    const result = onLoadCallback({
      path: join(root, "src", "utils.ts"),
      contents: `export function add(a: number, b: number) { return a + b; }`,
    });

    expect(result).toBeUndefined();
  });

  test("collects .css.ts selectors and appends them after atomic CSS", () => {
    const root = createTempRoot();
    const outDir = join(root, "dist");
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
      black: { kind: "static", defs: { color: "#353535" } },
    });

    const plugin = trussEsbuildPlugin({ mapping: join(root, "src", "Css.json") });
    const { onLoadCallback, onEndCallback } = setupPlugin(plugin, outDir);

    const cssTsSource = [
      'import { Css } from "./Css";',
      'export const zebraRows = "zebraRows";',
      "export const css = {",
      "  [`.${zebraRows} tbody tr:nth-child(even) td`]: Css.black.$,",
      "};",
    ].join("\n");

    const cssTsResult = onLoadCallback({
      path: join(root, "src", "DataGrid.css.ts"),
      contents: cssTsSource,
    });
    expect(cssTsResult).toBeDefined();
    expect(cssTsResult?.loader).toBe("ts");
    expect(cssTsResult?.contents).toBe(cssTsSource);

    onLoadCallback({
      path: join(root, "src", "DataGrid.tsx"),
      contents: `import { Css } from "./Css"; export const s = Css.df.$;`,
    });

    onEndCallback();

    const css = readFileSync(join(outDir, "truss.css"), "utf8");
    expect(css).toBe(
      [
        ":root { --t-spacing: 8px; }",
        "/* @truss p:3000 c:df */",
        ".df { display: flex; }",
        "/* @truss arbitrary:start */",
        ".zebraRows tbody tr:nth-child(even) td {",
        "  color: #353535;",
        "}",
        "/* @truss arbitrary:end */",
      ].join("\n"),
    );
  });

  test("collects raw-string .css.ts files without a Css import", () => {
    const root = createTempRoot();
    const outDir = join(root, "dist");
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });

    const plugin = trussEsbuildPlugin({ mapping: join(root, "src", "Css.json") });
    const { onLoadCallback, onEndCallback } = setupPlugin(plugin, outDir);

    onLoadCallback({
      path: join(root, "src", "App.css.ts"),
      contents: `export const css = { body: "margin: 0;\\nfont-size: 14px !important;" };`,
    });

    onEndCallback();

    const css = readFileSync(join(outDir, "truss.css"), "utf8");
    expect(css).toBe(
      [
        ":root { --t-spacing: 8px; }",
        "/* @truss arbitrary:start */",
        "body {",
        "  margin: 0;",
        "  font-size: 14px !important;",
        "}",
        "/* @truss arbitrary:end */",
      ].join("\n"),
    );
  });

  test("writes truss.css on build end", () => {
    const root = createTempRoot();
    const outDir = join(root, "dist");
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
      black: { kind: "static", defs: { color: "#353535" } },
    });

    const plugin = trussEsbuildPlugin({ mapping: join(root, "src", "Css.json") });
    const { onLoadCallback, onEndCallback } = setupPlugin(plugin, outDir);

    // Transform a file to populate the CSS registry
    onLoadCallback({
      path: join(root, "src", "Button.tsx"),
      contents: `import { Css } from "./Css"; const s = Css.df.black.$;`,
    });

    // Trigger the build end
    onEndCallback();

    // truss.css should be written to outDir
    const cssPath = join(outDir, "truss.css");
    expect(existsSync(cssPath)).toBe(true);

    const css = readFileSync(cssPath, "utf8");
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

  test("does not write truss.css when no rules collected", () => {
    const root = createTempRoot();
    const outDir = join(root, "dist");
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });

    const plugin = trussEsbuildPlugin({ mapping: join(root, "src", "Css.json") });
    const { onEndCallback } = setupPlugin(plugin, outDir);

    onEndCallback();

    expect(existsSync(join(outDir, "truss.css"))).toBe(false);
  });

  test("respects custom outputCss path", () => {
    const root = createTempRoot();
    const outDir = join(root, "dist");
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });

    const plugin = trussEsbuildPlugin({
      mapping: join(root, "src", "Css.json"),
      outputCss: "styles/truss.css",
    });
    const { onLoadCallback, onEndCallback } = setupPlugin(plugin, outDir);

    onLoadCallback({
      path: join(root, "src", "App.tsx"),
      contents: `import { Css } from "./Css"; const s = Css.df.$;`,
    });

    onEndCallback();

    expect(existsSync(join(outDir, "styles", "truss.css"))).toBe(true);
  });

  test("deduplicates rules across multiple files", () => {
    const root = createTempRoot();
    const outDir = join(root, "dist");
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
      black: { kind: "static", defs: { color: "#353535" } },
    });

    const plugin = trussEsbuildPlugin({ mapping: join(root, "src", "Css.json") });
    const { onLoadCallback, onEndCallback } = setupPlugin(plugin, outDir);

    // Both files use df
    onLoadCallback({
      path: join(root, "src", "Button.tsx"),
      contents: `import { Css } from "./Css"; const s = Css.df.$;`,
    });
    onLoadCallback({
      path: join(root, "src", "Card.tsx"),
      contents: `import { Css } from "./Css"; const s = Css.df.black.$;`,
    });

    onEndCallback();

    const css = readFileSync(join(outDir, "truss.css"), "utf8");
    // df deduplicated, both rules present once each
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

  test("transforms css prop on JSX even without Css import", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });

    const plugin = trussEsbuildPlugin({ mapping: join(root, "src", "Css.json") });
    const { onLoadCallback } = setupPlugin(plugin, join(root, "dist"));

    const result = onLoadCallback({
      path: join(root, "src", "GridItem.tsx"),
      contents: `
        import { useGridItem } from "./hooks";
        export function GridItem({ children }) {
          const { gridItemProps, gridItemStyles } = useGridItem();
          return <div {...gridItemProps} css={{ ...gridItemStyles }}>{children}</div>;
        }
      `,
    });

    expect(result).toBeDefined();
    expect(n(result!.contents)).toBe(
      n(`
        import { useGridItem } from "./hooks";
        import { trussProps } from "@homebound/truss/runtime";
        export function GridItem({ children }) {
          const { gridItemProps, gridItemStyles } = useGridItem();
          return <div {...gridItemProps} {...trussProps({ ...gridItemStyles })}>{children}</div>;
        }
      `),
    );
  });

  test("selects correct loader for file extensions", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });

    const plugin = trussEsbuildPlugin({ mapping: join(root, "src", "Css.json") });
    const { onLoadCallback } = setupPlugin(plugin, join(root, "dist"));

    const code = `import { Css } from "./Css"; const s = Css.df.$;`;

    const tsx = onLoadCallback({ path: join(root, "src", "Button.tsx"), contents: code });
    expect(tsx?.loader).toBe("tsx");

    const ts = onLoadCallback({ path: join(root, "src", "utils.ts"), contents: code });
    expect(ts?.loader).toBe("ts");

    const jsx = onLoadCallback({ path: join(root, "src", "App.jsx"), contents: code });
    expect(jsx?.loader).toBe("jsx");

    const js = onLoadCallback({ path: join(root, "src", "index.js"), contents: code });
    expect(js?.loader).toBe("js");
  });
  test("points a side-effect-only .css.ts import at the CSS-only module when bundling", () => {
    // Given a bundling build
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {});
    const plugin = trussEsbuildPlugin({ mapping: join(root, "src", "Css.json") });
    const { onLoadCallback } = setupPlugin(plugin, join(root, "dist"), true);
    // When esbuild loads a module with a side-effect-only .css.ts import
    const result = onLoadCallback({
      path: join(root, "src", "index.ts"),
      contents: `import "./App.css.ts";\nexport const a = 1;`,
    });
    // Then the import names the CSS-only module
    expect(n(result!.contents)).toBe(n(`import "./App.css.ts?truss-css"; export const a = 1;`));
  });

  test("leaves a side-effect-only .css.ts import as written when not bundling", () => {
    // Given a build that does not bundle, so esbuild resolves no imports
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {});
    const plugin = trussEsbuildPlugin({ mapping: join(root, "src", "Css.json") });
    const { onLoadCallback } = setupPlugin(plugin, join(root, "dist"), false);
    // When esbuild loads a module with a side-effect-only .css.ts import
    const result = onLoadCallback({
      path: join(root, "src", "index.ts"),
      contents: `import "./App.css.ts";\nexport const a = 1;`,
    });
    // Then the module needs no transform
    expect(result).toBeUndefined();
  });

  test("resolves the CSS-only import to the .css.ts file in the truss-css namespace", () => {
    // Given a bundling build
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {});
    const plugin = trussEsbuildPlugin({ mapping: join(root, "src", "Css.json") });
    const { onResolveCallback } = setupPlugin(plugin, join(root, "dist"), true);
    // And a .css.ts file on disk
    const sourcePath = join(root, "src", "App.css.ts");
    writeFileSync(sourcePath, `export const css = { body: "margin: 0;" };`, "utf8");
    // When esbuild resolves the rewritten import
    const result = onResolveCallback({ path: "./App.css.ts?truss-css", resolveDir: join(root, "src") });
    // Then it is the CSS-only module for that file
    expect(result).toEqual({ path: sourcePath, namespace: "truss-css" });
  });

  test("loads the CSS-only module as an empty module", () => {
    // Given a bundling build
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {});
    const plugin = trussEsbuildPlugin({ mapping: join(root, "src", "Css.json") });
    const { onCssOnlyLoadCallback } = setupPlugin(plugin, join(root, "dist"), true);
    // And a .css.ts file on disk
    const sourcePath = join(root, "src", "App.css.ts");
    writeFileSync(sourcePath, `export const css = { body: "margin: 0;" };`, "utf8");
    // When esbuild loads the CSS-only module
    const result = onCssOnlyLoadCallback({ path: sourcePath });
    // Then no code from the .css.ts file is bundled
    expect(result).toEqual({ contents: "export {};", loader: "js" });
  });

  test("writes the CSS of a .css.ts file that is only loaded as the CSS-only module", () => {
    // Given a bundling build
    const root = createTempRoot();
    const outDir = join(root, "dist");
    writeMapping(join(root, "src", "Css.json"), {});
    const plugin = trussEsbuildPlugin({ mapping: join(root, "src", "Css.json") });
    const { onCssOnlyLoadCallback, onEndCallback } = setupPlugin(plugin, outDir, true);
    // And a .css.ts file on disk
    const sourcePath = join(root, "src", "App.css.ts");
    writeFileSync(sourcePath, `export const css = { body: "margin: 0;" };`, "utf8");
    // When esbuild loads only its CSS-only module and the build ends
    onCssOnlyLoadCallback({ path: sourcePath });
    onEndCallback();
    // Then truss.css has the file's rule
    expect(readFileSync(join(outDir, "truss.css"), "utf8")).toBe(
      [
        ":root { --t-spacing: 8px; }",
        "/* @truss arbitrary:start */",
        "body {",
        "  margin: 0;",
        "}",
        "/* @truss arbitrary:end */",
      ].join("\n"),
    );
  });
});

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "truss-esbuild-test-"));
  tempDirs.push(root);
  return root;
}

function writeMapping(path: string, abbreviations: Record<string, Record<string, unknown>>): void {
  mkdirSync(dirname(path), { recursive: true });
  const mapping = { increment: 8, abbreviations };
  writeFileSync(path, `${JSON.stringify(mapping, null, 2)}\n`, "utf8");
}

/**
 * Wire up the esbuild plugin's setup function and return the registered callbacks.
 *
 * Simulates esbuild's `build.onLoad` / `build.onEnd` registration without
 * needing a real esbuild instance.
 */
function setupPlugin(
  plugin: ReturnType<typeof trussEsbuildPlugin>,
  outDir: string,
  bundle = false,
): {
  onLoadCallback: (args: { path: string; contents: string }) => LoadResult;
  onResolveCallback: (args: { path: string; resolveDir: string }) => ResolveResult;
  onCssOnlyLoadCallback: (args: { path: string }) => LoadResult;
  onEndCallback: () => void;
} {
  let loadCallback: ((args: { path: string }) => LoadResult) | undefined;
  let cssOnlyLoadCallback: ((args: { path: string }) => LoadResult) | undefined;
  let resolveCallback: ((args: { path: string; resolveDir: string }) => ResolveResult) | undefined;
  let endCallback: (() => void) | undefined;

  const fakeBuild = {
    initialOptions: { outdir: outDir, bundle },
    onResolve(_opts: { filter: RegExp }, cb: (args: { path: string; resolveDir: string }) => ResolveResult) {
      resolveCallback = cb;
    },
    onLoad(opts: { filter: RegExp; namespace?: string }, cb: (args: { path: string }) => LoadResult) {
      // The namespaced onLoad serves the CSS-only module of a side-effect-only .css.ts import
      if (opts.namespace === "truss-css") cssOnlyLoadCallback = cb;
      else loadCallback = cb;
    },
    onEnd(cb: () => void) {
      endCallback = cb;
    },
  };

  plugin.setup(fakeBuild);

  return {
    onLoadCallback(args: { path: string; contents: string }) {
      // Write the file so transformTruss can read it if needed, and the onLoad can find it
      mkdirSync(dirname(args.path), { recursive: true });
      writeFileSync(args.path, args.contents, "utf8");
      return loadCallback!(args);
    },
    onResolveCallback(args: { path: string; resolveDir: string }) {
      return resolveCallback!(args);
    },
    onCssOnlyLoadCallback(args: { path: string }) {
      return cssOnlyLoadCallback!(args);
    },
    onEndCallback() {
      endCallback!();
    },
  };
}

type LoadResult = { contents: string; loader: string } | undefined;
type ResolveResult = { path: string; namespace: string } | undefined;

function n(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
