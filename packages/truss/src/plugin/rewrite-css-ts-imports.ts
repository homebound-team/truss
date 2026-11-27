import { existsSync } from "fs";
import { dirname, resolve } from "path";
import * as t from "@babel/types";

/** Query that marks an import of a `.css.ts` file's compiled CSS instead of its runtime module. */
export const CSS_TS_QUERY = "?truss-css";

export interface RewriteCssTsImportsResult {
  changed: boolean;
  /**
   * Absolute .css.ts paths checked for bare .css side-effect imports, mapped to whether each file existed.
   *
   * I.e. `import "./theme.css"` from /app/src/Page.ts records /app/src/theme.css.ts -> true
   * if the companion exists, or -> false if it does not. Both outcomes are cache dependencies:
   * creating or deleting the companion must invalidate the importer's cached transform.
   */
  dependencies: ReadonlyMap<string, boolean>;
}

/**
 * Point side-effect-only `.css.ts` imports at the file's compiled CSS instead of its runtime module.
 *
 * I.e. `import "./App.css.ts"` becomes `import "./App.css.ts?truss-css"`, which the Vite plugin
 * loads as a module that only registers (or, in tests, injects) the file's CSS.
 *
 * Imports with specifiers are left alone: they load the real module, and its own transform
 * registers the CSS. A side-effect-only import cannot do that, because the real module would
 * then evaluate its `Css.*.$` values at runtime. That pulls the CssBuilder into production
 * bundles, and build-only helpers such as `Css.setVar(...)` throw when they evaluate.
 *
 * Bare `.css` side-effect imports (i.e. `import "./App.css"`) are handled when a corresponding
 * `.css.ts` file exists on disk; the specifier is normalized to `.css.ts` so the resolveId/load
 * pipeline can find the source file. Vite already resolves bare `.css` imports with specifiers
 * to the `.css.ts` file through its normal extension lookup.
 *
 * Mutates the caller's AST so expression compilation keeps the original source locations
 * without an intermediate print/parse cycle.
 */
export function rewriteCssTsImports(ast: t.File, filename: string): RewriteCssTsImportsResult {
  const importerDir = dirname(filename);
  const dependencies = new Map<string, boolean>();
  let changed = false;

  for (const node of ast.program.body) {
    if (!t.isImportDeclaration(node) || node.specifiers.length > 0) continue;
    if (!isCssTsImport(node.source.value, importerDir, dependencies)) continue;
    node.source = t.stringLiteral(toVirtualCssSpecifier(node.source.value));
    changed = true;
  }

  return { changed, dependencies };
}

/** Check if this import targets a `.css.ts` file (explicitly or via a bare `.css` with a `.css.ts` on disk). */
function isCssTsImport(specifier: string, importerDir: string, dependencies: Map<string, boolean>): boolean {
  if (specifier.endsWith(".css.ts")) return true;
  // I.e. `import "./App.css"` or `import "src/App.css"` — only rewrite if a `.css.ts` file exists
  if (specifier.endsWith(".css")) {
    const path = resolve(importerDir, `${specifier}.ts`);
    const exists = existsSync(path);
    dependencies.set(path, exists);
    return exists;
  }
  return false;
}

/** Normalize to `.css.ts` so resolveId can find the source file on disk. */
function toVirtualCssSpecifier(source: string): string {
  const normalized = source.endsWith(".css.ts") ? source : `${source}.ts`;
  return `${normalized}${CSS_TS_QUERY}`;
}
