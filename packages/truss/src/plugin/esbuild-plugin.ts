import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, join, relative } from "path";
import type { TrussMapping } from "./types";
import type { AtomicRule } from "./emit-truss";
import { generateCssText } from "./emit-truss";
import { transformTruss } from "./transform";
import { loadMapping } from "./index";

export interface TrussEsbuildPluginOptions {
  /** Path to the Css.json mapping file (relative to cwd or absolute). */
  mapping: string;
  /** Output path for the generated truss.css (relative to outDir or absolute). Defaults to `truss.css`. */
  outputCss?: string;
}

/**
 * esbuild plugin that transforms `Css.*.$` expressions and emits a `truss.css` file.
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
  const cssRegistry = new Map<string, AtomicRule>();
  let mapping: TrussMapping | null = null;
  let outDir: string | undefined;

  return {
    name: "truss",
    setup(build: EsbuildPluginBuild) {
      // Resolve outDir from esbuild config
      outDir = build.initialOptions.outdir ?? build.initialOptions.outdir;

      build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, (args: { path: string }) => {
        const code = readFileSync(args.path, "utf8");
        if (!code.includes("Css") && !code.includes("css=")) return undefined;

        if (!mapping) {
          mapping = loadMapping(resolve(process.cwd(), opts.mapping));
        }

        const result = transformTruss(code, args.path, mapping);
        if (!result) return undefined;

        // Merge rules into the shared registry
        if (result.rules) {
          for (const [className, rule] of result.rules) {
            if (!cssRegistry.has(className)) {
              cssRegistry.set(className, rule);
            }
          }
        }

        return { contents: result.code, loader: loaderForPath(args.path) };
      });

      build.onEnd(() => {
        if (cssRegistry.size === 0) return;

        const css = generateCssText(cssRegistry);
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
