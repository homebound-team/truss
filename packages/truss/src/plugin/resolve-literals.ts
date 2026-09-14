import * as t from "@babel/types";
import type { TrussMapping } from "./types";
import { memberPropertyName, staticPropertyName, unwrapExpression } from "./ast-utils";
import { type CallChainNode, UnsupportedPatternError } from "./chain-nodes";
import { pascalCase } from "change-case";
import { isCustomPropertyName, maybeCssVar } from "../css-custom-property";
import { UnknownKeyframesError } from "./keyframe-names";
import { incrementCssValue } from "../spacing-css-var";
import { camelToKebab } from "../utils";

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
    const keyframes = tryResolveKeyframesMember(node, mapping);
    if (keyframes !== null) return keyframes;
    const template = tryResolveTemplateLiteral(node, mapping);
    if (template !== null) return template;
  }
  if (t.isStringLiteral(node)) {
    return node.value;
  }
  const numeric = tryNumericLiteral(node);
  return numeric === null ? null : String(numeric);
}

/**
 * Resolve a template literal whose every interpolation is itself a literal.
 *
 * Interpolated custom property names are wrapped, because a token inside a larger value has to read
 * as `var(--angle)`, i.e. `` `conic-gradient(from ${Tokens.Angle}, red)` `` →
 * `conic-gradient(from var(--angle), red)`. A template with a runtime expression stays unresolved and
 * becomes a `_var` tuple like any other runtime value.
 */
function tryResolveTemplateLiteral(node: t.Expression, mapping: TrussMapping): string | null {
  if (!t.isTemplateLiteral(node)) return null;
  let result = node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
  for (let i = 0; i < node.expressions.length; i++) {
    const expression = node.expressions[i];
    if (!t.isExpression(expression)) return null;
    const resolved = tryResolveValueLiteral(expression, mapping);
    if (resolved === null) return null;
    const quasi = node.quasis[i + 1];
    result += maybeCssVar(resolved) + (quasi.value.cooked ?? quasi.value.raw);
  }
  return result;
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

/** Resolve `Keyframes.Member` / `Keyframes["Member"]` to an animation name, i.e. `Keyframes.Spin` → `spin`. */
function tryResolveKeyframesMember(node: t.Expression, mapping: TrussMapping): string | null {
  if (!t.isMemberExpression(node) || !t.isIdentifier(node.object, { name: "Keyframes" })) return null;
  const memberName = memberPropertyName(node);
  if (memberName === null) return null;

  const keyframesMap = mapping.keyframes;
  if (!keyframesMap) {
    throw new UnsupportedPatternError(`Keyframes.* requires config.keyframes`);
  }
  // The enum member is PascalCase, i.e. `Keyframes.Spin`, while the configured name is the CSS one.
  const name = Object.keys(keyframesMap).find((configured) => pascalCase(configured) === memberName);
  if (name === undefined) {
    throw new UnknownKeyframesError(
      memberName,
      Object.keys(keyframesMap).map((configured) => pascalCase(configured)),
    );
  }
  return name;
}

// ── Resolved value validation ─────────────────────────────────────────

const VAR_CALL = "var(";

/**
 * Throw when a resolved value uses `var()` with a first argument that is not a custom property name.
 *
 * CSS requires the first argument of `var()` to be a `--` name, so `var(var(--b-primary))` is invalid
 * at computed-value time and the browser drops the whole declaration. A `Tokens` member is already
 * wrapped in `var()`, so an author who writes the `var()` around it gets the nested form and, without
 * this check, no warning at all -- only a missing style.
 *
 * The scan is exact, not conservative: at every `var(` it skips whitespace and requires `--`. A fallback
 * like `var(--a, var(--b))` stays valid, because there the nested `var()` is the second argument.
 *
 * I.e. `props` of `["boxShadow"]` and a `value` of `inset 3px 0px 0 0px var(var(--b-primary))` throws and
 * suggests `` `inset 3px 0px 0 0px ${Tokens.Primary}` ``; `var(--a, var(--b))` returns.
 */
export function validateCssVarValue(props: string[], value: string, mapping: TrussMapping): void {
  const offender = findBadCssVarArgument(value);
  if (offender === null) return;

  const cssProps = props.map((prop) => camelToKebab(prop)).join(", ");
  if (!/^var\(/i.test(offender)) {
    throw new UnsupportedPatternError(
      `${cssProps} value passes "${offender}" to var(), which is not a custom property name:\n  ${value}`,
    );
  }
  throw new UnsupportedPatternError(
    `${cssProps} value nests var() inside var():\n  ${value}\n` +
      `A Tokens member is wrapped in var() automatically. Drop your own var() around it:\n` +
      `  ${suggestUnnestedValue(value, mapping)}`,
  );
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

/**
 * The first `var()` argument in `value` that is not a custom property name, or null when every `var()`
 * is well-formed. The argument stops at the fallback comma or the closing paren, so a nested call comes
 * back without its own closing paren.
 *
 * I.e. `var(var(--b-primary))` → `"var(--b-primary"`; `var(--a, var(--b))` → null.
 */
function findBadCssVarArgument(value: string): string | null {
  // CSS function names are case-insensitive, so search a lowercased copy but report the original text
  const lowered = value.toLowerCase();
  for (let index = lowered.indexOf(VAR_CALL); index !== -1; index = lowered.indexOf(VAR_CALL, index + 1)) {
    // I.e. only "var(" itself, never the tail of a longer function name like "myvar("
    if (index > 0 && /[\w-]/.test(lowered[index - 1])) continue;
    const argument = value.slice(index + VAR_CALL.length).trimStart();
    if (!argument.startsWith("--")) {
      return argument.split(/[,)]/)[0].trim();
    }
  }
  return null;
}

/**
 * Rewrite `value` the way the author should have written it: drop each `var()` that only wraps another
 * `var()`, then name the `Tokens` member behind each custom property.
 *
 * I.e. with `tokens` of `{ Primary: "--b-primary" }`, `inset 3px 0px 0 0px var(var(--b-primary))` becomes
 * the template literal `` `inset 3px 0px 0 0px ${Tokens.Primary}` ``. This is only a suggestion for the
 * error message, so it keeps the value as-is wherever nothing is recognized.
 */
function suggestUnnestedValue(value: string, mapping: TrussMapping): string {
  let unnested = value;
  let previous: string;
  do {
    previous = unnested;
    // I.e. "var(var(--b-primary))" → "var(--b-primary)"
    unnested = unnested.replace(/var\(\s*(var\(\s*--[^()]*\))\s*\)/gi, "$1");
  } while (unnested !== previous);

  const tokenNames = new Map(Object.entries(mapping.tokens ?? {}).map(([name, property]) => [property, name]));
  const suggestion = unnested.replace(/var\(\s*(--[\w-]+)\s*\)/gi, (call, property) => {
    const tokenName = tokenNames.get(property);
    return tokenName ? `\${Tokens.${tokenName}}` : call;
  });
  return suggestion.includes("${") ? `\`${suggestion}\`` : `"${suggestion}"`;
}
