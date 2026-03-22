import _traverse from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";
import type { TrussMapping } from "./types";
import type { ResolvedChain } from "./resolve-chain";
import { buildStyleHashProperties } from "./emit-truss";
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
  skippedCssPropMessages: Array<{ message: string; line: number | null }>;
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

  rewriteCssPropsCalls(options);
  rewriteCssSpreadCalls(options.ast, options.cssBindingName);

  // Second pass: lower any remaining `css={...}` expression to `trussProps(...)`.
  rewriteCssAttributeExpressions(options);
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

  for (const part of chain.parts) {
    if (part.type === "unconditional") {
      members.push(...buildStyleHashMembers(part.segments, options));
    } else {
      // Conditional: ...(cond ? { then } : { else })
      const thenMembers = buildStyleHashMembers(part.thenSegments, options);
      const elseMembers = buildStyleHashMembers(part.elseSegments, options);
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
 * Special segments (styleArrayArg, typographyLookup) produce SpreadElements.
 */
function buildStyleHashMembers(
  segments: ResolvedSegment[],
  options: RewriteSitesOptions,
): (t.ObjectProperty | t.SpreadElement)[] {
  const members: (t.ObjectProperty | t.SpreadElement)[] = [];
  const normalSegs: ResolvedSegment[] = [];

  function flushNormal(): void {
    if (normalSegs.length > 0) {
      members.push(...buildStyleHashProperties(normalSegs, options.mapping, options.maybeIncHelperName));
      normalSegs.length = 0;
    }
  }

  for (const seg of segments) {
    if (seg.error || seg.whenPseudo) continue;

    if (seg.styleArrayArg) {
      flushNormal();
      // In the new model, add(cssProp) takes a style hash object — just spread it
      members.push(t.spreadElement(seg.styleArrayArg as t.Expression));
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
  return members;
}

// ---------------------------------------------------------------------------
// Debug info injection
// ---------------------------------------------------------------------------

/**
 * Inject debug info into the first property of a style hash ObjectExpression.
 *
 * For static values, promotes `"df"` to `["df", new TrussDebugInfo("...")]`.
 * For dynamic tuples, appends the debug info as a third element.
 */
function injectDebugInfo(
  expr: t.ObjectExpression,
  line: number,
  options: Pick<RewriteSitesOptions, "debug" | "trussDebugInfoName" | "needsTrussDebugInfo" | "filename">,
): void {
  if (!options.debug) return;

  // Find the first ObjectProperty (skip SpreadElements)
  const firstProp = expr.properties.find((p) => t.isObjectProperty(p)) as t.ObjectProperty | undefined;
  if (!firstProp) return;

  options.needsTrussDebugInfo.current = true;
  const debugExpr = t.newExpression(t.identifier(options.trussDebugInfoName), [
    t.stringLiteral(`${options.filename}:${line}`),
  ]);

  if (t.isStringLiteral(firstProp.value)) {
    // Static: "df" → ["df", new TrussDebugInfo("...")]
    firstProp.value = t.arrayExpression([firstProp.value, debugExpr]);
  } else if (t.isArrayExpression(firstProp.value)) {
    // Dynamic tuple: ["mt_dyn", { vars }] → ["mt_dyn", { vars }, new TrussDebugInfo("...")]
    firstProp.value.elements.push(debugExpr);
  }
}

/** Build the `new TrussDebugInfo("File.tsx:line")` expression for a site. */
function buildDebugExpr(
  line: number | null,
  options: Pick<RewriteSitesOptions, "debug" | "trussDebugInfoName" | "needsTrussDebugInfo" | "filename">,
): t.NewExpression | null {
  if (!options.debug || line === null) return null;

  options.needsTrussDebugInfo.current = true;
  return t.newExpression(t.identifier(options.trussDebugInfoName), [t.stringLiteral(`${options.filename}:${line}`)]);
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
// Css.props(...) rewriting
// ---------------------------------------------------------------------------

/**
 * Rewrite `Css.props(expr)` into `trussProps(expr)`.
 *
 * In the new model, the argument is already a style hash, so we just delegate to trussProps.
 */
function rewriteCssPropsCalls(options: RewriteSitesOptions): void {
  traverse(options.ast, {
    CallExpression(path: NodePath<t.CallExpression>) {
      if (!isCssPropsCall(path.node, options.cssBindingName)) return;

      const arg = path.node.arguments[0];
      if (!arg || t.isSpreadElement(arg) || !t.isExpression(arg) || path.node.arguments.length !== 1) return;

      const line = path.node.loc?.start.line ?? null;

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
  });
}

// ---------------------------------------------------------------------------
// Css.spread(...) rewriting
// ---------------------------------------------------------------------------

/**
 * Strip `Css.spread(expr)` wrappers — in the new model, style composition
 * is native object composition, so Css.spread is a no-op.
 */
function rewriteCssSpreadCalls(ast: t.File, cssBindingName: string): void {
  traverse(ast, {
    CallExpression(path: NodePath<t.CallExpression>) {
      if (!isCssSpreadCall(path.node, cssBindingName)) return;

      const arg = path.node.arguments[0];
      if (!arg || t.isSpreadElement(arg) || !t.isExpression(arg) || path.node.arguments.length !== 1) return;

      // Just unwrap: Css.spread({ ...a, ...b }) → { ...a, ...b }
      path.replaceWith(arg);
    },
  });
}

// ---------------------------------------------------------------------------
// Second pass: remaining css={...} attributes
// ---------------------------------------------------------------------------

/**
 * Rewrite any remaining `css={expr}` JSX attributes into `{...trussProps(expr)}`.
 *
 * This handles cases where the css prop value is not a direct `Css.*.$` chain,
 * e.g. `css={someVariable}`, `css={{ ...a, ...b }}`, `css={cond ? a : b}`.
 *
 * In the new model, all of these just need to be wrapped in trussProps().
 */
function rewriteCssAttributeExpressions(options: RewriteSitesOptions): void {
  traverse(options.ast, {
    JSXAttribute(path: NodePath<t.JSXAttribute>) {
      if (!t.isJSXIdentifier(path.node.name, { name: "css" })) return;
      const value = path.node.value;
      if (!t.isJSXExpressionContainer(value)) return;
      if (!t.isExpression(value.expression)) return;

      const expr = value.expression;
      const line = path.node.loc?.start.line ?? null;

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

/** Match the legacy `Css.spread(...)` marker helper. */
function isCssSpreadCall(expr: t.CallExpression, cssBindingName: string): boolean {
  return (
    t.isMemberExpression(expr.callee) &&
    !expr.callee.computed &&
    t.isIdentifier(expr.callee.object, { name: cssBindingName }) &&
    t.isIdentifier(expr.callee.property, { name: "spread" })
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

/** Generate a compact code snippet for diagnostics. */
function formatNodeSnippet(node: t.Node): string {
  return generate(node, { compact: true, comments: true }).code;
}
