import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import { createTrussTransformSession } from "./transform-session";

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
  let outDir: string | undefined;
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
      // Resolve outDir from esbuild config
      outDir = build.initialOptions.outdir ?? build.initialOptions.outdir;

      build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, (args: { path: string }) => {
        const code = readFileSync(args.path, "utf8");

        if (args.path.endsWith(".css.ts")) {
          session.updateArbitraryCssRegistry(args.path, code);
          return { contents: code, loader: loaderForPath(args.path) };
        }

        if (!code.includes("Css") && !code.includes("css=")) return undefined;

        const result = session.transformCode(code, args.path);
        if (!result) return undefined;

        return { contents: result.code, loader: loaderForPath(args.path) };
      });

      build.onEnd(() => {
        if (!session.hasCss()) return;

        const css = session.collectCss();
        if (css.length === 0) return;
        const cssFileName = opts.outputCss ?? "truss.css";
        const cssPath = resolve(outDir ?? join(process.cwd(), "dist"), cssFileName);

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
  initialOptions: { outdir?: string };
  onLoad(
    options: { filter: RegExp },
    callback: (args: { path: string }) => { contents: string; loader: string } | undefined,
  ): void;
  onEnd(callback: () => void): void;
}
