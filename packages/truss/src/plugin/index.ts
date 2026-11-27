import { readFileSync, existsSync } from "fs";
import { resolve, dirname, isAbsolute } from "path";
import { createHash } from "crypto";
import { type PluginContext } from "rollup";
import { createTrussTransformSession } from "./transform-session";
import { createArbitraryTestCssPayload, TEST_CSS_BOOTSTRAP_ID } from "./test-css";
import { CSS_TS_QUERY } from "./rewrite-css-ts-imports";
import type { TransformTrussOptions } from "./transform";
import { rootSpacingPreludeCss } from "../spacing-css-var";
import type { DiagnosticOptions, TransformDiagnostic } from "./types";

export interface TrussPluginOptions {
  /** Path to the Css.json mapping file used for transforming files (relative to project root or absolute). */
  mapping: string;
  /** Paths to pre-compiled truss.css files from libraries to merge into the app's CSS. */
  libraries?: string[];
  /** Unsupported patterns fail builds by default; dev transforms warn and keep serving the page. */
  unsupportedPattern?: "error" | "warn";
}

type DiagnosticContext = Pick<PluginContext, "warn">;
/** The load hook also watches the `.css.ts` file behind a virtual module; tests can omit it. */
type LoadContext = DiagnosticContext & Partial<Pick<PluginContext, "addWatchFile">>;

// Use Rollup's context for diagnostics; keep other hooks loose without a Vite compile-time dependency.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface TrussVitePlugin {
  name: string;
  enforce?: "pre" | "post";
  configResolved?: (config: any) => void;
  buildStart?: () => void;
  resolveId?: (source: string, importer: string | undefined) => string | null;
  load?: (this: LoadContext, id: string) => string | null;
  transform?: (this: DiagnosticContext, code: string, id: string) => { code: string; map: any } | null;
  configureServer?: (server: any) => void;
  transformIndexHtml?: ((html: string) => string) | { order?: "pre" | "post"; handler: (html: string) => string };
  handleHotUpdate?: (ctx: any) => void;
  generateBundle?:
    | ((options: any, bundle: any) => void)
    | { order?: "pre" | "post"; handler: (this: PluginContext, options: any, bundle: any) => void };
}

/**
 * Prefix for the virtual module behind a side-effect-only `.css.ts` import, i.e. `import "./App.css.ts"`.
 *
 * It registers (or, in tests, injects) the file's CSS without evaluating the real module, whose
 * `Css.*.$` values would pull in the CssBuilder runtime. Imports with specifiers load the real
 * module, and its own transform handles the CSS.
 *
 * What the virtual module contains depends on how CSS reaches the document:
 *
 * - Dev and build: an empty module, `export {}`. Loading it only records the file's rules in the
 *   session. The document gets them from the app's stylesheet, `virtual:truss.css`, together
 *   with every other Truss rule. I.e. `body { margin: 0 }` from App.css.ts is in truss.css, and
 *   no JavaScript chunk contains it.
 * - Tests (Vitest/jsdom): a module that calls `__injectTrussCSS(payload)`. A test loads modules
 *   directly and never loads `virtual:truss.css`, so each module must add its own rules to the
 *   document when it evaluates. An empty module here would deliver no CSS.
 */
const VIRTUAL_CSS_PREFIX = "\0truss-css:";

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

// Test-only bootstrap that injects merged library CSS and the spacing prelude, see TEST_CSS_BOOTSTRAP_ID.
const RESOLVED_VIRTUAL_TEST_CSS_ID = "\0" + TEST_CSS_BOOTSTRAP_ID;

/**
 * Vite plugin that transforms `Css.*.$` expressions from truss's CssBuilder DSL
 * into Truss-native style hash objects and `trussProps()`/`mergeProps()` runtime calls.
 *
 * Also supports `.css.ts` files: a `.css.ts` file with
 * `export const css = { ".selector": Css.blue.$ }` can keep other runtime exports,
 * and side-effect-only imports of it load a virtual module that carries only its CSS.
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
  let sourceMaps = true;
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

  /**
   * Options for the two places that run session.transformCode: the transform hook and the load hook.
   *
   * The transform hook compiles real modules. The load hook compiles the source behind the virtual
   * module of a side-effect-only `.css.ts` import. The same options give both one cache entry, so a
   * file reached both ways is parsed once. I.e. `import "./App.css.ts"` in main.tsx loads the
   * virtual module, and `import { note } from "./App.css.ts"` in App.tsx loads the real module.
   *
   * "Test mode" (injectCss) means Vite's config.mode === "test", normally set by Vitest when
   * an application uses this plugin in its tests. It is not a check for NODE_ENV or Jest;
   * Jest does not automatically run this Vite plugin.
   */
  function transformOptions(context: DiagnosticContext): TransformTrussOptions {
    return { debug, sourceMaps, rewriteCssImports: true, injectCss: isTest, ...diagnostics(context) };
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
      // Devtools need maps in dev. Production only consumes them when the build enables them.
      sourceMaps = !isBuild || Boolean(config.build?.sourcemap);
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

      if (source === TEST_CSS_BOOTSTRAP_ID || source === "/" + TEST_CSS_BOOTSTRAP_ID) {
        return RESOLVED_VIRTUAL_TEST_CSS_ID;
      }

      // Handle side-effect-only .css.ts imports, which the transform rewrote to add the query
      if (!source.endsWith(CSS_TS_QUERY)) return null;

      const absolutePath = resolveImportPath(source.slice(0, -CSS_TS_QUERY.length), importer, projectRoot);

      // Only handle it if the .css.ts file actually exists
      if (!existsSync(absolutePath)) return null;

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

      // Handle .css.ts virtual modules
      if (!id.startsWith(VIRTUAL_CSS_PREFIX)) return null;

      // This virtual module is a different module from the real `.css.ts` file. I.e. the id is
      // `\0truss-css:/app/src/App.css.ts`, not `/app/src/App.css.ts`. The transform rewrote the
      // side-effect-only import to point here, so Vite never loads the real file for that import.
      // Read the real file from disk and run the same transform the real module gets. That
      // registers its CSS for collectCss(), and reuses the cached result when a named import
      // also loads the real module.
      const sourcePath = canonicalSourcePath(id.slice(VIRTUAL_CSS_PREFIX.length));
      const result = session.transformCode(readFileSync(sourcePath, "utf8"), sourcePath, transformOptions(this));
      // A virtual id names no file, so without this, dev ignores edits to the .css.ts file.
      this.addWatchFile?.(sourcePath);

      // Tests inject the CSS when this module evaluates, without evaluating build-only CssBuilder expressions.
      // Vitest/jsdom never loads `virtual:truss.css`, so this call is the only way the file's rules
      // reach the test document. I.e. for `export const css = { body: Css.m0.$ }` the payload is
      // `{ arbitraryRules: [<the body rule>], source: "/app/src/App.css.ts" }`.
      // The bootstrap import first injects the library CSS and the spacing prelude.
      if (isTest) {
        const payload = createArbitraryTestCssPayload(result?.arbitraryCss ?? "", sourcePath, session.ensureMapping());
        return `
import "${TEST_CSS_BOOTSTRAP_ID}";
import { __injectTrussCSS } from "@homebound/truss/runtime";

__injectTrussCSS(${JSON.stringify(payload)});
`;
      }

      // Return an empty module — the real CSS is served via collectCss(), either through
      // the app's own `virtual:truss.css` import or, without one, the dev endpoint and the
      // emitted truss-<hash>.css. So we avoid duplicating it in Vite's own CSS bundle.
      // The transformCode call above already recorded the rules; this module only has to exist
      // so that the rewritten import resolves.
      return `/* [truss] ${sourcePath} — included via truss.css */\nexport {};`;
    },

    transform(code: string, id: string) {
      // The virtual modules already contain compiled CSS or an empty body, not source TypeScript.
      if (id.startsWith(VIRTUAL_CSS_PREFIX)) return null;
      // Only process JS/TS/JSX/TSX files outside node_modules
      if (!/\.[cm]?[jt]sx?(\?|$)/.test(id)) return null;
      const fileId = stripQueryAndHash(id);
      if (isNodeModulesFile(fileId)) return null;

      // All eligible files use one transformation flow, sharing an AST across these steps:
      // - A file with Truss expressions: compile the expressions.
      // - A file with side-effect-only .css.ts imports: rewrite the imports.
      // - A .css.ts file: extract selector-based CSS while preserving runtime exports.
      // - Test mode: additionally bootstrap library CSS/spacing and inject per-file CSS.
      //   This is an option applied to the relevant files, not a separate parsing pipeline.
      //
      // Test mode includes application components/helpers loaded by tests, not just test files.
      // Test environments load modules directly instead of the app's HTML stylesheet entry.
      // An edited .css.ts re-runs this transform (or the virtual load, for side-effect-only
      // imports), and the session replaces that file's previous CSS.
      const result = session.transformCode(code, fileId, transformOptions(this));
      return result ? { code: result.code, map: result.map } : null;
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

export type { TrussMapping, TrussMappingEntry } from "./types";
export { loadMapping } from "./mapping-utils";
export { trussEsbuildPlugin, type TrussEsbuildPluginOptions } from "./esbuild-plugin";
