import * as t from "@babel/types";
import type { TrussMapping } from "./types";
import { memberPropertyName, staticPropertyName, unwrapExpression } from "./ast-utils";
import { type CallChainNode, UnsupportedPatternError } from "./chain-nodes";
import { isCustomPropertyName, maybeCssVar } from "../css-custom-property";
import { incrementCssValue } from "../spacing-css-var";

// ── Literal evaluation ────────────────────────────────────────────────

/**
 * Try to evaluate a literal AST node to a CSS property value.
 * For incremented entries, also evaluates `maybeInc(literal)` (web: calc on `--t-spacing`).
 * Custom property names (`--token` / `Tokens.X`) are wrapped as `var(--token)`.
 */
export function tryEvaluatePropertyLiteral(
  node: t.Expression,
  mapping: TrussMapping,
  incremented: boolean,
): string | null {
  const numeric = tryNumericLiteral(node);
  if (numeric !== null) {
    return incremented ? incrementCssValue(numeric) : String(numeric);
  }
  const raw = tryResolveValueLiteral(node, mapping);
  return raw === null ? null : maybeCssVar(raw);
}

/** True when the argument names a CSS custom property, i.e. `"--token"` or `Tokens.x`. */
export function isCustomPropertyLiteral(node: t.Expression, mapping: TrussMapping): boolean {
  const raw = tryResolveValueLiteral(node, mapping);
  return raw !== null && isCustomPropertyName(raw);
}

/** Resolve a literal value without wrapping (for setVar values, etc.). */
export function tryResolveValueLiteral(node: t.Expression, mapping?: TrussMapping): string | null {
  if (mapping) {
    const token = tryResolveTokensMember(node, mapping);
    if (token !== null) return token;
  }
  if (t.isStringLiteral(node)) {
    return node.value;
  }
  const numeric = tryNumericLiteral(node);
  return numeric === null ? null : String(numeric);
}

/** I.e. `12` → 12 and `-12` → -12; null for anything but a (negated) numeric literal. */
export function tryNumericLiteral(node: t.Expression): number | null {
  if (t.isNumericLiteral(node)) {
    return node.value;
  }
  if (t.isUnaryExpression(node, { operator: "-" }) && t.isNumericLiteral(node.argument)) {
    return -node.argument.value;
  }
  return null;
}

/** Resolve `Tokens.Member` / `Tokens["Member"]` to a `--` custom property name. */
function tryResolveTokensMember(node: t.Expression, mapping: TrussMapping): string | null {
  if (!t.isMemberExpression(node) || !t.isIdentifier(node.object, { name: "Tokens" })) return null;
  const memberName = memberPropertyName(node);
  if (memberName === null) return null;

  const tokenMap = mapping.tokens;
  if (!tokenMap) {
    throw new UnsupportedPatternError(`Tokens.* requires config.tokens`);
  }
  if (!(memberName in tokenMap)) {
    throw new UnsupportedPatternError(`Unknown token "${memberName}" - add it to config.tokens`);
  }
  return tokenMap[memberName];
}

// ── Argument and object-literal validation ────────────────────────────

/** The single argument of `label()`, rejecting missing, extra, and spread arguments. */
export function singleArg(node: CallChainNode, label: string): t.Expression {
  if (node.args.length !== 1) {
    throw new UnsupportedPatternError(`${label}() expects exactly 1 argument, got ${node.args.length}`);
  }
  const arg = node.args[0];
  if (t.isSpreadElement(arg)) {
    throw new UnsupportedPatternError(`${label}() does not support spread arguments`);
  }
  return arg;
}

/** The `key: value` pairs of an object literal, rejecting spreads, methods, computed keys, and non-static keys. */
export function plainObjectEntries(
  obj: t.ObjectExpression,
  label: string,
): Array<{ key: string; value: t.Expression }> {
  return obj.properties.map((prop) => {
    if (t.isSpreadElement(prop)) {
      throw new UnsupportedPatternError(`${label} does not support spread properties`);
    }
    if (!t.isObjectProperty(prop) || prop.computed) {
      throw new UnsupportedPatternError(`${label} only supports plain object properties`);
    }
    const key = staticPropertyName(prop.key);
    if (key === null) {
      throw new UnsupportedPatternError(`${label} only supports identifier/string keys`);
    }
    return { key, value: prop.value as t.Expression };
  });
}

/** A (negated) numeric literal's value, or throws `errorMessage`. */
export function numericLiteralValue(node: t.Expression, errorMessage: string): number {
  const numeric = tryNumericLiteral(node);
  if (numeric === null) {
    throw new UnsupportedPatternError(errorMessage);
  }
  return numeric;
}

/** A string literal's or expression-free template literal's value, or throws `errorMessage`. */
export function stringLiteralValue(node: t.Expression, errorMessage: string): string {
  if (t.isStringLiteral(node)) {
    return node.value;
  }
  if (t.isTemplateLiteral(node) && node.expressions.length === 0 && node.quasis.length === 1) {
    return node.quasis[0].value.cooked ?? "";
  }
  throw new UnsupportedPatternError(errorMessage);
}

/** A string/number literal value, unwrapping TS/paren wrappers first. */
export function requireValueLiteral(node: t.Expression, errorMessage: string): string {
  const value = tryResolveValueLiteral(unwrapExpression(node));
  if (value === null) {
    throw new UnsupportedPatternError(errorMessage);
  }
  return value;
}
