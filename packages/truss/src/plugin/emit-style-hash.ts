import * as t from "@babel/types";
import { isCssSegment, type ResolvedSegment, type TrussMapping } from "./types";
import { styleEntriesForSegment, type StyleEntry } from "./style-entries";
import type { RuntimeHelpers } from "./rewrite-sites";

// ── Style hash objects ────────────────────────────────────────────────

/**
 * Build the style hash AST for a list of segments (from one `Css.*.$` expression).
 *
 * I.e. `[blue, h_white]` → `{ color: "blue h_white" }`, and `[mt(x)]` →
 * `{ marginTop: ["mt_var", { "--marginTop": maybeCssVar(maybeInc(x)) }] }`.
 */
export function buildStyleHashProperties(
  segments: ResolvedSegment[],
  mapping: TrussMapping,
  runtime: RuntimeHelpers,
): t.ObjectProperty[] {
  return styleHashProperties(collectStyleEntryGroups(segments, mapping), runtime);
}

/**
 * Group the style entries of `segments` by CSS property, in order of first appearance.
 *
 * Within a group, a new base-level entry replaces earlier base-level entries while conditional
 * entries accumulate. I.e. `Css.blue.black.$` → the later `black` replaces `blue` for `color`,
 * but `Css.blue.onHover.black.$` keeps both because `onHover.black` is conditional.
 *
 * `seed` supplies the starting entries for a property the first time it appears, i.e. the base
 * `color` entries that an `if(cond).onHover.black` branch must carry alongside its own `h_black`.
 */
export function collectStyleEntryGroups(
  segments: ResolvedSegment[],
  mapping: TrussMapping,
  seed?: ReadonlyMap<string, StyleEntry[]>,
): Map<string, StyleEntry[]> {
  const propGroups = new Map<string, StyleEntry[]>();

  for (const seg of segments) {
    if (!isCssSegment(seg)) continue;
    for (const entry of styleEntriesForSegment(seg, mapping)) {
      const entries = propGroups.get(entry.cssProp) ?? seed?.get(entry.cssProp) ?? [];
      const kept = entry.isConditional ? entries : entries.filter((existing) => existing.isConditional);
      propGroups.set(entry.cssProp, [...kept, entry]);
    }
  }

  return propGroups;
}

/**
 * Build style hash properties from grouped entries.
 *
 * Static groups become space-separated class bundles, i.e. `{ color: "blue h_white" }`.
 * Groups with a variable entry become tuples, i.e.
 * `{ marginTop: ["mt_var", { "--marginTop": maybeCssVar(maybeInc(x)) }] }`.
 */
export function styleHashProperties(
  propGroups: ReadonlyMap<string, StyleEntry[]>,
  runtime: RuntimeHelpers,
): t.ObjectProperty[] {
  const properties: t.ObjectProperty[] = [];

  for (const [cssProp, entries] of propGroups) {
    const classNames = entries.map((e) => e.className).join(" ");
    const variableEntries = entries.filter((e) => e.isVariable);

    if (variableEntries.length === 0) {
      properties.push(t.objectProperty(toPropertyKey(cssProp), t.stringLiteral(classNames)));
      continue;
    }

    const varsProps = variableEntries.map((dyn) => {
      return t.objectProperty(t.stringLiteral(dyn.varName!), variableValueExpression(dyn, runtime));
    });
    const tuple = t.arrayExpression([t.stringLiteral(classNames), t.objectExpression(varsProps)]);
    properties.push(t.objectProperty(toPropertyKey(cssProp), tuple));
  }

  return properties;
}

/**
 * The runtime value stored in a variable tuple's vars object.
 *
 * I.e. an evaluated `Tokens.gap` → `"var(--gap)"`; `mt(x)` → `maybeCssVar(maybeInc(x))`; `mtPx(x)` → `` `${x}px` ``;
 * `sweep(x)` → `` `sweep ${maybeCssVar(x)}` ``.
 *
 * `maybeInc` and `maybeCssVar` are runtime exports, so asking `runtime` for one here is what adds its import.
 */
function variableValueExpression(dyn: StyleEntry, runtime: RuntimeHelpers): t.Expression {
  if (dyn.argResolved !== undefined) {
    return t.stringLiteral(dyn.argResolved);
  }

  let valueExpr = dyn.argNode!;
  if (dyn.incremented) {
    // I.e. wrap with `maybeInc(x)` for increment-based values
    valueExpr = t.callExpression(t.identifier(runtime.use("maybeInc")), [valueExpr]);
  } else if (dyn.appendPx) {
    // I.e. wrap with `` `${v}px` `` for Px delegate values
    valueExpr = t.templateLiteral(
      [t.templateElement({ raw: "", cooked: "" }, false), t.templateElement({ raw: "px", cooked: "px" }, true)],
      [valueExpr],
    );
  }
  // A Px value is always `` `${n}px` ``, so only the other values may be a `--token` name
  if (!dyn.appendPx) {
    valueExpr = t.callExpression(t.identifier(runtime.use("maybeCssVar")), [valueExpr]);
  }
  if (dyn.valuePrefix) {
    // I.e. a keyframe method wraps with `` `sweep ${x}` `` so the value still names its keyframe.
    valueExpr = t.templateLiteral(
      [
        t.templateElement({ raw: dyn.valuePrefix, cooked: dyn.valuePrefix }, false),
        t.templateElement({ raw: "", cooked: "" }, true),
      ],
      [valueExpr],
    );
  }
  return valueExpr;
}

/**
 * Build a runtime lookup table declaration for typography.
 *
 * I.e. `const __typography = { f24: { fontSize: "f24", lineHeight: "lh32" }, ... };`
 */
export function buildRuntimeLookupDeclaration(
  lookupName: string,
  segmentsByName: Record<string, ResolvedSegment[]>,
  mapping: TrussMapping,
  runtime: RuntimeHelpers,
): t.VariableDeclaration {
  const properties = Object.entries(segmentsByName).map(([name, segs]) => {
    return t.objectProperty(t.identifier(name), t.objectExpression(buildStyleHashProperties(segs, mapping, runtime)));
  });
  return t.variableDeclaration("const", [
    t.variableDeclarator(t.identifier(lookupName), t.objectExpression(properties)),
  ]);
}

/** I.e. `"color"` → `t.identifier("color")`, `"box-shadow"` → `t.stringLiteral("box-shadow")`. */
function toPropertyKey(key: string): t.Identifier | t.StringLiteral {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? t.identifier(key) : t.stringLiteral(key);
}
