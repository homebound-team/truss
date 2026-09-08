import * as t from "@babel/types";
import { isCssSegment, type ResolvedSegment, type TrussMapping } from "./types";
import { styleEntriesForSegment, type StyleEntry } from "./style-entries";
import { variableValueNeedsMaybeCssVar } from "../css-custom-property";
import { SPACING_CUSTOM_PROPERTY } from "../spacing-css-var";

// ── Style hash objects ────────────────────────────────────────────────

/**
 * Build the style hash AST for a list of segments (from one `Css.*.$` expression).
 *
 * I.e. `[blue, h_white]` → `{ color: "blue h_white" }`, and `[mt(x)]` →
 * `{ marginTop: ["mt_var", { "--marginTop": __maybeInc(x) }] }`.
 */
export function buildStyleHashProperties(
  segments: ResolvedSegment[],
  mapping: TrussMapping,
  maybeIncHelperName?: string | null,
  maybeCssVarHelperName?: string | null,
): t.ObjectProperty[] {
  return styleHashProperties(collectStyleEntryGroups(segments, mapping), maybeIncHelperName, maybeCssVarHelperName);
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
 * Groups with a variable entry become tuples, i.e. `{ marginTop: ["mt_var", { "--marginTop": __maybeInc(x) }] }`.
 */
export function styleHashProperties(
  propGroups: ReadonlyMap<string, StyleEntry[]>,
  maybeIncHelperName?: string | null,
  maybeCssVarHelperName?: string | null,
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
      return t.objectProperty(
        t.stringLiteral(dyn.varName!),
        variableValueExpression(dyn, maybeIncHelperName, maybeCssVarHelperName),
      );
    });
    const tuple = t.arrayExpression([t.stringLiteral(classNames), t.objectExpression(varsProps)]);
    properties.push(t.objectProperty(toPropertyKey(cssProp), tuple));
  }

  return properties;
}

/**
 * The runtime value stored in a variable tuple's vars object.
 *
 * I.e. a folded `Tokens.gap` → `"var(--gap)"`; `mt(x)` → `maybeCssVar(__maybeInc(x))`; `mtPx(x)` → `` `${x}px` ``.
 */
function variableValueExpression(
  dyn: StyleEntry,
  maybeIncHelperName?: string | null,
  maybeCssVarHelperName?: string | null,
): t.Expression {
  if (dyn.argResolved !== undefined) {
    return t.stringLiteral(dyn.argResolved);
  }

  let valueExpr = dyn.argNode!;
  if (dyn.incremented) {
    // I.e. wrap with `__maybeInc(x)` for increment-based values
    valueExpr = t.callExpression(t.identifier(maybeIncHelperName ?? "__maybeInc"), [valueExpr]);
  } else if (dyn.appendPx) {
    // I.e. wrap with `` `${v}px` `` for Px delegate values
    valueExpr = t.templateLiteral(
      [t.templateElement({ raw: "", cooked: "" }, false), t.templateElement({ raw: "px", cooked: "px" }, true)],
      [valueExpr],
    );
  }
  if (maybeCssVarHelperName && variableValueNeedsMaybeCssVar(dyn)) {
    valueExpr = t.callExpression(t.identifier(maybeCssVarHelperName), [valueExpr]);
  }
  return valueExpr;
}

// ── Helper AST declarations ───────────────────────────────────────────

/**
 * Build the per-file increment helper declaration.
 *
 * I.e. `const __maybeInc = (inc) => typeof inc === "string" ? inc : \`calc(var(--t-spacing) * \${inc})\`;`
 */
export function buildMaybeIncDeclaration(helperName: string): t.VariableDeclaration {
  const incParam = t.identifier("inc");
  const calcPrefix = `calc(var(${SPACING_CUSTOM_PROPERTY}) * `;
  const body = t.blockStatement([
    t.returnStatement(
      t.conditionalExpression(
        t.binaryExpression("===", t.unaryExpression("typeof", incParam), t.stringLiteral("string")),
        incParam,
        t.templateLiteral(
          [
            t.templateElement({ raw: calcPrefix, cooked: calcPrefix }, false),
            t.templateElement({ raw: ")", cooked: ")" }, true),
          ],
          [incParam],
        ),
      ),
    ),
  ]);

  return t.variableDeclaration("const", [
    t.variableDeclarator(t.identifier(helperName), t.arrowFunctionExpression([incParam], body)),
  ]);
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
): t.VariableDeclaration {
  const properties = Object.entries(segmentsByName).map(([name, segs]) => {
    return t.objectProperty(t.identifier(name), t.objectExpression(buildStyleHashProperties(segs, mapping)));
  });
  return t.variableDeclaration("const", [
    t.variableDeclarator(t.identifier(lookupName), t.objectExpression(properties)),
  ]);
}

/** I.e. `"color"` → `t.identifier("color")`, `"box-shadow"` → `t.stringLiteral("box-shadow")`. */
function toPropertyKey(key: string): t.Identifier | t.StringLiteral {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? t.identifier(key) : t.stringLiteral(key);
}
