import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import { createTrussTransformSession } from "./transform-session";
import { CSS_TS_QUERY } from "./rewrite-css-ts-imports";
import type { TransformTrussOptions } from "./transform";
import { type DiagnosticOptions } from "./types";

/** Matches an import that the transform pointed at a `.css.ts` file's CSS-only module. */
const CSS_TS_QUERY_RE = /\?truss-css$/;
/** esbuild namespace of the empty module that stands in for a side-effect-only `.css.ts` import. */
const CSS_ONLY_NAMESPACE = "truss-css";

export interface TrussEsbuildPluginOptions {
  /** Path to the Css.json mapping file (relative to cwd or absolute). */
  mapping: string;
  /** Output path for the generated truss.css (relative to outDir or absolute). Defaults to `truss.css`. */
  outputCss?: string;
}

/**
 * esbuild plugin that transforms `Css.*.$` expressions, collects `.css.ts` blocks,
 * and emits a `truss.css` file.
 *
 * Designed for library builds using tsup/esbuild. Transforms source files
 * during the build and writes an annotated `truss.css` alongside the output
 * that consuming applications can merge via the Vite plugin's `libraries` option.
 *
 * Usage with tsup:
 * ```ts
 * import { trussEsbuildPlugin } from "@homebound/truss/plugin";
 *
 * export default defineConfig({
 *   esbuildPlugins: [trussEsbuildPlugin({ mapping: "./src/Css.json" })],
 * });
 * ```
 */
export function trussEsbuildPlugin(opts: TrussEsbuildPluginOptions) {
  const diagnostics: DiagnosticOptions = {
    onDiagnostic(error) {
      throw error;
    },
  };
  const session = createTrussTransformSession({
    mappingPath() {
      return resolve(process.cwd(), opts.mapping);
    },
    projectRoot() {
      return process.cwd();
    },
  });

  return {
    name: "truss",
    setup(build: EsbuildPluginBuild) {
      const outDir = build.initialOptions.outdir ?? join(process.cwd(), "dist");

      // An unbundled build never calls onResolve, so a rewritten `?truss-css` import would be written
      // to the output as-is and fail in the consumer. Only a bundling build uses the CSS-only module.
      const transformOptions: TransformTrussOptions = {
        ...diagnostics,
        rewriteCssImports: build.initialOptions.bundle === true,
      };

      // The "file" namespace keeps this onLoad away from the CSS-only modules below; an onLoad
      // without a namespace matches every namespace, and would load the real source for them.
      build.onLoad({ filter: /\.[cm]?[jt]sx?$/, namespace: "file" }, (args: { path: string }) => {
        const code = readFileSync(args.path, "utf8");

        // A .css.ts file loaded here is the real module, i.e. for `import { zebraRows } from "./DataGrid.css.ts"`.
        // Its transform returns the source unchanged and records the file's selector CSS for onEnd.
        // I.e. `export const css = { body: Css.m0.$ }` is bundled as written, and truss.css gets
        // `body { margin: 0; }`.
        const result = session.transformCode(code, args.path, transformOptions);
        if (!result) return undefined;

        return { contents: result.code, loader: loaderForPath(args.path) };
      });

      // A side-effect-only import, i.e. `import "./App.css.ts"`, was rewritten to `./App.css.ts?truss-css`.
      // Resolve it to a CSS-only module instead of the real one. Bundling the real module would keep
      // the whole CssBuilder in the library and evaluate `Css.*.$` when the module loads, although
      // the CSS it describes is already in truss.css.
      build.onResolve({ filter: CSS_TS_QUERY_RE }, (args: { path: string; resolveDir: string }) => {
        const sourcePath = resolve(args.resolveDir, args.path.slice(0, -CSS_TS_QUERY.length));
        // Let esbuild resolve it when the file is not on disk here, i.e. a package specifier.
        if (!existsSync(sourcePath)) return undefined;
        return { path: sourcePath, namespace: CSS_ONLY_NAMESPACE };
      });

      // Run the same transform the real module gets, so the selector CSS is recorded for onEnd,
      // then give esbuild an empty module. The same options reuse the cached transform when a
      // named import also loads the real module.
      build.onLoad({ filter: /.*/, namespace: CSS_ONLY_NAMESPACE }, (args: { path: string }) => {
        session.transformCode(readFileSync(args.path, "utf8"), args.path, transformOptions);
        return { contents: "export {};", loader: "js" };
      });

      build.onEnd(() => {
        if (!session.hasCss()) return;

        const css = session.collectCss();
        if (css.length === 0) return;
        const cssPath = resolve(outDir, opts.outputCss ?? "truss.css");

        mkdirSync(resolve(cssPath, ".."), { recursive: true });
        writeFileSync(cssPath, css, "utf8");
      });
    },
  };
}

/** Map file extension to esbuild loader type. */
function loaderForPath(filePath: string): string {
  if (filePath.endsWith(".tsx")) return "tsx";
  if (filePath.endsWith(".ts")) return "ts";
  if (filePath.endsWith(".jsx")) return "jsx";
  return "js";
}

/**
 * Minimal esbuild plugin types so we don't need esbuild as a dependency.
 *
 * These match the subset of the esbuild Plugin API that we use.
 */
interface EsbuildPluginBuild {
  initialOptions: { outdir?: string; bundle?: boolean };
  onResolve(
    options: { filter: RegExp },
    callback: (args: { path: string; resolveDir: string }) => { path: string; namespace: string } | undefined,
  ): void;
  onLoad(
    options: { filter: RegExp; namespace?: string },
    callback: (args: { path: string }) => { contents: string; loader: string } | undefined,
  ): void;
  onEnd(callback: () => void): void;
}
