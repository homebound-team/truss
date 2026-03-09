import * as t from "@babel/types";
import type { ResolvedChain } from "./resolve-chain";

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
  dynamic?: { props: string[]; pseudo: string | null };
  /** If set, this entry uses stylex.when.ancestor() as the computed property key */
  ancestorPseudo?: { pseudo: string; marker?: string };
}

export interface CollectedCreateData {
  createEntries: Map<string, CreateEntrySpec>;
  needsMaybeInc: boolean;
  namedMarkers: Set<string>;
}

/**
 * Aggregate per-site resolved chains into file-level emission data.
 *
 * Why this exists: we emit one `stylex.create(...)` per source file, so all
 * style segments across all transformed sites must be deduplicated first.
 */
export function collectCreateData(chains: ResolvedChain[]): CollectedCreateData {
  const createEntries = new Map<string, CreateEntrySpec>();
  const namedMarkers = new Set<string>();
  let needsMaybeInc = false;

  for (const chain of chains) {
    for (const part of chain.parts) {
      const segs = part.type === "unconditional" ? part.segments : [...part.thenSegments, ...part.elseSegments];

      for (const seg of segs) {
        if (seg.dynamicProps) {
          if (!createEntries.has(seg.key)) {
            // Keyed dedupe guarantees a stable single entry for repeated usage.
            createEntries.set(seg.key, {
              key: seg.key,
              dynamic: { props: seg.dynamicProps, pseudo: seg.pseudo },
            });
          }
        } else {
          if (!createEntries.has(seg.key)) {
            createEntries.set(seg.key, {
              key: seg.key,
              defs: seg.defs,
              ancestorPseudo: seg.ancestorPseudo,
            });
          }
        }

        if (seg.incremented && seg.dynamicProps) {
          needsMaybeInc = true;
        }

        if (seg.ancestorPseudo?.marker) {
          namedMarkers.add(seg.ancestorPseudo.marker);
        }
      }
    }

    for (const marker of chain.markers) {
      if (marker.name) {
        namedMarkers.add(marker.name);
      }
    }
  }

  return { createEntries, needsMaybeInc, namedMarkers };
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
  markerVarForName: (name: string) => string,
): t.ObjectProperty[] {
  const createProperties: t.ObjectProperty[] = [];

  for (const [, entry] of createEntries) {
    if (entry.dynamic) {
      const paramId = t.identifier("v");
      const bodyProps: t.ObjectProperty[] = [];

      for (const prop of entry.dynamic.props) {
        if (entry.dynamic.pseudo) {
          bodyProps.push(
            t.objectProperty(
              toPropertyKey(prop),
              t.objectExpression([
                t.objectProperty(t.identifier("default"), t.nullLiteral()),
                t.objectProperty(t.stringLiteral(entry.dynamic.pseudo), paramId),
              ]),
            ),
          );
        } else {
          bodyProps.push(t.objectProperty(toPropertyKey(prop), paramId));
        }
      }

      const arrowFn = t.arrowFunctionExpression([paramId], t.objectExpression(bodyProps));
      createProperties.push(t.objectProperty(toPropertyKey(entry.key), arrowFn));
      continue;
    }

    if (entry.ancestorPseudo && entry.defs) {
      const ap = entry.ancestorPseudo;
      const props: t.ObjectProperty[] = [];

      for (const [prop, value] of Object.entries(entry.defs)) {
        // `when.ancestor(...)` must remain a computed key expression so StyleX
        // can generate marker-aware selectors.
        const whenCallArgs: t.Expression[] = [t.stringLiteral(ap.pseudo)];
        if (ap.marker) {
          whenCallArgs.push(t.identifier(markerVarForName(ap.marker)));
        }

        const whenCall = t.callExpression(
          t.memberExpression(
            t.memberExpression(t.identifier(stylexNamespaceName), t.identifier("when")),
            t.identifier("ancestor"),
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

/**
 * Build declarations for named markers (`stylex.defineMarker()`).
 */
export function buildMarkerDeclarations(
  markerNames: Iterable<string>,
  stylexNamespaceName: string,
  markerVarForName: (name: string) => string,
): t.VariableDeclaration[] {
  const declarations: t.VariableDeclaration[] = [];

  for (const markerName of markerNames) {
    const defineCall = t.callExpression(
      t.memberExpression(t.identifier(stylexNamespaceName), t.identifier("defineMarker")),
      [],
    );
    declarations.push(
      t.variableDeclaration("const", [t.variableDeclarator(t.identifier(markerVarForName(markerName)), defineCall)]),
    );
  }

  return declarations;
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
