import _traverse from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";
import type { TrussMapping } from "./types";
import type { ResolvedChain } from "./resolve-chain";
import { buildStyleHashProperties, markerClassName } from "./emit-truss";
import type { ResolvedSegment } from "./types";

// Babel packages are CJS today; normalize default interop across loaders.
const generate = ((_generate as unknown as { default?: typeof _generate }).default ?? _generate) as typeof _generate;
const traverse = ((_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse) as typeof _traverse;

export interface ExpressionSite {
  path: NodePath<t.MemberExpression>;
  resolvedChain: ResolvedChain;
}

export interface RewriteSitesOptions {
  ast: t.File;
  sites: ExpressionSite[];
  cssBindingName: string;
  filename: string;
  debug: boolean;
  mapping: TrussMapping;
  maybeIncHelperName: string | null;
  mergePropsHelperName: string;
  needsMergePropsHelper: { current: boolean };
  trussPropsHelperName: string;
  needsTrussPropsHelper: { current: boolean };
  trussDebugInfoName: string;
  needsTrussDebugInfo: { current: boolean };
  runtimeLookupNames: Map<string, string>;
}

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
      // JSX css= attribute → spread trussProps or mergeProps
      cssAttrPath.replaceWith(t.jsxSpreadAttribute(buildCssSpreadExpression(cssAttrPath, styleHash, line, options)));
    } else {
      // Non-JSX position → plain object expression with optional debug info
      if (options.debug && line !== null) {
        injectDebugInfo(styleHash, line, options);
      }
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

/** Build an ObjectExpression from a ResolvedChain, handling conditionals. */
function buildStyleHashFromChain(chain: ResolvedChain, options: RewriteSitesOptions): t.ObjectExpression {
  const members: (t.ObjectProperty | t.SpreadElement)[] = [];
  const previousProperties = new Map<string, t.ObjectProperty>();

  if (chain.markers.length > 0) {
    const markerClasses = chain.markers.map((marker) => {
      return markerClassName(marker.markerNode);
    });
    members.push(t.objectProperty(t.identifier("__marker"), t.stringLiteral(markerClasses.join(" "))));
  }

  for (const part of chain.parts) {
    if (part.type === "unconditional") {
      const partMembers = buildStyleHashMembers(part.segments, options);
      members.push(...partMembers);
      for (const member of partMembers) {
        if (t.isObjectProperty(member)) {
          previousProperties.set(propertyName(member.key), member);
        }
      }
    } else {
      // Conditional: ...(cond ? { then } : { else })
      const thenMembers = mergeConditionalBranchMembers(
        buildStyleHashMembers(part.thenSegments, options),
        previousProperties,
        collectConditionalOnlyProps(part.thenSegments),
      );
      const elseMembers = mergeConditionalBranchMembers(
        buildStyleHashMembers(part.elseSegments, options),
        previousProperties,
        collectConditionalOnlyProps(part.elseSegments),
      );
      members.push(
        t.spreadElement(
          t.conditionalExpression(part.conditionNode, t.objectExpression(thenMembers), t.objectExpression(elseMembers)),
        ),
      );
    }
  }

  return t.objectExpression(members);
}

/**
 * Build ObjectExpression members from a list of segments.
 *
 * Normal segments are batched and processed by buildStyleHashProperties.
 * Special segments (styleArrayArg, typographyLookup, classNameArg) produce
 * spread members or reserved metadata properties.
 */
function buildStyleHashMembers(
  segments: ResolvedSegment[],
  options: RewriteSitesOptions,
): (t.ObjectProperty | t.SpreadElement)[] {
  const members: (t.ObjectProperty | t.SpreadElement)[] = [];
  const normalSegs: ResolvedSegment[] = [];
  const classNameArgs: t.Expression[] = [];

  function flushNormal(): void {
    if (normalSegs.length > 0) {
      members.push(...buildStyleHashProperties(normalSegs, options.mapping, options.maybeIncHelperName));
      normalSegs.length = 0;
    }
  }

  for (const seg of segments) {
    if (seg.error) continue;

    if (seg.classNameArg) {
      // I.e. `Css.className(cls).df.$` becomes `className: [cls]` in the style hash.
      classNameArgs.push(t.cloneNode(seg.classNameArg, true) as t.Expression);
      continue;
    }

    if (seg.styleArrayArg) {
      flushNormal();
      if (seg.isAddCss && t.isObjectExpression(seg.styleArrayArg)) {
        members.push(...buildAddCssObjectMembers(seg.styleArrayArg));
      } else {
        members.push(t.spreadElement(seg.styleArrayArg as t.Expression));
      }
      continue;
    }

    if (seg.typographyLookup) {
      flushNormal();
      const lookupName = options.runtimeLookupNames.get(seg.typographyLookup.lookupKey);
      if (lookupName) {
        // I.e. `{ ...(__typography[key] ?? {}) }`
        const lookupAccess = t.memberExpression(
          t.identifier(lookupName),
          seg.typographyLookup.argNode as t.Expression,
          true,
        );
        members.push(t.spreadElement(t.logicalExpression("??", lookupAccess, t.objectExpression([]))));
      }
      continue;
    }

    normalSegs.push(seg);
  }

  flushNormal();
  if (classNameArgs.length > 0) {
    // I.e. keep raw class expressions separate from atomic CSS-property entries.
    members.push(t.objectProperty(t.identifier("className"), t.arrayExpression(classNameArgs)));
  }
  return members;
}

function buildAddCssObjectMembers(styleObject: t.ObjectExpression): (t.ObjectProperty | t.SpreadElement)[] {
  const members: (t.ObjectProperty | t.SpreadElement)[] = [];

  for (const property of styleObject.properties) {
    if (t.isSpreadElement(property)) {
      members.push(t.spreadElement(t.cloneNode(property.argument, true) as t.Expression));
      continue;
    }

    if (!t.isObjectProperty(property) || property.computed) {
      members.push(t.spreadElement(t.objectExpression([t.cloneNode(property, true)])));
      continue;
    }

    const value = property.value;
    if (t.isIdentifier(value) || t.isMemberExpression(value) || t.isOptionalMemberExpression(value)) {
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
  const allProps = new Map<string, boolean>();
  for (const seg of segments) {
    if (seg.error || seg.styleArrayArg || seg.typographyLookup || seg.classNameArg) continue;
    const hasCondition = !!(seg.pseudoClass || seg.mediaQuery || seg.pseudoElement || seg.whenPseudo);
    const props = seg.variableProps ?? Object.keys(seg.defs);
    for (const prop of props) {
      const current = allProps.get(prop);
      // If any segment for this property is unconditional, it's not conditional-only
      allProps.set(prop, current === undefined ? hasCondition : current && hasCondition);
    }
  }
  const result = new Set<string>();
  for (const [prop, isConditionalOnly] of allProps) {
    if (isConditionalOnly) result.add(prop);
  }
  return result;
}

/**
 * Merge prior base properties into conditional branch members, but only for
 * properties that are purely conditional (pseudo/media overlays). Plain
 * base-level replacements should NOT be merged — the spread will correctly
 * override the base when the condition is true.
 */
function mergeConditionalBranchMembers(
  members: (t.ObjectProperty | t.SpreadElement)[],
  previousProperties: Map<string, t.ObjectProperty>,
  conditionalOnlyProps: Set<string>,
): (t.ObjectProperty | t.SpreadElement)[] {
  return members.map((member) => {
    if (!t.isObjectProperty(member)) {
      return member;
    }

    const prop = propertyName(member.key);
    const prior = previousProperties.get(prop);
    if (prop === "className" && prior) {
      // I.e. `Css.className(base).if(cond).className(extra).$` should keep both classes when true.
      return t.objectProperty(clonePropertyKey(member.key), mergeClassNameValues(prior.value as t.Expression, member.value as t.Expression));
    }
    if (!prior || !conditionalOnlyProps.has(prop)) {
      return member;
    }

    return t.objectProperty(
      clonePropertyKey(member.key),
      mergePropertyValues(prior.value as t.Expression, member.value as t.Expression),
    );
  });
}

function mergePropertyValues(previousValue: t.Expression, currentValue: t.Expression): t.Expression {
  if (t.isStringLiteral(previousValue) && t.isStringLiteral(currentValue)) {
    return t.stringLiteral(`${previousValue.value} ${currentValue.value}`);
  }

  if (t.isStringLiteral(previousValue) && t.isArrayExpression(currentValue)) {
    return mergeTupleValue(currentValue, previousValue.value, true);
  }

  if (t.isArrayExpression(previousValue) && t.isStringLiteral(currentValue)) {
    return mergeTupleValue(previousValue, currentValue.value, false);
  }

  if (t.isArrayExpression(previousValue) && t.isArrayExpression(currentValue)) {
    const previousClassNames = tupleClassNames(previousValue);
    return mergeTupleValue(currentValue, previousClassNames, true, arrayElementExpression(previousValue.elements[1]));
  }

  return t.cloneNode(currentValue, true);
}

function mergeClassNameValues(previousValue: t.Expression, currentValue: t.Expression): t.ArrayExpression {
  return t.arrayExpression([...toClassNameElements(previousValue), ...toClassNameElements(currentValue)]);
}

function toClassNameElements(value: t.Expression): t.Expression[] {
  if (t.isArrayExpression(value)) {
    return value.elements.flatMap((element) => {
      return element && !t.isSpreadElement(element) ? [t.cloneNode(element, true)] : [];
    });
  }
  return [t.cloneNode(value, true)];
}

function mergeTupleValue(
  tuple: t.ArrayExpression,
  classNames: string,
  prependClassNames: boolean,
  previousVars?: t.Expression | null,
): t.ArrayExpression {
  const currentClassNames = tupleClassNames(tuple);
  const mergedClassNames = prependClassNames
    ? `${classNames} ${currentClassNames}`
    : `${currentClassNames} ${classNames}`;
  const varsExpr = tuple.elements[1];
  const mergedVars =
    previousVars && arrayElementExpression(varsExpr)
      ? mergeVarsObject(previousVars, arrayElementExpression(varsExpr)!)
      : (arrayElementExpression(varsExpr) ?? previousVars ?? null);

  return t.arrayExpression([
    t.stringLiteral(mergedClassNames),
    mergedVars ? t.cloneNode(mergedVars, true) : t.objectExpression([]),
  ]);
}

function tupleClassNames(tuple: t.ArrayExpression): string {
  const classNames = tuple.elements[0];
  return t.isStringLiteral(classNames) ? classNames.value : "";
}

function arrayElementExpression(element: t.Expression | t.SpreadElement | null | undefined): t.Expression | null {
  return element && !t.isSpreadElement(element) ? element : null;
}

function mergeVarsObject(previousVars: t.Expression, currentVars: t.Expression): t.Expression {
  if (t.isObjectExpression(previousVars) && t.isObjectExpression(currentVars)) {
    return t.objectExpression([
      ...previousVars.properties.map((property) => {
        return t.cloneNode(property, true);
      }),
      ...currentVars.properties.map((property) => {
        return t.cloneNode(property, true);
      }),
    ]);
  }

  return t.cloneNode(currentVars, true);
}

function propertyName(key: t.Expression | t.Identifier | t.PrivateName): string {
  if (t.isIdentifier(key)) {
    return key.name;
  }
  if (t.isStringLiteral(key)) {
    return key.value;
  }
  return generate(key).code;
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
 * Inject debug info into the first property of a style hash ObjectExpression.
 *
 * For static values, promotes `"df"` to `["df", new TrussDebugInfo("...")]`.
 * For variable tuples, appends the debug info as a third element.
 */
function injectDebugInfo(
  expr: t.ObjectExpression,
  line: number,
  options: Pick<RewriteSitesOptions, "debug" | "trussDebugInfoName" | "needsTrussDebugInfo" | "filename">,
): void {
  if (!options.debug) return;

  // Find the first real style property (skip SpreadElements and __marker metadata)
  const firstProp = expr.properties.find((p) => {
    return (
      t.isObjectProperty(p) &&
      !(
        (t.isIdentifier(p.key) && p.key.name === "className") ||
        (t.isStringLiteral(p.key) && p.key.value === "className") ||
        (t.isIdentifier(p.key) && p.key.name === "__marker") ||
        (t.isStringLiteral(p.key) && p.key.value === "__marker")
      )
    );
  }) as t.ObjectProperty | undefined;
  if (!firstProp) return;

  options.needsTrussDebugInfo.current = true;
  const debugExpr = t.newExpression(t.identifier(options.trussDebugInfoName), [
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

// ---------------------------------------------------------------------------
// JSX css= attribute handling
// ---------------------------------------------------------------------------

/** Build the spread expression for a JSX `css=` attribute. */
function buildCssSpreadExpression(
  path: NodePath<t.JSXAttribute>,
  styleHash: t.Expression,
  line: number | null,
  options: RewriteSitesOptions,
): t.Expression {
  const existingClassNameExpr = removeExistingAttribute(path, "className");
  const existingStyleExpr = removeExistingAttribute(path, "style");

  if (!existingClassNameExpr && !existingStyleExpr) {
    return buildPropsCall(styleHash, line, options);
  }

  // mergeProps(className, style, hash)
  options.needsMergePropsHelper.current = true;

  if (options.debug && line !== null) {
    injectDebugInfo(styleHash as t.ObjectExpression, line, options);
  }

  return t.callExpression(t.identifier(options.mergePropsHelperName), [
    existingClassNameExpr ?? t.identifier("undefined"),
    existingStyleExpr ?? t.identifier("undefined"),
    styleHash,
  ]);
}

/** Emit `trussProps(hash)` call. In debug mode, injects debug info into the hash first. */
function buildPropsCall(styleHash: t.Expression, line: number | null, options: RewriteSitesOptions): t.CallExpression {
  options.needsTrussPropsHelper.current = true;

  if (options.debug && line !== null && t.isObjectExpression(styleHash)) {
    injectDebugInfo(styleHash, line, options);
  }

  return t.callExpression(t.identifier(options.trussPropsHelperName), [styleHash]);
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
      if (!isCssPropsCall(path.node, options.cssBindingName)) return;

      const arg = path.node.arguments[0];
      if (!arg || t.isSpreadElement(arg) || !t.isExpression(arg) || path.node.arguments.length !== 1) return;

      options.needsTrussPropsHelper.current = true;

      // Check for a sibling `className` property in the parent object literal
      const classNameExpr = extractSiblingClassName(path);
      if (classNameExpr) {
        options.needsMergePropsHelper.current = true;
        path.replaceWith(
          t.callExpression(t.identifier(options.mergePropsHelperName), [classNameExpr, t.identifier("undefined"), arg]),
        );
      } else {
        path.replaceWith(t.callExpression(t.identifier(options.trussPropsHelperName), [arg]));
      }
    },
    // -- Remaining css={expr} JSX attributes → {...trussProps(expr)} spreads --
    // I.e. css={someVariable}, css={{ ...a, ...b }}, css={cond ? a : b}
    JSXAttribute(path: NodePath<t.JSXAttribute>) {
      if (!t.isJSXIdentifier(path.node.name, { name: "css" })) return;
      const value = path.node.value;
      if (!t.isJSXExpressionContainer(value)) return;
      if (!t.isExpression(value.expression)) return;

      const expr = value.expression;

      const existingClassNameExpr = removeExistingAttribute(path, "className");
      const existingStyleExpr = removeExistingAttribute(path, "style");

      if (existingClassNameExpr || existingStyleExpr) {
        options.needsMergePropsHelper.current = true;
        path.replaceWith(
          t.jsxSpreadAttribute(
            t.callExpression(t.identifier(options.mergePropsHelperName), [
              existingClassNameExpr ?? t.identifier("undefined"),
              existingStyleExpr ?? t.identifier("undefined"),
              expr,
            ]),
          ),
        );
      } else {
        options.needsTrussPropsHelper.current = true;
        path.replaceWith(t.jsxSpreadAttribute(t.callExpression(t.identifier(options.trussPropsHelperName), [expr])));
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Match `Css.props(...)` calls. */
function isCssPropsCall(expr: t.CallExpression, cssBindingName: string): boolean {
  return (
    t.isMemberExpression(expr.callee) &&
    !expr.callee.computed &&
    t.isIdentifier(expr.callee.object, { name: cssBindingName }) &&
    t.isIdentifier(expr.callee.property, { name: "props" })
  );
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
    if (!isMatchingPropertyName(prop.key, "className")) continue;
    if (!t.isExpression(prop.value)) continue;

    const classNameExpr = prop.value;
    properties.splice(i, 1);
    return classNameExpr;
  }

  return null;
}

/** Match static object property names. */
function isMatchingPropertyName(key: t.Expression | t.Identifier | t.PrivateName, name: string): boolean {
  return (t.isIdentifier(key) && key.name === name) || (t.isStringLiteral(key) && key.value === name);
}
