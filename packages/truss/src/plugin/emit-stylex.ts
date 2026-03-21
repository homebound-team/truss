import * as t from "@babel/types";
import type { ResolvedChain } from "./resolve-chain";
import type { ResolvedSegment } from "./types";

export interface CreateEntrySpec {
  /**
   * The property name in the generated `stylex.create({...})` object, built from
   * the Truss abbreviation, optionally suffixed with the resolved value and/or pseudo,
   * i.e. `"df"`, `"mt__16px"`, `"black__hover"`. Also used as the dedup key across the file.
   */
  key: string;
  /**
   * Static CSS property-value map for this entry. Usually a single property,
   * i.e. `{ display: "flex" }` for `"df"`, but shorthand abbreviations expand to multiple,
   * i.e. `{ borderStyle: "solid", borderWidth: "1px" }` for `"ba"`.
   */
  defs?: Record<string, unknown>;
  /**
   * For dynamic entries where the value is a runtime variable (not a literal),
   * i.e. `{ props: ["marginTop"], pseudo: null }` for `Css.mt(x).$`,
   * or `{ props: ["color"], pseudo: ":hover" }` for `Css.onHover.color(x).$`.
   *
   * Becomes `stylex.create({ mt: v => ({ marginTop: v }) })`
   */
  dynamic?: {
    props: string[];
    extraDefs?: Record<string, unknown>;
    mediaQuery?: string | null;
    pseudoClass?: string | null;
    pseudoElement?: string | null;
  };
  /** If set, this entry uses stylex.when.<relationship>() as the computed property key */
  whenPseudo?: { pseudo: string; markerNode?: any; relationship?: string };
}

export interface CollectedCreateData {
  createEntries: Map<string, CreateEntrySpec>;
  runtimeLookups: Map<string, RuntimeLookupSpec>;
  needsMaybeInc: boolean;
}

export interface RuntimeLookupSpec {
  lookupKey: string;
  refsByName: Record<string, string[]>;
}

/**
 * Aggregate per-site resolved chains into file-level emission data.
 *
 * Why this exists: we emit one `stylex.create(...)` per source file, so all
 * style segments across all transformed sites must be deduplicated first.
 */
export function collectCreateData(chains: ResolvedChain[]): CollectedCreateData {
  const createEntries = new Map<string, CreateEntrySpec>();
  const runtimeLookups = new Map<string, RuntimeLookupSpec>();
  let needsMaybeInc = false;

  for (const chain of chains) {
    for (const part of chain.parts) {
      const segs = part.type === "unconditional" ? part.segments : [...part.thenSegments, ...part.elseSegments];

      for (const seg of segs) {
        // Skip error segments — they have no CSS data to emit
        if (seg.error) continue;

        if (seg.typographyLookup) {
          collectTypographyLookup(createEntries, runtimeLookups, seg);
          continue;
        }

        if (seg.styleArrayArg) {
          continue;
        }

        if (seg.dynamicProps) {
          if (!createEntries.has(seg.key)) {
            // Keyed dedupe guarantees a stable single entry for repeated usage.
            createEntries.set(seg.key, {
              key: seg.key,
              dynamic: {
                props: seg.dynamicProps,
                extraDefs: seg.dynamicExtraDefs,
                mediaQuery: seg.mediaQuery,
                pseudoClass: seg.pseudoClass,
                pseudoElement: seg.pseudoElement,
              },
            });
          }
        } else {
          if (!createEntries.has(seg.key)) {
            createEntries.set(seg.key, {
              key: seg.key,
              defs: seg.defs,
              whenPseudo: seg.whenPseudo,
            });
          }
        }

        if (seg.incremented && seg.dynamicProps) {
          needsMaybeInc = true;
        }
      }
    }
  }

  return { createEntries, runtimeLookups, needsMaybeInc };
}

function collectTypographyLookup(
  createEntries: Map<string, CreateEntrySpec>,
  runtimeLookups: Map<string, RuntimeLookupSpec>,
  seg: ResolvedSegment,
): void {
  const lookup = seg.typographyLookup;
  if (!lookup) return;

  if (!runtimeLookups.has(lookup.lookupKey)) {
    runtimeLookups.set(lookup.lookupKey, {
      lookupKey: lookup.lookupKey,
      refsByName: Object.fromEntries(
        Object.entries(lookup.segmentsByName).map(function ([name, segments]) {
          return [
            name,
            segments.map(function (segment) {
              return segment.key;
            }),
          ];
        }),
      ),
    });
  }

  for (const segments of Object.values(lookup.segmentsByName)) {
    for (const segment of segments) {
      if (createEntries.has(segment.key)) continue;
      createEntries.set(segment.key, {
        key: segment.key,
        defs: segment.defs,
        whenPseudo: segment.whenPseudo,
      });
    }
  }
}

/**
 * Build the object literal properties passed to `stylex.create`.
 *
 * Handles static entries, dynamic entries (`v => ({ ... })`), and
 * ancestor-pseudo entries that use `stylex.when.ancestor(...)` keys.
 */
export function buildCreateProperties(
  createEntries: Map<string, CreateEntrySpec>,
  stylexNamespaceName: string,
): t.ObjectProperty[] {
  const createProperties: t.ObjectProperty[] = [];

  for (const [, entry] of createEntries) {
    if (entry.dynamic) {
      const paramId = t.identifier("v");
      const bodyProps: t.ObjectProperty[] = [];
      const { mediaQuery, pseudoClass } = entry.dynamic;

      for (const prop of entry.dynamic.props) {
        if (pseudoClass && mediaQuery) {
          // Stacked: { default: null, ":hover": { default: null, "@media...": v } }
          bodyProps.push(
            t.objectProperty(
              toPropertyKey(prop),
              t.objectExpression([
                t.objectProperty(t.identifier("default"), t.nullLiteral()),
                t.objectProperty(
                  t.stringLiteral(pseudoClass),
                  t.objectExpression([
                    t.objectProperty(t.identifier("default"), t.nullLiteral()),
                    t.objectProperty(t.stringLiteral(mediaQuery), paramId),
                  ]),
                ),
              ]),
            ),
          );
        } else if (pseudoClass || mediaQuery) {
          const condition = (pseudoClass || mediaQuery)!;
          bodyProps.push(
            t.objectProperty(
              toPropertyKey(prop),
              t.objectExpression([
                t.objectProperty(t.identifier("default"), t.nullLiteral()),
                t.objectProperty(t.stringLiteral(condition), paramId),
              ]),
            ),
          );
        } else {
          bodyProps.push(t.objectProperty(toPropertyKey(prop), paramId));
        }
      }

      if (entry.dynamic.extraDefs) {
        for (const [prop, value] of Object.entries(entry.dynamic.extraDefs)) {
          if (pseudoClass && mediaQuery) {
            bodyProps.push(
              t.objectProperty(
                toPropertyKey(prop),
                t.objectExpression([
                  t.objectProperty(t.identifier("default"), t.nullLiteral()),
                  t.objectProperty(
                    t.stringLiteral(pseudoClass),
                    t.objectExpression([
                      t.objectProperty(t.identifier("default"), t.nullLiteral()),
                      t.objectProperty(t.stringLiteral(mediaQuery), valueToAst(value)),
                    ]),
                  ),
                ]),
              ),
            );
          } else if (pseudoClass || mediaQuery) {
            const condition = (pseudoClass || mediaQuery)!;
            bodyProps.push(
              t.objectProperty(
                toPropertyKey(prop),
                t.objectExpression([
                  t.objectProperty(t.identifier("default"), t.nullLiteral()),
                  t.objectProperty(t.stringLiteral(condition), valueToAst(value)),
                ]),
              ),
            );
          } else {
            bodyProps.push(t.objectProperty(toPropertyKey(prop), valueToAst(value)));
          }
        }
      }

      let bodyExpr: t.Expression = t.objectExpression(bodyProps);
      if (entry.dynamic.pseudoElement) {
        // Wrap: { '::placeholder': { ...bodyProps } }
        bodyExpr = t.objectExpression([t.objectProperty(t.stringLiteral(entry.dynamic.pseudoElement), bodyExpr)]);
      }
      const arrowFn = t.arrowFunctionExpression([paramId], bodyExpr);
      createProperties.push(t.objectProperty(toPropertyKey(entry.key), arrowFn));
      continue;
    }

    if (entry.whenPseudo && entry.defs) {
      const ap = entry.whenPseudo;
      const props: t.ObjectProperty[] = [];

      for (const [prop, value] of Object.entries(entry.defs)) {
        // `when.ancestor(...)` must remain a computed key expression so StyleX
        // can generate marker-aware selectors.
        const whenCallArgs: t.Expression[] = [t.stringLiteral(ap.pseudo)];
        if (ap.markerNode) {
          whenCallArgs.push(ap.markerNode);
        }

        const relationship = ap.relationship ?? "ancestor";
        const whenCall = t.callExpression(
          t.memberExpression(
            t.memberExpression(t.identifier(stylexNamespaceName), t.identifier("when")),
            t.identifier(relationship),
          ),
          whenCallArgs,
        );

        props.push(
          t.objectProperty(
            toPropertyKey(prop),
            t.objectExpression([
              t.objectProperty(t.identifier("default"), t.nullLiteral()),
              t.objectProperty(whenCall, valueToAst(value), true),
            ]),
          ),
        );
      }

      createProperties.push(t.objectProperty(toPropertyKey(entry.key), t.objectExpression(props)));
      continue;
    }

    if (entry.defs) {
      createProperties.push(t.objectProperty(toPropertyKey(entry.key), defsToAst(entry.defs)));
    }
  }

  return createProperties;
}

/**
 * Build the per-file increment helper used by dynamic incremented calls.
 *
 * The helper is only emitted when needed to keep transformed files minimal.
 */
export function buildMaybeIncDeclaration(helperName: string, increment: number): t.VariableDeclaration {
  const incParam = t.identifier("inc");
  const body = t.blockStatement([
    t.returnStatement(
      t.conditionalExpression(
        t.binaryExpression("===", t.unaryExpression("typeof", incParam), t.stringLiteral("string")),
        incParam,
        t.templateLiteral(
          [t.templateElement({ raw: "", cooked: "" }, false), t.templateElement({ raw: "px", cooked: "px" }, true)],
          [t.binaryExpression("*", incParam, t.numericLiteral(increment))],
        ),
      ),
    ),
  ]);

  return t.variableDeclaration("const", [
    t.variableDeclarator(t.identifier(helperName), t.arrowFunctionExpression([incParam], body)),
  ]);
}

/** Build the per-file helper used to merge explicit `className` with `stylex.props()`. */
export function buildMergePropsDeclaration(helperName: string, stylexNamespaceName: string): t.FunctionDeclaration {
  const explicitClassNameParam = t.identifier("explicitClassName");
  const stylesRestParam = t.restElement(t.identifier("styles"));
  const sxId = t.identifier("sx");

  return t.functionDeclaration(
    t.identifier(helperName),
    [explicitClassNameParam, stylesRestParam],
    t.blockStatement([
      t.variableDeclaration("const", [
        t.variableDeclarator(
          sxId,
          t.callExpression(t.memberExpression(t.identifier(stylexNamespaceName), t.identifier("props")), [
            t.spreadElement(t.identifier("styles")),
          ]),
        ),
      ]),
      t.returnStatement(
        t.objectExpression([
          t.spreadElement(sxId),
          t.objectProperty(
            t.identifier("className"),
            t.callExpression(
              t.memberExpression(
                t.binaryExpression(
                  "+",
                  t.binaryExpression("+", explicitClassNameParam, t.stringLiteral(" ")),
                  t.logicalExpression("||", t.memberExpression(sxId, t.identifier("className")), t.stringLiteral("")),
                ),
                t.identifier("trim"),
              ),
              [],
            ),
          ),
        ]),
      ),
    ]),
  );
}

/** Build `const <createVarName> = <stylexNs>.create({...})`. */
export function buildCreateDeclaration(
  createVarName: string,
  stylexNamespaceName: string,
  createProperties: t.ObjectProperty[],
): t.VariableDeclaration {
  const createCall = t.callExpression(t.memberExpression(t.identifier(stylexNamespaceName), t.identifier("create")), [
    t.objectExpression(createProperties),
  ]);
  return t.variableDeclaration("const", [t.variableDeclarator(t.identifier(createVarName), createCall)]);
}

export function buildRuntimeLookupDeclaration(
  lookupName: string,
  createVarName: string,
  lookup: RuntimeLookupSpec,
): t.VariableDeclaration {
  const properties: t.ObjectProperty[] = [];

  for (const [name, refs] of Object.entries(lookup.refsByName)) {
    const values = refs.map(function (refKey) {
      return t.memberExpression(t.identifier(createVarName), t.identifier(refKey));
    });
    properties.push(t.objectProperty(toPropertyKey(name), t.arrayExpression(values)));
  }

  return t.variableDeclaration("const", [
    t.variableDeclarator(t.identifier(lookupName), t.objectExpression(properties)),
  ]);
}

/** Convert style definitions to an AST object, recursively. */
function defsToAst(defs: Record<string, unknown>): t.ObjectExpression {
  const properties: t.ObjectProperty[] = [];

  for (const [key, value] of Object.entries(defs)) {
    const keyNode = toPropertyKey(key);

    if (value === null) {
      properties.push(t.objectProperty(keyNode, t.nullLiteral()));
    } else if (typeof value === "string") {
      properties.push(t.objectProperty(keyNode, t.stringLiteral(value)));
    } else if (typeof value === "number") {
      properties.push(t.objectProperty(keyNode, t.numericLiteral(value)));
    } else if (typeof value === "object") {
      properties.push(t.objectProperty(keyNode, defsToAst(value as Record<string, unknown>)));
    }
  }

  return t.objectExpression(properties);
}

/** Convert a primitive/object style value into an AST expression node. */
function valueToAst(value: unknown): t.Expression {
  if (value === null) return t.nullLiteral();
  if (typeof value === "string") return t.stringLiteral(value);
  if (typeof value === "number") return t.numericLiteral(value);
  if (typeof value === "object") return defsToAst(value as Record<string, unknown>);
  return t.stringLiteral(String(value));
}

/** Use identifier keys when legal, otherwise string literal keys. */
function toPropertyKey(key: string): t.Identifier | t.StringLiteral {
  return isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key);
}

function isValidIdentifier(s: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s);
}
