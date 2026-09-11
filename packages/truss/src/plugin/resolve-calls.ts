import * as t from "@babel/types";
import {
  hasCondition,
  type ResolvedConditionContext,
  type ResolvedSegment,
  type TrussMapping,
  type TrussMappingEntry,
} from "./types";
import { findCanonicalAbbreviation } from "./mapping-utils";
import { staticPropertyName } from "./ast-utils";
import { type CallChainNode, UnsupportedPatternError } from "./chain-nodes";
import { cloneConditionContext } from "./condition-context";
import { requireEntry, staticSegment } from "./resolve-entry";
import { isCustomPropertyLiteral, singleArg, tryEvaluatePropertyLiteral, tryNumericLiteral } from "./resolve-literals";
import { resolveSetVarCall } from "./resolve-setvar";
import { resolveTypographyCall } from "./resolve-typography";

/** Resolve a call node: a built-in like `add(...)`/`setVar(...)`, or a variable/delegate abbreviation like `mt(2)`. */
export function resolveCallNode(
  node: CallChainNode,
  mapping: TrussMapping,
  context: ResolvedConditionContext,
): ResolvedSegment[] {
  switch (node.name) {
    case "with":
      return [resolveWithCall(node)];
    case "add":
      return resolveAddCall(node, mapping, context);
    case "className":
      return [resolveClassNameCall(node, context)];
    case "style":
      return [resolveStyleCall(node, context)];
    case "setVar":
      return resolveSetVarCall(node, mapping, context);
    case "typography":
      return resolveTypographyCall(node, mapping, context);
  }

  const entry = requireEntry(mapping, node.name);
  if (entry.kind === "variable") {
    return [resolveVariableCall(node.name, entry, node, mapping, context)];
  }
  if (entry.kind === "delegate") {
    return [resolveDelegateCall(node.name, entry, node, mapping, context)];
  }
  throw new UnsupportedPatternError(`Abbreviation "${node.name}" is ${entry.kind}, cannot be called as a function`);
}

/** Resolve a variable (parameterized) call like mt(2) or mt(x). */
function resolveVariableCall(
  abbr: string,
  entry: Extract<TrussMappingEntry, { kind: "variable" }>,
  node: CallChainNode,
  mapping: TrussMapping,
  context: ResolvedConditionContext,
): ResolvedSegment {
  const arg = singleArg(node, abbr);
  return resolveLiteralOrVariableSegment({
    abbr,
    props: entry.props,
    incremented: entry.incremented,
    extraDefs: entry.extraDefs,
    argAst: arg,
    literalValue: tryEvaluatePropertyLiteral(arg, mapping, entry.incremented),
    mapping,
    context,
  });
}

/** Resolve a delegate call like mtPx(12). */
function resolveDelegateCall(
  abbr: string,
  entry: Extract<TrussMappingEntry, { kind: "delegate" }>,
  node: CallChainNode,
  mapping: TrussMapping,
  context: ResolvedConditionContext,
): ResolvedSegment {
  const targetEntry = mapping.abbreviations[entry.target];
  if (!targetEntry || targetEntry.kind !== "variable") {
    throw new UnsupportedPatternError(`Delegate "${abbr}" targets "${entry.target}" which is not a variable entry`);
  }
  const arg = singleArg(node, abbr);
  // I.e. `mtPx(12)` folds to `12px` and `mtPx(-4)` to `-4px`; anything else is a runtime value
  const pixels = tryNumericLiteral(arg);
  // Use the target abbreviation name for delegate segments (i.e. mtPx → mt)
  return resolveLiteralOrVariableSegment({
    abbr: entry.target,
    props: targetEntry.props,
    incremented: false,
    appendPx: true,
    extraDefs: targetEntry.extraDefs,
    argAst: arg,
    literalValue: pixels === null ? null : `${pixels}px`,
    mapping,
    context,
  });
}

/**
 * Resolve a parameterized call argument to either a static fold, a compile-time `_var` tuple,
 * or a runtime `_var` tuple.
 *
 * I.e. `mt(2)` folds to `defs: { marginTop: "calc(var(--t-spacing) * 2)" }`; `mt(Tokens.gap)` stays a
 * `_var` segment with `argResolved: "var(--gap)"` so every token shares one `mt_var` class; and `mt(x)`
 * is a `_var` segment whose value is only known at runtime.
 */
function resolveLiteralOrVariableSegment(params: {
  abbr: string;
  props: string[];
  incremented: boolean;
  appendPx?: boolean;
  extraDefs?: Record<string, unknown>;
  argAst: t.Expression;
  literalValue: string | null;
  mapping: TrussMapping;
  context: ResolvedConditionContext;
}): ResolvedSegment {
  const { abbr, props, incremented, appendPx = false, extraDefs, argAst, literalValue, mapping, context } = params;

  if (literalValue !== null && !isCustomPropertyLiteral(argAst, mapping)) {
    const defs: Record<string, unknown> = Object.fromEntries(props.map((prop) => [prop, literalValue]));
    return staticSegment(abbr, { ...defs, ...extraDefs }, context, literalValue);
  }

  return {
    kind: "variable",
    abbr,
    props,
    incremented,
    appendPx,
    extraDefs,
    argNode: literalValue === null ? argAst : undefined,
    argResolved: literalValue ?? undefined,
    condition: cloneConditionContext(context),
  };
}

/** Raw class passthrough, i.e. `Css.className(buttonClass).df.$`. */
function resolveClassNameCall(node: CallChainNode, context: ResolvedConditionContext): ResolvedSegment {
  const arg = singleArg(node, "className");
  if (hasCondition(context)) {
    // I.e. `ifSm.className("x")` cannot be represented as a runtime-only class append.
    throw new UnsupportedPatternError(
      `className() cannot be used inside media query, pseudo-class, pseudo-element, or when() contexts`,
    );
  }
  // I.e. this is metadata for the rewriter/runtime, not an atomic CSS rule.
  return { kind: "className", arg };
}

/** Raw inline style passthrough, i.e. `Css.mt(x).style(vars).$`. */
function resolveStyleCall(node: CallChainNode, context: ResolvedConditionContext): ResolvedSegment {
  const arg = singleArg(node, "style");
  if (hasCondition(context)) {
    throw new UnsupportedPatternError(
      `style() cannot be used inside media query, pseudo-class, pseudo-element, or when() contexts`,
    );
  }
  return { kind: "inlineStyle", arg };
}

/**
 * Resolve a `with(cssProp)` call — compose an existing Css expression or partial
 * style hash into the chain.
 *
 * - `with(expr)` — spread an existing Css expression into the chain output
 * - `with({ height })` — inline a partial style hash, skipping undefined values
 */
function resolveWithCall(node: CallChainNode): ResolvedSegment {
  if (node.args.length !== 1) {
    throw new UnsupportedPatternError(`with() requires exactly 1 argument`);
  }
  const styleArg = node.args[0];
  if (t.isSpreadElement(styleArg)) {
    throw new UnsupportedPatternError(`with() does not support spread arguments`);
  }
  // Object literal: skip undefined values (the old addCss({ height }) pattern)
  return { kind: "composed", arg: styleArg, skipUndefined: t.isObjectExpression(styleArg) };
}

/**
 * Resolve an `add(...)` call.
 *
 * Supported overloads:
 * - `add({ prop: value, ... })` to add real CSS property/value pairs (alias for multiple add calls)
 * - `add("propName", value)` for an arbitrary CSS property/value pair
 *
 * Both forms reuse a canonical abbreviation when the pair matches one, i.e. `add("display", "grid")` → `dg`.
 */
function resolveAddCall(
  node: CallChainNode,
  mapping: TrussMapping,
  context: ResolvedConditionContext,
): ResolvedSegment[] {
  const usage =
    `add() requires 1 or 2 arguments (property name and value, or an object literal), got ${node.args.length}. ` +
    `Supported overloads are add({ prop: value }), add("propName", value), and with(cssProp)`;

  if (node.args.length === 1) {
    const styleArg = node.args[0];
    if (t.isSpreadElement(styleArg)) {
      throw new UnsupportedPatternError(`add() does not support spread arguments`);
    }
    if (t.isObjectExpression(styleArg)) {
      return resolveAddObjectLiteral(styleArg, mapping, context);
    }
    throw new UnsupportedPatternError(usage);
  }

  if (node.args.length !== 2) {
    throw new UnsupportedPatternError(usage);
  }

  const [propArg, valueArg] = node.args;
  if (!t.isStringLiteral(propArg)) {
    throw new UnsupportedPatternError(`add() first argument must be a string literal property name`);
  }
  if (t.isSpreadElement(valueArg)) {
    throw new UnsupportedPatternError(`add() does not support spread arguments`);
  }

  return [resolveAddDeclaration(propArg.value, valueArg, mapping, context)];
}

/**
 * Expand an `add({ prop1: value1, prop2: value2 })` object literal into individual segments,
 * as if the user had called `add("prop1", value1).add("prop2", value2)`.
 */
function resolveAddObjectLiteral(
  obj: t.ObjectExpression,
  mapping: TrussMapping,
  context: ResolvedConditionContext,
): ResolvedSegment[] {
  const segments: ResolvedSegment[] = [];
  for (const property of obj.properties) {
    if (t.isSpreadElement(property)) {
      throw new UnsupportedPatternError(`add({...}) does not support spread properties -- use with() instead`);
    }
    if (!t.isObjectProperty(property) || property.computed) {
      throw new UnsupportedPatternError(`add({...}) only supports simple property keys`);
    }
    const propName = staticPropertyName(property.key);
    if (propName === null) {
      throw new UnsupportedPatternError(`add({...}) property keys must be identifiers or string literals`);
    }
    segments.push(resolveAddDeclaration(propName, property.value as t.Expression, mapping, context));
  }
  return segments;
}

/**
 * Resolve one `add()` property/value pair to a segment.
 *
 * When the pair matches an existing single-property abbreviation in the mapping, that abbreviation
 * is reused so the class is shared with direct uses. Otherwise the property name itself is the
 * abbreviation: a literal value folds to a static class named with the property's short form from
 * the CSS property abbreviation table, and a runtime value becomes a `_var` tuple that keeps the
 * property name.
 *
 * I.e. `("display", "grid")` → the `dg` segment; `("boxShadow", "0 0 0 1px blue")` → `bxs_0_0_0_1px_blue`;
 * `("boxShadow", shadow)` → `boxShadow_var` with `--boxShadow: shadow`.
 */
function resolveAddDeclaration(
  propName: string,
  valueNode: t.Expression,
  mapping: TrussMapping,
  context: ResolvedConditionContext,
): ResolvedSegment {
  const literalValue = tryEvaluatePropertyLiteral(valueNode, mapping, false);

  const canonicalAbbr =
    literalValue !== null && !isCustomPropertyLiteral(valueNode, mapping)
      ? findCanonicalAbbreviation(mapping, propName, literalValue)
      : undefined;
  if (canonicalAbbr) {
    const entry = mapping.abbreviations[canonicalAbbr] as Extract<TrussMappingEntry, { kind: "static" }>;
    return staticSegment(canonicalAbbr, entry.defs, context);
  }

  return resolveLiteralOrVariableSegment({
    abbr: propName,
    props: [propName],
    incremented: false,
    argAst: valueNode,
    literalValue,
    mapping,
    context,
  });
}
