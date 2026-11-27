import { resolve } from "path";
import { createHash } from "crypto";
import { type PluginContext } from "rollup";
import { createTrussTransformSession } from "./transform-session";
import { TEST_CSS_BOOTSTRAP_ID } from "./test-css";
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
 * `export const css = { ".selector": Css.blue.$ }` adds its selectors to the stylesheet, and its
 * `css` export compiles to `undefined`, so any import of it loads the real module.
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

    resolveId(source: string) {
      if (source === VIRTUAL_STYLESHEET_ID) {
        stylesheetImported = true;
        return RESOLVED_VIRTUAL_STYLESHEET_ID;
      }

      if (source === TEST_CSS_BOOTSTRAP_ID || source === "/" + TEST_CSS_BOOTSTRAP_ID) {
        return RESOLVED_VIRTUAL_TEST_CSS_ID;
      }

      return null;
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

      return null;
    },

    transform(code: string, id: string) {
      // Only process JS/TS/JSX/TSX files outside node_modules
      if (!/\.[cm]?[jt]sx?(\?|$)/.test(id)) return null;
      const fileId = stripQueryAndHash(id);
      if (isNodeModulesFile(fileId)) return null;

      // All eligible files use one transformation flow, sharing an AST across these steps:
      // - A file with Truss expressions: compile the expressions.
      // - A .css.ts file: extract selector-based CSS and replace its `css` export with `undefined`,
      //   while preserving its other runtime exports.
      // - Test mode: additionally bootstrap library CSS/spacing and inject per-file CSS.
      //   This is an option applied to the relevant files, not a separate parsing pipeline.
      //
      // "Test mode" here means Vite's config.mode === "test", normally set by Vitest when
      // an application uses this plugin in its tests. It is not a check for NODE_ENV or Jest;
      // Jest does not automatically run this Vite plugin.
      // It includes application components/helpers loaded by tests, not just test files.
      // Test environments load modules directly instead of the app's HTML stylesheet entry.
      // An edited .css.ts re-runs this transform, and the session replaces that file's previous CSS.
      const result = session.transformCode(code, fileId, {
        debug,
        sourceMaps,
        injectCss: isTest,
        ...diagnostics(this),
      });
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

export type { TrussMapping, TrussMappingEntry } from "./types";
export { loadMapping } from "./mapping-utils";
export { trussEsbuildPlugin, type TrussEsbuildPluginOptions } from "./esbuild-plugin";
