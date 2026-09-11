import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname, isAbsolute, join } from "path";
import { createHash } from "crypto";
import { type PluginContext } from "rollup";
import { rewriteCssTsImports } from "./rewrite-css-ts-imports";
import { createTrussTransformSession } from "./transform-session";
import { splitArbitraryCss } from "./test-css";
import { rootSpacingPreludeCss } from "../spacing-css-var";
import { generate, parseModule, traverse } from "./babel-utils";
import { findNamedImportBinding, reservePreferredName, upsertNamedImports } from "./ast-utils";
import * as t from "@babel/types";
import { type DiagnosticOptions, type TransformDiagnostic } from "./types";

export interface TrussPluginOptions {
  /** Path to the Css.json mapping file used for transforming files (relative to project root or absolute). */
  mapping: string;
  /** Paths to pre-compiled truss.css files from libraries to merge into the app's CSS. */
  libraries?: string[];
  /** Unsupported patterns fail builds by default; dev transforms warn and keep serving the page. */
  unsupportedPattern?: "error" | "warn";
}

type DiagnosticContext = Pick<PluginContext, "warn">;

// Use Rollup's context for diagnostics; keep other hooks loose without a Vite compile-time dependency.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface TrussVitePlugin {
  name: string;
  enforce?: "pre" | "post";
  configResolved?: (config: any) => void;
  buildStart?: () => void;
  resolveId?: (source: string, importer: string | undefined) => string | null;
  load?: (this: DiagnosticContext, id: string) => string | null;
  transform?: (this: DiagnosticContext, code: string, id: string) => { code: string; map: any } | null;
  configureServer?: (server: any) => void;
  transformIndexHtml?: (html: string) => string;
  handleHotUpdate?: (ctx: any) => void;
  generateBundle?: (options: any, bundle: any) => void;
  writeBundle?: (options: any, bundle: any) => void;
}

/** Prefix for virtual CSS module IDs generated from .css.ts files. */
const VIRTUAL_CSS_PREFIX = "\0truss-css:";
const VIRTUAL_TEST_CSS_PREFIX = "\0truss-test-css:";
const CSS_TS_QUERY = "?truss-css";
const RUNTIME_MODULE = "@homebound/truss/runtime";
const INJECT_CSS_HELPER = "__injectTrussCSS";

/** Placeholder injected into HTML during build; replaced with the hashed CSS filename in generateBundle. */
const TRUSS_CSS_PLACEHOLDER = "__TRUSS_CSS_HASH__";

/** Virtual module IDs for dev HMR. */
const VIRTUAL_CSS_ENDPOINT = "/virtual:truss.css";
const VIRTUAL_RUNTIME_ID = "virtual:truss:runtime";
const RESOLVED_VIRTUAL_RUNTIME_ID = "\0" + VIRTUAL_RUNTIME_ID;
// Test-only bootstrap that injects merged library CSS and the spacing prelude
// as a virtual module side effect instead of an HTTP
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
  let projectRoot: string;
  let debug = false;
  let isTest = false;
  let isBuild = false;
  let annotate = true;
  let devSocket: { send: (payload: unknown) => void } | undefined;
  const libraryPaths = opts.libraries ?? [];
  /** The hashed CSS filename emitted during generateBundle, used by writeBundle to patch HTML. */
  let emittedCssFileName: string | null = null;

  let cssUpdateTimer: ReturnType<typeof setTimeout> | undefined;

  function mappingPath(): string {
    return resolve(projectRoot || process.cwd(), opts.mapping);
  }

  /** Connect transform diagnostics to Vite reporting. */
  function diagnostics(context: DiagnosticContext): DiagnosticOptions {
    return {
      onDiagnostic: (error) => reportDiagnostic(context, error),
    };
  }

  const session = createTrussTransformSession({
    mappingPath,
    projectRoot: () => projectRoot || process.cwd(),
    libraries: libraryPaths,
    onCssChanged() {
      if (!devSocket || cssUpdateTimer !== undefined) return;
      // Notify after transforms finish, batching registry changes in this event-loop turn.
      cssUpdateTimer = setTimeout(() => {
        cssUpdateTimer = undefined;
        devSocket?.send({ type: "custom", event: "truss:css-update" });
      }, 0);
    },
  });

  return {
    name: "truss",
    enforce: "pre",

    configResolved(config: any) {
      projectRoot = config.root;
      debug = config.command === "serve" || config.mode === "development" || config.mode === "test";
      isTest = config.mode === "test";
      isBuild = config.command === "build";
      annotate = !isBuild || Boolean(config.build?.lib);
    },

    buildStart() {
      session.ensureMapping();
      // Reset registries and library cache at start of each build
      session.reset();
      clearTimeout(cssUpdateTimer);
      cssUpdateTimer = undefined;
    },

    // -- Dev mode HMR --

    configureServer(server: any) {
      // Skip dev-server setup in test mode — Vitest doesn't start a real HTTP
      // server and does not use browser CSS updates.
      if (isTest) return;
      devSocket = server.ws;

      // Serve the current collected CSS at the virtual endpoint
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url !== VIRTUAL_CSS_ENDPOINT) return next();
        const css = session.collectCss(annotate);
        res.setHeader("Content-Type", "text/css");
        res.setHeader("Cache-Control", "no-store");
        res.end(css);
      });

      // Cancel pending CSS updates when the server closes.
      server.httpServer?.on("close", () => {
        clearTimeout(cssUpdateTimer);
        cssUpdateTimer = undefined;
        devSocket = undefined;
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

      // Compile test side effects without evaluating build-only CssBuilder expressions.
      if (isTest) return VIRTUAL_TEST_CSS_PREFIX + absolutePath;

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
  }
})();
`;
      }
      if (id === RESOLVED_VIRTUAL_TEST_CSS_ID) {
        // Vitest/jsdom has no dev server stylesheet fetch, so inject libraries
        // once; application modules deliver CSS when they evaluate.
        const payload = {
          ...session.collectTestCss(),
          source: "libraries",
          order: 0,
          prelude: rootSpacingPreludeCss(session.ensureMapping().increment),
        };
        return `
import { __injectTrussCSS } from "@homebound/truss/runtime";

__injectTrussCSS(${JSON.stringify(payload)});
`;
      }

      if (id.startsWith(VIRTUAL_TEST_CSS_PREFIX)) {
        const sourcePath = canonicalSourcePath(id.slice(VIRTUAL_TEST_CSS_PREFIX.length));
        session.updateArbitraryCssRegistry(sourcePath, readFileSync(sourcePath, "utf8"), diagnostics(this));
        const payload = {
          arbitraryRules: splitArbitraryCss(session.getArbitraryCss(sourcePath)),
          source: sourcePath,
        };
        return `
import "${VIRTUAL_TEST_CSS_ID}";
import { __injectTrussCSS } from "@homebound/truss/runtime";

__injectTrussCSS(${JSON.stringify(payload)});
`;
      }

      // Handle .css.ts virtual modules
      if (!id.startsWith(VIRTUAL_CSS_PREFIX)) return null;

      // Re-add `.ts` to recover the original source file path
      const sourcePath = id.slice(VIRTUAL_CSS_PREFIX.length) + ".ts";
      const sourceCode = readFileSync(sourcePath, "utf8");

      // Populate the arbitrary CSS registry on first load; subsequent updates
      // happen in the transform hook when Vite re-transforms the changed file.
      session.updateArbitraryCssRegistry(sourcePath, sourceCode, diagnostics(this));

      // Return an empty stylesheet to Vite's CSS pipeline — the real CSS is now
      // served via collectCss() (dev: /virtual:truss.css, build: truss-<hash>.css)
      // so we avoid duplicating it in Vite's own CSS bundle.
      return `/* [truss] ${sourcePath} — included via truss.css */`;
    },

    transform(code: string, id: string) {
      // The virtual test module already contains compiled CSS, not source TypeScript.
      if (id.startsWith(VIRTUAL_TEST_CSS_PREFIX)) return null;
      // Only process JS/TS/JSX/TSX files outside node_modules
      if (!/\.[cm]?[jt]sx?(\?|$)/.test(id)) return null;
      const fileId = stripQueryAndHash(id);
      if (isNodeModulesFile(fileId)) return null;

      const rewrittenImports = rewriteCssTsImports(code, id);

      // In tests, we do not boot through index.html and the dev runtime fetch path
      // (`virtual:truss:runtime` -> fetch("/virtual:truss.css")), so we inject the
      // library CSS and spacing through a virtual module side effect instead.
      //
      // We add `import "virtual:truss:test-css"` to each eligible transformed module,
      // but ESM module caching should evaluate that virtual module only once per test
      // module graph. Transformed files may still emit per-file `__injectTrussCSS`
      // calls; atomic classes are deduped in the runtime helper.
      const shouldBootstrapTestCss = isTest;
      const transformedCode = shouldBootstrapTestCss
        ? `${rewrittenImports.code}\nimport "${VIRTUAL_TEST_CSS_ID}";`
        : rewrittenImports.code;
      // The result to return when only the import rewrites changed the module
      const importsOnlyResult =
        rewrittenImports.changed || shouldBootstrapTestCss ? { code: transformedCode, map: null } : null;

      if (fileId.endsWith(".css.ts")) {
        // Keep `.css.ts` modules as normal TS so named exports like class-name
        // constants still work at runtime. Tests also inject their CSS at evaluation.
        //
        // Also update the arbitrary CSS registry so HMR picks up changes —
        // the load hook only runs on first resolve, so edits need to refresh
        // the registry here where Vite re-transforms changed files.
        session.updateArbitraryCssRegistry(fileId, code, diagnostics(this));
        if (isTest) {
          const css = session.getArbitraryCss(fileId);
          return { code: appendTestCssInjection(transformedCode, fileId, css), map: null };
        }
        return importsOnlyResult;
      }

      // Some non-`.css.ts` modules only need the import rewrite and do not have
      // any `Css.*.$` expressions for the main Truss transform to process.
      const hasCssDsl = rewrittenImports.code.includes("Css") || rewrittenImports.code.includes("css=");
      if (!hasCssDsl) return importsOnlyResult;

      // For regular JS/TS modules that still use the DSL, run the full Truss
      // transform after the import rewrite so both behaviors compose.
      const result = session.transformCode(transformedCode, fileId, { debug, injectCss: isTest, ...diagnostics(this) });
      return result ? { code: result.code, map: result.map } : importsOnlyResult;
    },

    // -- Production CSS emission --

    generateBundle(_options: any, _bundle: any) {
      if (!isBuild) return;
      const css = session.collectCss(annotate);
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
  /** Reject fatal diagnostics; report the rest in the terminal and dev overlay. */
  function reportDiagnostic(context: DiagnosticContext, error: TransformDiagnostic): void {
    if ((opts.unsupportedPattern ?? (isBuild ? "error" : "warn")) === "error") {
      throw error;
    }
    context.warn(error);
    devSocket?.send({
      type: "error",
      err: { message: error.message, stack: "", id: error.id, loc: error.loc, plugin: "truss" },
    });
  }
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

/** Absolute, forward-slashed path, matching the arbitrary CSS registry keys on every platform. */
function canonicalSourcePath(filePath: string): string {
  return resolve(filePath).replace(/\\/g, "/");
}

/**
 * Append an `__injectTrussCSS` call so a `.css.ts` module delivers its compiled CSS when it
 * evaluates in tests, including through dynamic imports the import rewrite cannot see.
 *
 * Reuses an existing runtime import of the helper, otherwise reserves a collision-free local
 * name the same way the main transform does, so `export const __injectTrussCSS` in the module
 * still works.
 */
function appendTestCssInjection(code: string, fileId: string, css: string): string {
  const ast = parseModule(code, fileId);
  // Module-scope names, so the injected import can avoid collisions
  let usedTopLevelNames = new Set<string>();
  traverse(ast, {
    Program(path) {
      usedTopLevelNames = new Set(Object.keys(path.scope.bindings));
      path.stop();
    },
  });
  const existing = findNamedImportBinding(ast, INJECT_CSS_HELPER, RUNTIME_MODULE);
  const localName = existing ?? reservePreferredName(usedTopLevelNames, INJECT_CSS_HELPER);
  if (!existing) upsertNamedImports(ast, RUNTIME_MODULE, [{ importedName: INJECT_CSS_HELPER, localName }]);
  ast.program.body.push(
    t.expressionStatement(
      t.callExpression(t.identifier(localName), [
        t.valueToNode({ arbitraryRules: splitArbitraryCss(css), source: canonicalSourcePath(fileId) }),
      ]),
    ),
  );
  return generate(ast, { sourceFileName: fileId }).code;
}

export type { TrussMapping, TrussMappingEntry } from "./types";
export { loadMapping } from "./mapping-utils";
export { trussEsbuildPlugin, type TrussEsbuildPluginOptions } from "./esbuild-plugin";
