import * as t from "@babel/types";
import { pascalCase } from "change-case";
import type { ResolvedConditionContext, ResolvedSegment, TrussMapping } from "./types";
import { breakpointMediaQuery } from "./mapping-utils";
import { memberPropertyName, unwrapExpression } from "./ast-utils";
import { type CallChainNode, UnsupportedPatternError } from "./chain-nodes";
import { cloneConditionContext } from "./condition-context";
import { staticSegment } from "./resolve-entry";
import { plainObjectEntries, requireValueLiteral, singleArg, tryResolveValueLiteral } from "./resolve-literals";
import { type ContainerBounds, containerQueryString, readContainerBound } from "./container-query";
import { sanitizeClassNameToken } from "./style-entries";

/** CSS custom properties as atomic classes, i.e. `Css.setVar({ [Tokens.x]: "1px" }).$`. */
export function resolveSetVarCall(
  node: CallChainNode,
  mapping: TrussMapping,
  context: ResolvedConditionContext,
): ResolvedSegment[] {
  const arg = singleArg(node, "setVar");
  if (!t.isObjectExpression(arg)) {
    throw new UnsupportedPatternError(`setVar() requires an object literal argument`);
  }

  const segments: ResolvedSegment[] = [];
  for (const prop of arg.properties) {
    if (t.isSpreadElement(prop)) {
      throw new UnsupportedPatternError(`setVar() does not support spread properties`);
    }
    if (!t.isObjectProperty(prop)) {
      throw new UnsupportedPatternError(`setVar() only supports object properties`);
    }
    const cssVarName = resolveSetVarPropertyKey(prop, mapping);
    // I.e. `--theme-accent` → `__theme_accent`, which the emitter extends with the value, i.e. `__theme_accent_blue`.
    const abbr = `__${sanitizeClassNameToken(cssVarName.replace(/^--/, ""))}`;
    for (const leaf of expandSetVarValueToLeaves(prop.value as t.Expression, mapping, context)) {
      segments.push(staticSegment(abbr, { [cssVarName]: leaf.literal }, leaf.context, leaf.literal));
    }
  }

  return segments;
}

/** The `--var-name` a setVar key refers to: a `"--literal"` string key or a `[Tokens.Name]` member. */
function resolveSetVarPropertyKey(prop: t.ObjectProperty, mapping: TrussMapping): string {
  const key = prop.key;
  if (!prop.computed) {
    if (t.isStringLiteral(key)) {
      if (key.value.startsWith("--")) {
        return key.value;
      }
      throw new UnsupportedPatternError(
        `setVar() string keys must be CSS variables starting with "--" - got ${JSON.stringify(key.value)}`,
      );
    }
    if (t.isIdentifier(key)) {
      throw new UnsupportedPatternError(
        `setVar() requires computed keys like [Tokens.Name] or string keys "--my-var", not bare property names`,
      );
    }
    throw new UnsupportedPatternError(`setVar() property keys must be string literals or [Tokens.*] members`);
  }

  if (!t.isMemberExpression(key)) {
    throw new UnsupportedPatternError(`setVar() computed keys must be Tokens.*-style members`);
  }
  const memberName = memberPropertyName(key);
  if (memberName === null) {
    throw new UnsupportedPatternError(
      `setVar() [Tokens.name] keys must use a plain .member or ["string"] member access`,
    );
  }
  const tokenMap = mapping.tokens;
  if (!tokenMap || !(memberName in tokenMap)) {
    throw new UnsupportedPatternError(
      tokenMap
        ? `Unknown token "${memberName}" - add it to config.tokens or use a "--" string literal key`
        : `setVar() [Tokens.*] requires config.tokens; use "--" string literal keys only`,
    );
  }
  return tokenMap[memberName];
}

/** One concrete value for a setVar custom property, together with the condition it applies under. */
interface SetVarLeaf {
  literal: string;
  context: ResolvedConditionContext;
}

/**
 * Expands one `setVar` property value into one or more static "leaves" for emission.
 *
 * Input: the AST for a single value — either a string/number literal, or an object
 * `{ default?, media?, container? }` when the variable is responsive.
 *
 * Output: each leaf is a concrete literal plus a condition context (viewport `mediaQuery`,
 * `@container` string in `mediaQuery`, or base). `resolveSetVarCall` turns each leaf into
 * a static segment with `defs: { [cssVarName]: literal }`. Leaves are emitted in the order
 * default, media, container regardless of the source property order.
 *
 * I.e. `"8px"` → one leaf with the inherited context (often unconditional).
 *
 * I.e. `{ default: "blue", media: { sm: "green" } }` → `"blue"` in base context, and `"green"`
 * with `mediaQuery` set from `mapping.breakpoints` for `ifSm` (same `@media` as `Css.ifSm`).
 *
 * I.e. `{ container: [{ gt: 400, value: "10px" }] }` → one leaf with `mediaQuery` like
 * `@container (min-width: 401px)` (same shape as `ifContainer({ gt: 400 })`).
 */
function expandSetVarValueToLeaves(
  valueNode: t.Expression,
  mapping: TrussMapping,
  baseContext: ResolvedConditionContext,
): SetVarLeaf[] {
  const unwrapped = unwrapExpression(valueNode);
  const scalar = tryResolveValueLiteral(unwrapped);
  if (scalar !== null) {
    return [setVarLeaf(scalar, baseContext)];
  }

  if (!t.isObjectExpression(unwrapped)) {
    throw new UnsupportedPatternError(
      `setVar() values must be string/number literals or a { default?, media?, container? } object`,
    );
  }

  let defaultLiteral: string | undefined;
  let mediaObject: t.ObjectExpression | undefined;
  let containerArray: t.ArrayExpression | undefined;

  for (const { key, value } of plainObjectEntries(unwrapped, "setVar() responsive object")) {
    if (key === "default") {
      defaultLiteral = requireValueLiteral(value, `setVar().default must be a string or number literal`);
    } else if (key === "media") {
      if (!t.isObjectExpression(value)) {
        throw new UnsupportedPatternError(`setVar().media must be an object literal`);
      }
      mediaObject = value;
    } else if (key === "container") {
      if (!t.isArrayExpression(value)) {
        throw new UnsupportedPatternError(`setVar().container must be an array literal`);
      }
      containerArray = value;
    } else {
      throw new UnsupportedPatternError(`setVar() responsive object does not support property "${key}"`);
    }
  }

  const leaves: SetVarLeaf[] = [];
  if (defaultLiteral !== undefined) {
    leaves.push(setVarLeaf(defaultLiteral, baseContext));
  }
  if (mediaObject) {
    leaves.push(...setVarMediaLeaves(mediaObject, mapping, baseContext));
  }
  if (containerArray) {
    leaves.push(...setVarContainerLeaves(containerArray, baseContext));
  }

  if (leaves.length === 0) {
    throw new UnsupportedPatternError(
      `setVar() responsive object must include at least one of default, media entries, or container entries`,
    );
  }

  return leaves;
}

/** I.e. `{ sm: "green" }` → one leaf per breakpoint, each under that breakpoint's media query. */
function setVarMediaLeaves(
  mediaObject: t.ObjectExpression,
  mapping: TrussMapping,
  baseContext: ResolvedConditionContext,
): SetVarLeaf[] {
  return plainObjectEntries(mediaObject, "setVar().media").map(({ key: breakpointName, value }) => {
    const mediaQuery = breakpointMediaQuery(mapping, `if${pascalCase(breakpointName)}`);
    if (mediaQuery === null) {
      throw new UnsupportedPatternError(
        `Unknown breakpoint "${breakpointName}" in setVar().media - use a Breakpoint name from truss-config`,
      );
    }
    const literal = requireValueLiteral(value, `setVar().media[${breakpointName}] must be a string or number literal`);
    return setVarLeaf(literal, baseContext, mediaQuery);
  });
}

/** I.e. `[{ gt: 400, value: "10px" }]` → one leaf per row, each under its `@container` query. */
function setVarContainerLeaves(containerArray: t.ArrayExpression, baseContext: ResolvedConditionContext): SetVarLeaf[] {
  const leaves: SetVarLeaf[] = [];
  for (const element of containerArray.elements) {
    if (element === null) {
      continue;
    }
    if (!t.isObjectExpression(element)) {
      throw new UnsupportedPatternError(`setVar().container entries must be object literals`);
    }
    let rowValue: string | undefined;
    const bounds: ContainerBounds = {};
    for (const { key, value } of plainObjectEntries(element, "setVar().container row")) {
      if (key === "value") {
        rowValue = requireValueLiteral(value, `setVar().container row "value" must be a string or number literal`);
      } else if (!readContainerBound(bounds, key, value, "setVar().container ")) {
        throw new UnsupportedPatternError(`setVar().container row does not support property "${key}"`);
      }
    }
    if (rowValue === undefined) {
      throw new UnsupportedPatternError(`setVar().container row requires a "value" property`);
    }
    if (bounds.lt === undefined && bounds.gt === undefined) {
      throw new UnsupportedPatternError(`setVar().container row requires at least one of gt or lt`);
    }
    leaves.push(setVarLeaf(rowValue, baseContext, containerQueryString(bounds)));
  }
  return leaves;
}

/** A leaf in the base context, or under `mediaQuery` when given. */
function setVarLeaf(literal: string, baseContext: ResolvedConditionContext, mediaQuery?: string): SetVarLeaf {
  const context = cloneConditionContext(baseContext);
  if (mediaQuery !== undefined) {
    context.mediaQuery = mediaQuery;
  }
  return { literal, context };
}
