import { existsSync } from "fs";
import { dirname, resolve } from "path";
import { parse } from "@babel/parser";
import _generate from "@babel/generator";
import * as t from "@babel/types";
import { findLastImportIndex } from "./ast-utils";

// Babel generator is published as CJS, so normalize default interop before using it.
const generate = ((_generate as unknown as { default?: typeof _generate }).default ?? _generate) as typeof _generate;

export interface RewriteCssTsImportsResult {
  code: string;
  changed: boolean;
}

/**
 * Rewrite `.css.ts` (and bare `.css`) imports so runtime imports stay pointed at the
 * real module, while a separate `?truss-css` side-effect import is added for generated CSS.
 *
 * I.e. `import { foo } from "./App.css.ts"` becomes:
 * - `import { foo } from "./App.css.ts"`
 * - `import "./App.css.ts?truss-css"`
 *
 * Bare `.css` imports (i.e. `from "./App.css"`) are handled when a corresponding `.css.ts`
 * file exists on disk — the specifier is normalized to `.css.ts` for the virtual CSS
 * side-effect import so the resolveId/load pipeline can find the source file.
 *
 * Pure side-effect imports are rewritten directly to the virtual CSS import.
 */
export function rewriteCssTsImports(code: string, filename: string): RewriteCssTsImportsResult {
  if (!code.includes(".css")) {
    return { code, changed: false };
  }

  const importerDir = dirname(filename);

  const ast = parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
    sourceFilename: filename,
  });

  const existingCssSideEffects = new Set<string>();
  const neededCssSideEffects = new Set<string>();
  let changed = false;

  for (const node of ast.program.body) {
    if (!t.isImportDeclaration(node)) continue;
    if (typeof node.source.value !== "string") continue;
    if (!isCssTsImport(node.source.value, importerDir)) continue;

    if (node.specifiers.length === 0) {
      node.source = t.stringLiteral(toVirtualCssSpecifier(node.source.value));
      existingCssSideEffects.add(node.source.value);
      changed = true;
      continue;
    }

    neededCssSideEffects.add(toVirtualCssSpecifier(node.source.value));
  }

  const sideEffectImports: t.ImportDeclaration[] = [];
  for (const source of neededCssSideEffects) {
    if (existingCssSideEffects.has(source)) continue;
    sideEffectImports.push(t.importDeclaration([], t.stringLiteral(source)));
    changed = true;
  }

  if (!changed) {
    return { code, changed: false };
  }

  if (sideEffectImports.length > 0) {
    const insertIndex = findLastImportIndex(ast) + 1;
    ast.program.body.splice(insertIndex, 0, ...sideEffectImports);
  }

  const output = generate(ast, {
    sourceFileName: filename,
    retainLines: false,
  });
  return { code: output.code, changed: true };
}

/** Check if this import targets a `.css.ts` file (explicitly or via a bare `.css` with a `.css.ts` on disk). */
function isCssTsImport(specifier: string, importerDir: string): boolean {
  if (specifier.endsWith(".css.ts")) return true;
  // I.e. `from "./App.css"` or `from "src/App.css"` — only rewrite if a `.css.ts` file exists
  if (specifier.endsWith(".css")) {
    return existsSync(resolve(importerDir, `${specifier}.ts`));
  }
  return false;
}

/** Normalize to `.css.ts` so resolveId can find the source file on disk. */
function toVirtualCssSpecifier(source: string): string {
  const normalized = source.endsWith(".css.ts") ? source : `${source}.ts`;
  return `${normalized}?truss-css`;
}
