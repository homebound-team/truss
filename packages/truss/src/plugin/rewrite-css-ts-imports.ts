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
 * Rewrite `.css.ts` imports so runtime imports stay pointed at the real module,
 * while a separate `?truss-css` side-effect import is added for generated CSS.
 *
 * I.e. `import { foo } from "./App.css.ts"` becomes:
 * - `import { foo } from "./App.css.ts"`
 * - `import "./App.css.ts?truss-css"`
 *
 * Pure side-effect imports are rewritten directly to the virtual CSS import.
 */
export function rewriteCssTsImports(code: string, filename: string): RewriteCssTsImportsResult {
  if (!code.includes(".css.ts")) {
    return { code, changed: false };
  }

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
    if (!node.source.value.endsWith(".css.ts")) continue;

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

function toVirtualCssSpecifier(source: string): string {
  return `${source}?truss-css`;
}
