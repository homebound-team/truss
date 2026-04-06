import type * as t from "@babel/types";
import {
  getLonghandLookup,
  type MarkerSegment,
  type ResolvedConditionContext,
  type ResolvedSegment,
  type TrussMapping,
  type TrussMappingEntry,
  type WhenCondition,
} from "./types";
import { extractChain } from "./ast-utils";

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
  /** The starting modifier state for this resolution pass, i.e. inherited media/pseudo context. */
  initialContext?: ResolvedConditionContext;
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
  | { type: "conditional"; conditionNode: any; thenSegments: ResolvedSegment[]; elseSegments: ResolvedSegment[] };

function emptyConditionContext(): ResolvedConditionContext {
  return {
    mediaQuery: null,
    pseudoClass: null,
    pseudoElement: null,
    whenPseudo: null,
  };
}

function cloneConditionContext(context: ResolvedConditionContext): ResolvedConditionContext {
  return {
    mediaQuery: context.mediaQuery,
    pseudoClass: context.pseudoClass,
    pseudoElement: context.pseudoElement,
    whenPseudo: context.whenPseudo ? { ...context.whenPseudo } : null,
  };
}

function resetConditionContext(context: ResolvedConditionContext): void {
  context.mediaQuery = null;
  context.pseudoClass = null;
  context.pseudoElement = null;
  context.whenPseudo = null;
}

function segmentWithConditionContext(
  segment: Omit<ResolvedSegment, "mediaQuery" | "pseudoClass" | "pseudoElement" | "whenPseudo">,
  context: ResolvedConditionContext,
): ResolvedSegment {
  return {
    ...segment,
    mediaQuery: context.mediaQuery,
    pseudoClass: context.pseudoClass,
    pseudoElement: context.pseudoElement,
    whenPseudo: context.whenPseudo,
  };
}

function applyModifierNodeToConditionContext(
  context: ResolvedConditionContext,
  node: ChainNode,
  mapping: TrussMapping,
): void {
  if ((node as any).type === "__mediaQuery") {
    context.mediaQuery = (node as any).mediaQuery;
    return;
  }

  if (node.type === "getter") {
    if (node.name === "end") {
      resetConditionContext(context);
      return;
    }
    if (isPseudoMethod(node.name)) {
      context.pseudoClass = pseudoSelector(node.name);
      return;
    }
    if (mapping.breakpoints && node.name in mapping.breakpoints) {
      context.mediaQuery = mapping.breakpoints[node.name];
    }
    return;
  }

  if (node.type !== "call") {
    return;
  }

  if (node.name === "ifContainer") {
    try {
      context.mediaQuery = containerSelectorFromCall(node);
    } catch {
      // Ignore invalid modifiers here; resolveChain() will report the real error.
    }
    return;
  }

  if (node.name === "element") {
    if (node.args.length === 1 && node.args[0].type === "StringLiteral") {
      context.pseudoElement = node.args[0].value;
    }
    return;
  }

  if (node.name === "when") {
    try {
      const resolved = resolveWhenCall(node);
      if (resolved.kind === "selector") {
        context.pseudoClass = resolved.pseudo;
      } else {
        context.whenPseudo = resolved;
      }
    } catch {
      // Ignore invalid modifiers here; resolveChain() will report the real error.
    }
    return;
  }

  if (isPseudoMethod(node.name)) {
    context.pseudoClass = pseudoSelector(node.name);
  }
}

/**
 * High-level chain resolver that handles if/else by splitting into parts.
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
 * - **`when(":hover")`** — Same-element selector pseudo. Behaves like a custom
 *   pseudo-class context and stacks with media queries.
 *
 * - **`when({ ":hover": Css.blue.$ })`** — Object form. Each value is resolved
 *   like an inline `Css.*.$` chain using the selector key as its initial
 *   pseudo-class context, while inheriting the current media/when context.
 *
 * - **`when(marker, "ancestor", ":hover")`** — Relationship selector. Sets the
 *   relationship selector context and stacks with same-element pseudos, pseudo-elements,
 *   and media queries.
 *
 * - **`ifContainer({ gt, lt })`** — Container query. Sets the media query
 *   context to an `@container` query string.
 *
 * - **`end`** — Resets the active media query, pseudo-class, pseudo-element,
 *   and `when(...)` relationship-selector context so subsequent styles start
 *   from the base condition state again.
 *
 * Contexts accumulate left-to-right until explicitly replaced within the same
 * axis or cleared with `end`. A media query set by `ifSm` persists through
 * `onHover` and `when(...)`.
 * A boolean `if(bool)` nests the chain but inherits the currently-active
 * modifier axes into both branches.
 */
export function resolveFullChain(ctx: ResolveChainCtx, chain: ChainNode[]): ResolvedChain {
  const { mapping } = ctx;
  const initialContext = ctx.initialContext ?? emptyConditionContext();
  const parts: ResolvedChainPart[] = [];
  const markers: MarkerSegment[] = [];
  const nestedErrors: string[] = [];

  // Pre-scan for marker nodes and strip them from the chain
  const filteredChain: ChainNode[] = [];
  /** Errors found during marker scanning — attached to the chain result */
  const scanErrors: string[] = [];
  for (let j = 0; j < chain.length; j++) {
    const node = chain[j];
    if (node.type === "getter" && node.name === "marker") {
      markers.push({ type: "marker" });
    } else if (node.type === "call" && node.name === "markerOf") {
      if (node.args.length !== 1) {
        scanErrors.push("[truss] Unsupported pattern: markerOf() requires exactly one argument (a marker variable)");
      } else {
        markers.push({ type: "marker", markerNode: node.args[0] });
      }
    } else {
      filteredChain.push(node);
    }
  }

  // Split chain at if/else boundaries
  let i = 0;
  let currentNodes: ChainNode[] = [];
  let currentContext = cloneConditionContext(initialContext);
  let currentNodesStartContext = cloneConditionContext(initialContext);

  function flushCurrentNodes(): void {
    if (currentNodes.length === 0) {
      return;
    }

    parts.push({
      type: "unconditional",
      segments: resolveChain({ ...ctx, initialContext: currentNodesStartContext }, currentNodes),
    });
    currentNodes = [];
    currentNodesStartContext = cloneConditionContext(currentContext);
  }

  function pushCurrentNode(nodeToPush: ChainNode): void {
    if (currentNodes.length === 0) {
      currentNodesStartContext = cloneConditionContext(currentContext);
    }

    currentNodes.push(nodeToPush);
    applyModifierNodeToConditionContext(currentContext, nodeToPush, mapping);
  }

  while (i < filteredChain.length) {
    const node = filteredChain[i];
    const mediaStart = getMediaConditionalStartNode(node, mapping);
    if (mediaStart) {
      const elseIndex = findElseIndex(filteredChain, i + 1);
      if (elseIndex !== -1) {
        flushCurrentNodes();
        const branchContext = cloneConditionContext(currentContext);

        const thenNodes = mediaStart.thenNodes
          ? [...mediaStart.thenNodes, ...filteredChain.slice(i + 1, elseIndex)]
          : filteredChain.slice(i, elseIndex);
        const elseNodes = [makeMediaQueryNode(mediaStart.inverseMediaQuery), ...filteredChain.slice(elseIndex + 1)];
        const thenSegs = resolveChain({ ...ctx, initialContext: branchContext }, thenNodes);
        const elseSegs = resolveChain({ ...ctx, initialContext: branchContext }, elseNodes);
        parts.push({ type: "unconditional", segments: [...thenSegs, ...elseSegs] });
        i = filteredChain.length;
        break;
      }
    }

    if (isWhenObjectCall(node)) {
      flushCurrentNodes();
      const resolved = resolveWhenObjectSelectors(ctx, node, currentContext);
      parts.push(...resolved.parts);
      markers.push(...resolved.markers);
      nestedErrors.push(...resolved.errors);
      i++;
      continue;
    }

    if (node.type === "if") {
      // if(stringLiteral) → media query pseudo, not a boolean conditional
      if (node.conditionNode.type === "StringLiteral") {
        const mediaQuery: string = (node.conditionNode as any).value;
        pushCurrentNode({ type: "__mediaQuery" as any, mediaQuery } as any);
        i++;
        continue;
      }

      // Flush any accumulated unconditional nodes
      flushCurrentNodes();
      const branchContext = cloneConditionContext(currentContext);

      // Collect "then" nodes until "else" or end
      const thenNodes: ChainNode[] = [];
      const elseNodes: ChainNode[] = [];
      i++;
      let inElse = false;
      while (i < filteredChain.length) {
        if (filteredChain[i].type === "else") {
          inElse = true;
          i++;
          continue;
        }
        if (filteredChain[i].type === "if") {
          // Nested if — break out and let the outer loop handle it
          break;
        }
        if (inElse) {
          elseNodes.push(filteredChain[i]);
        } else {
          thenNodes.push(filteredChain[i]);
        }
        i++;
      }
      const thenSegs = resolveChain({ ...ctx, initialContext: branchContext }, thenNodes);
      const elseSegs = resolveChain({ ...ctx, initialContext: branchContext }, elseNodes);
      parts.push({
        type: "conditional",
        conditionNode: node.conditionNode,
        thenSegments: thenSegs,
        elseSegments: elseSegs,
      });
    } else {
      pushCurrentNode(node);
      i++;
    }
  }

  // Flush remaining unconditional nodes
  flushCurrentNodes();

  // Collect error messages from all resolved segments
  const segmentErrors: string[] = [];
  for (const part of parts) {
    const segs = part.type === "unconditional" ? part.segments : [...part.thenSegments, ...part.elseSegments];
    for (const seg of segs) {
      if (seg.error) {
        segmentErrors.push(seg.error);
      }
    }
  }

  return { parts, markers, errors: [...new Set([...scanErrors, ...nestedErrors, ...segmentErrors])] };
}

/** Detect `when({ ... })` so object-form selector groups can be resolved specially. */
function isWhenObjectCall(node: ChainNode): node is CallChainNode {
  return (
    node.type === "call" && node.name === "when" && node.args.length === 1 && node.args[0].type === "ObjectExpression"
  );
}

/**
 * Resolve `when({ ":hover": Css.blue.$, ... })` by recursively resolving each
 * nested `Css.*.$` value with the selector key as its initial pseudo-class.
 */
function resolveWhenObjectSelectors(
  ctx: ResolveChainCtx,
  node: CallChainNode,
  initialContext: ResolvedConditionContext,
): ResolvedChain {
  const { cssBindingName } = ctx;
  if (!cssBindingName) {
    return {
      parts: [],
      markers: [],
      errors: [new UnsupportedPatternError(`when({ ... }) requires a resolvable Css binding`).message],
    };
  }

  const objectArg = node.args[0];
  if (objectArg.type !== "ObjectExpression") {
    throw new UnsupportedPatternError(`when({ ... }) requires an object literal argument`);
  }

  const parts: ResolvedChainPart[] = [];
  const markers: MarkerSegment[] = [];
  const errors: string[] = [];

  for (const property of objectArg.properties) {
    try {
      if (property.type === "SpreadElement") {
        throw new UnsupportedPatternError(`when({ ... }) does not support spread properties`);
      }
      if (property.type !== "ObjectProperty") {
        throw new UnsupportedPatternError(`when({ ... }) only supports plain object properties`);
      }
      if (property.computed || property.key.type !== "StringLiteral") {
        throw new UnsupportedPatternError(`when({ ... }) selector keys must be string literals`);
      }

      const value = unwrapExpression(property.value as t.Expression);
      const innerChain = resolveWhenObjectValueChain(ctx, value);
      if (!innerChain) {
        throw new UnsupportedPatternError(`when({ ... }) values must be Css.*.$ expressions`);
      }

      const selectorContext = cloneConditionContext(initialContext);
      selectorContext.pseudoClass = property.key.value;
      const resolved = resolveFullChain({ ...ctx, initialContext: selectorContext }, innerChain);
      parts.push(...resolved.parts);
      markers.push(...resolved.markers);
      errors.push(...resolved.errors);
    } catch (err) {
      if (err instanceof UnsupportedPatternError) {
        errors.push(err.message);
      } else {
        throw err;
      }
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
  const { cssBindingName, resolveCssChainReference } = ctx;
  if (
    cssBindingName &&
    value.type === "MemberExpression" &&
    !value.computed &&
    value.property.type === "Identifier" &&
    value.property.name === "$"
  ) {
    return extractChain(value.object as t.Expression, cssBindingName);
  }

  return resolveCssChainReference?.(value) ?? null;
}

/** Flatten nested `when({ ... })` parts back into plain segments for `resolveChain()`. */
function flattenWhenObjectParts(resolved: ResolvedChain): ResolvedSegment[] {
  const segments: ResolvedSegment[] = [];

  // I.e. `resolveChain()` needs a flat segment list, even though `when({ ... })` is resolved via `resolveFullChain()`.
  for (const part of resolved.parts) {
    if (part.type !== "unconditional") {
      throw new UnsupportedPatternError(`when({ ... }) values cannot use if()/else in this context`);
    }

    segments.push(...part.segments);
  }

  for (const err of resolved.errors) {
    segments.push({ abbr: "__error", defs: {}, error: err });
  }

  return segments;
}

function getMediaConditionalStartNode(
  node: ChainNode,
  mapping: TrussMapping,
): { inverseMediaQuery: string; thenNodes?: ChainNode[] } | null {
  if (node.type === "if" && node.conditionNode.type === "StringLiteral") {
    return {
      inverseMediaQuery: invertMediaQuery(node.conditionNode.value),
      thenNodes: [makeMediaQueryNode(node.conditionNode.value)],
    };
  }

  if (node.type === "getter" && mapping.breakpoints && node.name in mapping.breakpoints) {
    return { inverseMediaQuery: invertMediaQuery(mapping.breakpoints[node.name]) };
  }

  return null;
}

function findElseIndex(chain: ChainNode[], start: number): number {
  for (let i = start; i < chain.length; i++) {
    if (chain[i].type === "if") {
      return -1;
    }
    if (chain[i].type === "else") {
      return i;
    }
  }
  return -1;
}

function makeMediaQueryNode(mediaQuery: string): ChainNode {
  return { type: "__mediaQuery" as any, mediaQuery } as any;
}

function invertMediaQuery(query: string): string {
  const screenPrefix = "@media screen and ";
  if (query.startsWith(screenPrefix)) {
    const conditions = query.slice(screenPrefix.length).trim();
    const rangeMatch = conditions.match(/^\(min-width: (\d+)px\) and \(max-width: (\d+)px\)$/);
    if (rangeMatch) {
      const min = Number(rangeMatch[1]);
      const max = Number(rangeMatch[2]);
      return `@media screen and (max-width: ${min - 1}px), screen and (min-width: ${max + 1}px)`;
    }
    const minMatch = conditions.match(/^\(min-width: (\d+)px\)$/);
    if (minMatch) {
      return `@media screen and (max-width: ${Number(minMatch[1]) - 1}px)`;
    }
    const maxMatch = conditions.match(/^\(max-width: (\d+)px\)$/);
    if (maxMatch) {
      return `@media screen and (min-width: ${Number(maxMatch[1]) + 1}px)`;
    }
  }
  return query.replace("@media", "@media not");
}

/**
 * Walks a Css member-expression chain (the AST between `Css` and `.$`) and
 * resolves each segment into CSS property definitions using the truss mapping.
 *
 * Returns an array of ResolvedSegment with flat defs (no condition nesting).
 * Does NOT handle if/else — use resolveFullChain for that.
 */
export function resolveChain(ctx: ResolveChainCtx, chain: ChainNode[]): ResolvedSegment[] {
  const { mapping, cssBindingName } = ctx;
  const initialContext = ctx.initialContext ?? emptyConditionContext();
  const segments: ResolvedSegment[] = [];
  const context = cloneConditionContext(initialContext);

  for (const node of chain) {
    try {
      // Synthetic media query node injected by resolveFullChain for if("@media...")
      if ((node as any).type === "__mediaQuery") {
        context.mediaQuery = (node as any).mediaQuery;
        continue;
      }

      if (node.type === "getter") {
        const abbr = node.name;

        if (abbr === "end") {
          resetConditionContext(context);
          continue;
        }

        // Pseudo-class getters: onHover, onFocus, etc.
        if (isPseudoMethod(abbr)) {
          context.pseudoClass = pseudoSelector(abbr);
          continue;
        }

        // Breakpoint getters: ifSm, ifMd, ifLg, etc.
        if (mapping.breakpoints && abbr in mapping.breakpoints) {
          context.mediaQuery = mapping.breakpoints[abbr];
          continue;
        }

        const entry = mapping.abbreviations[abbr];
        if (!entry) {
          throw new UnsupportedPatternError(`Unknown abbreviation "${abbr}"`);
        }

        const resolved = resolveEntry(
          abbr,
          entry,
          mapping,
          context.mediaQuery,
          context.pseudoClass,
          context.pseudoElement,
          context.whenPseudo,
        );
        segments.push(...resolved);
      } else if (node.type === "call") {
        const abbr = node.name;

        // Container query call: ifContainer({ gt, lt, name? })
        if (abbr === "ifContainer") {
          context.mediaQuery = containerSelectorFromCall(node);
          continue;
        }

        // with(cssProp) — compose an existing Css expression
        if (abbr === "with") {
          const seg = resolveWithCall(
            node,
            context.mediaQuery,
            context.pseudoClass,
            context.pseudoElement,
            context.whenPseudo,
          );
          segments.push(seg);
          continue;
        }

        // add(prop, value) / add({...})
        if (abbr === "add") {
          const segs = resolveAddCall(
            node,
            mapping,
            context.mediaQuery,
            context.pseudoClass,
            context.pseudoElement,
            context.whenPseudo,
          );
          segments.push(...segs);
          continue;
        }

        // Raw class passthrough, i.e. `Css.className(buttonClass).df.$`
        if (abbr === "className") {
          const seg = resolveClassNameCall(
            node,
            context.mediaQuery,
            context.pseudoClass,
            context.pseudoElement,
            context.whenPseudo,
          );
          segments.push(seg);
          continue;
        }

        // Raw inline style passthrough, i.e. `Css.mt(x).style(vars).$`
        if (abbr === "style") {
          const seg = resolveStyleCall(
            node,
            context.mediaQuery,
            context.pseudoClass,
            context.pseudoElement,
            context.whenPseudo,
          );
          segments.push(seg);
          continue;
        }

        if (abbr === "typography") {
          const resolved = resolveTypographyCall(
            node,
            mapping,
            context.mediaQuery,
            context.pseudoClass,
            context.pseudoElement,
            context.whenPseudo,
          );
          segments.push(...resolved);
          continue;
        }

        // Pseudo-element: element("::placeholder") etc.
        if (abbr === "element") {
          if (node.args.length !== 1 || node.args[0].type !== "StringLiteral") {
            throw new UnsupportedPatternError(
              `element() requires exactly one string literal argument (e.g. "::placeholder")`,
            );
          }
          context.pseudoElement = (node.args[0] as any).value;
          continue;
        }

        // Generic when(selector) or when(marker, relationship, pseudo)
        if (abbr === "when") {
          if (isWhenObjectCall(node)) {
            const resolved = resolveWhenObjectSelectors(ctx, node, context);
            segments.push(...flattenWhenObjectParts(resolved));
            continue;
          }

          const resolved = resolveWhenCall(node);
          if (resolved.kind === "selector") {
            context.pseudoClass = resolved.pseudo;
          } else {
            context.whenPseudo = resolved;
          }
          continue;
        }

        // Simple pseudo-class calls (backward compat — pseudos are now getters)
        if (isPseudoMethod(abbr)) {
          context.pseudoClass = pseudoSelector(abbr);
          if (node.args.length > 0) {
            throw new UnsupportedPatternError(
              `${abbr}() does not take arguments -- use when(marker, "ancestor", ":hover") for relationship selectors`,
            );
          }
          continue;
        }

        const entry = mapping.abbreviations[abbr];
        if (!entry) {
          throw new UnsupportedPatternError(`Unknown abbreviation "${abbr}"`);
        }

        if (entry.kind === "variable") {
          const seg = resolveVariableCall(
            abbr,
            entry,
            node,
            mapping,
            context.mediaQuery,
            context.pseudoClass,
            context.pseudoElement,
            context.whenPseudo,
          );
          segments.push(seg);
        } else if (entry.kind === "delegate") {
          const seg = resolveDelegateCall(
            abbr,
            entry,
            node,
            mapping,
            context.mediaQuery,
            context.pseudoClass,
            context.pseudoElement,
            context.whenPseudo,
          );
          segments.push(seg);
        } else {
          throw new UnsupportedPatternError(`Abbreviation "${abbr}" is ${entry.kind}, cannot be called as a function`);
        }
      }
    } catch (err) {
      if (err instanceof UnsupportedPatternError) {
        segments.push({ abbr: "__error", defs: {}, error: err.message });
      } else {
        throw err;
      }
    }
  }

  return segments;
}

/**
 * Build a typography lookup key suffix from condition context.
 *
 * I.e. `typography(key)` → `"typography"`, `ifSm.typography(key)` → `"typography__sm"`.
 */
function typographyLookupKeySuffix(
  mediaQuery: string | null,
  pseudoClass: string | null,
  pseudoElement: string | null,
  whenPseudo: WhenCondition | null,
  breakpoints?: Record<string, string>,
): string {
  const parts: string[] = [];
  if (pseudoElement) parts.push(pseudoElement.replace(/^::/, ""));
  if (mediaQuery && breakpoints) {
    const bp = Object.entries(breakpoints).find(([, v]) => v === mediaQuery)?.[0];
    parts.push(bp ? bp.replace(/^if/, "").replace(/^./, (c) => c.toLowerCase()) : "mq");
  } else if (mediaQuery) {
    parts.push("mq");
  }
  if (pseudoClass) parts.push(pseudoClass.replace(/^:+/, "").replace(/-/g, "_"));
  if (whenPseudo) parts.push(whenLookupKeyPart(whenPseudo));
  return parts.join("_");
}

function whenLookupKeyPart(whenPseudo: WhenCondition): string {
  const parts = ["when", whenPseudo.relationship ?? "ancestor", sanitizeLookupToken(whenPseudo.pseudo)];

  if (whenPseudo.markerNode?.type === "Identifier" && whenPseudo.markerNode.name) {
    parts.push(whenPseudo.markerNode.name);
  }

  return parts.join("_");
}

function sanitizeLookupToken(value: string): string {
  return (
    value
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") || "value"
  );
}

/** Resolve `typography(key)` into either direct segments or a runtime lookup-backed segment. */
function resolveTypographyCall(
  node: CallChainNode,
  mapping: TrussMapping,
  mediaQuery: string | null,
  pseudoClass: string | null,
  pseudoElement: string | null,
  whenPseudo: WhenCondition | null,
): ResolvedSegment[] {
  if (node.args.length !== 1) {
    throw new UnsupportedPatternError(`typography() expects exactly 1 argument, got ${node.args.length}`);
  }

  const argAst = node.args[0];
  if (argAst.type === "StringLiteral") {
    return resolveTypographyEntry(argAst.value, mapping, mediaQuery, pseudoClass, pseudoElement, whenPseudo);
  }

  const typography = mapping.typography ?? [];
  if (typography.length === 0) {
    throw new UnsupportedPatternError(`typography() is unavailable because no typography abbreviations were generated`);
  }

  const suffix = typographyLookupKeySuffix(mediaQuery, pseudoClass, pseudoElement, whenPseudo, mapping.breakpoints);
  const lookupKey = suffix ? `typography__${suffix}` : "typography";
  const segmentsByName: Record<string, ResolvedSegment[]> = {};

  for (const name of typography) {
    segmentsByName[name] = resolveTypographyEntry(name, mapping, mediaQuery, pseudoClass, pseudoElement, whenPseudo);
  }

  return [
    {
      abbr: lookupKey,
      defs: {},
      typographyLookup: {
        lookupKey,
        argNode: argAst,
        segmentsByName,
      },
    },
  ];
}

/** Resolve a single typography abbreviation name within the current condition context. */
function resolveTypographyEntry(
  name: string,
  mapping: TrussMapping,
  mediaQuery: string | null,
  pseudoClass: string | null,
  pseudoElement: string | null,
  whenPseudo: WhenCondition | null,
): ResolvedSegment[] {
  if (!(mapping.typography ?? []).includes(name)) {
    throw new UnsupportedPatternError(`Unknown typography abbreviation "${name}"`);
  }

  const entry = mapping.abbreviations[name];
  if (!entry) {
    throw new UnsupportedPatternError(`Unknown typography abbreviation "${name}"`);
  }

  const resolved = resolveEntry(name, entry, mapping, mediaQuery, pseudoClass, pseudoElement, whenPseudo);
  for (const segment of resolved) {
    if (segment.variableProps) {
      throw new UnsupportedPatternError(`Typography abbreviation "${name}" cannot require runtime arguments`);
    }
  }
  return resolved;
}

/** Resolve a static or alias entry (from a getter access). Defs are always flat. */
function resolveEntry(
  abbr: string,
  entry: TrussMappingEntry,
  mapping: TrussMapping,
  mediaQuery: string | null,
  pseudoClass: string | null,
  pseudoElement: string | null,
  whenPseudo: WhenCondition | null,
): ResolvedSegment[] {
  const context: ResolvedConditionContext = {
    mediaQuery,
    pseudoClass,
    pseudoElement,
    whenPseudo,
  };

  switch (entry.kind) {
    case "static": {
      return [segmentWithConditionContext({ abbr, defs: entry.defs }, context)];
    }
    case "alias": {
      const result: ResolvedSegment[] = [];
      for (const chainAbbr of entry.chain) {
        const subEntry = mapping.abbreviations[chainAbbr];
        if (!subEntry) {
          throw new UnsupportedPatternError(`Alias "${abbr}" references unknown abbreviation "${chainAbbr}"`);
        }
        result.push(...resolveEntry(chainAbbr, subEntry, mapping, mediaQuery, pseudoClass, pseudoElement, whenPseudo));
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

/** Resolve a variable (parameterized) call like mt(2) or mt(x). */
function resolveVariableCall(
  abbr: string,
  entry: { kind: "variable"; props: string[]; incremented: boolean; extraDefs?: Record<string, unknown> },
  node: CallChainNode,
  mapping: TrussMapping,
  mediaQuery: string | null,
  pseudoClass: string | null,
  pseudoElement: string | null,
  whenPseudo: WhenCondition | null,
): ResolvedSegment {
  if (node.args.length !== 1) {
    throw new UnsupportedPatternError(`${abbr}() expects exactly 1 argument, got ${node.args.length}`);
  }
  const literalValue = tryEvaluateLiteral(node.args[0], entry.incremented, mapping.increment);
  return buildParameterizedSegment({
    abbr,
    props: entry.props,
    incremented: entry.incremented,
    extraDefs: entry.extraDefs,
    argAst: node.args[0],
    literalValue,
    mediaQuery,
    pseudoClass,
    pseudoElement,
    whenPseudo,
  });
}

/** Resolve a delegate call like mtPx(12). */
function resolveDelegateCall(
  abbr: string,
  entry: { kind: "delegate"; target: string },
  node: CallChainNode,
  mapping: TrussMapping,
  mediaQuery: string | null,
  pseudoClass: string | null,
  pseudoElement: string | null,
  whenPseudo: WhenCondition | null,
): ResolvedSegment {
  const targetEntry = mapping.abbreviations[entry.target];
  if (!targetEntry || targetEntry.kind !== "variable") {
    throw new UnsupportedPatternError(`Delegate "${abbr}" targets "${entry.target}" which is not a variable entry`);
  }
  if (node.args.length !== 1) {
    throw new UnsupportedPatternError(`${abbr}() expects exactly 1 argument, got ${node.args.length}`);
  }
  const literalValue = tryEvaluatePxLiteral(node.args[0]);
  // Use the target abbreviation name for delegate segments (i.e. mtPx → mt)
  return buildParameterizedSegment({
    abbr: entry.target,
    props: targetEntry.props,
    incremented: false,
    appendPx: true,
    extraDefs: targetEntry.extraDefs,
    argAst: node.args[0],
    literalValue,
    mediaQuery,
    pseudoClass,
    pseudoElement,
    whenPseudo,
  });
}

/** Shared builder for variable and delegate call segments. */
function buildParameterizedSegment(params: {
  abbr: string;
  props: string[];
  incremented: boolean;
  appendPx?: boolean;
  extraDefs?: Record<string, unknown>;
  argAst: t.Expression | t.SpreadElement;
  literalValue: string | null;
  mediaQuery: string | null;
  pseudoClass: string | null;
  pseudoElement: string | null;
  whenPseudo: WhenCondition | null;
}): ResolvedSegment {
  const { abbr, props, incremented, appendPx, extraDefs, argAst, literalValue, whenPseudo } = params;
  const context: ResolvedConditionContext = {
    mediaQuery: params.mediaQuery,
    pseudoClass: params.pseudoClass,
    pseudoElement: params.pseudoElement,
    whenPseudo,
  };

  if (literalValue !== null) {
    const defs: Record<string, unknown> = {};
    for (const prop of props) {
      defs[prop] = literalValue;
    }
    if (extraDefs) Object.assign(defs, extraDefs);
    return segmentWithConditionContext({ abbr, defs, argResolved: literalValue }, context);
  }

  const base = segmentWithConditionContext(
    {
      abbr,
      defs: {},
      variableProps: props,
      incremented,
      variableExtraDefs: extraDefs,
      argNode: argAst,
    },
    context,
  );
  if (appendPx) base.appendPx = true;
  return base;
}

function resolveClassNameCall(
  node: CallChainNode,
  mediaQuery: string | null,
  pseudoClass: string | null,
  pseudoElement: string | null,
  whenPseudo: WhenCondition | null,
): ResolvedSegment {
  if (node.args.length !== 1) {
    throw new UnsupportedPatternError(`className() expects exactly 1 argument, got ${node.args.length}`);
  }

  const arg = node.args[0];
  if (arg.type === "SpreadElement") {
    throw new UnsupportedPatternError(`className() does not support spread arguments`);
  }

  if (mediaQuery || pseudoClass || pseudoElement || whenPseudo) {
    // I.e. `ifSm.className("x")` cannot be represented as a runtime-only class append.
    throw new UnsupportedPatternError(
      `className() cannot be used inside media query, pseudo-class, pseudo-element, or when() contexts`,
    );
  }

  return {
    // I.e. this is metadata for the rewriter/runtime, not an atomic CSS rule.
    abbr: "className",
    defs: {},
    classNameArg: arg,
  };
}

function resolveStyleCall(
  node: CallChainNode,
  mediaQuery: string | null,
  pseudoClass: string | null,
  pseudoElement: string | null,
  whenPseudo: WhenCondition | null,
): ResolvedSegment {
  if (node.args.length !== 1) {
    throw new UnsupportedPatternError(`style() expects exactly 1 argument, got ${node.args.length}`);
  }

  const arg = node.args[0];
  if (arg.type === "SpreadElement") {
    throw new UnsupportedPatternError(`style() does not support spread arguments`);
  }

  if (mediaQuery || pseudoClass || pseudoElement || whenPseudo) {
    throw new UnsupportedPatternError(
      `style() cannot be used inside media query, pseudo-class, pseudo-element, or when() contexts`,
    );
  }

  return {
    abbr: "style",
    defs: {},
    styleArg: arg,
  };
}

/**
 * Resolve a `with(cssProp)` call — compose an existing Css expression or partial
 * style hash into the chain.
 *
 * - `with(expr)` — spread an existing Css expression into the chain output
 * - `with({ height })` — inline a partial style hash, skipping undefined values
 */
function resolveWithCall(
  node: CallChainNode,
  mediaQuery: string | null,
  pseudoClass: string | null,
  pseudoElement: string | null,
  whenPseudo: WhenCondition | null,
): ResolvedSegment {
  if (node.args.length !== 1) {
    throw new UnsupportedPatternError(`with() requires exactly 1 argument`);
  }
  const styleArg = node.args[0];
  if (styleArg.type === "SpreadElement") {
    throw new UnsupportedPatternError(`with() does not support spread arguments`);
  }
  // Object literal: skip undefined values (the old addCss({ height }) pattern)
  if (styleArg.type === "ObjectExpression") {
    return {
      abbr: "__composed_css_prop",
      defs: {},
      styleArrayArg: styleArg,
      isAddCss: true,
    };
  }
  return {
    abbr: "__composed_css_prop",
    defs: {},
    styleArrayArg: styleArg,
  };
}

/**
 * Resolve an `add(...)` call.
 *
 * Supported overloads:
 * - `add({ prop: value, ... })` to add real CSS property/value pairs (alias for multiple add calls)
 * - `add("propName", value)` for an arbitrary CSS property/value pair
 */
function resolveAddCall(
  node: CallChainNode,
  mapping: TrussMapping,
  mediaQuery: string | null,
  pseudoClass: string | null,
  pseudoElement: string | null,
  whenPseudo: WhenCondition | null,
): ResolvedSegment[] {
  const context: ResolvedConditionContext = {
    mediaQuery,
    pseudoClass,
    pseudoElement,
    whenPseudo,
  };

  if (node.args.length === 1) {
    const styleArg = node.args[0];
    if (styleArg.type === "SpreadElement") {
      throw new UnsupportedPatternError(`add() does not support spread arguments`);
    }
    if (styleArg.type === "ObjectExpression") {
      // New behavior: expand object literal into individual property/value segments
      return resolveAddObjectLiteral(styleArg as any, mapping, context);
    }
    throw new UnsupportedPatternError(
      `add() requires 1 or 2 arguments (property name and value, or an object literal), got ${node.args.length}. ` +
        `Supported overloads are add({ prop: value }), add("propName", value), and with(cssProp)`,
    );
  }

  if (node.args.length !== 2) {
    throw new UnsupportedPatternError(
      `add() requires 1 or 2 arguments (property name and value, or an object literal), got ${node.args.length}. ` +
        `Supported overloads are add({ prop: value }), add("propName", value), and with(cssProp)`,
    );
  }

  const propArg = node.args[0];
  if (propArg.type !== "StringLiteral") {
    throw new UnsupportedPatternError(`add() first argument must be a string literal property name`);
  }
  const propName: string = (propArg as any).value;

  const valueArg = node.args[1];
  const literalValue = tryEvaluateAddLiteral(valueArg);

  if (literalValue !== null) {
    return [segmentWithConditionContext(
      { abbr: propName, defs: { [propName]: literalValue }, argResolved: literalValue },
      context,
    )];
  }

  return [segmentWithConditionContext(
    {
      abbr: propName,
      defs: {},
      variableProps: [propName],
      incremented: false,
      argNode: valueArg,
    },
    context,
  )];
}

/**
 * Expand an `add({ prop1: value1, prop2: value2 })` object literal into individual segments,
 * as if the user had called `add("prop1", value1).add("prop2", value2)`.
 *
 * When a property/value pair matches an existing abbreviation in the mapping (e.g.
 * `{ display: "grid" }` → `dg`), the canonical abbreviation is reused.
 */
function resolveAddObjectLiteral(
  obj: import("@babel/types").ObjectExpression,
  mapping: TrussMapping,
  context: ResolvedConditionContext,
): ResolvedSegment[] {
  const segments: ResolvedSegment[] = [];
  for (const property of obj.properties) {
    if (property.type === "SpreadElement") {
      throw new UnsupportedPatternError(`add({...}) does not support spread properties -- use with() instead`);
    }
    if (property.type !== "ObjectProperty" || property.computed) {
      throw new UnsupportedPatternError(`add({...}) only supports simple property keys`);
    }
    let propName: string;
    if (property.key.type === "Identifier") {
      propName = property.key.name;
    } else if (property.key.type === "StringLiteral") {
      propName = (property.key as any).value;
    } else {
      throw new UnsupportedPatternError(`add({...}) property keys must be identifiers or string literals`);
    }
    const valueNode = property.value;
    const literalValue = tryEvaluateAddLiteral(valueNode as any);
    if (literalValue !== null) {
      // Check if this prop/value matches an existing abbreviation in the mapping
      const canonicalAbbr = findCanonicalAbbreviation(mapping, propName, literalValue);
      if (canonicalAbbr) {
        const entry = mapping.abbreviations[canonicalAbbr];
        segments.push(segmentWithConditionContext(
          { abbr: canonicalAbbr, defs: (entry as any).defs },
          context,
        ));
      } else {
        segments.push(segmentWithConditionContext(
          { abbr: propName, defs: { [propName]: literalValue }, argResolved: literalValue },
          context,
        ));
      }
    } else {
      segments.push(segmentWithConditionContext(
        { abbr: propName, defs: {}, variableProps: [propName], incremented: false, argNode: valueNode },
        context,
      ));
    }
  }
  return segments;
}

/** Find a canonical abbreviation whose static defs exactly match `{ prop: value }`. */
function findCanonicalAbbreviation(mapping: TrussMapping, prop: string, value: string): string | null {
  return getLonghandLookup(mapping).get(`${prop}\0${value}`) ?? null;
}

/** Try to evaluate a literal for add() — strings, numbers, and template literals with no expressions. */
function tryEvaluateAddLiteral(node: t.Expression | t.SpreadElement): string | null {
  if (node.type === "StringLiteral") {
    return (node as any).value;
  }
  if (node.type === "NumericLiteral") {
    return String((node as any).value);
  }
  if (node.type === "UnaryExpression" && node.operator === "-" && node.argument.type === "NumericLiteral") {
    return String(-(node.argument as any).value);
  }
  return null;
}

const WHEN_RELATIONSHIPS = new Set(["ancestor", "descendant", "anySibling", "siblingBefore", "siblingAfter"]);

/**
 * Resolve a `when(selector)` or `when(marker, relationship, pseudo)` call.
 *
 * - 1 arg: `when(":hover")` — same-element selector, must be a string literal
 * - 3 args: `when(marker, "ancestor", ":hover")` — marker must be a marker variable or
 *   the shared `marker` token, relationship/pseudo must be string literals
 */
function resolveWhenCall(
  node: CallChainNode,
):
  | { kind: "selector"; pseudo: string }
  | { kind: "relationship"; pseudo: string; markerNode?: any; relationship: string } {
  if (node.args.length !== 1 && node.args.length !== 3) {
    throw new UnsupportedPatternError(
      `when() expects 1 or 3 arguments (selector) or (marker, relationship, pseudo), got ${node.args.length}`,
    );
  }

  if (node.args.length === 1) {
    const pseudoArg = node.args[0];
    if (pseudoArg.type !== "StringLiteral") {
      throw new UnsupportedPatternError(`when() selector must be a string literal`);
    }
    return { kind: "selector", pseudo: (pseudoArg as any).value };
  }

  const markerArg = node.args[0];
  const markerNode = resolveWhenMarker(markerArg);
  const relationshipArg = node.args[1];
  if (relationshipArg.type !== "StringLiteral") {
    throw new UnsupportedPatternError(`when() relationship argument must be a string literal`);
  }
  const relationship: string = (relationshipArg as any).value;
  if (!WHEN_RELATIONSHIPS.has(relationship)) {
    throw new UnsupportedPatternError(
      `when() relationship must be one of: ${[...WHEN_RELATIONSHIPS].join(", ")} -- got "${relationship}"`,
    );
  }

  const pseudoArg = node.args[2];
  if (pseudoArg.type !== "StringLiteral") {
    throw new UnsupportedPatternError(`when() pseudo selector (3rd argument) must be a string literal`);
  }
  return { kind: "relationship", pseudo: (pseudoArg as any).value, markerNode, relationship };
}

function resolveWhenMarker(node: t.Expression | t.SpreadElement): any | undefined {
  if (isDefaultMarkerNode(node)) {
    return undefined;
  }
  if (node.type === "Identifier") {
    return node;
  }
  throw new UnsupportedPatternError(`when() marker must be a marker variable or marker`);
}

function isDefaultMarkerNode(node: t.Expression | t.SpreadElement): boolean {
  if (node.type === "Identifier" && (node.name === "marker" || node.name === "defaultMarker")) {
    return true;
  }
  return isLegacyDefaultMarkerExpression(node);
}

function isLegacyDefaultMarkerExpression(node: t.Expression | t.SpreadElement): boolean {
  return (
    node.type === "CallExpression" &&
    node.arguments.length === 0 &&
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.property.type === "Identifier" &&
    node.callee.property.name === "defaultMarker"
  );
}

// ── Helpers ───────────────────────────────────────────────────────────

const PSEUDO_METHODS: Record<string, string> = {
  onHover: ":hover",
  onFocus: ":focus",
  onFocusVisible: ":focus-visible",
  onFocusWithin: ":focus-within",
  onActive: ":active",
  onDisabled: ":disabled",
  ifFirstOfType: ":first-of-type",
  ifLastOfType: ":last-of-type",
};

function isPseudoMethod(name: string): boolean {
  return name in PSEUDO_METHODS;
}

function pseudoSelector(name: string): string {
  return PSEUDO_METHODS[name];
}

/**
 * Try to evaluate a literal AST node to a string value.
 * For incremented entries, also evaluates `maybeInc(literal)`.
 */
function tryEvaluateLiteral(
  node: t.Expression | t.SpreadElement,
  incremented: boolean,
  increment: number,
): string | null {
  if (node.type === "NumericLiteral") {
    if (incremented) {
      return `${node.value * increment}px`;
    }
    return String(node.value);
  }
  if (node.type === "StringLiteral") {
    return node.value;
  }
  if (node.type === "UnaryExpression" && node.operator === "-" && node.argument.type === "NumericLiteral") {
    const val = -node.argument.value;
    if (incremented) {
      return `${val * increment}px`;
    }
    return String(val);
  }
  return null;
}

/** Try to evaluate a Px delegate argument (always a number → `${n}px`). */
function tryEvaluatePxLiteral(node: t.Expression | t.SpreadElement): string | null {
  if (node.type === "NumericLiteral") {
    return `${node.value}px`;
  }
  return null;
}

/** Resolve ifContainer({ gt, lt, name? }) to a container query pseudo key. */
function containerSelectorFromCall(node: CallChainNode): string {
  if (node.args.length !== 1) {
    throw new UnsupportedPatternError(`ifContainer() expects exactly 1 argument, got ${node.args.length}`);
  }

  const arg = node.args[0];
  if (!arg || arg.type !== "ObjectExpression") {
    throw new UnsupportedPatternError("ifContainer() expects an object literal argument");
  }

  let lt: number | undefined;
  let gt: number | undefined;
  let name: string | undefined;

  for (const prop of arg.properties) {
    if (prop.type === "SpreadElement") {
      throw new UnsupportedPatternError("ifContainer() does not support spread properties");
    }
    if (prop.type !== "ObjectProperty" || prop.computed) {
      throw new UnsupportedPatternError("ifContainer() expects plain object properties");
    }

    const key = objectPropertyName(prop.key);
    if (!key) {
      throw new UnsupportedPatternError("ifContainer() only supports identifier/string keys");
    }

    const valueNode = prop.value as t.Expression | t.SpreadElement;

    if (key === "lt") {
      lt = numericLiteralValue(valueNode, "ifContainer().lt must be a numeric literal");
      continue;
    }
    if (key === "gt") {
      gt = numericLiteralValue(valueNode, "ifContainer().gt must be a numeric literal");
      continue;
    }
    if (key === "name") {
      name = stringLiteralValue(valueNode, "ifContainer().name must be a string literal");
      continue;
    }

    throw new UnsupportedPatternError(`ifContainer() does not support property "${key}"`);
  }

  if (lt === undefined && gt === undefined) {
    throw new UnsupportedPatternError('ifContainer() requires at least one of "lt" or "gt"');
  }

  const parts: string[] = [];
  if (gt !== undefined) {
    parts.push(`(min-width: ${gt + 1}px)`);
  }
  if (lt !== undefined) {
    parts.push(`(max-width: ${lt}px)`);
  }

  const query = parts.join(" and ");
  const namePrefix = name ? `${name} ` : "";
  return `@container ${namePrefix}${query}`;
}

function objectPropertyName(node: t.Expression | t.Identifier | t.PrivateName): string | null {
  if (node.type === "Identifier") return node.name;
  if (node.type === "StringLiteral") return node.value;
  return null;
}

/** Unwrap TS/paren wrappers so nested `when({ ... })` values can be validated uniformly. */
function unwrapExpression(node: t.Expression): t.Expression {
  let current = node;

  while (true) {
    if (
      current.type === "ParenthesizedExpression" ||
      current.type === "TSAsExpression" ||
      current.type === "TSTypeAssertion" ||
      current.type === "TSNonNullExpression" ||
      current.type === "TSSatisfiesExpression"
    ) {
      current = current.expression;
      continue;
    }

    return current;
  }
}

function numericLiteralValue(node: t.Expression | t.SpreadElement, errorMessage: string): number {
  if (node.type === "NumericLiteral") {
    return node.value;
  }
  if (node.type === "UnaryExpression" && node.operator === "-" && node.argument.type === "NumericLiteral") {
    return -node.argument.value;
  }
  throw new UnsupportedPatternError(errorMessage);
}

function stringLiteralValue(node: t.Expression | t.SpreadElement, errorMessage: string): string {
  if (node.type === "StringLiteral") {
    return node.value;
  }
  if (node.type === "TemplateLiteral" && node.expressions.length === 0 && node.quasis.length === 1) {
    return node.quasis[0].value.cooked ?? "";
  }
  throw new UnsupportedPatternError(errorMessage);
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
  conditionNode: t.Expression | t.SpreadElement;
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
