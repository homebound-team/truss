import * as t from "@babel/types";
import type { ChainNode } from "./resolve-chain";

/**
 * Collect module-scope bindings so generated declarations can avoid collisions.
 *
 * We only care about top-level names because the transform injects declarations
 * at the module root, not inside nested blocks.
 */
export function collectTopLevelBindings(ast: t.File): Set<string> {
  const used = new Set<string>();

  for (const node of ast.program.body) {
    if (t.isImportDeclaration(node)) {
      for (const spec of node.specifiers) {
        used.add(spec.local.name);
      }
      continue;
    }

    if (t.isVariableDeclaration(node)) {
      for (const decl of node.declarations) {
        collectPatternBindings(decl.id, used);
      }
      continue;
    }

    if (t.isFunctionDeclaration(node) && node.id) {
      used.add(node.id.name);
      continue;
    }

    if (t.isClassDeclaration(node) && node.id) {
      used.add(node.id.name);
      continue;
    }

    if (t.isExportNamedDeclaration(node) && node.declaration) {
      const decl = node.declaration;
      if (t.isVariableDeclaration(decl)) {
        for (const varDecl of decl.declarations) {
          collectPatternBindings(varDecl.id, used);
        }
      } else if ((t.isFunctionDeclaration(decl) || t.isClassDeclaration(decl)) && decl.id) {
        used.add(decl.id.name);
      }
      continue;
    }

    if (t.isExportDefaultDeclaration(node)) {
      const decl = node.declaration;
      if ((t.isFunctionDeclaration(decl) || t.isClassDeclaration(decl)) && decl.id) {
        used.add(decl.id.name);
      }
    }
  }

  return used;
}

/**
 * Recursively collect names introduced by binding patterns.
 *
 * This handles destructuring (`const { a } = ...`, `const [x] = ...`) so we do
 * not accidentally generate a helper that shadows an existing binding.
 */
function collectPatternBindings(pattern: t.LVal | t.VoidPattern, used: Set<string>): void {
  if (t.isVoidPattern(pattern)) {
    return;
  }

  if (t.isIdentifier(pattern)) {
    used.add(pattern.name);
    return;
  }

  if (t.isAssignmentPattern(pattern)) {
    collectPatternBindings(pattern.left, used);
    return;
  }

  if (t.isRestElement(pattern)) {
    collectPatternBindings(pattern.argument as t.LVal, used);
    return;
  }

  if (t.isObjectPattern(pattern)) {
    for (const prop of pattern.properties) {
      if (t.isObjectProperty(prop)) {
        collectPatternBindings(prop.value as t.LVal, used);
      } else if (t.isRestElement(prop)) {
        collectPatternBindings(prop.argument as t.LVal, used);
      }
    }
    return;
  }

  if (t.isArrayPattern(pattern)) {
    for (const el of pattern.elements) {
      if (!el) continue;
      if (t.isIdentifier(el) || t.isAssignmentPattern(el) || t.isObjectPattern(el) || t.isArrayPattern(el)) {
        collectPatternBindings(el, used);
      } else if (t.isRestElement(el)) {
        collectPatternBindings(el.argument as t.LVal, used);
      }
    }
  }
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

/**
 * Find the local binding name for `Css` from import declarations.
 */
export function findCssImportBinding(ast: t.File): string | null {
  for (const node of ast.program.body) {
    if (!t.isImportDeclaration(node)) continue;
    for (const spec of node.specifiers) {
      if (t.isImportSpecifier(spec) && t.isIdentifier(spec.imported, { name: "Css" })) {
        return spec.local.name;
      }
    }
  }
  return null;
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

/**
 * Find an existing namespace import for `@stylexjs/stylex`, if present.
 *
 * Reusing an existing namespace avoids duplicate imports and ensures generated
 * calls use the same local alias as handwritten code (e.g. `sx`).
 */
export function findStylexNamespaceImport(ast: t.File): string | null {
  for (const node of ast.program.body) {
    if (!t.isImportDeclaration(node)) continue;
    if (node.source.value !== "@stylexjs/stylex") continue;

    for (const spec of node.specifiers) {
      if (t.isImportNamespaceSpecifier(spec)) {
        return spec.local.name;
      }
    }
  }
  return null;
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
 * Insert `import * as <localName> from "@stylexjs/stylex"` after existing imports.
 */
export function insertStylexNamespaceImport(ast: t.File, localName: string): void {
  const stylexImport = t.importDeclaration(
    [t.importNamespaceSpecifier(t.identifier(localName))],
    t.stringLiteral("@stylexjs/stylex"),
  );
  const idx = findLastImportIndex(ast);
  ast.program.body.splice(idx + 1, 0, stylexImport);
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
