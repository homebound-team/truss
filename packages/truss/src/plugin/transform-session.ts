import { resolve } from "path";
import { existsSync } from "fs";
import { applyReferencedKeyframes, applyRegisteredProperties } from "./at-rule-refs";
import { generateCssData, type AtomicRule } from "./emit-css";
import { transformCssTs } from "./transform-css";
import { transformTruss, type TransformResult, type TransformTrussOptions } from "./transform";
import { mergeTrussCssData, readTrussCss } from "./merge-css";
import type { ParsedTrussCss } from "../truss-css";
import { serializeTrussCss } from "./truss-css";
import { createTestCssPayload } from "./test-css";
import type { TestCssPayload } from "../test-css";
import { loadMapping } from "./mapping-utils";
import { type DiagnosticOptions, type TrussMapping } from "./types";
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
  const arbitraryCssRegistry = new Map<string, string>();
  const libraryPaths = options.libraries ?? [];
  // React Router builds the client and server with the same plugin. Keep the latest
  // source per transform mode across registry resets, then replay rules on cache hits.
  const transformCache = new Map<string, { code: string; result: TransformResult | null }>();
  const arbitraryCache = new Map<string, { code: string; css: string }>();
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

  function updateArbitraryCssRegistry(
    sourcePath: string,
    sourceCode: string,
    diagnostics: DiagnosticOptions = {},
  ): void {
    sourcePath = resolve(sourcePath).replace(/\\/g, "/");
    const cached = arbitraryCache.get(sourcePath);
    let css: string;
    if (cached?.code === sourceCode) {
      css = cached.css;
    } else {
      let hadDiagnostic = false;
      css = transformCssTs(sourceCode, sourcePath, ensureMapping(), {
        onDiagnostic(error) {
          hadDiagnostic = true;
          diagnostics.onDiagnostic?.(error);
        },
      }).trim();
      if (!hadDiagnostic) arbitraryCache.set(sourcePath, { code: sourceCode, css });
    }
    registerArbitraryCss(sourcePath, css);
  }

  /** Replay extracted CSS into the current build's registry without parsing its source again. */
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
    const key = `${fileId}\0${Boolean(transformOptions.debug)}\0${Boolean(transformOptions.injectCss)}\0${Boolean(transformOptions.rewriteCssImports)}\0${transformOptions.bootstrapImport ?? ""}`;
    const cached = transformCache.get(key);
    const arbitrarySourcePath = fileId.endsWith(".css.ts") ? resolve(fileId).replace(/\\/g, "/") : undefined;
    let result: TransformResult | null;
    if (cached?.code === code && importDependenciesUnchanged(cached.result)) {
      result = cached.result;
    } else {
      let hadDiagnostic = false;
      const cachedArbitrary = arbitrarySourcePath ? arbitraryCache.get(arbitrarySourcePath) : undefined;
      result = transformTruss(code, fileId, ensureMapping(), {
        ...transformOptions,
        // A virtual load may already have extracted this file's CSS. The module transform
        // still needs its AST for imports/injection, but can reuse the compiled stylesheet.
        cachedArbitraryCss: cachedArbitrary?.code === code ? cachedArbitrary.css : undefined,
        onDiagnostic(error) {
          hadDiagnostic = true;
          transformOptions.onDiagnostic?.(error);
        },
      });
      // Re-run diagnostics each time instead of suppressing warnings on another environment.
      // A null result has no dependency metadata; a newly created .css.ts could make an
      // unchanged bare .css import start needing a rewrite on the next request.
      if (!hadDiagnostic && (result || !transformOptions.rewriteCssImports)) transformCache.set(key, { code, result });
      if (!hadDiagnostic && arbitrarySourcePath && result?.arbitraryCss !== undefined) {
        arbitraryCache.set(arbitrarySourcePath, { code, css: result.arbitraryCss });
      }
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

  function hasCss(): boolean {
    return cssRegistry.size > 0 || arbitraryCssRegistry.size > 0 || libraryPaths.length > 0;
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

  /** Read the transformed arbitrary CSS for one canonical source file. */
  function getArbitraryCss(sourcePath: string): string {
    return arbitraryCssRegistry.get(resolve(sourcePath).replace(/\\/g, "/")) ?? "";
  }

  return {
    collectCss,
    collectTestCss,
    getArbitraryCss,
    ensureMapping,
    hasCss,
    reset,
    transformCode,
    updateArbitraryCssRegistry,
  };
}

export interface TrussTransformSession {
  collectCss: (annotate?: boolean) => string;
  collectTestCss: () => TestCssPayload;
  getArbitraryCss: (sourcePath: string) => string;
  ensureMapping: () => TrussMapping;
  hasCss: () => boolean;
  reset: () => void;
  transformCode: (code: string, fileId: string, options?: TransformTrussOptions) => TransformResult | null;
  updateArbitraryCssRegistry: (sourcePath: string, sourceCode: string, options?: DiagnosticOptions) => void;
}

/** Invalidate import rewrites when a bare .css target gains or loses its .css.ts companion. */
function importDependenciesUnchanged(result: TransformResult | null): boolean {
  for (const [path, existed] of result?.cssImportDependencies ?? []) {
    if (existsSync(path) !== existed) return false;
  }
  return true;
}
