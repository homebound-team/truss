import type { Plugin } from "vite";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { TrussMapping } from "./types";
import { transformTruss } from "./transform";

export interface TrussPluginOptions {
  /**
   * Path to the Css.json mapping file (relative to project root or absolute).
   * Each application generates its own mapping via `yarn codegen`.
   */
  mapping: string;
}

/**
 * Vite plugin that transforms `Css.*.$` expressions from truss's CssBuilder DSL
 * into file-local `stylex.create()` + `stylex.props()` calls.
 *
 * Must be placed BEFORE the StyleX unplugin in the plugins array so that
 * StyleX's babel plugin can process the generated `stylex.create()` calls.
 */
export function trussPlugin(opts: TrussPluginOptions): Plugin {
  let mapping: TrussMapping;
  let projectRoot: string;

  // Resolve lazily from Vite's final root so relative paths match user config.
  const mappingPath = () => resolve(projectRoot || process.cwd(), opts.mapping);

  // Some tooling can call `transform` before `buildStart`; this keeps behavior
  // resilient without requiring hook ordering assumptions.
  const ensureMapping = () => {
    if (!mapping) {
      mapping = loadMapping(mappingPath());
    }
    return mapping;
  };

  return {
    name: "truss-stylex",
    enforce: "pre",

    configResolved(config) {
      projectRoot = config.root;
    },

    buildStart() {
      mapping = loadMapping(mappingPath());
    },

    transform(code, id) {
      // Only process JS/TS/JSX/TSX files
      if (!/\.[cm]?[jt]sx?(\?|$)/.test(id)) return null;
      // Fast bail: skip files that don't reference Css
      if (!code.includes("Css")) return null;
      // Skip node_modules
      if (id.includes("node_modules")) return null;

      const result = transformTruss(code, id, ensureMapping());
      if (!result) return null;
      return { code: result.code, map: result.map };
    },
  };
}

/** Load a truss mapping file synchronously (for tests). */
export function loadMapping(path: string): TrussMapping {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw);
}

export type { TrussMapping, TrussMappingEntry } from "./types";
