import type {
  ResolvedConditionContext,
  ResolvedSegment,
  StaticSegment,
  TrussMapping,
  TrussMappingEntry,
} from "./types";
import { UnsupportedPatternError } from "./chain-nodes";
import { cloneConditionContext } from "./condition-context";
import { UnknownAbbreviationError } from "./unknown-abbreviation";

/** The mapping entry for `abbr`, or an unsupported-pattern error for an unknown abbreviation. */
export function requireEntry(mapping: TrussMapping, abbr: string): TrussMappingEntry {
  const entry = mapping.abbreviations[abbr];
  if (!entry) {
    throw new UnknownAbbreviationError(abbr, Object.keys(mapping.abbreviations));
  }
  return entry;
}

/** Placeholder segment that carries an unsupported-pattern message through to the emitter. */
export function errorSegment(message: string): ResolvedSegment {
  return { kind: "error", message };
}

/** A static segment under a snapshot of the active condition axes. */
export function staticSegment(
  abbr: string,
  defs: Record<string, unknown>,
  context: ResolvedConditionContext,
  argResolved?: string,
): StaticSegment {
  return { kind: "static", abbr, defs, argResolved, condition: cloneConditionContext(context) };
}

/** Resolve a static or alias entry (from a getter access). Defs are always flat. */
export function resolveEntry(
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
