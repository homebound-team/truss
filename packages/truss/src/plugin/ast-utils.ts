import * as t from "@babel/types";
import type { ChainNode } from "./resolve-chain";

export interface NamedImport {
  importedName: string;
  localName: string;
}

/**
 * Reserve a stable, collision-free identifier.
 *
 * Preference order:
 * 1) preferred
 * 2) secondary (if provided)
 * 3) numbered suffixes based on secondary/preferred
 */
export function reservePreferredName(used: Set<string>, preferred: string, secondary?: string): string {
  if (!used.has(preferred)) {
    used.add(preferred);
    return preferred;
  }

  if (secondary && !used.has(secondary)) {
    used.add(secondary);
    return secondary;
  }

  const base = secondary ?? preferred;
  let i = 1;
  // Numbered fallback keeps generated names deterministic across runs.
  let candidate = `${base}_${i}`;
  while (used.has(candidate)) {
    i++;
    candidate = `${base}_${i}`;
  }
  used.add(candidate);
  return candidate;
}

/** Find the local binding name for `Css` from import declarations. */
export function findCssImportBinding(ast: t.File): string | null {
  return findNamedImportBinding(ast, "Css");
}

/**
 * Find a local binding where `Css` is created via `new CssBuilder(...)`.
 *
 * This handles tsup-bundled libraries where Css is not imported but declared as:
 *   var Css = new CssBuilder({ ... });
 */
export function findCssBuilderBinding(ast: t.File): string | null {
  for (const node of ast.program.body) {
    if (!t.isVariableDeclaration(node)) continue;
    for (const decl of node.declarations) {
      if (
        t.isIdentifier(decl.id) &&
        decl.init &&
        t.isNewExpression(decl.init) &&
        t.isIdentifier(decl.init.callee, { name: "CssBuilder" })
      ) {
        return decl.id.name;
      }
    }
  }
  return null;
}

/** True for a `binding.method(...)` call, i.e. `Css.props(...)` when `binding` is `"Css"` and `method` is `"props"`. */
export function isCssMethodCall(node: t.CallExpression, binding: string, method: string): boolean {
  return (
    t.isMemberExpression(node.callee) &&
    !node.callee.computed &&
    t.isIdentifier(node.callee.object, { name: binding }) &&
    t.isIdentifier(node.callee.property, { name: method })
  );
}

/**
 * Remove the Css import specifier. If it was the only specifier, remove the whole import.
 */
export function removeCssImport(ast: t.File, cssBinding: string): void {
  for (let i = 0; i < ast.program.body.length; i++) {
    const node = ast.program.body[i];
    if (!t.isImportDeclaration(node)) continue;

    const cssSpecIndex = node.specifiers.findIndex((s) => t.isImportSpecifier(s) && s.local.name === cssBinding);
    if (cssSpecIndex === -1) continue;

    if (node.specifiers.length === 1) {
      ast.program.body.splice(i, 1);
    } else {
      node.specifiers.splice(cssSpecIndex, 1);
    }
    return;
  }
}

/** Return the index of the last import declaration in the module. */
export function findLastImportIndex(ast: t.File): number {
  let lastImportIndex = -1;
  for (let i = 0; i < ast.program.body.length; i++) {
    if (t.isImportDeclaration(ast.program.body[i])) {
      lastImportIndex = i;
    }
  }
  return lastImportIndex;
}

/**
 * Insert statements directly after the module's leading block of imports.
 *
 * I.e. before the first non-import statement, so helpers land near the top even when a
 * later import (like the test-mode `import "virtual:truss:test-css"`) trails the module body.
 */
export function insertAfterLeadingImports(ast: t.File, statements: t.Statement[]): void {
  if (statements.length === 0) return;
  const firstNonImport = ast.program.body.findIndex((node) => !t.isImportDeclaration(node));
  ast.program.body.splice(firstNonImport === -1 ? ast.program.body.length : firstNonImport, 0, ...statements);
}

/**
 * Find the local name of a named import, i.e. `mergeProps13` for `import { mergeProps as mergeProps13 }`.
 *
 * When `source` is given, only imports from that module are considered.
 */
export function findNamedImportBinding(ast: t.File, importedName: string, source?: string): string | null {
  for (const node of ast.program.body) {
    if (!t.isImportDeclaration(node)) continue;
    if (source !== undefined && node.source.value !== source) continue;
    for (const spec of node.specifiers) {
      if (t.isImportSpecifier(spec) && t.isIdentifier(spec.imported, { name: importedName })) {
        return spec.local.name;
      }
    }
  }
  return null;
}

/** Find the import declaration for `source`, if the module has one. */
export function findImportDeclaration(ast: t.File, source: string): t.ImportDeclaration | null {
  for (const node of ast.program.body) {
    if (t.isImportDeclaration(node) && node.source.value === source) {
      return node;
    }
  }
  return null;
}

/**
 * Repoint an import that only binds `Css` at `source` with `imports`, so the runtime import
 * lands on the line the Css import occupied. Returns false when no such sole-specifier import exists.
 */
export function replaceCssImportWithNamedImports(
  ast: t.File,
  cssBinding: string,
  source: string,
  imports: NamedImport[],
): boolean {
  for (const node of ast.program.body) {
    if (!t.isImportDeclaration(node)) continue;

    const cssSpecIndex = node.specifiers.findIndex((spec) => {
      return t.isImportSpecifier(spec) && spec.local.name === cssBinding;
    });
    if (cssSpecIndex === -1 || node.specifiers.length !== 1) continue;

    node.source = t.stringLiteral(source);
    node.specifiers = imports.map(toImportSpecifier);
    return true;
  }

  return false;
}

/** Add `imports` to the existing import of `source`, or add a new import after the last one. */
export function upsertNamedImports(ast: t.File, source: string, imports: NamedImport[]): void {
  if (imports.length === 0) return;

  const existing = findImportDeclaration(ast, source);
  if (!existing) {
    const importDecl = t.importDeclaration(imports.map(toImportSpecifier), t.stringLiteral(source));
    ast.program.body.splice(findLastImportIndex(ast) + 1, 0, importDecl);
    return;
  }

  for (const entry of imports) {
    const exists = existing.specifiers.some((spec) => {
      return t.isImportSpecifier(spec) && t.isIdentifier(spec.imported, { name: entry.importedName });
    });
    if (!exists) existing.specifiers.push(toImportSpecifier(entry));
  }
}

/**
 * Extract a `Css` method/property chain from an expression.
 *
 * Example: `Css.if(cond).df.else.db.$` ->
 * `[{type:"if"}, {type:"getter", name:"df"}, {type:"else"}, {type:"getter", name:"db"}]`
 *
 * Returns `null` when the expression is not rooted at the Css import binding,
 * which lets the caller ignore unrelated member expressions cheaply.
 */
export function extractChain(node: t.Expression, cssBinding: string): ChainNode[] | null {
  const chain: ChainNode[] = [];
  let current: t.Expression = node;

  while (true) {
    if (t.isIdentifier(current, { name: cssBinding })) {
      chain.reverse();
      return chain;
    }

    if (t.isMemberExpression(current) && !current.computed && t.isIdentifier(current.property)) {
      const name = current.property.name;
      if (name === "else") {
        chain.push({ type: "else" });
      } else {
        chain.push({ type: "getter", name });
      }
      current = current.object as t.Expression;
      continue;
    }

    if (
      t.isCallExpression(current) &&
      t.isMemberExpression(current.callee) &&
      !current.callee.computed &&
      t.isIdentifier(current.callee.property)
    ) {
      const name = current.callee.property.name;

      if (name === "if") {
        chain.push({
          type: "if",
          conditionNode: current.arguments[0] as t.Expression,
        });
        current = current.callee.object as t.Expression;
        continue;
      }

      chain.push({
        type: "call",
        name,
        args: current.arguments as (t.Expression | t.SpreadElement)[],
      });
      current = current.callee.object as t.Expression;
      continue;
    }

    return null;
  }
}

/**
 * Extract the chain of a complete `Css.*.$` expression.
 *
 * Returns `null` when `node` does not end in `.$` or is not rooted at `cssBinding`.
 */
export function extractDollarChain(node: t.Node, cssBinding: string): ChainNode[] | null {
  if (!t.isMemberExpression(node) || node.computed || !t.isIdentifier(node.property, { name: "$" })) return null;
  if (t.isSuper(node.object)) return null;
  return extractChain(node.object, cssBinding);
}

/** Strip parentheses and TypeScript-only wrappers, i.e. `(x as Foo)!` → `x`. */
export function unwrapExpression(node: t.Expression): t.Expression {
  let current = node;
  while (
    t.isParenthesizedExpression(current) ||
    t.isTSAsExpression(current) ||
    t.isTSTypeAssertion(current) ||
    t.isTSNonNullExpression(current) ||
    t.isTSSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

/** The static name of an object key, i.e. `foo` and `"foo"` → `"foo"`; null for computed or other keys. */
export function staticPropertyName(key: t.Node): string | null {
  if (t.isIdentifier(key)) return key.name;
  if (t.isStringLiteral(key)) return key.value;
  return null;
}

/** The static member name of `obj.foo` or `obj["foo"]` → `"foo"`; null for other member access. */
export function memberPropertyName(node: t.MemberExpression): string | null {
  if (!node.computed && t.isIdentifier(node.property)) return node.property.name;
  if (node.computed && t.isStringLiteral(node.property)) return node.property.value;
  return null;
}

function toImportSpecifier(entry: NamedImport): t.ImportSpecifier {
  return t.importSpecifier(t.identifier(entry.localName), t.identifier(entry.importedName));
}
