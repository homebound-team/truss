import * as t from "@babel/types";
import type { ResolvedConditionContext, ResolvedSegment, TrussMapping, WhenCondition } from "./types";
import { breakpointNameForMediaQuery } from "./mapping-utils";
import { type CallChainNode, UnsupportedPatternError } from "./chain-nodes";
import { resolveEntry } from "./resolve-entry";
import { singleArg } from "./resolve-literals";
import { sanitizeClassNameToken } from "./style-entries";

/** Resolve `typography(key)` into either direct segments or a runtime lookup-backed segment. */
export function resolveTypographyCall(
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
    parts.push(
      breakpoint ? breakpoint.replace(/^./, (c) => c.toLowerCase()) : sanitizeClassNameToken(context.mediaQuery),
    );
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
