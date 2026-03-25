import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname, isAbsolute, join } from "path";
import type { TrussMapping } from "./types";
import type { AtomicRule } from "./emit-truss";
import { generateCssText } from "./emit-truss";
import { transformTruss } from "./transform";
import { transformCssTs } from "./transform-css";
import { rewriteCssTsImports } from "./rewrite-css-ts-imports";
import { readTrussCss, mergeTrussCss, parseTrussCss, type ParsedTrussCss } from "./merge-css";

export interface TrussPluginOptions {
  /** Path to the Css.json mapping file used for transforming files (relative to project root or absolute). */
  mapping: string;
  /** Paths to pre-compiled truss.css files from libraries to merge into the app's CSS. */
  libraries?: string[];
}

// Intentionally loose Vite types so we don't depend on the `vite` package at compile time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface TrussVitePlugin {
  name: string;
  enforce?: "pre" | "post";
  configResolved?: (config: any) => void;
  buildStart?: () => void;
  resolveId?: (source: string, importer: string | undefined) => string | null;
  load?: (id: string) => string | null;
  transform?: (code: string, id: string) => { code: string; map: any } | null;
  configureServer?: (server: any) => void;
  transformIndexHtml?: (html: string) => string;
  handleHotUpdate?: (ctx: any) => void;
  generateBundle?: (options: any, bundle: any) => void;
  writeBundle?: (options: any, bundle: any) => void;
}

/** Prefix for virtual CSS module IDs generated from .css.ts files. */
const VIRTUAL_CSS_PREFIX = "\0truss-css:";
const CSS_TS_QUERY = "?truss-css";

/** Virtual module IDs for dev HMR. */
const VIRTUAL_CSS_ENDPOINT = "/virtual:truss.css";
const VIRTUAL_RUNTIME_ID = "virtual:truss:runtime";
const RESOLVED_VIRTUAL_RUNTIME_ID = "\0" + VIRTUAL_RUNTIME_ID;

/**
 * Vite plugin that transforms `Css.*.$` expressions from truss's CssBuilder DSL
 * into Truss-native style hash objects and `trussProps()`/`mergeProps()` runtime calls.
 *
 * Also supports `.css.ts` files: a `.css.ts` file with
 * `export const css = { ".selector": Css.blue.$ }` can keep other runtime exports,
 * while imports are supplemented with a virtual CSS side-effect module.
 *
 * In dev mode, serves CSS via a virtual endpoint that the injected runtime keeps in sync.
 * In production, emits a single `truss.css` asset with all atomic rules.
 */
export function trussPlugin(opts: TrussPluginOptions): TrussVitePlugin {
  let mapping: TrussMapping | null = null;
  let projectRoot: string;
  let debug = false;
  let isTest = false;
  let isBuild = false;
  const libraryPaths = opts.libraries ?? [];

  // Global CSS rule registry shared across all transform calls within a build
  const cssRegistry = new Map<string, AtomicRule>();
  let cssVersion = 0;
  let lastSentVersion = 0;

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

  /** Cached parsed library CSS (loaded once per build). */
  let libraryCache: ParsedTrussCss[] | null = null;

  /** Load and cache all library truss.css files. */
  function loadLibraries(): ParsedTrussCss[] {
    if (!libraryCache) {
      libraryCache = libraryPaths.map(function (libPath) {
        const resolved = resolve(projectRoot || process.cwd(), libPath);
        return readTrussCss(resolved);
      });
    }
    return libraryCache;
  }

  /**
   * Generate the full CSS string from the global registry, merged with library CSS.
   *
   * When `libraries` are configured, parses each library's annotated truss.css,
   * combines with the app's own rules, deduplicates by class name, and sorts
   * by priority to produce a unified stylesheet.
   */
  function collectCss(): string {
    const appCss = generateCssText(cssRegistry);
    const libs = loadLibraries();
    if (libs.length === 0) return appCss;
    // Parse the app's own annotated CSS and merge with library sources
    const appParsed = parseTrussCss(appCss);
    return mergeTrussCss([...libs, appParsed]);
  }

  return {
    name: "truss",
    enforce: "pre",

    configResolved(config: any) {
      projectRoot = config.root;
      debug = config.command === "serve" || config.mode === "development" || config.mode === "test";
      isTest = config.mode === "test";
      isBuild = config.command === "build";
    },

    buildStart() {
      ensureMapping();
      // Reset registry and library cache at start of each build
      cssRegistry.clear();
      libraryCache = null;
      cssVersion = 0;
      lastSentVersion = 0;
    },

    // -- Dev mode HMR --

    configureServer(server: any) {
      // Skip dev-server setup in test mode — Vitest doesn't start a real HTTP
      // server, so the interval would keep the process alive.
      if (isTest) return;

      // Serve the current collected CSS at the virtual endpoint
      server.middlewares.use(function (req: any, res: any, next: any) {
        if (req.url !== VIRTUAL_CSS_ENDPOINT) return next();
        const css = collectCss();
        res.setHeader("Content-Type", "text/css");
        res.setHeader("Cache-Control", "no-store");
        res.end(css);
      });

      // Poll for CSS version changes and push HMR updates
      const interval = setInterval(function () {
        if (cssVersion !== lastSentVersion && server.ws) {
          lastSentVersion = cssVersion;
          server.ws.send({ type: "custom", event: "truss:css-update" });
        }
      }, 150);

      // Clean up interval when server closes
      server.httpServer?.on("close", function () {
        clearInterval(interval);
      });
    },

    transformIndexHtml(html: string) {
      if (isBuild) return html;
      // Inject the virtual runtime script for dev mode; it owns style updates.
      const tag = `<script type="module" src="/${VIRTUAL_RUNTIME_ID}"></script>`;
      return html.replace("</head>", `    ${tag}\n  </head>`);
    },

    handleHotUpdate(ctx: any) {
      // Send CSS update event on any file change for safety
      if (ctx.server?.ws) {
        ctx.server.ws.send({ type: "custom", event: "truss:css-update" });
      }
    },

    // -- Virtual module resolution --

    resolveId(source: string, importer: string | undefined) {
      // Handle the dev HMR runtime virtual module
      if (source === VIRTUAL_RUNTIME_ID || source === "/" + VIRTUAL_RUNTIME_ID) {
        return RESOLVED_VIRTUAL_RUNTIME_ID;
      }

      // Handle .css.ts virtual modules
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
      // Serve the dev HMR runtime script
      if (id === RESOLVED_VIRTUAL_RUNTIME_ID) {
        return `
// Truss dev HMR runtime — keeps styles up to date without page reload
(function() {
  let style = document.getElementById("__truss_virtual__");
  if (!style) {
    style = document.createElement("style");
    style.id = "__truss_virtual__";
    document.head.appendChild(style);
  }

  function fetchCss() {
    fetch("${VIRTUAL_CSS_ENDPOINT}")
      .then(function(r) { return r.text(); })
      .then(function(css) { style.textContent = css; })
      .catch(function() {});
  }

  fetchCss();

  if (import.meta.hot) {
    import.meta.hot.on("truss:css-update", fetchCss);
    import.meta.hot.on("vite:afterUpdate", function() {
      setTimeout(fetchCss, 50);
    });
  }
})();
`;
      }

      // Handle .css.ts virtual modules
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
      if (isNodeModulesFile(fileId)) {
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
      const result = transformTruss(rewrittenCode, fileId, ensureMapping(), {
        debug,
        // In test mode (jsdom), inject CSS directly so document.styleSheets has rules
        injectCss: isTest,
      });
      if (!result) {
        if (!rewrittenImports.changed) return null;
        return { code: rewrittenCode, map: null };
      }

      // Merge new rules into the global registry
      if (result.rules) {
        let hasNewRules = false;
        for (const [className, rule] of result.rules) {
          if (!cssRegistry.has(className)) {
            cssRegistry.set(className, rule);
            hasNewRules = true;
          }
        }
        if (hasNewRules) {
          cssVersion++;
        }
      }

      return { code: result.code, map: result.map };
    },

    // -- Production CSS emission --

    generateBundle(_options: any, bundle: any) {
      if (!isBuild) return;
      const css = collectCss();
      if (!css) return;

      // Try to append to an existing CSS asset in the bundle
      for (const key of Object.keys(bundle)) {
        const asset = bundle[key];
        if (asset.type === "asset" && key.endsWith(".css")) {
          asset.source = asset.source + "\n" + css;
          return;
        }
      }

      // No existing CSS asset found — emit a standalone truss.css
      (this as any).emitFile({
        type: "asset",
        fileName: "truss.css",
        source: css,
      });
    },

    writeBundle(options: any, bundle: any) {
      if (!isBuild) return;
      const css = collectCss();
      if (!css) return;

      // Fallback: if generateBundle didn't find a target, write to disk
      const outDir = options.dir || join(projectRoot, "dist");
      const trussPath = join(outDir, "truss.css");
      if (!existsSync(trussPath)) {
        // Check if it was appended to an existing CSS asset
        const alreadyEmitted = Object.keys(bundle).some(function (key) {
          const asset = bundle[key];
          return (
            asset.type === "asset" &&
            key.endsWith(".css") &&
            typeof asset.source === "string" &&
            asset.source.includes(css)
          );
        });
        if (!alreadyEmitted) {
          writeFileSync(trussPath, css, "utf8");
        }
      }
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
  return filePath.replace(/\\/g, "/").includes("/node_modules/");
}

/** Load a truss mapping file synchronously (for tests). */
export function loadMapping(path: string): TrussMapping {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw);
}

export type { TrussMapping, TrussMappingEntry } from "./types";
