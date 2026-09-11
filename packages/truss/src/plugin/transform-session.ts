import { resolve } from "path";
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
  }

  function updateArbitraryCssRegistry(
    sourcePath: string,
    sourceCode: string,
    diagnostics: DiagnosticOptions = {},
  ): void {
    sourcePath = resolve(sourcePath).replace(/\\/g, "/");
    const css = transformCssTs(sourceCode, sourcePath, ensureMapping(), diagnostics).trim();
    if (css.length > 0) {
      const prev = arbitraryCssRegistry.get(sourcePath);
      arbitraryCssRegistry.set(sourcePath, css);
      if (prev !== css) options.onCssChanged?.();
      return;
    }

    if (arbitraryCssRegistry.delete(sourcePath)) {
      options.onCssChanged?.();
    }
  }

  function transformCode(
    code: string,
    fileId: string,
    transformOptions: TransformTrussOptions = {},
  ): TransformResult | null {
    const result = transformTruss(code, fileId, ensureMapping(), transformOptions);
    if (!result) return null;

    let hasNewRules = false;
    for (const [className, rule] of result.rules) {
      if (!cssRegistry.has(className)) {
        cssRegistry.set(className, rule);
        hasNewRules = true;
      }
    }
    if (hasNewRules) {
      options.onCssChanged?.();
    }

    return result;
  }

  function collectCss(): string {
    const mapping = ensureMapping();
    const appCss = generateCssData(cssRegistry);
    const allArbitrary = Array.from(arbitraryCssRegistry.entries())
      .sort((a, b) => compareClassNames(a[0], b[0]))
      .map((entry) => entry[1])
      .join("\n\n");
    if (allArbitrary.length > 0) appCss.arbitraryCssBlocks.push({ cssText: allArbitrary });
    const libs = loadLibraries();
    const body = serializeTrussCss(libs.length === 0 ? appCss : mergeTrussCssData([...libs, appCss]));
    if (body.length === 0) return "";
    return `${rootSpacingPreludeCss(mapping.increment)}\n${body}`;
  }

  function hasCss(): boolean {
    return cssRegistry.size > 0 || arbitraryCssRegistry.size > 0 || libraryPaths.length > 0;
  }

  /** Collect only libraries; application modules deliver their own CSS in tests. */
  function collectTestCss(): TestCssPayload {
    return createTestCssPayload(mergeTrussCssData(loadLibraries()));
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
  collectCss: () => string;
  collectTestCss: () => TestCssPayload;
  getArbitraryCss: (sourcePath: string) => string;
  ensureMapping: () => TrussMapping;
  hasCss: () => boolean;
  reset: () => void;
  transformCode: (code: string, fileId: string, options?: TransformTrussOptions) => TransformResult | null;
  updateArbitraryCssRegistry: (sourcePath: string, sourceCode: string, options?: DiagnosticOptions) => void;
}
