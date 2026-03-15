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
 */
export function resolveFullChain(chain: ChainNode[], mapping: TrussMapping): ResolvedChain {
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
      // Flush any accumulated unconditional nodes
      if (currentNodes.length > 0) {
        parts.push({ type: "unconditional", segments: mergeOverlappingPseudos(resolveChain(currentNodes, mapping)) });
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
      parts.push({
        type: "conditional",
        conditionNode: node.conditionNode,
        thenSegments: mergeOverlappingPseudos(resolveChain(thenNodes, mapping)),
        elseSegments: mergeOverlappingPseudos(resolveChain(elseNodes, mapping)),
      });
    } else {
      currentNodes.push(node);
      i++;
    }
  }

  // Flush remaining unconditional nodes
  if (currentNodes.length > 0) {
    parts.push({ type: "unconditional", segments: mergeOverlappingPseudos(resolveChain(currentNodes, mapping)) });
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
  let currentPseudo: string | null = null;
  let currentWhenPseudo: { pseudo: string; markerNode?: any; relationship?: string } | null = null;

  for (const node of chain) {
    try {
      if (node.type === "getter") {
        const abbr = node.name;

        // Pseudo-class getters: onHover, onFocus, etc.
        if (isPseudoMethod(abbr)) {
          currentPseudo = pseudoSelector(abbr);
          currentWhenPseudo = null;
          continue;
        }

        // Breakpoint getters: ifSm, ifMd, ifLg, etc.
        if (mapping.breakpoints && abbr in mapping.breakpoints) {
          currentPseudo = mapping.breakpoints[abbr];
          currentWhenPseudo = null;
          continue;
        }

        const entry = mapping.abbreviations[abbr];
        if (!entry) {
          throw new UnsupportedPatternError(`Unknown abbreviation "${abbr}"`);
        }

        const resolved = resolveEntry(abbr, entry, mapping, currentPseudo, currentWhenPseudo);
        segments.push(...resolved);
      } else if (node.type === "call") {
        const abbr = node.name;

        // Container query call: ifContainer({ gt, lt, name? })
        if (abbr === "ifContainer") {
          currentPseudo = containerSelectorFromCall(node);
          currentWhenPseudo = null;
          continue;
        }

        // add(prop, value) — arbitrary CSS property
        if (abbr === "add") {
          const seg = resolveAddCall(node, mapping, currentPseudo);
          segments.push(seg);
          continue;
        }

        // Generic when(relationship, pseudo) or when(relationship, marker, pseudo)
        if (abbr === "when") {
          const resolved = resolveWhenCall(node);
          currentPseudo = null;
          currentWhenPseudo = resolved;
          continue;
        }

        // Simple pseudo-class calls (backward compat — pseudos are now getters)
        if (isPseudoMethod(abbr)) {
          currentPseudo = pseudoSelector(abbr);
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

        if (entry.kind === "dynamic") {
          const seg = resolveDynamicCall(abbr, entry, node, mapping, currentPseudo);
          segments.push(seg);
        } else if (entry.kind === "delegate") {
          const seg = resolveDelegateCall(abbr, entry, node, mapping, currentPseudo);
          segments.push(seg);
        } else {
          throw new UnsupportedPatternError(`Abbreviation "${abbr}" is ${entry.kind}, cannot be called as a function`);
        }
      }
    } catch (err) {
      if (err instanceof UnsupportedPatternError) {
        // Record the error as a segment so the rest of the chain continues processing
        segments.push({ key: "__error", defs: {}, pseudo: null, error: err.message });
      } else {
        throw err;
      }
    }
  }

  return segments;
}

/** Resolve a static or alias entry (from a getter access). */
function resolveEntry(
  abbr: string,
  entry: TrussMappingEntry,
  mapping: TrussMapping,
  pseudo: string | null,
  whenPseudo?: { pseudo: string; markerNode?: any; relationship?: string } | null,
): ResolvedSegment[] {
  switch (entry.kind) {
    case "static": {
      if (whenPseudo) {
        const suffix = whenPseudoKeyName(whenPseudo);
        const key = `${abbr}__${suffix}`;
        // Store raw defs — the transform will wrap with stylex.when.<rel>() computed key
        return [{ key, defs: entry.defs, pseudo: null, whenPseudo }];
      }
      const key = pseudo ? `${abbr}__${pseudoName(pseudo, mapping.breakpoints)}` : abbr;
      const defs = pseudo ? wrapDefsWithPseudo(entry.defs, pseudo) : entry.defs;
      return [{ key, defs, pseudo }];
    }
    case "alias": {
      // Recursively resolve each abbreviation in the alias chain
      const result: ResolvedSegment[] = [];
      for (const chainAbbr of entry.chain) {
        const subEntry = mapping.abbreviations[chainAbbr];
        if (!subEntry) {
          throw new UnsupportedPatternError(`Alias "${abbr}" references unknown abbreviation "${chainAbbr}"`);
        }
        result.push(...resolveEntry(chainAbbr, subEntry, mapping, pseudo, whenPseudo));
      }
      return result;
    }
    case "dynamic":
    case "delegate":
      throw new UnsupportedPatternError(`Abbreviation "${abbr}" requires arguments — use ${abbr}() not .${abbr}`);
    default:
      throw new UnsupportedPatternError(`Unhandled entry kind for "${abbr}"`);
  }
}

/** Resolve a dynamic (parameterized) call like mt(2) or mt(x). */
function resolveDynamicCall(
  abbr: string,
  entry: { kind: "dynamic"; props: string[]; incremented: boolean },
  node: CallChainNode,
  mapping: TrussMapping,
  pseudo: string | null,
): ResolvedSegment {
  if (node.args.length !== 1) {
    throw new UnsupportedPatternError(`${abbr}() expects exactly 1 argument, got ${node.args.length}`);
  }

  const argAst = node.args[0];
  const literalValue = tryEvaluateLiteral(argAst, entry.incremented, mapping.increment);

  if (literalValue !== null) {
    // Literal argument — resolve to a static entry
    const keySuffix = literalValue.replace(/[^a-zA-Z0-9]/g, "_");
    const key = pseudo ? `${abbr}__${keySuffix}__${pseudoName(pseudo, mapping.breakpoints)}` : `${abbr}__${keySuffix}`;
    const defs: Record<string, unknown> = {};
    for (const prop of entry.props) {
      defs[prop] = literalValue;
    }
    return {
      key,
      defs: pseudo ? wrapDefsWithPseudo(defs, pseudo) : defs,
      pseudo,
      argResolved: literalValue,
    };
  } else {
    // Variable argument — needs a parameterized stylex.create entry
    const key = pseudo ? `${abbr}__${pseudoName(pseudo, mapping.breakpoints)}` : abbr;
    return {
      key,
      defs: {},
      pseudo,
      dynamicProps: entry.props,
      incremented: entry.incremented,
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
  pseudo: string | null,
): ResolvedSegment {
  const targetEntry = mapping.abbreviations[entry.target];
  if (!targetEntry || targetEntry.kind !== "dynamic") {
    throw new UnsupportedPatternError(`Delegate "${abbr}" targets "${entry.target}" which is not a dynamic entry`);
  }

  if (node.args.length !== 1) {
    throw new UnsupportedPatternError(`${abbr}() expects exactly 1 argument, got ${node.args.length}`);
  }

  const argAst = node.args[0];
  // For Px delegates, the arg is always a number that becomes `${px}px`
  const literalValue = tryEvaluatePxLiteral(argAst);

  if (literalValue !== null) {
    const keySuffix = literalValue.replace(/[^a-zA-Z0-9]/g, "_");
    const key = pseudo
      ? `${entry.target}__${keySuffix}__${pseudoName(pseudo, mapping.breakpoints)}`
      : `${entry.target}__${keySuffix}`;
    const defs: Record<string, unknown> = {};
    for (const prop of targetEntry.props) {
      defs[prop] = literalValue;
    }
    return {
      key,
      defs: pseudo ? wrapDefsWithPseudo(defs, pseudo) : defs,
      pseudo,
      argResolved: literalValue,
    };
  } else {
    // Variable arg for Px delegate — wrap in template literal
    const key = pseudo ? `${entry.target}__${pseudoName(pseudo, mapping.breakpoints)}` : entry.target;
    return {
      key,
      defs: {},
      pseudo,
      dynamicProps: targetEntry.props,
      incremented: false, // Px delegates don't use maybeInc; they pass `${px}px`
      argNode: argAst,
      // Mark that this needs `${arg}px` wrapping (not maybeInc)
    };
  }
}

/**
 * Resolve an `add(prop, value)` call — arbitrary CSS property with a string literal
 * property name and either a literal or variable value.
 *
 * Only the two-argument `add("propName", value)` overload is supported.
 * The object overload `add({ prop: value })` is not supported (StyleX requires
 * static property names at build time).
 */
function resolveAddCall(node: CallChainNode, mapping: TrussMapping, pseudo: string | null): ResolvedSegment {
  if (node.args.length !== 2) {
    throw new UnsupportedPatternError(
      `add() requires exactly 2 arguments (property name and value), got ${node.args.length}. ` +
        `The add({...}) object overload is not supported -- use add("propName", value) instead`,
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

  if (literalValue !== null) {
    // Static: add("boxShadow", "0 0 0 1px blue") → { boxShadow: "0 0 0 1px blue" }
    const keySuffix = literalValue
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
    const key = pseudo
      ? `add_${propName}__${keySuffix}__${pseudoName(pseudo, mapping.breakpoints)}`
      : `add_${propName}__${keySuffix}`;
    const defs: Record<string, unknown> = { [propName]: literalValue };
    return {
      key,
      defs: pseudo ? wrapDefsWithPseudo(defs, pseudo) : defs,
      pseudo,
      argResolved: literalValue,
    };
  } else {
    // Dynamic: add("boxShadow", expr) → needs a parameterized stylex.create entry
    const key = pseudo ? `add_${propName}__${pseudoName(pseudo, mapping.breakpoints)}` : `add_${propName}`;
    return {
      key,
      defs: {},
      pseudo,
      dynamicProps: [propName],
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
 * Post-process resolved segments to merge base and pseudo entries that target
 * the same CSS property. Without this, `Css.black.onHover().blue.$` would
 * produce `color: "#353535"` and `color: { default: null, ":hover": "#526675" }`
 * as separate entries, and the `default: null` would clobber the base.
 *
 * After merging: a single entry with `color: { default: "#353535", ":hover": "#526675" }`.
 */
export function mergeOverlappingPseudos(segments: ResolvedSegment[]): ResolvedSegment[] {
  // Build a map of CSS property → index of the base (non-pseudo) segment that sets it
  const basePropMap = new Map<string, number>();
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg.pseudo && seg.defs && !seg.dynamicProps) {
      for (const prop of Object.keys(seg.defs)) {
        basePropMap.set(prop, i);
      }
    }
  }

  // For each pseudo segment, check for overlaps with base segments
  const result: ResolvedSegment[] = [];
  const mergedBaseIndices = new Set<number>();
  // Track which base segments had properties removed (may need filtering)
  const basePropertyRemovals = new Map<number, Set<string>>();

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg.pseudo || seg.dynamicProps) {
      // Non-pseudo or dynamic — handle later
      result.push(seg);
      continue;
    }

    // Static pseudo segment — check for property overlaps
    const overlaps: Array<{ prop: string; baseIdx: number; baseValue: unknown }> = [];
    for (const prop of Object.keys(seg.defs)) {
      const baseIdx = basePropMap.get(prop);
      if (baseIdx !== undefined && baseIdx < i) {
        overlaps.push({ prop, baseIdx, baseValue: segments[baseIdx].defs[prop] });
      }
    }

    if (overlaps.length === 0) {
      // No overlap — keep as-is
      result.push(seg);
      continue;
    }

    // Merge: replace `default: null` with the base value
    const mergedDefs: Record<string, unknown> = {};
    for (const [prop, value] of Object.entries(seg.defs)) {
      const overlap = overlaps.find((o) => o.prop === prop);
      if (overlap && typeof value === "object" && value !== null && "default" in (value as any)) {
        // Replace default: null with the base value
        mergedDefs[prop] = { ...(value as Record<string, unknown>), default: overlap.baseValue };
      } else {
        mergedDefs[prop] = value;
      }
    }

    // Build merged key: baseKey + "_" + pseudoKey
    const baseKeys = [...new Set(overlaps.map((o) => segments[o.baseIdx].key))];
    const mergedKey = baseKeys.join("_") + "_" + seg.key;

    result.push({ ...seg, key: mergedKey, defs: mergedDefs });

    // Track which properties to remove from base segments
    for (const { prop, baseIdx } of overlaps) {
      if (!basePropertyRemovals.has(baseIdx)) {
        basePropertyRemovals.set(baseIdx, new Set());
      }
      basePropertyRemovals.get(baseIdx)!.add(prop);
      mergedBaseIndices.add(baseIdx);
    }
  }

  // Remove merged properties from base segments, or remove them entirely
  const filtered: ResolvedSegment[] = [];
  for (const seg of result) {
    const origIdx = segments.indexOf(seg);
    const removals = basePropertyRemovals.get(origIdx);
    if (!removals) {
      filtered.push(seg);
      continue;
    }
    const remainingDefs: Record<string, unknown> = {};
    for (const [prop, value] of Object.entries(seg.defs)) {
      if (!removals.has(prop)) {
        remainingDefs[prop] = value;
      }
    }
    if (Object.keys(remainingDefs).length > 0) {
      filtered.push({ ...seg, defs: remainingDefs });
    }
    // If empty, drop the segment entirely
  }

  return filtered;
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

  return pseudo.replace(/^:/, "").replace(/-/g, "_");
}

/** Wrap each CSS property value in StyleX pseudo conditional syntax. */
export function wrapDefsWithPseudo(defs: Record<string, unknown>, pseudo: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [prop, value] of Object.entries(defs)) {
    result[prop] = { default: null, [pseudo]: value };
  }
  return result;
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
