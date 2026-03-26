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
        import { trussProps } from "@homebound/truss/runtime";
        const el = <div {...trussProps({ display: "df" })} />;
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
        "/* @truss p:3000 c:black */",
        ".black { color: #353535; }",
        "/* @truss p:3000 c:df */",
        ".df { display: flex; }",
      ].join("\n"),
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
): {
  onLoadCallback: (args: { path: string; contents: string }) => { contents: string; loader: string } | undefined;
  onEndCallback: () => void;
} {
  let loadCallback: ((args: { path: string }) => { contents: string; loader: string } | undefined) | undefined;
  let endCallback: (() => void) | undefined;

  const fakeBuild = {
    initialOptions: { outdir: outDir },
    onLoad(
      _opts: { filter: RegExp },
      cb: (args: { path: string }) => { contents: string; loader: string } | undefined,
    ) {
      loadCallback = cb;
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
    onEndCallback() {
      endCallback!();
    },
  };
}

function n(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
