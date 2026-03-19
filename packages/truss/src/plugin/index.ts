import { readFileSync, existsSync } from "fs";
import { resolve, dirname, isAbsolute } from "path";
import type { TrussMapping } from "./types";
import { transformTruss } from "./transform";
import { transformCssTs } from "./transform-css";

export interface TrussPluginOptions {
  /** Path to the Css.json mapping file used for transforming files (relative to project root or absolute). */
  mapping: string;
  /** Packages in `node_modules` that should also be transformed, all other `node_modules` files are skipped. */
  externalPackages?: string[];
}

export interface TrussVitePlugin {
  name: string;
  enforce?: "pre" | "post";
  configResolved?: (config: { root: string }) => void;
  buildStart?: () => void;
  resolveId?: (source: string, importer: string | undefined) => string | null;
  load?: (id: string) => string | null;
  transform?: (code: string, id: string) => { code: string; map: any } | null;
}

/** Prefix for virtual CSS module IDs generated from .css.ts files. */
const VIRTUAL_CSS_PREFIX = "\0truss-css:";

/**
 * Vite plugin that transforms `Css.*.$` expressions from truss's CssBuilder DSL
 * into file-local `stylex.create()` + `stylex.props()` calls.
 *
 * Also supports `.css.ts` files: a `.css.ts` file with `export default { ".selector": Css.blue.$ }`
 * is transformed into a virtual CSS module. Imports of `.css.ts` files are rewritten
 * to load the generated CSS.
 *
 * Must be placed BEFORE the StyleX unplugin in the plugins array so that
 * StyleX's babel plugin can process the generated `stylex.create()` calls.
 */
export function trussPlugin(opts: TrussPluginOptions): TrussVitePlugin {
  let mapping: TrussMapping | null = null;
  let projectRoot: string;
  const externalPackages = opts.externalPackages ?? [];

  function mappingPath(): string {
    return resolve(projectRoot || process.cwd(), opts.mapping);
  }

  // Some tooling can call `transform` before `buildStart`; this keeps behavior
  // resilient without requiring hook ordering assumptions.
  function ensureMapping(): TrussMapping {
    if (!mapping) {
      mapping = loadMapping(mappingPath());
    }
    return mapping;
  }

  return {
    name: "truss-stylex",
    enforce: "pre",

    configResolved(config: { root: string }) {
      projectRoot = config.root;
    },

    buildStart() {
      ensureMapping();
    },

    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith(".css.ts")) return null;

      // Resolve the .css.ts path relative to the importer
      let absolutePath: string;
      if (isAbsolute(source)) {
        absolutePath = source;
      } else if (importer) {
        absolutePath = resolve(dirname(importer), source);
      } else {
        absolutePath = resolve(projectRoot || process.cwd(), source);
      }

      // Only handle it if the .css.ts file actually exists
      if (!existsSync(absolutePath)) return null;

      // Return a virtual CSS module ID that maps back to the source .css.ts file.
      // Strip the trailing `.ts` so the ID ends in `.css` — this tells Vite to
      // route the loaded content through its CSS pipeline.
      return VIRTUAL_CSS_PREFIX + absolutePath.slice(0, -3);
    },

    load(id: string) {
      if (!id.startsWith(VIRTUAL_CSS_PREFIX)) return null;

      // Re-add `.ts` to recover the original source file path
      const sourcePath = id.slice(VIRTUAL_CSS_PREFIX.length) + ".ts";
      const sourceCode = readFileSync(sourcePath, "utf8");
      return transformCssTs(sourceCode, sourcePath, ensureMapping());
    },

    transform(code: string, id: string) {
      // Only process JS/TS/JSX/TSX files
      if (!/\.[cm]?[jt]sx?(\?|$)/.test(id)) return null;
      // Fast bail: skip files that don't reference Css
      if (!code.includes("Css")) return null;

      const fileId = stripQueryAndHash(id);
      if (isNodeModulesFile(fileId) && !isWhitelistedExternalPackageFile(fileId, externalPackages)) {
        return null;
      }

      const result = transformTruss(code, id, ensureMapping());
      if (!result) return null;
      return { code: result.code, map: result.map };
    },
  };
}

/** Strip Vite query/hash suffixes from an id. */
function stripQueryAndHash(id: string): string {
  const queryIndex = id.indexOf("?");
  const hashIndex = id.indexOf("#");

  let end = id.length;
  if (queryIndex >= 0) end = Math.min(end, queryIndex);
  if (hashIndex >= 0) end = Math.min(end, hashIndex);

  const cleanId = id.slice(0, end);
  // Vite can prefix absolute paths with `/@fs/`.
  if (cleanId.startsWith("/@fs/")) {
    return cleanId.slice(4);
  }
  return cleanId;
}

function isNodeModulesFile(filePath: string): boolean {
  return normalizePath(filePath).includes("/node_modules/");
}

function isWhitelistedExternalPackageFile(filePath: string, externalPackages: string[]): boolean {
  const normalizedPath = normalizePath(filePath);
  return externalPackages.some(function (pkg) {
    return normalizedPath.includes(`/node_modules/${pkg}/`);
  });
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

/** Load a truss mapping file synchronously (for tests). */
export function loadMapping(path: string): TrussMapping {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw);
}

export type { TrussMapping, TrussMappingEntry } from "./types";
