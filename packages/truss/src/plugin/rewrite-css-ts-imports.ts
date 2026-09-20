import { existsSync } from "fs";
import { dirname, resolve } from "path";
import * as t from "@babel/types";
import { findLastImportIndex } from "./ast-utils";
import { generate, parseModule } from "./babel-utils";

export interface RewriteCssTsImportsResult {
  code: string;
  changed: boolean;
  dependencies?: ReadonlyMap<string, boolean>;
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
export function rewriteCssTsImports(code: string, filename: string, sharedAst?: t.File): RewriteCssTsImportsResult {
  if (!code.includes(".css")) {
    return { code, changed: false };
  }

  const importerDir = dirname(filename);

  const ast = sharedAst ?? parseModule(code, filename);

  const existingCssSideEffects = new Set<string>();
  const neededCssSideEffects = new Set<string>();
  const dependencies = new Map<string, boolean>();
  let changed = false;

  for (const node of ast.program.body) {
    if (!t.isImportDeclaration(node)) continue;
    if (typeof node.source.value !== "string") continue;
    if (!isCssTsImport(node.source.value, importerDir, dependencies)) continue;

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
    return { code, changed: false, dependencies };
  }

  if (sideEffectImports.length > 0) {
    const insertIndex = findLastImportIndex(ast) + 1;
    ast.program.body.splice(insertIndex, 0, ...sideEffectImports);
  }

  // The caller will emit this AST after compiling Css expressions, so avoid an intermediate
  // print/parse cycle (and keep source locations tied to the original module).
  if (sharedAst) return { code, changed: true, dependencies };

  const output = generate(ast, {
    sourceFileName: filename,
    retainLines: false,
  });
  return { code: output.code, changed: true, dependencies };
}

/** Check if this import targets a `.css.ts` file (explicitly or via a bare `.css` with a `.css.ts` on disk). */
function isCssTsImport(specifier: string, importerDir: string, dependencies: Map<string, boolean>): boolean {
  if (specifier.endsWith(".css.ts")) return true;
  // I.e. `from "./App.css"` or `from "src/App.css"` — only rewrite if a `.css.ts` file exists
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
  return `${normalized}?truss-css`;
}
