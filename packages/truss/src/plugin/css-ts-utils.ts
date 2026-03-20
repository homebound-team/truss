import * as t from "@babel/types";

/** Resolve module-scope string constants so .css.ts selectors can reuse them. */
export function collectStaticStringBindings(ast: t.File): Map<string, string> {
  const bindings = new Map<string, string>();
  let changed = true;

  while (changed) {
    changed = false;

    for (const node of ast.program.body) {
      const declaration = getTopLevelVariableDeclaration(node);
      if (!declaration) continue;

      for (const declarator of declaration.declarations) {
        if (!t.isIdentifier(declarator.id) || !declarator.init) continue;
        if (bindings.has(declarator.id.name)) continue;

        const value = resolveStaticString(declarator.init, bindings);
        if (value === null) continue;

        bindings.set(declarator.id.name, value);
        changed = true;
      }
    }
  }

  return bindings;
}

/** Resolve a static string expression from a literal, template, or identifier. */
export function resolveStaticString(node: t.Node | null | undefined, bindings: Map<string, string>): string | null {
  if (!node) return null;

  if (t.isStringLiteral(node)) return node.value;

  if (t.isTemplateLiteral(node)) {
    let value = "";
    for (let i = 0; i < node.quasis.length; i++) {
      value += node.quasis[i].value.cooked ?? "";
      if (i >= node.expressions.length) continue;

      const expressionValue = resolveStaticString(node.expressions[i], bindings);
      if (expressionValue === null) return null;
      value += expressionValue;
    }
    return value;
  }

  if (t.isIdentifier(node)) {
    return bindings.get(node.name) ?? null;
  }

  if (t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node) || t.isTSNonNullExpression(node)) {
    return resolveStaticString(node.expression, bindings);
  }

  if (t.isParenthesizedExpression(node)) {
    return resolveStaticString(node.expression, bindings);
  }

  if (t.isBinaryExpression(node, { operator: "+" })) {
    const left = resolveStaticString(node.left, bindings);
    const right = resolveStaticString(node.right, bindings);
    if (left === null || right === null) return null;
    return left + right;
  }

  return null;
}

function getTopLevelVariableDeclaration(node: t.Statement): t.VariableDeclaration | null {
  if (t.isVariableDeclaration(node)) {
    return node;
  }

  if (t.isExportNamedDeclaration(node) && node.declaration && t.isVariableDeclaration(node.declaration)) {
    return node.declaration;
  }

  return null;
}
