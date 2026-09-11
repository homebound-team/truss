import { readFileSync, existsSync } from "fs";
import { resolve, dirname, isAbsolute } from "path";
import { createHash } from "crypto";
import { type PluginContext } from "rollup";
import { rewriteCssTsImports } from "./rewrite-css-ts-imports";
import { createTrussTransformSession } from "./transform-session";
import { splitArbitraryCss } from "./test-css";
import { applyReferencedKeyframes } from "./at-rule-refs";
import type { ParsedTrussCss } from "../truss-css";
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
  transformIndexHtml?: ((html: string) => string) | { order?: "pre" | "post"; handler: (html: string) => string };
  handleHotUpdate?: (ctx: any) => void;
  generateBundle?:
    | ((options: any, bundle: any) => void)
    | { order?: "pre" | "post"; handler: (this: PluginContext, options: any, bundle: any) => void };
}

/** Prefix for virtual CSS module IDs generated from .css.ts files. */
const VIRTUAL_CSS_PREFIX = "\0truss-css:";
const VIRTUAL_TEST_CSS_PREFIX = "\0truss-test-css:";
const CSS_TS_QUERY = "?truss-css";
const RUNTIME_MODULE = "@homebound/truss/runtime";
const INJECT_CSS_HELPER = "__injectTrussCSS";

/**
 * The app's stylesheet. `import "virtual:truss.css"` in the entry module lets the framework
 * link and bundle Truss's CSS the same as any other stylesheet, which works for a Vite SPA and
 * for an app that renders its own document, i.e. React Router, Remix, TanStack Start.
 */
const VIRTUAL_STYLESHEET_ID = "virtual:truss.css";
const RESOLVED_VIRTUAL_STYLESHEET_ID = "\0" + VIRTUAL_STYLESHEET_ID;
/**
 * Stand-in rule that `virtual:truss.css` loads during a build. Vite bundles and hashes the
 * stylesheet before the last module is transformed, so the real rules are not known yet; a
 * post-ordered `generateBundle` swaps this rule for `collectCss()` once they are.
 */
const STYLESHEET_PLACEHOLDER = ".__truss_placeholder__ { --truss-placeholder: 0; }";
const STYLESHEET_PLACEHOLDER_RE = /\.__truss_placeholder__\s*\{[^}]*\}/;

/** Any `index.html` tag left over from the stylesheet link Truss used to write itself. */
const LEGACY_CSS_LINK_RE =
  /<link[^>]*href=["'][^"']*(?:virtual:truss\.css|__TRUSS_CSS_HASH__|\/assets\/truss-[0-9a-f]+\.css)["'][^>]*\/?>/;

// Test-only bootstrap that injects merged library CSS and the spacing prelude as a virtual
// module side effect. Vitest/jsdom does not import `virtual:truss.css` or run browser CSS
// HMR; it imports modules directly into the test environment, so CSS has to enter via a
// module side effect instead.
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
  let isLib = false;
  let annotate = true;
  let devSocket: { send: (payload: unknown) => void } | undefined;
  let devServer: any;
  /** True once a module imported `virtual:truss.css`, i.e. the app links its stylesheet itself. */
  let stylesheetImported = false;
  const libraryPaths = opts.libraries ?? [];

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
        reloadVirtualStylesheet();
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
      isLib = Boolean(config.build?.lib);
      annotate = !isBuild || isLib;
    },

    buildStart() {
      session.ensureMapping();
      // Reset registries and library cache at start of each build
      session.reset();
      stylesheetImported = false;
      clearTimeout(cssUpdateTimer);
      cssUpdateTimer = undefined;
    },

    // -- Dev mode HMR --

    configureServer(server: any) {
      // Skip dev-server setup in test mode — Vitest doesn't start a real HTTP
      // server and does not use browser CSS updates.
      if (isTest) return;
      devSocket = server.ws;
      devServer = server;

      // Cancel pending CSS updates when the server closes.
      server.httpServer?.on("close", () => {
        clearTimeout(cssUpdateTimer);
        cssUpdateTimer = undefined;
        devSocket = undefined;
        devServer = undefined;
      });
    },

    /**
     * Reject an `index.html` that still links Truss's stylesheet.
     *
     * Truss used to write that tag itself; the app imports `virtual:truss.css` now. A leftover
     * tag no longer names a stylesheet — in dev the URL falls through to Vite's HTML fallback,
     * so the page silently loads `index.html` as CSS — hence failing rather than warning.
     *
     * Ordered pre, so the raw HTML is checked before Vite's own HTML plugin rewrites its links.
     */
    transformIndexHtml: {
      order: "pre",
      handler(html: string) {
        if (LEGACY_CSS_LINK_RE.test(html)) {
          throw new Error(
            "[truss] index.html still links Truss's stylesheet. Delete that <link> tag and add " +
              '`import "virtual:truss.css";` to your entry module instead.',
          );
        }
        return html;
      },
    },

    // -- Virtual module resolution --

    resolveId(source: string, importer: string | undefined) {
      if (source === VIRTUAL_STYLESHEET_ID) {
        stylesheetImported = true;
        return RESOLVED_VIRTUAL_STYLESHEET_ID;
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

      // Return a virtual module ID that maps back to the source .css.ts file. Its rules go
      // into collectCss(), so the module itself stays JavaScript and Vite writes no stylesheet
      // for it — a CSS module here becomes a near-empty per-route asset the document must link.
      return VIRTUAL_CSS_PREFIX + absolutePath;
    },

    load(id: string) {
      // Dev serves the rules collected so far and pushes the rest over Vite's CSS HMR;
      // a build gets a placeholder that generateBundle fills in.
      if (id === RESOLVED_VIRTUAL_STYLESHEET_ID) {
        return isBuild ? STYLESHEET_PLACEHOLDER : session.collectCss(annotate);
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
        const arbitraryRules = splitArbitraryCss(session.getArbitraryCss(sourcePath));
        // Raw blocks name keyframes too, so this module carries the ones it animates.
        const atRules: ParsedTrussCss = {
          rules: [],
          properties: [],
          keyframes: [],
          arbitraryCssBlocks: arbitraryRules.map((cssText) => ({ cssText })),
        };
        applyReferencedKeyframes(atRules, session.ensureMapping());
        const payload = {
          arbitraryRules,
          ...(atRules.keyframes.length > 0 ? { keyframes: atRules.keyframes } : {}),
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

      const sourcePath = id.slice(VIRTUAL_CSS_PREFIX.length);
      const sourceCode = readFileSync(sourcePath, "utf8");

      // Populate the arbitrary CSS registry on first load; subsequent updates
      // happen in the transform hook when Vite re-transforms the changed file.
      session.updateArbitraryCssRegistry(sourcePath, sourceCode, diagnostics(this));

      // Return an empty module — the real CSS is served via collectCss(), either through
      // the app's own `virtual:truss.css` import or, without one, the dev endpoint and the
      // emitted truss-<hash>.css. So we avoid duplicating it in Vite's own CSS bundle.
      return `/* [truss] ${sourcePath} — included via truss.css */\nexport {};`;
    },

    transform(code: string, id: string) {
      // The virtual modules already contain compiled CSS or an empty body, not source TypeScript.
      if (id.startsWith(VIRTUAL_TEST_CSS_PREFIX) || id.startsWith(VIRTUAL_CSS_PREFIX)) return null;
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

    // Post, so Vite's own CSS assets are in the bundle and can be patched.
    generateBundle: {
      order: "post",
      handler(_options: any, bundle: any) {
        if (!isBuild) return;
        const css = session.collectCss(annotate);
        if (!css) return;

        // A library has no entry module of its own to import the stylesheet, so it keeps
        // writing a standalone file for the consuming app to merge through `libraries`.
        if (isLib) {
          const hash = createHash("sha256").update(css).digest("hex").slice(0, 8);
          (this as any).emitFile({ type: "asset", fileName: `assets/truss-${hash}.css`, source: css });
          return;
        }

        if (!stylesheetImported) {
          (this as any).warn(
            '[truss] No module imported "virtual:truss.css", so this build ships no Truss stylesheet. ' +
              'Add `import "virtual:truss.css";` to your entry module.',
          );
          return;
        }

        // The framework has already bundled, hashed and linked a stylesheet holding the
        // placeholder, so fill that in rather than emit a file nothing links.
        fillStylesheetPlaceholder(bundle, css);
      },
    },
  };

  /**
   * Send new rules to a dev page that imports `virtual:truss.css`.
   *
   * Vite transforms modules on demand, so the load hook answers the stylesheet import with only
   * the rules known at that moment. Reloading the module re-runs load and lets Vite's own CSS
   * HMR replace the stylesheet, the same as editing a `.css` file would.
   *
   * Only the browser's copy is reloaded. Reloading the server copy makes Vite reload the whole
   * page, which a style change does not need.
   */
  function reloadVirtualStylesheet(): void {
    const client = devServer?.environments?.client ?? devServer;
    const module = client?.moduleGraph?.getModuleById?.(RESOLVED_VIRTUAL_STYLESHEET_ID);
    if (!module) return;
    Promise.resolve(client.reloadModule(module)).catch(() => {});
  }

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

/**
 * Put the collected stylesheet into whichever bundled CSS asset holds the `virtual:truss.css`
 * placeholder rule.
 *
 * I.e. React Router bundles `import "virtual:truss.css"` into `assets/root-B1c2d3.css`, whose
 * source starts as `.__truss_placeholder__ { --truss-placeholder: 0; }`; this replaces that rule
 * with every rule the transforms produced, so the document's existing `<link>` carries them.
 * The placeholder is matched as a whole rule, so a CSS minifier that reformats it still matches.
 */
function fillStylesheetPlaceholder(bundle: Record<string, any>, css: string): void {
  for (const item of Object.values(bundle)) {
    if (item.type !== "asset" || !item.fileName.endsWith(".css")) continue;
    const source = String(item.source);
    if (!STYLESHEET_PLACEHOLDER_RE.test(source)) continue;
    item.source = source.replace(STYLESHEET_PLACEHOLDER_RE, css);
    rehashStylesheet(bundle, item);
  }
}

/**
 * Rename a filled stylesheet so its name hashes the rules it holds.
 *
 * The framework hashes the asset while it still holds only the placeholder, so every build would
 * otherwise reuse one filename and browsers would keep serving the rules they cached from an
 * earlier deploy. I.e. `assets/root-DrDJUF32.css` becomes `assets/root-9f1c2ab3.css`, and every
 * manifest, HTML file and chunk in this bundle that names the old file is rewritten. A name with
 * no hash in it is left alone.
 */
function rehashStylesheet(bundle: Record<string, any>, item: any): void {
  const hashed = /^(.*-)[A-Za-z0-9_-]{8}(\.css)$/.exec(item.fileName);
  if (!hashed) return;
  const hash = createHash("sha256").update(String(item.source)).digest("hex").slice(0, 8);
  const oldFileName: string = item.fileName;
  const newFileName = `${hashed[1]}${hash}${hashed[2]}`;
  if (newFileName === oldFileName) return;

  // Rename in place: Rolldown ignores new keys added to the bundle, and writes each entry
  // under its own `fileName`, so the stale key is harmless.
  item.fileName = newFileName;
  for (const other of Object.values(bundle)) {
    if (other === item) continue;
    if (other.type === "chunk") {
      other.code = other.code.split(oldFileName).join(newFileName);
    } else if (typeof other.source === "string") {
      other.source = other.source.split(oldFileName).join(newFileName);
    }
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
