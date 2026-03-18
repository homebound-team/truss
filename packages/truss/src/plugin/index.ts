import { readFileSync } from "fs";
import { resolve } from "path";
import type { TrussMapping } from "./types";
import { transformTruss } from "./transform";

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
  transform?: (code: string, id: string) => { code: string; map: any } | null;
}

/**
 * Vite plugin that transforms `Css.*.$` expressions from truss's CssBuilder DSL
 * into file-local `stylex.create()` + `stylex.props()` calls.
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
