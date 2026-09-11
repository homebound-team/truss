import * as t from "@babel/types";
import type { MarkerSegment, ResolvedConditionContext, ResolvedSegment, TrussMapping } from "./types";
import { breakpointMediaQuery } from "./mapping-utils";
import { extractDollarChain, unwrapExpression } from "./ast-utils";
import { type CallChainNode, type ChainNode, UnsupportedPatternError } from "./chain-nodes";
import { cloneConditionContext, emptyConditionContext, resetConditionContext } from "./condition-context";
import { errorSegment, requireEntry, resolveEntry } from "./resolve-entry";
import { resolveCallNode } from "./resolve-calls";
import { resolveWhenCall } from "./resolve-when";
import { containerQueryFromCall } from "./container-query";
import { invertMediaQuery } from "../media-query";
import { isTrussPseudoMethod, trussPseudoSelector } from "../pseudo-selectors";

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
 * I.e. `ChainNode` is just the raw AST chain from `Css` to `.$`, which may contain if/else nodes;
 * this `ResolvedChain` is the post-processed result where each if/else has been split into separate segments.
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
    // Preserve unsupported patterns as error segments so transforms can report them to the build tool.
    // Production rejects these diagnostics; dev can keep valid segments while reporting the errors.
    if (!(err instanceof UnsupportedPatternError)) throw err;
    return [errorSegment(err.message)];
  }
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
