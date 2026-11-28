import { resolve } from "path";
import { applyReferencedKeyframes, applyRegisteredProperties } from "./at-rule-refs";
import { generateCssData, type AtomicRule } from "./emit-css";
import { transformTruss, type TransformResult, type TransformTrussOptions } from "./transform";
import { mergeTrussCssData, readTrussCss } from "./merge-css";
import type { ParsedTrussCss } from "../truss-css-types";
import { serializeTrussCss } from "./truss-css";
import { createTestCssPayload } from "./test-css";
import type { TestCssPayload } from "../test-css-types";
import { loadMapping } from "./mapping-utils";
import type { TrussMapping } from "./types";
import { rootSpacingPreludeCss } from "../spacing-css-var";
import { compareClassNames } from "../css-order";

export interface TrussTransformSessionOptions {
  mappingPath: () => string;
  projectRoot: () => string;
  libraries?: string[];
  onCssChanged?: () => void;
}

/** Shared transform state for plugin adapters that collect Truss CSS. */
export function createTrussTransformSession(options: TrussTransformSessionOptions): TrussTransformSession {
  let mapping: TrussMapping | null = null;
  let libraryCache: ParsedTrussCss[] | null = null;
  const cssRegistry = new Map<string, AtomicRule>();
  /** Complete selector-based CSS from each reached .css.ts file, keyed by its absolute source path. */
  const arbitraryCssRegistry = new Map<string, string>();
  const libraryPaths = options.libraries ?? [];
  // React Router builds the client and server with the same plugin. Keep the latest source
  // and result for each file and combination of output options (the "transform mode"):
  // debug metadata (debug), test CSS injection and bootstrap (injectCss), and source maps (sourceMaps).
  // I.e. a production transform without debug metadata or CSS injection cannot be reused
  // for a Vitest transform that includes them.
  // Keep these cached results across registry resets, then replay their rules on cache hits.
  const transformCache = new Map<string, { code: string; result: TransformResult | null }>();
  const stylesheetCache = new Map<boolean, string>();

  function ensureMapping(): TrussMapping {
    if (!mapping) {
      mapping = loadMapping(options.mappingPath());
    }
    return mapping;
  }

  function loadLibraries(): ParsedTrussCss[] {
    if (!libraryCache) {
      libraryCache = libraryPaths.map((libPath) => {
        const resolved = resolve(options.projectRoot(), libPath);
        return readTrussCss(resolved);
      });
    }
    return libraryCache;
  }

  function reset(): void {
    cssRegistry.clear();
    arbitraryCssRegistry.clear();
    libraryCache = null;
    stylesheetCache.clear();
  }

  /**
   * Record a .css.ts file's compiled CSS for the combined stylesheet.
   *
   * "Arbitrary CSS" means rules for selectors the author chooses, such as body or .dialog > h2.
   * The registry maps each absolute source path to that file's complete compiled CSS text.
   * I.e. /app/src/reset.css.ts with `export const css = { body: "margin: 0;" }` records:
   * /app/src/reset.css.ts -> "body {\n  margin: 0;\n}"
   * And /app/src/dialog.css.ts with `export const css = { ".dialog > h2": Css.df.$ }` records:
   * /app/src/dialog.css.ts -> ".dialog > h2 {\n  display: flex;\n}"
   *
   * collectCss() merges these blocks with atomic rules and library CSS. An edit replaces the
   * file's previous block (or removes it if empty), so HMR does not retain stale selector rules.
   * Each build starts with an empty registry and adds files as they are reached; a cached
   * transform replays its CSS here without parsing its source again.
   */
  function registerArbitraryCss(sourcePath: string, css: string): void {
    if (css.length > 0) {
      const prev = arbitraryCssRegistry.get(sourcePath);
      arbitraryCssRegistry.set(sourcePath, css);
      if (prev !== css) {
        stylesheetCache.clear();
        options.onCssChanged?.();
      }
      return;
    }

    if (arbitraryCssRegistry.delete(sourcePath)) {
      stylesheetCache.clear();
      options.onCssChanged?.();
    }
  }

  function transformCode(
    code: string,
    fileId: string,
    transformOptions: TransformTrussOptions = {},
  ): TransformResult | null {
    const key = `${fileId}\0${Boolean(transformOptions.debug)}\0${Boolean(transformOptions.injectCss)}\0${transformOptions.sourceMaps ?? true}`;
    const cached = transformCache.get(key);
    const arbitrarySourcePath = fileId.endsWith(".css.ts") ? resolve(fileId).replace(/\\/g, "/") : undefined;
    let result: TransformResult | null;
    if (cached?.code === code) {
      result = cached.result;
    } else {
      let hadDiagnostic = false;
      result = transformTruss(code, fileId, ensureMapping(), {
        ...transformOptions,
        onDiagnostic(error) {
          hadDiagnostic = true;
          transformOptions.onDiagnostic?.(error);
        },
      });
      // Re-run diagnostics each time instead of suppressing warnings on another environment.
      if (!hadDiagnostic) transformCache.set(key, { code, result });
    }
    if (!result) return null;
    if (arbitrarySourcePath && result.arbitraryCss !== undefined) {
      registerArbitraryCss(arbitrarySourcePath, result.arbitraryCss);
    }

    let hasNewRules = false;
    for (const [className, rule] of result.rules) {
      if (!cssRegistry.has(className)) {
        cssRegistry.set(className, rule);
        hasNewRules = true;
      }
    }
    if (hasNewRules) {
      stylesheetCache.clear();
      options.onCssChanged?.();
    }

    return result;
  }

  /** Merge library and application CSS before optionally omitting build-time annotations. */
  function collectCss(annotate = true): string {
    const cached = stylesheetCache.get(annotate);
    if (cached !== undefined) return cached;
    const mapping = ensureMapping();
    const appCss = generateCssData(cssRegistry);
    const allArbitrary = Array.from(arbitraryCssRegistry.entries())
      .sort((a, b) => compareClassNames(a[0], b[0]))
      .map((entry) => entry[1])
      .join("\n\n");
    if (allArbitrary.length > 0) appCss.arbitraryCssBlocks.push({ cssText: allArbitrary });
    const libs = loadLibraries();
    const merged = libs.length === 0 ? appCss : mergeTrussCssData([...libs, appCss]);
    // After the merge, so a keyframe sees every animation in the stylesheet, libraries included.
    applyReferencedKeyframes(merged, mapping);
    applyRegisteredProperties(merged, mapping);
    const body = serializeTrussCss(merged, annotate);
    const css = body.length === 0 ? "" : `${rootSpacingPreludeCss(mapping.increment)}\n${body}`;
    stylesheetCache.set(annotate, css);
    return css;
  }

  /**
   * Collect only libraries; application modules deliver their own CSS in tests.
   *
   * Registered `@property` blocks ride along here rather than in each module, because registration
   * is stylesheet-wide state that does not prune with any one rule.
   */
  function collectTestCss(): TestCssPayload {
    const css = mergeTrussCssData(loadLibraries());
    applyRegisteredProperties(css, ensureMapping());
    return createTestCssPayload(css);
  }

  return {
    collectCss,
    collectTestCss,
    ensureMapping,
    reset,
    transformCode,
  };
}

export interface TrussTransformSession {
  collectCss: (annotate?: boolean) => string;
  collectTestCss: () => TestCssPayload;
  ensureMapping: () => TrussMapping;
  reset: () => void;
  transformCode: (code: string, fileId: string, options?: TransformTrussOptions) => TransformResult | null;
}
