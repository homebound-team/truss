import { resolve } from "path";
import { generateCssText, type AtomicRule } from "./emit-truss";
import { transformCssTs } from "./transform-css";
import { transformTruss, type TransformResult, type TransformTrussOptions } from "./transform";
import { annotateArbitraryCssBlock, mergeTrussCss, parseTrussCss, readTrussCss, type ParsedTrussCss } from "./merge-css";
import { loadMapping } from "./mapping-utils";
import type { TrussMapping } from "./types";

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

  function updateArbitraryCssRegistry(sourcePath: string, sourceCode: string): void {
    const css = transformCssTs(sourceCode, sourcePath, ensureMapping()).trim();
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

  function transformCode(code: string, fileId: string, transformOptions: TransformTrussOptions = {}): TransformResult | null {
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
    const appCssParts = [generateCssText(cssRegistry)];
    const allArbitrary = Array.from(arbitraryCssRegistry.values()).join("\n\n");
    appCssParts.push(annotateArbitraryCssBlock(allArbitrary));
    const appCss = appCssParts.filter((part) => part.length > 0).join("\n");
    const libs = loadLibraries();
    if (libs.length === 0) return appCss;
    return mergeTrussCss([...libs, parseTrussCss(appCss)]);
  }

  function hasCss(): boolean {
    return cssRegistry.size > 0 || arbitraryCssRegistry.size > 0 || libraryPaths.length > 0;
  }

  return {
    collectCss,
    ensureMapping,
    hasCss,
    reset,
    transformCode,
    updateArbitraryCssRegistry,
  };
}

export interface TrussTransformSession {
  collectCss: () => string;
  ensureMapping: () => TrussMapping;
  hasCss: () => boolean;
  reset: () => void;
  transformCode: (code: string, fileId: string, options?: TransformTrussOptions) => TransformResult | null;
  updateArbitraryCssRegistry: (sourcePath: string, sourceCode: string) => void;
}
