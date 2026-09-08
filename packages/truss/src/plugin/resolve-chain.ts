import * as t from "@babel/types";
import { pascalCase } from "change-case";
import {
  hasCondition,
  type MarkerSegment,
  type ResolvedConditionContext,
  type ResolvedSegment,
  type StaticSegment,
  type TrussMapping,
  type TrussMappingEntry,
  type WhenCondition,
} from "./types";
import { breakpointMediaQuery, breakpointNameForMediaQuery, findCanonicalAbbreviation } from "./mapping-utils";
import {
  extractChain,
  extractDollarChain,
  memberPropertyName,
  staticPropertyName,
  unwrapExpression,
} from "./ast-utils";
import { sanitizeClassNameToken } from "./emit-truss";
import { isWhenRelationship, WHEN_RELATIONSHIPS } from "./when-relationships";
import { invertMediaQuery } from "../media-query";
import { isTrussPseudoMethod, trussPseudoSelector } from "../pseudo-selectors";
import { isCustomPropertyName, maybeCssVar } from "../css-custom-property";
import { incrementCssValue } from "../spacing-css-var";

/**
 * Optional hook for resolving identifier references like `const same = Css.blue.$`
 * back into a `ChainNode[]`, so the core chain resolver can stay decoupled from
 * Babel scope/AST traversal concerns.
 */
export type CssChainReferenceResolver = (node: t.Expression) => ChainNode[] | null;

export interface ResolveChainCtx {
  /** The Truss mapping that defines abbreviations, breakpoints, and typography resolution. */
  mapping: TrussMapping;
  /** The local identifier bound to the generated `Css` export, if one exists in this file. */
  cssBindingName?: string;
  /** Optional lexical binding resolver for `const same = Css.blue.$` style references. */
  resolveCssChainReference?: CssChainReferenceResolver;
}

/**
 * A resolved chain that may contain conditional (if/else) sections.
 *
 * I.e. `ChainNode` from ast-utils.ts is just the raw AST chain from `Css` to `.$`, which may contain if/else
 * nodes; this `ResolvedChain` is the post-processed result where each if/else has been split into separate segments.
 *
 * The `parts` array contains unconditional segments and conditional groups.
 * The `markers` array contains marker directives (Css.marker.$, Css.markerOf("x").$).
 */
export interface ResolvedChain {
  parts: ResolvedChainPart[];
  /** Marker directives to attach to the element (not CSS styles). */
  markers: MarkerSegment[];
  /** Error messages from unsupported patterns found in this chain. */
  errors: string[];
}

export type ResolvedChainPart =
  | { type: "unconditional"; segments: ResolvedSegment[] }
  | {
      type: "conditional";
      conditionNode: t.Expression;
      thenSegments: ResolvedSegment[];
      elseSegments: ResolvedSegment[];
    };

/** Every segment in a chain part, i.e. both branches of a conditional part. */
export function partSegments(part: ResolvedChainPart): ResolvedSegment[] {
  return part.type === "unconditional" ? part.segments : [...part.thenSegments, ...part.elseSegments];
}

/** Every segment in a resolved chain, across all parts and branches. */
export function chainSegments(chain: ResolvedChain): ResolvedSegment[] {
  return chain.parts.flatMap((part) => partSegments(part));
}

/**
 * Resolve a whole `Css.*.$` chain in one left-to-right pass, splitting at if/else into parts.
 *
 * One live condition context is advanced by every modifier node as it is encountered, and each
 * style node is resolved under the context at that moment. `initialContext` seeds that context,
 * i.e. the selector of an enclosing `when({ ":hover": ... })` value.
 *
 * ## Chain semantics
 *
 * A `Css.*.$` chain is read left-to-right. Each segment is either a style
 * abbreviation (getter or call) or a modifier that changes the context for
 * subsequent styles. The modifiers and their precedence:
 *
 * - **`if(bool)`** / **`else`** — Boolean conditional. Splits the chain into
 *   then/else branches at the AST level. Subsequent styles go into the active
 *   branch. A new `if` starts a new conditional.
 *
 * - **`if(mediaQuery)`** — String overload. Sets the media query context
 *   (same as `ifSm`, `ifMd` etc.) for subsequent styles. Does NOT create
 *   a boolean branch.
 *
 * - **`ifSm`**, **`ifMd`**, **`ifLg`**, etc. — Breakpoint getters. Set the
 *   media query context. Stacks with pseudo-classes: `ifSm.onHover.blue.$`
 *   applies both conditions.
 *
 * - **`onHover`**, **`onFocus`**, etc. — Pseudo-class getters. Set the
 *   pseudo-class context. Stacks with media queries (see above). A new
 *   pseudo-class replaces the previous one.
 *
 * - **`element("::placeholder")`** — Pseudo-element. Sets the pseudo-element
 *   context for subsequent styles.
 *
 * - **`when(":hover")` / `when('[data-state="open"]')`** — Same-element selector.
 *   Behaves like a custom selector context and stacks with media queries.
 *
 * - **`when({ ":hover": Css.blue.$ })`** — Object form. Each value is resolved
 *   like an inline `Css.*.$` chain using the selector key as its initial
 *   selector context, while inheriting the current media/when context.
 *
 * - **`when(marker, "ancestor", ":hover")`** — Relationship selector. Sets the
 *   relationship selector context and stacks with same-element pseudos, pseudo-elements,
 *   and media queries.
 *
 * - **`ifContainer({ gt, lt })`** — Container query. Sets the media query
 *   context to an `@container` query string.
 *
 * - **`end`** — Closes the active boolean or media `if`/`else` group and resets
 *   the media query, pseudo-class, pseudo-element, and `when(...)`
 *   relationship-selector context so subsequent styles are unconditional.
 *
 * Contexts accumulate left-to-right until explicitly replaced within the same
 * axis or cleared with `end`. A media query set by `ifSm` persists through
 * `onHover` and `when(...)`.
 * A boolean `if(bool)` nests the chain but inherits the currently-active
 * modifier axes into both branches.
 */
export function resolveFullChain(
  ctx: ResolveChainCtx,
  chain: ChainNode[],
  initialContext: ResolvedConditionContext = emptyConditionContext(),
): ResolvedChain {
  const { mapping } = ctx;
  const markerScan = scanMarkerNodes(chain);
  const nodes = markerScan.chain;
  const markers = [...markerScan.markers];
  const errors = [...markerScan.errors];
  const parts: ResolvedChainPart[] = [];
  const context = cloneConditionContext(initialContext);
  // The open unconditional part; closed before each conditional or when({ ... }) part
  let current: ResolvedSegment[] = [];

  function closeCurrentPart(): void {
    if (current.length > 0) {
      parts.push({ type: "unconditional", segments: current });
      current = [];
    }
  }

  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i];

    const mediaQuery = mediaQueryOfNode(node, mapping);
    if (mediaQuery !== null) {
      const elseIndex = findElseIndex(nodes, i + 1);
      if (elseIndex === -1) {
        // I.e. `ifSm.black` or `if("@media ...").black`: a media context for the nodes that follow.
        context.mediaQuery = mediaQuery;
        i++;
        continue;
      }

      // I.e. `ifSm.black.else.white[.end]`: the else branch gets the inverted media query.
      const branchEnd = findEndIndex(nodes, elseIndex + 1);
      const thenContext = cloneConditionContext(context);
      thenContext.mediaQuery = mediaQuery;
      const elseContext = cloneConditionContext(context);
      elseContext.mediaQuery = invertMediaQuery(mediaQuery);
      current.push(
        ...resolveSegments(ctx, nodes.slice(i + 1, elseIndex), thenContext),
        ...resolveSegments(ctx, nodes.slice(elseIndex + 1, branchEnd), elseContext),
      );
      if (branchEnd === nodes.length) {
        break;
      }
      resetConditionContext(context);
      i = branchEnd + 1;
      continue;
    }

    if (isWhenObjectCall(node)) {
      closeCurrentPart();
      const resolved = resolveWhenObjectSelectors(ctx, node, context);
      parts.push(...resolved.parts);
      markers.push(...resolved.markers);
      errors.push(...resolved.errors);
      i++;
      continue;
    }

    if (node.type === "if") {
      // Boolean conditional; the string-literal `if(mediaQuery)` overload was handled above.
      closeCurrentPart();
      // Both branches inherit the context as of the `if`, even when the group's `end` resets it below
      const branchContext = cloneConditionContext(context);

      // Collect "then" nodes until "else" or end
      const thenNodes: ChainNode[] = [];
      const elseNodes: ChainNode[] = [];
      i++;
      let inElse = false;
      while (i < nodes.length) {
        const branchNode = nodes[i];
        if (branchNode.type === "getter" && branchNode.name === "end") {
          resetConditionContext(context);
          i++;
          break;
        }
        if (branchNode.type === "else") {
          inElse = true;
          i++;
          continue;
        }
        if (branchNode.type === "if") {
          // Nested if — break out and let the outer loop handle it
          break;
        }
        if (inElse) {
          elseNodes.push(branchNode);
        } else {
          thenNodes.push(branchNode);
        }
        i++;
      }
      parts.push({
        type: "conditional",
        conditionNode: node.conditionNode,
        thenSegments: resolveSegments(ctx, thenNodes, cloneConditionContext(branchContext)),
        elseSegments: resolveSegments(ctx, elseNodes, cloneConditionContext(branchContext)),
      });
      continue;
    }

    current.push(...resolveNode(ctx, node, context));
    i++;
  }

  closeCurrentPart();

  const segmentErrors = parts
    .flatMap((part) => partSegments(part))
    .flatMap((seg) => (seg.kind === "error" ? [seg.message] : []));
  return { parts, markers, errors: [...new Set([...errors, ...segmentErrors])] };
}

/**
 * Resolve a run of nodes under one live `context`, which each modifier node advances in place.
 *
 * I.e. the body of an `if()` branch. Does NOT split at if/else — use resolveFullChain for that.
 */
function resolveSegments(
  ctx: ResolveChainCtx,
  nodes: ChainNode[],
  context: ResolvedConditionContext,
): ResolvedSegment[] {
  return nodes.flatMap((node) => resolveNode(ctx, node, context));
}

/**
 * Resolve one chain node under `context`.
 *
 * Modifiers (`ifSm`, `onHover`, `end`, ...) advance `context` and yield no segments; abbreviations and
 * built-in calls yield their segments; an unsupported pattern yields one error segment in their place.
 */
function resolveNode(ctx: ResolveChainCtx, node: ChainNode, context: ResolvedConditionContext): ResolvedSegment[] {
  const { mapping } = ctx;
  try {
    if (isWhenObjectCall(node)) {
      return flattenWhenObjectParts(resolveWhenObjectSelectors(ctx, node, context));
    }
    if (applyModifierNodeToConditionContext(context, node, mapping)) {
      return [];
    }
    if (node.type === "getter") {
      return resolveEntry(node.name, requireEntry(mapping, node.name), mapping, context);
    }
    if (node.type === "call") {
      return resolveCallNode(node, mapping, context);
    }
    return [];
  } catch (err) {
    if (!(err instanceof UnsupportedPatternError)) throw err;
    return [errorSegment(err.message)];
  }
}

// ── Condition context ─────────────────────────────────────────────────

function emptyConditionContext(): ResolvedConditionContext {
  return {
    mediaQuery: null,
    pseudoClass: null,
    pseudoElement: null,
    whenPseudo: null,
  };
}

/** `WhenCondition` objects are never mutated after creation, so a shallow copy is a full snapshot. */
function cloneConditionContext(context: ResolvedConditionContext): ResolvedConditionContext {
  return { ...context };
}

function resetConditionContext(context: ResolvedConditionContext): void {
  Object.assign(context, emptyConditionContext());
}

/** A static segment under a snapshot of the active condition axes. */
function staticSegment(
  abbr: string,
  defs: Record<string, unknown>,
  context: ResolvedConditionContext,
  argResolved?: string,
): StaticSegment {
  return { kind: "static", abbr, defs, argResolved, condition: cloneConditionContext(context) };
}

/**
 * Apply context-only chain nodes like breakpoints/pseudos/end.
 *
 * Returns false for nodes that produce styles instead. Throws UnsupportedPatternError for a
 * malformed modifier, which `resolveNode` turns into an error segment.
 */
function applyModifierNodeToConditionContext(
  context: ResolvedConditionContext,
  node: ChainNode,
  mapping: TrussMapping,
): boolean {
  if (node.type === "getter") {
    if (node.name === "end") {
      resetConditionContext(context);
      return true;
    }
    if (isTrussPseudoMethod(node.name)) {
      context.pseudoClass = trussPseudoSelector(node.name);
      return true;
    }
    const mediaQuery = breakpointMediaQuery(mapping, node.name);
    if (mediaQuery !== null) {
      context.mediaQuery = mediaQuery;
      return true;
    }
    return false;
  }

  if (node.type !== "call") {
    return false;
  }

  if (node.name === "ifContainer") {
    context.mediaQuery = containerQueryFromCall(node);
    return true;
  }

  if (node.name === "element") {
    const arg = node.args.length === 1 ? node.args[0] : null;
    if (!t.isStringLiteral(arg)) {
      throw new UnsupportedPatternError(
        `element() requires exactly one string literal argument (e.g. "::placeholder")`,
      );
    }
    context.pseudoElement = arg.value;
    return true;
  }

  if (node.name === "when") {
    if (isWhenObjectCall(node)) {
      return false;
    }
    const resolved = resolveWhenCall(node);
    if (resolved.kind === "selector") {
      context.pseudoClass = resolved.selector;
    } else {
      context.whenPseudo = resolved.condition;
    }
    return true;
  }

  if (isTrussPseudoMethod(node.name)) {
    context.pseudoClass = trussPseudoSelector(node.name);
    if (node.args.length > 0) {
      throw new UnsupportedPatternError(
        `${node.name}() does not take arguments -- use when(marker, "ancestor", ":hover") for relationship selectors`,
      );
    }
    return true;
  }

  return false;
}

// ── Chain scanning helpers for resolveFullChain ───────────────────────

/** Pull marker nodes out of a chain before style resolution. */
function scanMarkerNodes(chain: ChainNode[]): { chain: ChainNode[]; markers: MarkerSegment[]; errors: string[] } {
  const filteredChain: ChainNode[] = [];
  const markers: MarkerSegment[] = [];
  const errors: string[] = [];

  for (const node of chain) {
    if (node.type === "getter" && node.name === "marker") {
      markers.push({ type: "marker" });
      continue;
    }

    if (node.type === "call" && node.name === "markerOf") {
      const arg = node.args.length === 1 ? node.args[0] : null;
      if (!arg || t.isSpreadElement(arg)) {
        errors.push("[truss] Unsupported pattern: markerOf() requires exactly one argument (a marker variable)");
      } else {
        markers.push({ type: "marker", markerNode: arg });
      }
      continue;
    }

    filteredChain.push(node);
  }

  return { chain: filteredChain, markers, errors };
}

/** The media query a node switches into, i.e. `ifSm` or `if("@media ...")`; null for every other node. */
function mediaQueryOfNode(node: ChainNode, mapping: TrussMapping): string | null {
  if (node.type === "if" && t.isStringLiteral(node.conditionNode)) {
    return node.conditionNode.value;
  }
  if (node.type === "getter") {
    return breakpointMediaQuery(mapping, node.name);
  }
  return null;
}

/** Index of the `else` that closes the branch starting at `start`, or -1 when an `if`/`end` comes first. */
function findElseIndex(chain: ChainNode[], start: number): number {
  for (let i = start; i < chain.length; i++) {
    const node = chain[i];
    if (node.type === "if") {
      return -1;
    }
    if (node.type === "getter" && node.name === "end") {
      return -1;
    }
    if (node.type === "else") {
      return i;
    }
  }
  return -1;
}

/** Index of the first `end` at or after `start`, or `chain.length` when the chain has none. */
function findEndIndex(chain: ChainNode[], start: number): number {
  for (let i = start; i < chain.length; i++) {
    const node = chain[i];
    if (node.type === "getter" && node.name === "end") {
      return i;
    }
  }
  return chain.length;
}

// ── when({ ... }) object form ─────────────────────────────────────────

/** Detect `when({ ... })` so object-form selector groups can be resolved specially. */
type WhenObjectCallChainNode = CallChainNode & { name: "when"; args: [t.ObjectExpression] };

function isWhenObjectCall(node: ChainNode): node is WhenObjectCallChainNode {
  return node.type === "call" && node.name === "when" && node.args.length === 1 && t.isObjectExpression(node.args[0]);
}

/**
 * Resolve `when({ ":hover": Css.blue.$, ... })` by recursively resolving each
 * nested `Css.*.$` value with the selector key as its initial pseudo-class.
 */
function resolveWhenObjectSelectors(
  ctx: ResolveChainCtx,
  node: WhenObjectCallChainNode,
  context: ResolvedConditionContext,
): ResolvedChain {
  if (!ctx.cssBindingName) {
    return {
      parts: [],
      markers: [],
      errors: [new UnsupportedPatternError(`when({ ... }) requires a resolvable Css binding`).message],
    };
  }

  const parts: ResolvedChainPart[] = [];
  const markers: MarkerSegment[] = [];
  const errors: string[] = [];

  for (const property of node.args[0].properties) {
    try {
      if (t.isSpreadElement(property)) {
        throw new UnsupportedPatternError(`when({ ... }) does not support spread properties`);
      }
      if (!t.isObjectProperty(property)) {
        throw new UnsupportedPatternError(`when({ ... }) only supports plain object properties`);
      }
      if (property.computed || !t.isStringLiteral(property.key)) {
        throw new UnsupportedPatternError(`when({ ... }) selector keys must be string literals`);
      }

      const value = unwrapExpression(property.value as t.Expression);
      const innerChain = resolveWhenObjectValueChain(ctx, value);
      if (!innerChain) {
        throw new UnsupportedPatternError(`when({ ... }) values must be Css.*.$ expressions`);
      }

      const selectorContext = cloneConditionContext(context);
      selectorContext.pseudoClass = property.key.value;
      const resolved = resolveFullChain(ctx, innerChain, selectorContext);
      parts.push(...resolved.parts);
      markers.push(...resolved.markers);
      errors.push(...resolved.errors);
    } catch (err) {
      if (!(err instanceof UnsupportedPatternError)) throw err;
      errors.push(err.message);
    }
  }

  return { parts, markers, errors: [...new Set(errors)] };
}

/**
 * Resolve a `when({ ... })` value into an inner `ChainNode[]`.
 *
 * I.e. this accepts either a direct `Css.blue.$` member expression or a
 * transform-provided reference resolver for identifiers like `const same = Css.blue.$`.
 * The reference lookup itself stays outside this file because it depends on
 * Babel scope/NodePath traversal state, while `resolve-chain.ts` is kept focused
 * on chain semantics rather than lexical binding analysis.
 */
function resolveWhenObjectValueChain(ctx: ResolveChainCtx, value: t.Expression): ChainNode[] | null {
  const direct = ctx.cssBindingName ? extractDollarChain(value, ctx.cssBindingName) : null;
  return direct ?? ctx.resolveCssChainReference?.(value) ?? null;
}

/** Flatten nested `when({ ... })` parts back into plain segments for a branch body. */
function flattenWhenObjectParts(resolved: ResolvedChain): ResolvedSegment[] {
  const segments: ResolvedSegment[] = [];

  // I.e. a branch body needs a flat segment list, even though `when({ ... })` is resolved via `resolveFullChain()`.
  for (const part of resolved.parts) {
    if (part.type !== "unconditional") {
      throw new UnsupportedPatternError(`when({ ... }) values cannot use if()/else in this context`);
    }

    segments.push(...part.segments);
  }

  for (const err of resolved.errors) {
    segments.push(errorSegment(err));
  }

  return segments;
}

// ── Getter and call resolution ────────────────────────────────────────

function requireEntry(mapping: TrussMapping, abbr: string): TrussMappingEntry {
  const entry = mapping.abbreviations[abbr];
  if (!entry) {
    throw new UnsupportedPatternError(`Unknown abbreviation "${abbr}"`);
  }
  return entry;
}

/** Placeholder segment that carries an unsupported-pattern message through to the emitter. */
function errorSegment(message: string): ResolvedSegment {
  return { kind: "error", message };
}

/** Resolve a static or alias entry (from a getter access). Defs are always flat. */
function resolveEntry(
  abbr: string,
  entry: TrussMappingEntry,
  mapping: TrussMapping,
  context: ResolvedConditionContext,
): ResolvedSegment[] {
  switch (entry.kind) {
    case "static": {
      return [staticSegment(abbr, entry.defs, context)];
    }
    case "alias": {
      const result: ResolvedSegment[] = [];
      for (const chainAbbr of entry.chain) {
        const subEntry = mapping.abbreviations[chainAbbr];
        if (!subEntry) {
          throw new UnsupportedPatternError(`Alias "${abbr}" references unknown abbreviation "${chainAbbr}"`);
        }
        result.push(...resolveEntry(chainAbbr, subEntry, mapping, context));
      }
      return result;
    }
    case "variable":
    case "delegate":
      throw new UnsupportedPatternError(`Abbreviation "${abbr}" requires arguments — use ${abbr}() not .${abbr}`);
    default:
      throw new UnsupportedPatternError(`Unhandled entry kind for "${abbr}"`);
  }
}

/** Resolve a call node: a built-in like `add(...)`/`setVar(...)`, or a variable/delegate abbreviation like `mt(2)`. */
function resolveCallNode(
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
  // Use the target abbreviation name for delegate segments (i.e. mtPx → mt)
  return resolveLiteralOrVariableSegment({
    abbr: entry.target,
    props: targetEntry.props,
    incremented: false,
    appendPx: true,
    extraDefs: targetEntry.extraDefs,
    argAst: arg,
    literalValue: t.isNumericLiteral(arg) ? `${arg.value}px` : null,
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
 * abbreviation, folded to a static class for literal values or a `_var` tuple for runtime values.
 *
 * I.e. `("display", "grid")` → the `dg` segment; `("boxShadow", "0 0 0 1px blue")` → `boxShadow_0_0_0_1px_blue`;
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

// ── typography(...) ───────────────────────────────────────────────────

/** Resolve `typography(key)` into either direct segments or a runtime lookup-backed segment. */
function resolveTypographyCall(
  node: CallChainNode,
  mapping: TrussMapping,
  context: ResolvedConditionContext,
): ResolvedSegment[] {
  const arg = singleArg(node, "typography");
  if (t.isStringLiteral(arg)) {
    return resolveTypographyEntry(arg.value, mapping, context);
  }

  const typography = mapping.typography ?? [];
  if (typography.length === 0) {
    throw new UnsupportedPatternError(`typography() is unavailable because no typography abbreviations were generated`);
  }

  const suffix = typographyLookupKeySuffix(context, mapping);
  const lookupKey = suffix ? `typography__${suffix}` : "typography";
  const segmentsByName: Record<string, ResolvedSegment[]> = {};
  for (const name of typography) {
    segmentsByName[name] = resolveTypographyEntry(name, mapping, context);
  }

  return [{ kind: "typography", lookupKey, argNode: arg, segmentsByName }];
}

/** Resolve a single typography abbreviation name within the current condition context. */
function resolveTypographyEntry(
  name: string,
  mapping: TrussMapping,
  context: ResolvedConditionContext,
): ResolvedSegment[] {
  if (!(mapping.typography ?? []).includes(name)) {
    throw new UnsupportedPatternError(`Unknown typography abbreviation "${name}"`);
  }

  const entry = mapping.abbreviations[name];
  if (!entry) {
    throw new UnsupportedPatternError(`Unknown typography abbreviation "${name}"`);
  }

  const resolved = resolveEntry(name, entry, mapping, context);
  for (const segment of resolved) {
    if (segment.kind === "variable") {
      throw new UnsupportedPatternError(`Typography abbreviation "${name}" cannot require runtime arguments`);
    }
  }
  return resolved;
}

/**
 * Build a typography lookup key suffix from condition context.
 *
 * I.e. `typography(key)` → `""`, `ifSm.typography(key)` → `"sm"`, `onHover.typography(key)` → `"hover"`.
 */
function typographyLookupKeySuffix(context: ResolvedConditionContext, mapping: TrussMapping): string {
  const parts: string[] = [];
  if (context.pseudoElement) parts.push(context.pseudoElement.replace(/^::/, ""));
  if (context.mediaQuery) {
    const breakpoint = breakpointNameForMediaQuery(mapping, context.mediaQuery);
    parts.push(breakpoint ? breakpoint.replace(/^./, (c) => c.toLowerCase()) : "mq");
  }
  if (context.pseudoClass) parts.push(context.pseudoClass.replace(/^:+/, "").replace(/-/g, "_"));
  if (context.whenPseudo) parts.push(whenLookupKeyPart(context.whenPseudo));
  return parts.join("_");
}

/** I.e. `when(row, "ancestor", ":hover")` → `"when_ancestor_hover_row"`. */
function whenLookupKeyPart(whenPseudo: WhenCondition): string {
  const parts = ["when", whenPseudo.relationship, sanitizeClassNameToken(whenPseudo.pseudo) || "value"];
  if (whenPseudo.markerNode) {
    parts.push(whenPseudo.markerNode.name);
  }
  return parts.join("_");
}

// ── when(...) selector form ───────────────────────────────────────────

/**
 * Resolve a `when(selector)` or `when(marker, relationship, pseudo)` call.
 *
 * - 1 arg: `when(":hover")` / `when('[data-state="open"]')` — same-element selector,
 *   must be a string literal
 * - 3 args: `when(marker, "ancestor", ":hover")` — marker must be a marker variable or
 *   the shared `marker` token, relationship/pseudo must be string literals
 */
function resolveWhenCall(
  node: CallChainNode,
): { kind: "selector"; selector: string } | { kind: "relationship"; condition: WhenCondition } {
  if (node.args.length !== 1 && node.args.length !== 3) {
    throw new UnsupportedPatternError(
      `when() expects 1 or 3 arguments (selector) or (marker, relationship, pseudo), got ${node.args.length}`,
    );
  }

  if (node.args.length === 1) {
    const selectorArg = node.args[0];
    if (!t.isStringLiteral(selectorArg)) {
      throw new UnsupportedPatternError(`when() selector must be a string literal`);
    }
    return { kind: "selector", selector: selectorArg.value };
  }

  const [markerArg, relationshipArg, pseudoArg] = node.args;
  const markerNode = resolveWhenMarker(markerArg);
  if (!t.isStringLiteral(relationshipArg)) {
    throw new UnsupportedPatternError(`when() relationship argument must be a string literal`);
  }
  const relationship = relationshipArg.value;
  if (!isWhenRelationship(relationship)) {
    throw new UnsupportedPatternError(
      `when() relationship must be one of: ${Object.keys(WHEN_RELATIONSHIPS).join(", ")} -- got "${relationship}"`,
    );
  }
  if (!t.isStringLiteral(pseudoArg)) {
    throw new UnsupportedPatternError(`when() pseudo selector (3rd argument) must be a string literal`);
  }
  return { kind: "relationship", condition: { pseudo: pseudoArg.value, markerNode, relationship } };
}

/** The user's marker variable, or undefined for the shared default marker. */
function resolveWhenMarker(node: t.Expression | t.SpreadElement): t.Identifier | undefined {
  if (isDefaultMarkerNode(node)) {
    return undefined;
  }
  if (t.isIdentifier(node)) {
    return node;
  }
  throw new UnsupportedPatternError(`when() marker must be a marker variable or marker`);
}

/** I.e. `marker`, `defaultMarker`, or the legacy `Css.defaultMarker()` call. */
function isDefaultMarkerNode(node: t.Expression | t.SpreadElement): boolean {
  if (t.isIdentifier(node) && (node.name === "marker" || node.name === "defaultMarker")) {
    return true;
  }
  return (
    t.isCallExpression(node) &&
    node.arguments.length === 0 &&
    t.isMemberExpression(node.callee) &&
    !node.callee.computed &&
    t.isIdentifier(node.callee.property, { name: "defaultMarker" })
  );
}

// ── Literal evaluation ────────────────────────────────────────────────

/**
 * Try to evaluate a literal AST node to a CSS property value.
 * For incremented entries, also evaluates `maybeInc(literal)` (web: calc on `--t-spacing`).
 * Custom property names (`--token` / `Tokens.X`) are wrapped as `var(--token)`.
 */
function tryEvaluatePropertyLiteral(node: t.Expression, mapping: TrussMapping, incremented: boolean): string | null {
  const numeric = tryNumericLiteral(node);
  if (numeric !== null) {
    return incremented ? incrementCssValue(numeric) : String(numeric);
  }
  const raw = tryResolveValueLiteral(node, mapping);
  return raw === null ? null : maybeCssVar(raw);
}

/** True when the argument names a CSS custom property, i.e. `"--token"` or `Tokens.x`. */
function isCustomPropertyLiteral(node: t.Expression, mapping: TrussMapping): boolean {
  const raw = tryResolveValueLiteral(node, mapping);
  return raw !== null && isCustomPropertyName(raw);
}

/** Resolve a literal value without wrapping (for setVar values, etc.). */
function tryResolveValueLiteral(node: t.Expression, mapping?: TrussMapping): string | null {
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
function tryNumericLiteral(node: t.Expression): number | null {
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
function singleArg(node: CallChainNode, label: string): t.Expression {
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
function plainObjectEntries(obj: t.ObjectExpression, label: string): Array<{ key: string; value: t.Expression }> {
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

function numericLiteralValue(node: t.Expression, errorMessage: string): number {
  const numeric = tryNumericLiteral(node);
  if (numeric === null) {
    throw new UnsupportedPatternError(errorMessage);
  }
  return numeric;
}

function stringLiteralValue(node: t.Expression, errorMessage: string): string {
  if (t.isStringLiteral(node)) {
    return node.value;
  }
  if (t.isTemplateLiteral(node) && node.expressions.length === 0 && node.quasis.length === 1) {
    return node.quasis[0].value.cooked ?? "";
  }
  throw new UnsupportedPatternError(errorMessage);
}

/** A string/number literal value, unwrapping TS/paren wrappers first. */
function requireValueLiteral(node: t.Expression, errorMessage: string): string {
  const value = tryResolveValueLiteral(unwrapExpression(node));
  if (value === null) {
    throw new UnsupportedPatternError(errorMessage);
  }
  return value;
}

// ── Container queries ─────────────────────────────────────────────────

interface ContainerBounds {
  lt?: number;
  gt?: number;
  name?: string;
}

/** Resolve ifContainer({ gt, lt, name? }) to an `@container` query string. */
function containerQueryFromCall(node: CallChainNode): string {
  const arg = singleArg(node, "ifContainer");
  if (!t.isObjectExpression(arg)) {
    throw new UnsupportedPatternError("ifContainer() expects an object literal argument");
  }

  const bounds: ContainerBounds = {};
  for (const { key, value } of plainObjectEntries(arg, "ifContainer()")) {
    if (!readContainerBound(bounds, key, value, "ifContainer().")) {
      throw new UnsupportedPatternError(`ifContainer() does not support property "${key}"`);
    }
  }

  if (bounds.lt === undefined && bounds.gt === undefined) {
    throw new UnsupportedPatternError('ifContainer() requires at least one of "lt" or "gt"');
  }

  return containerQueryString(bounds);
}

/** Read one `lt`/`gt`/`name` bound into `bounds`; false when `key` is not a bound. */
function readContainerBound(bounds: ContainerBounds, key: string, value: t.Expression, label: string): boolean {
  if (key === "lt") {
    bounds.lt = numericLiteralValue(value, `${label}lt must be a numeric literal`);
    return true;
  }
  if (key === "gt") {
    bounds.gt = numericLiteralValue(value, `${label}gt must be a numeric literal`);
    return true;
  }
  if (key === "name") {
    bounds.name = stringLiteralValue(value, `${label}name must be a string literal`);
    return true;
  }
  return false;
}

/** I.e. `{ gt: 400, lt: 800, name: "card" }` → `@container card (min-width: 401px) and (max-width: 800px)`. */
function containerQueryString(bounds: ContainerBounds): string {
  const parts: string[] = [];
  if (bounds.gt !== undefined) {
    parts.push(`(min-width: ${bounds.gt + 1}px)`);
  }
  if (bounds.lt !== undefined) {
    parts.push(`(max-width: ${bounds.lt}px)`);
  }
  const namePrefix = bounds.name ? `${bounds.name} ` : "";
  return `@container ${namePrefix}${parts.join(" and ")}`;
}

// ── setVar(...) ───────────────────────────────────────────────────────

/** CSS custom properties as atomic classes, i.e. `Css.setVar({ [Tokens.x]: "1px" }).$`. */
function resolveSetVarCall(
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
    // I.e. `--theme-accent` → `__theme_accent`, which emit-truss extends with the value, i.e. `__theme_accent_blue`.
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

// ── Chain node types (parsed from AST) ────────────────────────────────

export interface GetterChainNode {
  type: "getter";
  name: string;
}

export interface CallChainNode {
  type: "call";
  name: string;
  args: (t.Expression | t.SpreadElement)[];
}

export interface IfChainNode {
  type: "if";
  conditionNode: t.Expression;
}

export interface ElseChainNode {
  type: "else";
}

export type ChainNode = GetterChainNode | CallChainNode | IfChainNode | ElseChainNode;

export class UnsupportedPatternError extends Error {
  constructor(message: string) {
    super(`[truss] Unsupported pattern: ${message}`);
    this.name = "UnsupportedPatternError";
  }
}
