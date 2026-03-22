import type * as t from "@babel/types";
import type { TrussMapping, TrussMappingEntry, ResolvedSegment, MarkerSegment } from "./types";

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
 *   produces `{ color: { default: null, ":hover": { default: null, "@media...": value } } }`.
 *
 * - **`onHover`**, **`onFocus`**, etc. — Pseudo-class getters. Set the
 *   pseudo-class context. Stacks with media queries (see above). A new
 *   pseudo-class replaces the previous one.
 *
 * - **`element("::placeholder")`** — Pseudo-element. Sets the pseudo-element
 *   context. Wraps subsequent defs in a top-level namespace key:
 *   `{ "::placeholder": { color: value } }`. Stacks with pseudo-classes
 *   and media queries inside the pseudo-element.
 *
 * - **`when("ancestor", ":hover")`** — StyleX `when` API. Resets both media
 *   query and pseudo-class contexts. Uses `stylex.when.<relationship>()`
 *   computed keys.
 *
 * - **`ifContainer({ gt, lt })`** — Container query. Sets the media query
 *   context to an `@container` query string.
 *
 * Contexts accumulate left-to-right until explicitly replaced. A media query
 * set by `ifSm` persists through `onHover` (they stack). A new `if(bool)`
 * resets all contexts for its branches.
 */
export function resolveFullChain(
  chain: ChainNode[],
  mapping: TrussMapping,
  options?: { skipMerge?: boolean },
): ResolvedChain {
  const parts: ResolvedChainPart[] = [];
  const markers: MarkerSegment[] = [];

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

  while (i < filteredChain.length) {
    const node = filteredChain[i];
    if (node.type === "if") {
      // if(stringLiteral) → media query pseudo, not a boolean conditional
      if (node.conditionNode.type === "StringLiteral") {
        const mediaQuery: string = (node.conditionNode as any).value;
        // Inject a synthetic "media query pseudo" into the current unconditional nodes.
        // This works by creating a synthetic call node that resolveChain's pseudo handling
        // can recognize — but it's simpler to just inject it as a special marker.
        currentNodes.push({ type: "__mediaQuery" as any, mediaQuery } as any);
        i++;
        continue;
      }

      // Flush any accumulated unconditional nodes
      if (currentNodes.length > 0) {
        const unconditionalSegs = resolveChain(currentNodes, mapping);
        parts.push({
          type: "unconditional",
          segments: options?.skipMerge ? unconditionalSegs : mergeOverlappingConditions(unconditionalSegs),
        });
        currentNodes = [];
      }
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
      const thenSegs = resolveChain(thenNodes, mapping);
      const elseSegs = resolveChain(elseNodes, mapping);
      parts.push({
        type: "conditional",
        conditionNode: node.conditionNode,
        thenSegments: options?.skipMerge ? thenSegs : mergeOverlappingConditions(thenSegs),
        elseSegments: options?.skipMerge ? elseSegs : mergeOverlappingConditions(elseSegs),
      });
    } else {
      currentNodes.push(node);
      i++;
    }
  }

  // Flush remaining unconditional nodes
  if (currentNodes.length > 0) {
    const remainingSegs = resolveChain(currentNodes, mapping);
    parts.push({
      type: "unconditional",
      segments: options?.skipMerge ? remainingSegs : mergeOverlappingConditions(remainingSegs),
    });
  }

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

  return { parts, markers, errors: [...scanErrors, ...segmentErrors] };
}

/**
 * Walks a Css member-expression chain (the AST between `Css` and `.$`) and
 * resolves each segment into CSS property definitions using the truss mapping.
 *
 * Returns an array of ResolvedSegment, or throws if a pattern is unsupported.
 * Does NOT handle if/else — use resolveFullChain for that.
 */
export function resolveChain(chain: ChainNode[], mapping: TrussMapping): ResolvedSegment[] {
  const segments: ResolvedSegment[] = [];
  // Track media query and pseudo-class separately so they can stack.
  // e.g. Css.ifSm.onHover.blue.$ → both mediaQuery and pseudoClass are set
  let currentMediaQuery: string | null = null;
  let currentPseudoClass: string | null = null;
  let currentPseudoElement: string | null = null;
  let currentWhenPseudo: { pseudo: string; markerNode?: any; relationship?: string } | null = null;

  for (const node of chain) {
    try {
      // Synthetic media query node injected by resolveFullChain for if("@media...")
      if ((node as any).type === "__mediaQuery") {
        currentMediaQuery = (node as any).mediaQuery;
        currentWhenPseudo = null;
        continue;
      }

      if (node.type === "getter") {
        const abbr = node.name;

        // Pseudo-class getters: onHover, onFocus, etc.
        if (isPseudoMethod(abbr)) {
          currentPseudoClass = pseudoSelector(abbr);
          currentWhenPseudo = null;
          continue;
        }

        // Breakpoint getters: ifSm, ifMd, ifLg, etc.
        if (mapping.breakpoints && abbr in mapping.breakpoints) {
          currentMediaQuery = mapping.breakpoints[abbr];
          currentWhenPseudo = null;
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
          currentMediaQuery,
          currentPseudoClass,
          currentPseudoElement,
          currentWhenPseudo,
        );
        segments.push(...resolved);
      } else if (node.type === "call") {
        const abbr = node.name;

        // Container query call: ifContainer({ gt, lt, name? })
        if (abbr === "ifContainer") {
          currentMediaQuery = containerSelectorFromCall(node);
          currentWhenPseudo = null;
          continue;
        }

        // add(prop, value) — arbitrary CSS property
        if (abbr === "add") {
          const seg = resolveAddCall(
            node,
            mapping,
            currentMediaQuery,
            currentPseudoClass,
            currentPseudoElement,
            currentWhenPseudo,
          );
          segments.push(seg);
          continue;
        }

        if (abbr === "typography") {
          const resolved = resolveTypographyCall(
            node,
            mapping,
            currentMediaQuery,
            currentPseudoClass,
            currentPseudoElement,
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
          currentPseudoElement = (node.args[0] as any).value;
          continue;
        }

        // Generic when(relationship, pseudo) or when(relationship, marker, pseudo)
        if (abbr === "when") {
          const resolved = resolveWhenCall(node);
          currentPseudoClass = null;
          currentMediaQuery = null;
          currentWhenPseudo = resolved;
          continue;
        }

        // Simple pseudo-class calls (backward compat — pseudos are now getters)
        if (isPseudoMethod(abbr)) {
          currentPseudoClass = pseudoSelector(abbr);
          currentWhenPseudo = null;
          if (node.args.length > 0) {
            throw new UnsupportedPatternError(
              `${abbr}() does not take arguments -- use when("ancestor", ":hover") for relationship pseudos`,
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
            currentMediaQuery,
            currentPseudoClass,
            currentPseudoElement,
            currentWhenPseudo,
          );
          segments.push(seg);
        } else if (entry.kind === "delegate") {
          const seg = resolveDelegateCall(
            abbr,
            entry,
            node,
            mapping,
            currentMediaQuery,
            currentPseudoClass,
            currentPseudoElement,
            currentWhenPseudo,
          );
          segments.push(seg);
        } else {
          throw new UnsupportedPatternError(`Abbreviation "${abbr}" is ${entry.kind}, cannot be called as a function`);
        }
      }
    } catch (err) {
      if (err instanceof UnsupportedPatternError) {
        segments.push({ key: "__error", defs: {}, error: err.message });
      } else {
        throw err;
      }
    }
  }

  return segments;
}

/** Build the stylex.create key suffix from mediaQuery, pseudoClass, and/or pseudoElement. */
export function conditionKeySuffix(
  mediaQuery: string | null,
  pseudoClass: string | null,
  pseudoElement: string | null,
  breakpoints?: Record<string, string>,
): string {
  const parts: string[] = [];
  if (pseudoElement) parts.push(pseudoName(pseudoElement));
  if (mediaQuery) parts.push(pseudoName(mediaQuery, breakpoints));
  if (pseudoClass) parts.push(pseudoName(pseudoClass));
  return parts.join("_");
}

/** Resolve `typography(key)` into either direct segments or a runtime lookup-backed segment. */
function resolveTypographyCall(
  node: CallChainNode,
  mapping: TrussMapping,
  mediaQuery: string | null,
  pseudoClass: string | null,
  pseudoElement: string | null,
): ResolvedSegment[] {
  if (node.args.length !== 1) {
    throw new UnsupportedPatternError(`typography() expects exactly 1 argument, got ${node.args.length}`);
  }

  const argAst = node.args[0];
  if (argAst.type === "StringLiteral") {
    return resolveTypographyEntry(argAst.value, mapping, mediaQuery, pseudoClass, pseudoElement);
  }

  const typography = mapping.typography ?? [];
  if (typography.length === 0) {
    throw new UnsupportedPatternError(`typography() is unavailable because no typography abbreviations were generated`);
  }

  const suffix = conditionKeySuffix(mediaQuery, pseudoClass, pseudoElement, mapping.breakpoints);
  const lookupKey = suffix ? `typography__${suffix}` : "typography";
  const segmentsByName: Record<string, ResolvedSegment[]> = {};

  for (const name of typography) {
    segmentsByName[name] = resolveTypographyEntry(name, mapping, mediaQuery, pseudoClass, pseudoElement);
  }

  return [
    {
      key: lookupKey,
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
): ResolvedSegment[] {
  if (!(mapping.typography ?? []).includes(name)) {
    throw new UnsupportedPatternError(`Unknown typography abbreviation "${name}"`);
  }

  const entry = mapping.abbreviations[name];
  if (!entry) {
    throw new UnsupportedPatternError(`Unknown typography abbreviation "${name}"`);
  }

  const resolved = resolveEntry(name, entry, mapping, mediaQuery, pseudoClass, pseudoElement, null);
  for (const segment of resolved) {
    if (segment.variableProps || segment.whenPseudo) {
      throw new UnsupportedPatternError(`Typography abbreviation "${name}" cannot require runtime arguments`);
    }
  }
  return resolved;
}

/**
 * Wrap raw CSS defs with condition nesting for StyleX.
 *
 * - mediaQuery only:    `{ prop: { default: null, "@media...": value } }`
 * - pseudoClass only:   `{ prop: { default: null, ":hover": value } }`
 * - both (stacked):     `{ prop: { default: null, ":hover": { default: null, "@media...": value } } }`
 */
function wrapDefsWithConditions(
  defs: Record<string, unknown>,
  mediaQuery: string | null,
  pseudoClass: string | null,
): Record<string, unknown> {
  if (!mediaQuery && !pseudoClass) return defs;
  const result: Record<string, unknown> = {};
  for (const [prop, value] of Object.entries(defs)) {
    if (pseudoClass && mediaQuery) {
      result[prop] = { default: null, [pseudoClass]: { default: null, [mediaQuery]: value } };
    } else if (pseudoClass) {
      result[prop] = { default: null, [pseudoClass]: value };
    } else {
      result[prop] = { default: null, [mediaQuery!]: value };
    }
  }
  return result;
}

/** Resolve a static or alias entry (from a getter access). */
function resolveEntry(
  abbr: string,
  entry: TrussMappingEntry,
  mapping: TrussMapping,
  mediaQuery: string | null,
  pseudoClass: string | null,
  pseudoElement: string | null,
  whenPseudo?: { pseudo: string; markerNode?: any; relationship?: string } | null,
): ResolvedSegment[] {
  switch (entry.kind) {
    case "static": {
      if (whenPseudo) {
        const suffix = whenPseudoKeyName(whenPseudo);
        const key = `${abbr}__${suffix}`;
        return [{ key, defs: entry.defs, whenPseudo }];
      }
      const suffix = conditionKeySuffix(mediaQuery, pseudoClass, pseudoElement, mapping.breakpoints);
      const key = suffix ? `${abbr}__${suffix}` : abbr;
      const defs = pseudoElement
        ? { [pseudoElement]: wrapDefsWithConditions(entry.defs, mediaQuery, pseudoClass) }
        : wrapDefsWithConditions(entry.defs, mediaQuery, pseudoClass);
      return [{ key, defs, mediaQuery, pseudoClass, pseudoElement }];
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
  whenPseudo?: { pseudo: string; markerNode?: any; relationship?: string } | null,
): ResolvedSegment {
  if (node.args.length !== 1) {
    throw new UnsupportedPatternError(`${abbr}() expects exactly 1 argument, got ${node.args.length}`);
  }

  const argAst = node.args[0];
  const literalValue = tryEvaluateLiteral(argAst, entry.incremented, mapping.increment);

  // When inside a when() context, use whenPseudo key naming instead of condition suffix
  if (whenPseudo) {
    const wpSuffix = whenPseudoKeyName(whenPseudo);
    if (literalValue !== null) {
      const keySuffix = literalValue.replace(/[^a-zA-Z0-9]/g, "_");
      const key = `${abbr}__${keySuffix}__${wpSuffix}`;
      const defs: Record<string, unknown> = {};
      for (const prop of entry.props) {
        defs[prop] = literalValue;
      }
      if (entry.extraDefs) Object.assign(defs, entry.extraDefs);
      return { key, defs, whenPseudo, argResolved: literalValue };
    } else {
      const key = `${abbr}__${wpSuffix}`;
      return {
        key,
        defs: {},
        whenPseudo,
        variableProps: entry.props,
        incremented: entry.incremented,
        variableExtraDefs: entry.extraDefs,
        argNode: argAst,
      };
    }
  }

  const suffix = conditionKeySuffix(mediaQuery, pseudoClass, pseudoElement, mapping.breakpoints);

  if (literalValue !== null) {
    const keySuffix = literalValue.replace(/[^a-zA-Z0-9]/g, "_");
    const key = suffix ? `${abbr}__${keySuffix}__${suffix}` : `${abbr}__${keySuffix}`;
    const defs: Record<string, unknown> = {};
    for (const prop of entry.props) {
      defs[prop] = literalValue;
    }
    if (entry.extraDefs) {
      Object.assign(defs, entry.extraDefs);
    }
    const wrappedDefs = wrapDefsWithConditions(defs, mediaQuery, pseudoClass);
    return {
      key,
      defs: pseudoElement ? { [pseudoElement]: wrappedDefs } : wrappedDefs,
      mediaQuery,
      pseudoClass,
      pseudoElement,
      argResolved: literalValue,
    };
  } else {
    const key = suffix ? `${abbr}__${suffix}` : abbr;
    return {
      key,
      defs: {},
      mediaQuery,
      pseudoClass,
      variableProps: entry.props,
      incremented: entry.incremented,
      variableExtraDefs: entry.extraDefs,
      argNode: argAst,
    };
  }
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
  whenPseudo?: { pseudo: string; markerNode?: any; relationship?: string } | null,
): ResolvedSegment {
  const targetEntry = mapping.abbreviations[entry.target];
  if (!targetEntry || targetEntry.kind !== "variable") {
    throw new UnsupportedPatternError(`Delegate "${abbr}" targets "${entry.target}" which is not a variable entry`);
  }

  if (node.args.length !== 1) {
    throw new UnsupportedPatternError(`${abbr}() expects exactly 1 argument, got ${node.args.length}`);
  }

  const argAst = node.args[0];
  const literalValue = tryEvaluatePxLiteral(argAst);

  // When inside a when() context, use whenPseudo key naming instead of condition suffix
  if (whenPseudo) {
    const wpSuffix = whenPseudoKeyName(whenPseudo);
    if (literalValue !== null) {
      const keySuffix = literalValue.replace(/[^a-zA-Z0-9]/g, "_");
      const key = `${entry.target}__${keySuffix}__${wpSuffix}`;
      const defs: Record<string, unknown> = {};
      for (const prop of targetEntry.props) {
        defs[prop] = literalValue;
      }
      if (targetEntry.extraDefs) Object.assign(defs, targetEntry.extraDefs);
      return { key, defs, whenPseudo, argResolved: literalValue };
    } else {
      const key = `${entry.target}__${wpSuffix}`;
      return {
        key,
        defs: {},
        whenPseudo,
        variableProps: targetEntry.props,
        incremented: false,
        appendPx: true,
        variableExtraDefs: targetEntry.extraDefs,
        argNode: argAst,
      };
    }
  }

  const suffix = conditionKeySuffix(mediaQuery, pseudoClass, pseudoElement, mapping.breakpoints);

  if (literalValue !== null) {
    const keySuffix = literalValue.replace(/[^a-zA-Z0-9]/g, "_");
    const key = suffix ? `${entry.target}__${keySuffix}__${suffix}` : `${entry.target}__${keySuffix}`;
    const defs: Record<string, unknown> = {};
    for (const prop of targetEntry.props) {
      defs[prop] = literalValue;
    }
    if (targetEntry.extraDefs) {
      Object.assign(defs, targetEntry.extraDefs);
    }
    const wrappedDefs = wrapDefsWithConditions(defs, mediaQuery, pseudoClass);
    return {
      key,
      defs: pseudoElement ? { [pseudoElement]: wrappedDefs } : wrappedDefs,
      mediaQuery,
      pseudoClass,
      pseudoElement,
      argResolved: literalValue,
    };
  } else {
    const key = suffix ? `${entry.target}__${suffix}` : entry.target;
    return {
      key,
      defs: {},
      mediaQuery,
      pseudoClass,
      pseudoElement,
      variableProps: targetEntry.props,
      incremented: false,
      appendPx: true,
      variableExtraDefs: targetEntry.extraDefs,
      argNode: argAst,
    };
  }
}

/**
 * Resolve an `add(...)` call.
 *
 * Supported overloads:
 * - `add(cssProp)` to inline an existing CssProp array into the chain output
 * - `add("propName", value)` for an arbitrary CSS property/value pair
 */
function resolveAddCall(
  node: CallChainNode,
  mapping: TrussMapping,
  mediaQuery: string | null,
  pseudoClass: string | null,
  pseudoElement: string | null,
  whenPseudo?: { pseudo: string; markerNode?: any; relationship?: string } | null,
): ResolvedSegment {
  if (node.args.length === 1) {
    const styleArg = node.args[0];
    if (styleArg.type === "SpreadElement") {
      throw new UnsupportedPatternError(`add() does not support spread arguments`);
    }
    if (styleArg.type === "ObjectExpression") {
      throw new UnsupportedPatternError(
        `add(cssProp) does not accept object literals -- pass an existing CssProp expression instead`,
      );
    }
    return {
      key: "__composed_css_prop",
      defs: {},
      styleArrayArg: styleArg,
    };
  }

  if (node.args.length !== 2) {
    throw new UnsupportedPatternError(
      `add() requires exactly 2 arguments (property name and value), got ${node.args.length}. ` +
        `Supported overloads are add(cssProp) and add("propName", value)`,
    );
  }

  const propArg = node.args[0];
  if (propArg.type !== "StringLiteral") {
    throw new UnsupportedPatternError(`add() first argument must be a string literal property name`);
  }
  const propName: string = (propArg as any).value;

  const valueArg = node.args[1];
  // Try to evaluate the value as a literal
  const literalValue = tryEvaluateAddLiteral(valueArg);

  // When inside a when() context, use whenPseudo key naming
  if (whenPseudo) {
    const wpSuffix = whenPseudoKeyName(whenPseudo);
    if (literalValue !== null) {
      const keySuffix = literalValue
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_|_$/g, "");
      const key = `add_${propName}__${keySuffix}__${wpSuffix}`;
      return { key, defs: { [propName]: literalValue }, whenPseudo, argResolved: literalValue };
    } else {
      const key = `add_${propName}__${wpSuffix}`;
      return { key, defs: {}, whenPseudo, variableProps: [propName], incremented: false, argNode: valueArg };
    }
  }

  const suffix = conditionKeySuffix(mediaQuery, pseudoClass, pseudoElement, mapping.breakpoints);

  if (literalValue !== null) {
    const keySuffix = literalValue
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    const key = suffix ? `add_${propName}__${keySuffix}__${suffix}` : `add_${propName}__${keySuffix}`;
    const defs: Record<string, unknown> = { [propName]: literalValue };
    const wrappedDefs = wrapDefsWithConditions(defs, mediaQuery, pseudoClass);
    return {
      key,
      defs: pseudoElement ? { [pseudoElement]: wrappedDefs } : wrappedDefs,
      mediaQuery,
      pseudoClass,
      pseudoElement,
      argResolved: literalValue,
    };
  } else {
    const key = suffix ? `add_${propName}__${suffix}` : `add_${propName}`;
    return {
      key,
      defs: {},
      mediaQuery,
      pseudoClass,
      pseudoElement,
      variableProps: [propName],
      incremented: false,
      argNode: valueArg,
    };
  }
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
 * Resolve a `when(relationship, pseudo)` or `when(relationship, marker, pseudo)` call.
 *
 * - 2 args: `when("ancestor", ":hover")` — both must be string literals
 * - 3 args: `when("ancestor", marker, ":hover")` — 1st and 3rd must be string literals, 2nd is a marker variable
 */
function resolveWhenCall(node: CallChainNode): { pseudo: string; markerNode?: any; relationship: string } {
  if (node.args.length < 2 || node.args.length > 3) {
    throw new UnsupportedPatternError(
      `when() expects 2 or 3 arguments (relationship, [marker], pseudo), got ${node.args.length}`,
    );
  }

  const relationshipArg = node.args[0];
  if (relationshipArg.type !== "StringLiteral") {
    throw new UnsupportedPatternError(`when() first argument must be a string literal relationship`);
  }
  const relationship: string = (relationshipArg as any).value;
  if (!WHEN_RELATIONSHIPS.has(relationship)) {
    throw new UnsupportedPatternError(
      `when() relationship must be one of: ${[...WHEN_RELATIONSHIPS].join(", ")} -- got "${relationship}"`,
    );
  }

  if (node.args.length === 2) {
    // when("ancestor", ":hover")
    const pseudoArg = node.args[1];
    if (pseudoArg.type !== "StringLiteral") {
      throw new UnsupportedPatternError(`when() pseudo selector must be a string literal`);
    }
    return { pseudo: (pseudoArg as any).value, relationship };
  } else {
    // when("ancestor", marker, ":hover")
    const markerNode = node.args[1];
    const pseudoArg = node.args[2];
    if (pseudoArg.type !== "StringLiteral") {
      throw new UnsupportedPatternError(`when() pseudo selector (3rd argument) must be a string literal`);
    }
    return { pseudo: (pseudoArg as any).value, markerNode, relationship };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

const PSEUDO_METHODS: Record<string, string> = {
  onHover: ":hover",
  onFocus: ":focus",
  onFocusVisible: ":focus-visible",
  onActive: ":active",
  onDisabled: ":disabled",
};

function isPseudoMethod(name: string): boolean {
  return name in PSEUDO_METHODS;
}

function pseudoSelector(name: string): string {
  return PSEUDO_METHODS[name];
}

/**
 * Generate the stylex.create key suffix for when/ancestor pseudo segments.
 * e.g. { pseudo: ":hover" } → "ancestorHover"
 * e.g. { pseudo: ":hover", relationship: "descendant" } → "descendantHover"
 * e.g. { pseudo: ":hover", markerNode: Identifier("row") } → "ancestorHover_row"
 */
function whenPseudoKeyName(ap: { pseudo: string; markerNode?: any; relationship?: string }): string {
  const rel = ap.relationship ?? "ancestor";
  const pn = pseudoName(ap.pseudo);
  const base = `${rel}${pn.charAt(0).toUpperCase()}${pn.slice(1)}`;
  if (!ap.markerNode) return base;
  // Use the identifier name for readable keys; fall back to a generic suffix for complex expressions
  const suffix = ap.markerNode.type === "Identifier" ? ap.markerNode.name : "marker";
  return `${base}_${suffix}`;
}

/**
 * Post-process resolved segments to merge entries that target the same CSS
 * properties into a single `stylex.create` entry with stacked conditions.
 *
 * For example, `Css.black.ifSm.white.onHover.blue.$` produces three segments:
 *   1. `black` → `{ color: "#353535" }` (base)
 *   2. `white__sm` → `{ color: { default: null, "@media...": "#fcfcfa" } }` (media-only)
 *   3. `blue__sm_hover` → `{ color: { default: null, ":hover": { default: null, "@media...": "#526675" } } }` (media+pseudo)
 *
 * All three set `color`, so they merge into one entry:
 *   `{ color: { default: "#353535", "@media...": "#fcfcfa", ":hover": { default: null, "@media...": "#526675" } } }`
 */
export function mergeOverlappingConditions(segments: ResolvedSegment[]): ResolvedSegment[] {
  // Index: for each CSS property, which segments set it?
  // Only static segments (no variableProps, no styleArrayArg, no whenPseudo, no error) participate in merging.
  const propToIndices = new Map<string, number[]>();
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.variableProps || seg.styleArrayArg || seg.whenPseudo || seg.error) continue;
    for (const prop of Object.keys(seg.defs)) {
      if (!propToIndices.has(prop)) propToIndices.set(prop, []);
      propToIndices.get(prop)!.push(i);
    }
  }

  // Find properties where a base (no-condition) segment overlaps with conditional segments.
  // Two base segments setting the same property is NOT a merge — the later one just overrides.
  const mergeableProps = new Set<string>();
  for (const [prop, indices] of propToIndices) {
    if (indices.length < 2) continue;
    const hasBase = indices.some((i) => !segments[i].mediaQuery && !segments[i].pseudoClass);
    const hasConditional = indices.some((i) => !!(segments[i].mediaQuery || segments[i].pseudoClass));
    if (hasBase && hasConditional) {
      mergeableProps.add(prop);
    }
  }

  if (mergeableProps.size === 0) return segments;

  // For each mergeable property, deep-merge all contributing segments into one defs object.
  // Track which segment indices have properties consumed by the merge.
  const consumedProps = new Map<number, Set<string>>(); // segIndex → consumed prop names
  const mergedPropDefs = new Map<string, { defs: Record<string, unknown>; key: string }>();

  for (const prop of mergeableProps) {
    const indices = propToIndices.get(prop)!;
    let merged: Record<string, unknown> = {};
    const keyParts: string[] = [];

    for (const idx of indices) {
      const seg = segments[idx];
      const value = seg.defs[prop];
      keyParts.push(seg.key);

      if (typeof value === "string" || typeof value === "number") {
        // Base value → default
        merged.default = value;
      } else if (typeof value === "object" && value !== null) {
        // Conditional value — merge all keys (may include default: null which base will override)
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          if (k === "default" && v === null && merged.default !== undefined) {
            // Don't let a conditional's `default: null` clobber the base value
            continue;
          }
          merged[k] = v;
        }
      }

      // Mark this property as consumed from this segment
      if (!consumedProps.has(idx)) consumedProps.set(idx, new Set());
      consumedProps.get(idx)!.add(prop);
    }

    // If the merged object has only a `default` key, it's just a raw value (no conditions)
    const finalValue = Object.keys(merged).length === 1 && "default" in merged ? merged.default : merged;
    const mergedKey = [...new Set(keyParts)].join("_");
    mergedPropDefs.set(prop, { defs: { [prop]: finalValue }, key: mergedKey });
  }

  // Group mergeable props that share the exact same set of contributing segments
  // so they become one stylex.create entry.
  const groupByIndices = new Map<string, { props: string[]; key: string }>();
  for (const prop of mergeableProps) {
    const indices = propToIndices.get(prop)!;
    const groupKey = indices.join(",");
    if (!groupByIndices.has(groupKey)) {
      groupByIndices.set(groupKey, { props: [], key: mergedPropDefs.get(prop)!.key });
    }
    groupByIndices.get(groupKey)!.props.push(prop);
  }

  // Build merged segments
  const mergedSegments: ResolvedSegment[] = [];
  for (const [, group] of groupByIndices) {
    const defs: Record<string, unknown> = {};
    for (const prop of group.props) {
      Object.assign(defs, mergedPropDefs.get(prop)!.defs);
    }
    mergedSegments.push({ key: group.key, defs });
  }

  // Rebuild result: emit non-consumed segments (or segments with remaining non-consumed props),
  // then emit merged segments at the position of the first consumed segment.
  const result: ResolvedSegment[] = [];
  const mergedEmitted = new Set<string>();

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const consumed = consumedProps.get(i);

    if (!consumed) {
      // Not involved in any merge
      result.push(seg);
      continue;
    }

    // Emit any non-consumed properties from this segment
    const remainingDefs: Record<string, unknown> = {};
    for (const [prop, value] of Object.entries(seg.defs)) {
      if (!consumed.has(prop)) {
        remainingDefs[prop] = value;
      }
    }
    if (Object.keys(remainingDefs).length > 0) {
      result.push({ ...seg, defs: remainingDefs });
    }

    // Emit the merged segment(s) at the position of the first segment that contributed
    const indices = [...propToIndices.entries()]
      .filter(([prop]) => consumed.has(prop) && mergeableProps.has(prop))
      .map(([, idxs]) => idxs.join(","));

    for (const groupKey of new Set(indices)) {
      if (!mergedEmitted.has(groupKey)) {
        const group = groupByIndices.get(groupKey);
        if (group) {
          const defs: Record<string, unknown> = {};
          for (const prop of group.props) {
            Object.assign(defs, mergedPropDefs.get(prop)!.defs);
          }
          result.push({ key: group.key, defs });
          mergedEmitted.add(groupKey);
        }
      }
    }
  }

  return result;
}

/**
 * Convert a pseudo/media selector into a short key suffix.
 * ":hover" → "hover", ":focus-visible" → "focus_visible"
 * "@media screen and (max-width:599px)" → "sm" (using breakpoints reverse map)
 * "@container (min-width: 601px)" → "container_min_width_601px"
 */
export function pseudoName(pseudo: string, breakpoints?: Record<string, string>): string {
  if (pseudo.startsWith("@media") && breakpoints) {
    // Reverse lookup: find the breakpoint getter name (e.g. "ifSm") and strip "if" prefix
    for (const [getterName, mediaQuery] of Object.entries(breakpoints)) {
      if (mediaQuery === pseudo) {
        // "ifSm" → "sm", "ifSmOrMd" → "smOrMd", "ifMdAndUp" → "mdAndUp"
        return getterName.replace(/^if/, "").replace(/^./, (c) => c.toLowerCase());
      }
    }
    // Fallback: create a compact name from the media query
    return pseudo
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }

  if (pseudo.startsWith("@container")) {
    return pseudo
      .replace(/^@container\s*/, "container ")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }

  return pseudo.replace(/^:+/, "").replace(/-/g, "_");
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

/** Resolve ifContainer({ gt, lt, name? }) to a StyleX pseudo key. */
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
