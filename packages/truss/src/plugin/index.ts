import { readFileSync, existsSync } from "fs";
import { resolve, dirname, isAbsolute } from "path";
import type { TrussMapping } from "./types";
import { transformTruss } from "./transform";
import { transformCssTs } from "./transform-css";
import { rewriteCssTsImports } from "./rewrite-css-ts-imports";

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
const CSS_TS_QUERY = "?truss-css";

/**
 * Vite plugin that transforms `Css.*.$` expressions from truss's CssBuilder DSL
 * into file-local `stylex.create()` + `stylex.props()` calls.
 *
 * Also supports `.css.ts` files: a `.css.ts` file with
 * `export const css = { ".selector": Css.blue.$ }` can keep other runtime exports,
 * while imports are supplemented with a virtual CSS side-effect module.
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
      if (!source.endsWith(CSS_TS_QUERY)) return null;

      const absolutePath = resolveImportPath(source.slice(0, -CSS_TS_QUERY.length), importer, projectRoot);

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

      const rewrittenImports = rewriteCssTsImports(code, id);
      const rewrittenCode = rewrittenImports.code;
      const hasCssDsl = rewrittenCode.includes("Css");
      if (!hasCssDsl && !rewrittenImports.changed) return null;

      const fileId = stripQueryAndHash(id);
      if (isNodeModulesFile(fileId) && !isWhitelistedExternalPackageFile(fileId, externalPackages)) {
        return null;
      }

      if (fileId.endsWith(".css.ts")) {
        // Keep `.css.ts` modules as normal TS so named exports like class-name
        // constants still work at runtime; only return code when we injected the
        // companion `?truss-css` side-effect import.
        return rewrittenImports.changed ? { code: rewrittenCode, map: null } : null;
      }

      if (!hasCssDsl) {
        // Some non-`.css.ts` modules only need the import rewrite and do not have
        // any `Css.*.$` expressions for the main Truss transform to process.
        return { code: rewrittenCode, map: null };
      }

      // For regular JS/TS modules that still use the DSL, run the full Truss
      // transform after the import rewrite so both behaviors compose.
      const result = transformTruss(rewrittenCode, id, ensureMapping());
      if (!result) {
        if (!rewrittenImports.changed) return null;
        return { code: rewrittenCode, map: null };
      }
      return { code: result.code, map: result.map };
    },
  };
}

function resolveImportPath(source: string, importer: string | undefined, projectRoot: string | undefined): string {
  if (isAbsolute(source)) {
    return source;
  }

  if (importer) {
    return resolve(dirname(importer), source);
  }

  return resolve(projectRoot || process.cwd(), source);
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
