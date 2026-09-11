import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { hasCondition, isCssSegment, type CssSegment, type ResolvedSegment, type TrussMapping } from "./types";
import type { ResolvedChain } from "./resolve-chain";
import { collectStyleEntryGroups, styleHashProperties } from "./emit-style-hash";
import { markerClassName, type StyleEntry } from "./style-entries";
import { generate, traverse } from "./babel-utils";
import { isCssMethodCall, staticPropertyName } from "./ast-utils";
import { TRUSS_CUSTOM_CLASS_PREFIX, TRUSS_INLINE_STYLE_PREFIX, TRUSS_MARKER_KEY } from "../style-metadata";

export interface ExpressionSite {
  path: NodePath<t.MemberExpression>;
  resolvedChain: ResolvedChain;
}

/** The `@homebound/truss/runtime` exports the rewritten code may call. */
export type RuntimeHelperName = "trussProps" | "mergeProps" | "TrussDebugInfo" | "maybeCssVar";

export interface RuntimeHelpers {
  /**
   * The local identifier for a runtime export, marking it as used so the import gets added.
   *
   * I.e. `use("mergeProps")` → `"mergeProps"`, or `"mergeProps13"` when the module already
   * has `import { mergeProps as mergeProps13 } from "@homebound/truss/runtime"`.
   */
  use(name: RuntimeHelperName): string;
}

export interface RewriteSitesOptions {
  ast: t.File;
  sites: ExpressionSite[];
  /** Null when the file only has JSX `css=` attributes and no `Css` binding. */
  cssBindingName: string | null;
  filename: string;
  debug: boolean;
  mapping: TrussMapping;
  maybeIncHelperName: string | null;
  maybeCssVarHelperName: string | null;
  runtime: RuntimeHelpers;
  runtimeLookupNames: Map<string, string>;
}

type StyleHashMember = t.ObjectProperty | t.SpreadElement;

/** Entry groups keyed by CSS property, i.e. `color → [blue, h_white]`. */
type StyleEntryGroups = Map<string, StyleEntry[]>;

/**
 * Rewrite collected `Css...$` expression sites into Truss-native style hash objects.
 *
 * In the new model, each site becomes an ObjectExpression keyed by CSS property.
 * JSX `css=` attributes become `trussProps(hash)` or `mergeProps(className, style, hash)` spreads.
 * Non-JSX positions become plain object expressions.
 */
export function rewriteExpressionSites(options: RewriteSitesOptions): void {
  for (const site of options.sites) {
    const styleHash = buildStyleHashFromChain(site.resolvedChain, options);
    const cssAttrPath = getCssAttributePath(site.path);
    const line = site.path.node.loc?.start.line ?? null;

    if (cssAttrPath) {
      // JSX css= attribute → static className when possible, otherwise spread trussProps/mergeProps
      if (
        !options.debug &&
        isFullyStaticStyleHash(styleHash) &&
        !hasExistingAttribute(cssAttrPath, "className") &&
        !hasExistingAttribute(cssAttrPath, "style")
      ) {
        const classNames = extractStaticClassNames(styleHash);
        cssAttrPath.replaceWith(t.jsxAttribute(t.jsxIdentifier("className"), t.stringLiteral(classNames)));
      } else {
        cssAttrPath.replaceWith(buildCssSpreadAttribute(cssAttrPath, styleHash, line, options));
      }
    } else {
      // Non-JSX position → plain object expression with optional debug info
      injectDebugInfo(styleHash, line, options);
      site.path.replaceWith(styleHash);
    }
  }

  // Single pass: rewrite Css.props(...) calls and remaining css={...} attributes together
  rewriteCssPropsAndCssAttributes(options);
}

/**
 * Return the enclosing `css={...}` JSX attribute path for a transformed site,
 * or null when the site is in a non-`css` expression context.
 */
function getCssAttributePath(path: NodePath<t.MemberExpression>): NodePath<t.JSXAttribute> | null {
  const parentPath = path.parentPath;
  if (!parentPath || !parentPath.isJSXExpressionContainer()) return null;

  const attrPath = parentPath.parentPath;
  if (!attrPath || !attrPath.isJSXAttribute()) return null;
  if (!t.isJSXIdentifier(attrPath.node.name, { name: "css" })) return null;

  return attrPath;
}

// ---------------------------------------------------------------------------
// Building style hash objects from resolved chains
// ---------------------------------------------------------------------------

/**
 * Build an ObjectExpression from a ResolvedChain, handling conditionals.
 *
 * I.e. `Css.blue.if(cond).onHover.black.$` →
 * `{ color: "blue", ...(cond ? { color: "blue h_black" } : {}) }`.
 */
function buildStyleHashFromChain(chain: ResolvedChain, options: RewriteSitesOptions): t.ObjectExpression {
  const members: StyleHashMember[] = [];
  // The latest entry group per CSS property from the unconditional parts so far, so a conditional
  // branch can carry the base classes alongside its own conditional-only overlays.
  const previousGroups: StyleEntryGroups = new Map();
  const pendingUnconditionalSegments: ResolvedSegment[] = [];

  function flushPendingUnconditionalSegments(): void {
    // I.e. `Css.black.when({ ":hover": Css.blue.$ }).$` becomes one merged `color: "black h_blue"` entry.
    if (pendingUnconditionalSegments.length === 0) {
      return;
    }

    const built = buildStyleHashMembers(pendingUnconditionalSegments, options);
    members.push(...built.members);
    for (const [cssProp, entries] of built.groups) {
      previousGroups.set(cssProp, entries);
    }
    pendingUnconditionalSegments.length = 0;
  }

  /**
   * Build one `if()` branch.
   *
   * Properties the branch only touches conditionally (i.e. `onHover.black`) start from the base
   * entries, so the spread keeps `blue` alongside `h_black` instead of dropping it. Plain
   * replacements (i.e. an unconditional `black`) get no seed, so the spread overrides the base.
   */
  function buildBranchMembers(segments: ResolvedSegment[]): StyleHashMember[] {
    const conditionalOnly = collectConditionalOnlyProps(segments);
    const seed: StyleEntryGroups = new Map([...previousGroups].filter(([cssProp]) => conditionalOnly.has(cssProp)));
    return buildStyleHashMembers(segments, options, seed).members;
  }

  if (chain.markers.length > 0) {
    const markerClasses = chain.markers.map((marker) => markerClassName(marker.markerNode));
    members.push(t.objectProperty(t.identifier(TRUSS_MARKER_KEY), t.stringLiteral(markerClasses.join(" "))));
  }

  for (const part of chain.parts) {
    if (part.type === "unconditional") {
      pendingUnconditionalSegments.push(...part.segments);
    } else {
      flushPendingUnconditionalSegments();
      // Conditional: ...(cond ? { then } : { else })
      const thenMembers = buildBranchMembers(part.thenSegments);
      const elseMembers = buildBranchMembers(part.elseSegments);
      members.push(
        t.spreadElement(
          t.conditionalExpression(part.conditionNode, t.objectExpression(thenMembers), t.objectExpression(elseMembers)),
        ),
      );
    }
  }

  flushPendingUnconditionalSegments();

  return t.objectExpression(members);
}

/**
 * Build ObjectExpression members from a list of segments.
 *
 * CSS segments are batched into entry groups and emitted as style hash properties. The other kinds
 * (composed, typography, className, inlineStyle) produce spread members or reserved metadata properties.
 *
 * Returns the members plus the entry groups they were built from, so an enclosing conditional can
 * seed its branches with them.
 */
function buildStyleHashMembers(
  segments: ResolvedSegment[],
  options: RewriteSitesOptions,
  seed?: StyleEntryGroups,
): { members: StyleHashMember[]; groups: StyleEntryGroups } {
  const members: StyleHashMember[] = [];
  const groups: StyleEntryGroups = new Map();
  const cssSegs: CssSegment[] = [];
  const classNameArgs: t.Expression[] = [];
  const styleKeyCounts = new Map<string, number>();

  function flushCssSegs(): void {
    if (cssSegs.length === 0) return;
    const batchGroups = collectStyleEntryGroups(cssSegs, options.mapping, seed);
    members.push(...styleHashProperties(batchGroups, options.maybeIncHelperName, options.maybeCssVarHelperName));
    for (const [cssProp, entries] of batchGroups) {
      groups.set(cssProp, entries);
    }
    cssSegs.length = 0;
  }

  for (const seg of segments) {
    switch (seg.kind) {
      case "error":
        continue;
      case "className":
        // I.e. `Css.className(cls).df.$` becomes `className_cls: cls` in the style hash.
        classNameArgs.push(t.cloneNode(seg.arg, true));
        continue;
      case "inlineStyle":
        flushCssSegs();
        members.push(buildMetadataMember(TRUSS_INLINE_STYLE_PREFIX, seg.arg, styleKeyCounts));
        continue;
      case "composed":
        flushCssSegs();
        if (seg.skipUndefined && t.isObjectExpression(seg.arg)) {
          members.push(...buildAddCssObjectMembers(seg.arg));
        } else {
          members.push(t.spreadElement(seg.arg));
        }
        continue;
      case "typography": {
        flushCssSegs();
        const lookupName = options.runtimeLookupNames.get(seg.lookupKey);
        if (lookupName) {
          // I.e. `{ ...(__typography[key] ?? {}) }`
          const lookupAccess = t.memberExpression(t.identifier(lookupName), seg.argNode, true);
          members.push(t.spreadElement(t.logicalExpression("??", lookupAccess, t.objectExpression([]))));
        }
        continue;
      }
    }

    // In debug mode, add the abbreviation name as a marker className for multi-property
    // segments so engineers can see the origin in the DOM. I.e. `Css.bb.$` adds "bb"
    // alongside "bbs_solid bbw_1px", and `Css.lineClamp(n).$` adds "lineClamp".
    if (options.debug) {
      const isMultiProp = seg.kind === "static" && Object.keys(seg.defs).length > 1;
      const hasExtraDefs = seg.kind === "variable" && !!seg.extraDefs && Object.keys(seg.extraDefs).length > 0;
      if (isMultiProp || hasExtraDefs) {
        classNameArgs.push(t.stringLiteral(seg.abbr));
      }
    }

    cssSegs.push(seg);
  }

  flushCssSegs();
  if (classNameArgs.length > 0) {
    // Prepend so markers/custom classes appear first in the DOM,
    // I.e. `className="bb bbs_solid bbw_1px"` rather than at the end.
    // Uses unique `className_${key}` keys so spreading preserves all entries.
    const classNameKeyCounts = new Map<string, number>();
    members.unshift(
      ...classNameArgs.map((arg) => buildMetadataMember(TRUSS_CUSTOM_CLASS_PREFIX, arg, classNameKeyCounts)),
    );
  }
  return { members, groups };
}

/** I.e. `className_my_btn: "my-btn"`, with `_2`, `_3` suffixes for repeated keys. */
function buildMetadataMember(prefix: string, arg: t.Expression, counts: Map<string, number>): t.ObjectProperty {
  const baseKey = `${prefix}${sanitizeMetadataKey(arg)}`;
  const count = (counts.get(baseKey) ?? 0) + 1;
  counts.set(baseKey, count);
  const key = count === 1 ? baseKey : `${baseKey}_${count}`;
  return t.objectProperty(t.identifier(key), t.cloneNode(arg, true));
}

/** Derive a valid JS identifier suffix from metadata args. I.e. `"my-btn"` → `my_btn`, `vars` → `vars`. */
function sanitizeMetadataKey(arg: t.Expression): string {
  const raw = t.isStringLiteral(arg)
    ? arg.value
    : t.isTemplateLiteral(arg) && arg.expressions.length === 0 && arg.quasis.length === 1
      ? (arg.quasis[0].value.cooked ?? "")
      : generate(arg).code;

  const sanitized = raw
    .replace(/[^a-zA-Z0-9_$]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized || "value";
}

/**
 * Spread an `with({ height, ...rest })` object literal member by member, skipping identifier and
 * member-expression values that are `undefined` at runtime so they do not clobber earlier styles.
 */
function buildAddCssObjectMembers(styleObject: t.ObjectExpression): StyleHashMember[] {
  const members: StyleHashMember[] = [];

  for (const property of styleObject.properties) {
    if (t.isSpreadElement(property)) {
      members.push(t.spreadElement(t.cloneNode(property.argument, true)));
      continue;
    }

    if (!t.isObjectProperty(property) || property.computed) {
      members.push(t.spreadElement(t.objectExpression([t.cloneNode(property, true)])));
      continue;
    }

    const value = property.value;
    if (t.isIdentifier(value) || t.isMemberExpression(value) || t.isOptionalMemberExpression(value)) {
      // I.e. `...(height === undefined ? {} : { height })`
      members.push(
        t.spreadElement(
          t.conditionalExpression(
            t.binaryExpression("===", t.cloneNode(value, true), t.identifier("undefined")),
            t.objectExpression([]),
            t.objectExpression([t.objectProperty(clonePropertyKey(property.key), t.cloneNode(value, true))]),
          ),
        ),
      );
      continue;
    }

    members.push(t.spreadElement(t.objectExpression([t.cloneNode(property, true)])));
  }

  return members;
}

/**
 * Collect the set of CSS properties where ALL contributing segments have a condition
 * (pseudo-class, media query, pseudo-element, or when relationship).
 *
 * I.e. `onHover.white` → `color` is conditional-only (needs base merged in),
 * but `bgWhite` → `backgroundColor` is a plain replacement (should NOT merge).
 */
function collectConditionalOnlyProps(segments: ResolvedSegment[]): Set<string> {
  const conditionalOnly = new Map<string, boolean>();
  for (const seg of segments) {
    if (!isCssSegment(seg)) continue;
    const segHasCondition = hasCondition(seg.condition);
    const props = seg.kind === "variable" ? seg.props : Object.keys(seg.defs);
    for (const prop of props) {
      // If any segment for this property is unconditional, it's not conditional-only
      conditionalOnly.set(prop, (conditionalOnly.get(prop) ?? true) && segHasCondition);
    }
  }
  return new Set([...conditionalOnly].filter(([, isConditionalOnly]) => isConditionalOnly).map(([prop]) => prop));
}

function propertyName(key: t.Expression | t.Identifier | t.PrivateName): string {
  return staticPropertyName(key) ?? generate(key).code;
}

function clonePropertyKey(key: t.Expression | t.Identifier | t.PrivateName): t.Expression | t.Identifier {
  if (t.isPrivateName(key)) {
    return t.identifier(key.id.name);
  }
  return t.cloneNode(key, true);
}

// ---------------------------------------------------------------------------
// Debug info injection
// ---------------------------------------------------------------------------

/**
 * Inject debug info into the first style property of a style hash ObjectExpression.
 *
 * For static values, promotes `"df"` to `["df", new TrussDebugInfo("...")]`.
 * For variable tuples, appends the debug info as a third element.
 * No-op outside debug mode, without a source line, or for non-object hashes.
 */
function injectDebugInfo(
  styleHash: t.Expression,
  line: number | null,
  options: Pick<RewriteSitesOptions, "debug" | "filename" | "runtime">,
): void {
  if (!options.debug || line === null || !t.isObjectExpression(styleHash)) return;

  // Find the first real style property (skip SpreadElements and metadata like __marker / className_*)
  const firstProp = styleHash.properties.find((p): p is t.ObjectProperty => {
    return t.isObjectProperty(p) && !isMetadataKey(propertyName(p.key));
  });
  if (!firstProp) return;

  const debugExpr = t.newExpression(t.identifier(options.runtime.use("TrussDebugInfo")), [
    t.stringLiteral(`${options.filename}:${line}`),
  ]);

  if (t.isStringLiteral(firstProp.value)) {
    // Static: "df" → ["df", new TrussDebugInfo("...")]
    firstProp.value = t.arrayExpression([firstProp.value, debugExpr]);
  } else if (t.isArrayExpression(firstProp.value)) {
    // Variable tuple: ["mt_var", { vars }] → ["mt_var", { vars }, new TrussDebugInfo("...")]
    firstProp.value.elements.push(debugExpr);
  }
}

/** I.e. `__marker`, `className_foo`, and `style_vars` carry runtime metadata rather than CSS classes. */
function isMetadataKey(name: string): boolean {
  return (
    name === TRUSS_MARKER_KEY ||
    name.startsWith(TRUSS_CUSTOM_CLASS_PREFIX) ||
    name.startsWith(TRUSS_INLINE_STYLE_PREFIX)
  );
}

// ---------------------------------------------------------------------------
// JSX css= attribute handling
// ---------------------------------------------------------------------------

/**
 * Build the spread attribute for a JSX `css=` attribute.
 *
 * I.e. `{...trussProps(hash)}`, or `{...mergeProps(className, style, hash)}` when the element
 * also has `className`/`style` attributes (which are removed and merged in).
 */
function buildCssSpreadAttribute(
  path: NodePath<t.JSXAttribute>,
  styleHash: t.Expression,
  line: number | null,
  options: RewriteSitesOptions,
): t.JSXSpreadAttribute {
  const existingClassNameExpr = removeExistingAttribute(path, "className");
  const existingStyleExpr = removeExistingAttribute(path, "style");

  injectDebugInfo(styleHash, line, options);

  if (!existingClassNameExpr && !existingStyleExpr) {
    return t.jsxSpreadAttribute(t.callExpression(t.identifier(options.runtime.use("trussProps")), [styleHash]));
  }

  return t.jsxSpreadAttribute(
    t.callExpression(t.identifier(options.runtime.use("mergeProps")), [
      existingClassNameExpr ?? t.identifier("undefined"),
      existingStyleExpr ?? t.identifier("undefined"),
      styleHash,
    ]),
  );
}

/** Remove a sibling JSX attribute and return its expression. */
function removeExistingAttribute(path: NodePath<t.JSXAttribute>, attrName: string): t.Expression | null {
  const openingElement = path.parentPath;
  if (!openingElement || !openingElement.isJSXOpeningElement()) return null;

  const attrs = openingElement.node.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name, { name: attrName })) continue;

    let expr: t.Expression | null = null;
    if (t.isStringLiteral(attr.value)) {
      expr = attr.value;
    } else if (t.isJSXExpressionContainer(attr.value) && t.isExpression(attr.value.expression)) {
      expr = attr.value.expression;
    }

    attrs.splice(i, 1);
    return expr;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Combined pass: Css.props(...) rewriting + remaining css={...} attributes
// ---------------------------------------------------------------------------

/**
 * Single traversal that rewrites both `Css.props(expr)` calls and remaining
 * `css={expr}` JSX attributes, avoiding two separate full-AST passes.
 */
function rewriteCssPropsAndCssAttributes(options: RewriteSitesOptions): void {
  traverse(options.ast, {
    // -- Css.props(expr) → trussProps(expr) or mergeProps(...) --
    CallExpression(path: NodePath<t.CallExpression>) {
      if (!options.cssBindingName || !isCssMethodCall(path.node, options.cssBindingName, "props")) return;

      const arg = path.node.arguments[0];
      if (!arg || t.isSpreadElement(arg) || !t.isExpression(arg) || path.node.arguments.length !== 1) return;

      // Check for a sibling `className` property in the parent object literal
      const classNameExpr = extractSiblingClassName(path);
      if (classNameExpr) {
        path.replaceWith(
          t.callExpression(t.identifier(options.runtime.use("mergeProps")), [
            classNameExpr,
            t.identifier("undefined"),
            arg,
          ]),
        );
      } else {
        path.replaceWith(t.callExpression(t.identifier(options.runtime.use("trussProps")), [arg]));
      }
    },
    // -- Remaining css={expr} JSX attributes → {...trussProps(expr)} spreads --
    // I.e. css={someVariable}, css={{ ...a, ...b }}, css={cond ? a : b}
    JSXAttribute(path: NodePath<t.JSXAttribute>) {
      if (!t.isJSXIdentifier(path.node.name, { name: "css" })) return;
      if (isRuntimeStyleCssAttribute(path)) return;
      const value = path.node.value;
      if (!t.isJSXExpressionContainer(value)) return;
      if (!t.isExpression(value.expression)) return;

      path.replaceWith(buildCssSpreadAttribute(path, value.expression, path.node.loc?.start.line ?? null, options));
    },
  });
}

/**
 * If `...Css.props(...)` is spread inside an object literal that has a sibling
 * `className` property, extract and remove that property so the rewrite can
 * merge it via `mergeProps`.
 */
function extractSiblingClassName(callPath: NodePath<t.CallExpression>): t.Expression | null {
  // Walk up: CallExpression → SpreadElement → ObjectExpression
  const spreadPath = callPath.parentPath;
  if (!spreadPath || !spreadPath.isSpreadElement()) return null;
  const objectPath = spreadPath.parentPath;
  if (!objectPath || !objectPath.isObjectExpression()) return null;

  const properties = objectPath.node.properties;
  for (let i = 0; i < properties.length; i++) {
    const prop = properties[i];
    if (!t.isObjectProperty(prop)) continue;
    if (staticPropertyName(prop.key) !== "className") continue;
    if (!t.isExpression(prop.value)) continue;

    const classNameExpr = prop.value;
    properties.splice(i, 1);
    return classNameExpr;
  }

  return null;
}

/** `<RuntimeStyle css={...}>` takes real declarations, not a style hash, so it is left for the runtime. */
function isRuntimeStyleCssAttribute(path: NodePath<t.JSXAttribute>): boolean {
  const openingElementPath = path.parentPath;
  if (!openingElementPath || !openingElementPath.isJSXOpeningElement()) return false;
  return t.isJSXIdentifier(openingElementPath.node.name, { name: "RuntimeStyle" });
}

// ---------------------------------------------------------------------------
// Static style hash detection
// ---------------------------------------------------------------------------

/** Check whether a style hash has only static string values (no spreads, no tuples). */
function isFullyStaticStyleHash(hash: t.ObjectExpression): boolean {
  return hash.properties.every((prop) => t.isObjectProperty(prop) && t.isStringLiteral(prop.value));
}

/** Extract all static class names from a fully-static style hash, joined with spaces. */
function extractStaticClassNames(hash: t.ObjectExpression): string {
  const classNames: string[] = [];
  for (const prop of hash.properties) {
    if (t.isObjectProperty(prop) && t.isStringLiteral(prop.value)) {
      classNames.push(prop.value.value);
    }
  }
  return classNames.join(" ");
}

/** Check whether a sibling JSX attribute exists without removing it. */
function hasExistingAttribute(path: NodePath<t.JSXAttribute>, attrName: string): boolean {
  const openingElement = path.parentPath;
  if (!openingElement || !openingElement.isJSXOpeningElement()) return false;
  return openingElement.node.attributes.some((attr) => {
    return t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: attrName });
  });
}
