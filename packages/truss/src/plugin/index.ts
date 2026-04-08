import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname, isAbsolute, join } from "path";
import { createHash } from "crypto";
import type { TrussMapping } from "./types";
import type { AtomicRule } from "./emit-truss";
import { generateCssText } from "./emit-truss";
import { transformTruss } from "./transform";
import { transformCssTs } from "./transform-css";
import { rewriteCssTsImports } from "./rewrite-css-ts-imports";
import {
  readTrussCss,
  mergeTrussCss,
  parseTrussCss,
  annotateArbitraryCssBlock,
  type ParsedTrussCss,
} from "./merge-css";

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

/** Placeholder injected into HTML during build; replaced with the hashed CSS filename in generateBundle. */
const TRUSS_CSS_PLACEHOLDER = "__TRUSS_CSS_HASH__";

/** Virtual module IDs for dev HMR. */
const VIRTUAL_CSS_ENDPOINT = "/virtual:truss.css";
const VIRTUAL_RUNTIME_ID = "virtual:truss:runtime";
const RESOLVED_VIRTUAL_RUNTIME_ID = "\0" + VIRTUAL_RUNTIME_ID;
// Test-only bootstrap that injects the same merged collectCss() output used by
// /virtual:truss.css, but as a virtual module side effect instead of an HTTP
// fetch. In dev, the browser reaches /virtual:truss.css via transformIndexHtml
// -> virtual:truss:runtime -> fetch("/virtual:truss.css") -> configureServer.
// Vitest/jsdom does not boot from index.html or run that browser fetch/HMR path;
// it imports modules directly into the test environment, so CSS has to enter via
// a module side effect instead.
const VIRTUAL_TEST_CSS_ID = "virtual:truss:test-css";
const RESOLVED_VIRTUAL_TEST_CSS_ID = "\0" + VIRTUAL_TEST_CSS_ID;

/**
 * Vite plugin that transforms `Css.*.$` expressions from truss's CssBuilder DSL
 * into Truss-native style hash objects and `trussProps()`/`mergeProps()` runtime calls.
 *
 * Also supports `.css.ts` files: a `.css.ts` file with
 * `export const css = { ".selector": Css.blue.$ }` can keep other runtime exports,
 * while imports are supplemented with a virtual CSS side-effect module.
 *
 * In dev mode, serves CSS via a virtual endpoint that the injected runtime keeps in sync.
 * In production, emits a content-hashed CSS asset (e.g. `assets/truss-abc123.css`) for long-term caching.
 */
export function trussPlugin(opts: TrussPluginOptions): TrussVitePlugin {
  let mapping: TrussMapping | null = null;
  let projectRoot: string;
  let debug = false;
  let isTest = false;
  let isBuild = false;
  const libraryPaths = opts.libraries ?? [];
  /** The hashed CSS filename emitted during generateBundle, used by writeBundle to patch HTML. */
  let emittedCssFileName: string | null = null;

  // Global CSS rule registry shared across all transform calls within a build
  const cssRegistry = new Map<string, AtomicRule>();
  /** Arbitrary CSS blocks from app .css.ts files, keyed by source path. */
  const arbitraryCssRegistry = new Map<string, string>();
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
      libraryCache = libraryPaths.map((libPath) => {
        const resolved = resolve(projectRoot || process.cwd(), libPath);
        return readTrussCss(resolved);
      });
    }
    return libraryCache;
  }

  /** Transform a `.css.ts` file and store the raw CSS in the arbitrary registry. */
  function updateArbitraryCssRegistry(sourcePath: string, sourceCode: string): void {
    const css = transformCssTs(sourceCode, sourcePath, ensureMapping()).trim();
    if (css.length > 0) {
      const prev = arbitraryCssRegistry.get(sourcePath);
      arbitraryCssRegistry.set(sourcePath, css);
      if (prev !== css) cssVersion++;
    } else {
      if (arbitraryCssRegistry.delete(sourcePath)) cssVersion++;
    }
  }

  /**
   * Generate the full CSS string from the global registry, merged with library CSS.
   *
   * When `libraries` are configured, parses each library's annotated truss.css,
   * combines with the app's own rules, deduplicates by class name, and sorts
   * by priority to produce a unified stylesheet.
   *
   * Also appends app-side `.css.ts` arbitrary CSS blocks collected during transform.
   */
  function collectCss(): string {
    const appCssParts = [generateCssText(cssRegistry)];
    // Wrap all app .css.ts blocks in a single annotation (mirroring how the esbuild plugin handles them)
    const allArbitrary = Array.from(arbitraryCssRegistry.values()).join("\n\n");
    appCssParts.push(annotateArbitraryCssBlock(allArbitrary));
    const appCss = appCssParts.filter((p) => p.length > 0).join("\n");
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
      // Reset registries and library cache at start of each build
      cssRegistry.clear();
      arbitraryCssRegistry.clear();
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
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url !== VIRTUAL_CSS_ENDPOINT) return next();
        const css = collectCss();
        res.setHeader("Content-Type", "text/css");
        res.setHeader("Cache-Control", "no-store");
        res.end(css);
      });

      // Poll for CSS version changes and push HMR updates
      const interval = setInterval(() => {
        if (cssVersion !== lastSentVersion && server.ws) {
          lastSentVersion = cssVersion;
          server.ws.send({ type: "custom", event: "truss:css-update" });
        }
      }, 150);

      // Clean up interval when server closes
      server.httpServer?.on("close", () => {
        clearInterval(interval);
      });
    },

    transformIndexHtml(html: string) {
      if (isBuild) {
        // Strip any existing truss CSS references so the hook is idempotent when
        // a tool (e.g. Storybook) runs multiple Vite builds with the same plugin.
        // I.e. removes /virtual:truss.css, __TRUSS_CSS_HASH__, and /assets/truss-<hash>.css
        const stripped = html
          .replace(/\s*<link[^>]*href=["'][^"']*virtual:truss\.css["'][^>]*\/?>/g, "")
          .replace(/\s*<link[^>]*href=["'][^"']*__TRUSS_CSS_HASH__["'][^>]*\/?>/g, "")
          .replace(/\s*<link[^>]*href=["'][^"']*\/assets\/truss-[0-9a-f]+\.css["'][^>]*\/?>/g, "");
        // Inject a stylesheet link with a placeholder; writeBundle replaces it
        // with the content-hashed filename for long-term caching.
        const link = `<link rel="stylesheet" href="${TRUSS_CSS_PLACEHOLDER}">`;
        return stripped.replace("</head>", `    ${link}\n  </head>`);
      }
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
      if (source === VIRTUAL_TEST_CSS_ID || source === "/" + VIRTUAL_TEST_CSS_ID) {
        return RESOLVED_VIRTUAL_TEST_CSS_ID;
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
(() => {
  let style = document.getElementById("__truss_virtual__");
  if (!style) {
    style = document.createElement("style");
    style.id = "__truss_virtual__";
    document.head.appendChild(style);
  }

  function fetchCss() {
    fetch("${VIRTUAL_CSS_ENDPOINT}")
      .then((r) => r.text())
      .then((css) => { style.textContent = css; })
      .catch(() => {});
  }

  fetchCss();

  if (import.meta.hot) {
    import.meta.hot.on("truss:css-update", fetchCss);
    import.meta.hot.on("vite:afterUpdate", () => {
      setTimeout(fetchCss, 50);
    });
  }
})();
`;
      }
      if (id === RESOLVED_VIRTUAL_TEST_CSS_ID) {
        // Vitest/jsdom has no dev server stylesheet fetch, so inject the full
        // merged CSS payload once via a virtual side-effect module.
        const css = collectCss();
        return `
import { __injectTrussCSS } from "@homebound/truss/runtime";

__injectTrussCSS(${JSON.stringify(css)});
`;
      }

      // Handle .css.ts virtual modules
      if (!id.startsWith(VIRTUAL_CSS_PREFIX)) return null;

      // Re-add `.ts` to recover the original source file path
      const sourcePath = id.slice(VIRTUAL_CSS_PREFIX.length) + ".ts";
      const sourceCode = readFileSync(sourcePath, "utf8");

      // Populate the arbitrary CSS registry on first load; subsequent updates
      // happen in the transform hook when Vite re-transforms the changed file.
      updateArbitraryCssRegistry(sourcePath, sourceCode);

      // Return an empty stylesheet to Vite's CSS pipeline — the real CSS is now
      // served via collectCss() (dev: /virtual:truss.css, build: truss-<hash>.css)
      // so we avoid duplicating it in Vite's own CSS bundle.
      return `/* [truss] ${sourcePath} — included via truss.css */`;
    },

    transform(code: string, id: string) {
      // Only process JS/TS/JSX/TSX files
      if (!/\.[cm]?[jt]sx?(\?|$)/.test(id)) return null;

      const rewrittenImports = rewriteCssTsImports(code, id);
      const rewrittenCode = rewrittenImports.code;
      const fileId = stripQueryAndHash(id);

      // In tests, we do not boot through index.html and the dev runtime fetch path
      // (`virtual:truss:runtime` -> fetch("/virtual:truss.css")), so we inject the
      // merged application + library CSS through a virtual module side effect instead.
      //
      // We add `import "virtual:truss:test-css"` to each eligible transformed module,
      // but ESM module caching should evaluate that virtual module only once per test
      // module graph. Transformed files may still emit per-file `__injectTrussCSS`
      // calls; exact repeated chunks are deduped in the runtime helper.
      const shouldBootstrapTestCss = isTest && libraryPaths.length > 0 && !isNodeModulesFile(fileId);
      const testCssBootstrap = injectTestCssBootstrapImport(rewrittenCode, shouldBootstrapTestCss);
      const transformedCode = testCssBootstrap.code;
      const hasCssDsl = rewrittenCode.includes("Css") || rewrittenCode.includes("css=");
      if (isNodeModulesFile(fileId)) {
        return null;
      }
      if (!hasCssDsl && !rewrittenImports.changed && !testCssBootstrap.changed) return null;

      if (fileId.endsWith(".css.ts")) {
        // Keep `.css.ts` modules as normal TS so named exports like class-name
        // constants still work at runtime; only return code when we injected the
        // companion `?truss-css` side-effect import.
        //
        // Also update the arbitrary CSS registry so HMR picks up changes —
        // the load hook only runs on first resolve, so edits need to refresh
        // the registry here where Vite re-transforms changed files.
        updateArbitraryCssRegistry(fileId, code);
        return rewrittenImports.changed || testCssBootstrap.changed ? { code: transformedCode, map: null } : null;
      }

      if (!hasCssDsl) {
        // Some non-`.css.ts` modules only need the import rewrite and do not have
        // any `Css.*.$` expressions for the main Truss transform to process.
        return { code: transformedCode, map: null };
      }

      // For regular JS/TS modules that still use the DSL, run the full Truss
      // transform after the import rewrite so both behaviors compose.
      const result = transformTruss(
        transformedCode,
        fileId,
        ensureMapping(),
        // In test mode (jsdom), inject CSS directly so document.styleSheets has rules
        { debug, injectCss: isTest },
      );
      if (!result) {
        if (!rewrittenImports.changed && !testCssBootstrap.changed) return null;
        return { code: transformedCode, map: null };
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

    generateBundle(_options: any, _bundle: any) {
      if (!isBuild) return;
      const css = collectCss();
      if (!css) return;

      // Compute a content hash so the filename is cache-bustable.
      const hash = createHash("sha256").update(css).digest("hex").slice(0, 8);
      const fileName = `assets/truss-${hash}.css`;
      emittedCssFileName = fileName;

      (this as any).emitFile({
        type: "asset",
        fileName,
        source: css,
      });
    },

    /** Patch HTML files on disk to replace the CSS placeholder with the hashed filename. */
    writeBundle(options: any, _bundle: any) {
      if (!emittedCssFileName) return;
      const outDir = options.dir || join(projectRoot, "dist");
      // Find and patch all HTML files in the output directory
      for (const entry of readdirSync(outDir)) {
        if (!entry.endsWith(".html")) continue;
        const htmlPath = join(outDir, entry);
        const html = readFileSync(htmlPath, "utf8");
        if (html.includes(TRUSS_CSS_PLACEHOLDER)) {
          writeFileSync(htmlPath, html.replace(TRUSS_CSS_PLACEHOLDER, `/${emittedCssFileName}`), "utf8");
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

function injectTestCssBootstrapImport(code: string, shouldInject: boolean): { code: string; changed: boolean } {
  // Keep this as a normal ESM import so Vite/Vitest module caching ensures the
  // bootstrap executes once per module graph instead of once per transformed file.
  if (!shouldInject) {
    return { code, changed: false };
  }

  return {
    code: `${code}\nimport "${VIRTUAL_TEST_CSS_ID}";`,
    changed: true,
  };
}

/** Load a truss mapping file synchronously (for tests). */
export function loadMapping(path: string): TrussMapping {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw);
}

export type { TrussMapping, TrussMappingEntry } from "./types";
export { trussEsbuildPlugin, type TrussEsbuildPluginOptions } from "./esbuild-plugin";
