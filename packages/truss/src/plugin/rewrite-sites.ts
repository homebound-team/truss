import _traverse from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";
import type { ResolvedSegment } from "./types";
import type { ResolvedChain } from "./resolve-chain";

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
  filename: string;
  debug: boolean;
  createVarName: string;
  stylexNamespaceName: string;
  maybeIncHelperName: string | null;
  mergePropsHelperName: string;
  needsMergePropsHelper: { current: boolean };
  trussPropsHelperName: string;
  needsTrussPropsHelper: { current: boolean };
  trussDebugInfoName: string;
  needsTrussDebugInfo: { current: boolean };
  asStyleArrayHelperName: string;
  needsAsStyleArrayHelper: { current: boolean };
  skippedCssPropMessages: Array<{ message: string; line: number | null }>;
  runtimeLookupNames: Map<string, string>;
}

/**
 * Rewrite collected `Css...$` expression sites into StyleX runtime calls.
 *
 * Why this is split out: the transform has two distinct concerns—"what to
 * emit" (`stylex.create`) and "where to rewrite usage sites" (`stylex.props`).
 * Keeping site rewrites isolated makes behavior easier to reason about.
 */
export function rewriteExpressionSites(options: RewriteSitesOptions): void {
  for (const site of options.sites) {
    const propsArgs = buildPropsArgsFromChain(site.resolvedChain, options);
    const cssAttrPath = getCssAttributePath(site.path);

    if (cssAttrPath) {
      cssAttrPath.replaceWith(
        t.jsxSpreadAttribute(
          buildCssSpreadExpression(
            cssAttrPath,
            propsArgs,
            site.path.node.loc?.start.line ?? null,
            options.mergePropsHelperName,
            options.needsMergePropsHelper,
            options,
          ),
        ),
      );
      continue;
    }

    site.path.replaceWith(buildStyleArrayExpression(propsArgs, site.path.node.loc?.start.line ?? null, options));
  }

  rewriteStyleObjectExpressions(options.ast);

  // Second pass: lower any style-array-like `css={...}` expression to `stylex.props(...)`.
  rewriteCssAttributeExpressions(
    options.ast,
    options.filename,
    options.debug,
    options.stylexNamespaceName,
    options.mergePropsHelperName,
    options.needsMergePropsHelper,
    options.trussPropsHelperName,
    options.needsTrussPropsHelper,
    options.trussDebugInfoName,
    options.needsTrussDebugInfo,
    options.asStyleArrayHelperName,
    options.needsAsStyleArrayHelper,
    options.skippedCssPropMessages,
  );
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

/**
 * Build arguments for `stylex.props(...)` from a resolved chain.
 *
 * Conditional segments are converted to ternaries (or spread ternaries when a
 * branch has multiple refs) so branch structure is preserved in emitted code.
 */
function buildPropsArgsFromChain(
  chain: ResolvedChain,
  options: RewriteSitesOptions,
): (t.Expression | t.SpreadElement)[] {
  const args: (t.Expression | t.SpreadElement)[] = [];

  for (const marker of chain.markers) {
    if (marker.markerNode) {
      args.push(marker.markerNode);
    } else {
      args.push(
        t.callExpression(
          t.memberExpression(t.identifier(options.stylexNamespaceName), t.identifier("defaultMarker")),
          [],
        ),
      );
    }
  }

  for (const part of chain.parts) {
    if (part.type === "unconditional") {
      args.push(...buildPropsArgs(part.segments, options));
      continue;
    }

    const thenArgs = buildPropsArgs(part.thenSegments, options);
    const elseArgs = buildPropsArgs(part.elseSegments, options);

    if (
      thenArgs.length === 1 &&
      elseArgs.length === 1 &&
      !t.isSpreadElement(thenArgs[0]) &&
      !t.isSpreadElement(elseArgs[0])
    ) {
      args.push(t.conditionalExpression(part.conditionNode, thenArgs[0], elseArgs[0]));
    } else if (thenArgs.length > 0 || elseArgs.length > 0) {
      args.push(
        t.spreadElement(
          t.conditionalExpression(part.conditionNode, t.arrayExpression(thenArgs), t.arrayExpression(elseArgs)),
        ),
      );
    }
  }

  return args;
}

/**
 * Convert resolved segments to style refs and dynamic invocations.
 */
function buildPropsArgs(segments: ResolvedSegment[], options: RewriteSitesOptions): (t.Expression | t.SpreadElement)[] {
  const args: (t.Expression | t.SpreadElement)[] = [];

  for (const seg of segments) {
    // Skip error segments — they are logged via console.error at the top of the file
    if (seg.error) continue;

    if (seg.typographyLookup) {
      const lookupName = options.runtimeLookupNames.get(seg.typographyLookup.lookupKey);
      if (!lookupName) {
        continue;
      }
      const lookupAccess = t.memberExpression(
        t.identifier(lookupName),
        seg.typographyLookup.argNode as t.Expression,
        true,
      );
      args.push(t.spreadElement(t.logicalExpression("??", lookupAccess, t.arrayExpression([]))));
      continue;
    }

    if (seg.styleArrayArg) {
      args.push(
        t.spreadElement(
          buildUnknownObjectSpreadFallback(
            seg.styleArrayArg as t.Expression,
            options.asStyleArrayHelperName,
            options.needsAsStyleArrayHelper,
          ),
        ),
      );
      continue;
    }

    const ref = t.memberExpression(t.identifier(options.createVarName), t.identifier(seg.key));

    if (seg.dynamicProps && seg.argNode) {
      let argExpr: t.Expression;
      if (seg.incremented && options.maybeIncHelperName) {
        argExpr = t.callExpression(t.identifier(options.maybeIncHelperName), [seg.argNode]);
      } else if (seg.incremented) {
        argExpr = seg.argNode as t.Expression;
      } else if (seg.appendPx) {
        argExpr = t.binaryExpression(
          "+",
          t.callExpression(t.identifier("String"), [seg.argNode]),
          t.stringLiteral("px"),
        );
      } else {
        argExpr = t.callExpression(t.identifier("String"), [seg.argNode]);
      }
      args.push(t.callExpression(ref, [argExpr]));
    } else {
      args.push(ref);
    }
  }

  return args;
}

/**
 * Rewrite style-array-like `css={...}` expressions to `...stylex.props(...)`.
 */
function rewriteCssAttributeExpressions(
  ast: t.File,
  filename: string,
  debug: boolean,
  stylexNamespaceName: string,
  mergePropsHelperName: string,
  needsMergePropsHelper: { current: boolean },
  trussPropsHelperName: string,
  needsTrussPropsHelper: { current: boolean },
  trussDebugInfoName: string,
  needsTrussDebugInfo: { current: boolean },
  asStyleArrayHelperName: string,
  needsAsStyleArrayHelper: { current: boolean },
  skippedCssPropMessages: Array<{ message: string; line: number | null }>,
): void {
  traverse(ast, {
    JSXAttribute(path: NodePath<t.JSXAttribute>) {
      if (!t.isJSXIdentifier(path.node.name, { name: "css" })) return;
      const value = path.node.value;
      if (!t.isJSXExpressionContainer(value)) return;
      if (!t.isExpression(value.expression)) return;
      if (!isCssRewriteableExpression(value.expression, path)) {
        skippedCssPropMessages.push({
          message: explainSkippedCssRewrite(value.expression, path),
          line: path.node.loc?.start.line ?? null,
        });
        return;
      }

      const propsArgs = lowerCssExpressionToPropsArgs(
        value.expression,
        path,
        asStyleArrayHelperName,
        needsAsStyleArrayHelper,
      );
      if (!propsArgs) {
        skippedCssPropMessages.push({
          message: explainSkippedCssRewrite(value.expression, path),
          line: path.node.loc?.start.line ?? null,
        });
        return;
      }

      path.replaceWith(
        t.jsxSpreadAttribute(
          buildCssSpreadExpression(
            path,
            propsArgs,
            path.node.loc?.start.line ?? null,
            mergePropsHelperName,
            needsMergePropsHelper,
            {
              filename,
              debug,
              stylexNamespaceName,
              trussPropsHelperName,
              needsTrussPropsHelper,
              trussDebugInfoName,
              needsTrussDebugInfo,
            },
          ),
        ),
      );
    },
  });
}

/** Emit a style array and optionally prepend a Truss debug sentinel. */
function buildStyleArrayExpression(
  propsArgs: (t.Expression | t.SpreadElement)[],
  line: number | null,
  options: RewriteSitesOptions,
): t.ArrayExpression {
  const elements: Array<t.Expression | t.SpreadElement> = buildDebugElements(line, options);
  elements.push(...propsArgs);
  return t.arrayExpression(elements);
}

/** Emit `stylex.props(...)` or `trussProps(stylex, ...)` depending on debug mode. */
function buildPropsCall(
  propsArgs: (t.Expression | t.SpreadElement)[],
  line: number | null,
  options: Pick<
    RewriteSitesOptions,
    | "debug"
    | "stylexNamespaceName"
    | "trussPropsHelperName"
    | "needsTrussPropsHelper"
    | "trussDebugInfoName"
    | "needsTrussDebugInfo"
    | "filename"
  >,
): t.CallExpression {
  if (!options.debug) {
    return t.callExpression(
      t.memberExpression(t.identifier(options.stylexNamespaceName), t.identifier("props")),
      propsArgs,
    );
  }

  options.needsTrussPropsHelper.current = true;
  const args: Array<t.Expression | t.SpreadElement> = buildDebugElements(line, options);
  args.push(...propsArgs);
  return t.callExpression(t.identifier(options.trussPropsHelperName), [
    t.identifier(options.stylexNamespaceName),
    ...args,
  ]);
}

/** Build the `new TrussDebugInfo("File.tsx:line")` expression for a site. */
function buildDebugElements(
  line: number | null,
  options: Pick<RewriteSitesOptions, "debug" | "trussDebugInfoName" | "needsTrussDebugInfo" | "filename">,
): Array<t.Expression | t.SpreadElement> {
  if (!options.debug || line === null) {
    return [];
  }

  options.needsTrussDebugInfo.current = true;
  return [t.newExpression(t.identifier(options.trussDebugInfoName), [t.stringLiteral(`${options.filename}:${line}`)])];
}

/** Check whether a JSX `css={...}` expression should be lowered to `stylex.props(...)`. */
function isCssRewriteableExpression(expr: t.Expression, path: NodePath<t.JSXAttribute>): boolean {
  return !!lowerCssExpressionToPropsArgs(expr, path, "asStyleArray", { current: false });
}

/** Lower a rewriteable JSX `css={...}` expression into `stylex.props(...)` args. */
function lowerCssExpressionToPropsArgs(
  expr: t.Expression,
  path: NodePath<t.JSXAttribute>,
  asStyleArrayHelperName: string,
  needsAsStyleArrayHelper: { current: boolean },
): (t.Expression | t.SpreadElement)[] | null {
  return (
    buildStyleObjectPropsArgs(expr, path, asStyleArrayHelperName, needsAsStyleArrayHelper) ??
    buildStyleArrayLikePropsArgsFromExpression(expr, path, asStyleArrayHelperName, needsAsStyleArrayHelper) ??
    buildUnknownCssValuePropsArgs(expr, asStyleArrayHelperName, needsAsStyleArrayHelper)
  );
}

/** Explain why a remaining `css={...}` expression could not be lowered. */
function explainSkippedCssRewrite(expr: t.Expression, path: NodePath<t.JSXAttribute>): string {
  if (t.isObjectExpression(expr)) {
    for (const prop of expr.properties) {
      if (!t.isSpreadElement(prop)) {
        return `[truss] Unsupported pattern: Could not rewrite css prop: object contains a non-spread property (${formatNodeSnippet(expr)})`;
      }

      const normalizedArg = normalizeStyleArrayLikeExpression(prop.argument, path, new Set<t.Node>());
      if (!normalizedArg) {
        return `[truss] Unsupported pattern: Could not rewrite css prop: spread argument is not style-array-like (${formatNodeSnippet(prop.argument)})`;
      }
    }

    return `[truss] Unsupported pattern: Could not rewrite css prop: object spread composition was not recognized (${formatNodeSnippet(expr)})`;
  }

  return `[truss] Unsupported pattern: Could not rewrite css prop: expression is not style-array-like (${formatNodeSnippet(expr)})`;
}

/** Generate a compact code snippet for diagnostics. */
function formatNodeSnippet(node: t.Node): string {
  return generate(node, { compact: true, comments: true }).code;
}

/** Merge existing `className` attr into a rewritten `stylex.props(...)` spread. */
function buildCssSpreadExpression(
  path: NodePath<t.JSXAttribute>,
  propsArgs: (t.Expression | t.SpreadElement)[],
  line: number | null,
  mergePropsHelperName: string,
  needsMergePropsHelper: { current: boolean },
  options: Pick<
    RewriteSitesOptions,
    | "debug"
    | "stylexNamespaceName"
    | "trussPropsHelperName"
    | "needsTrussPropsHelper"
    | "trussDebugInfoName"
    | "needsTrussDebugInfo"
    | "filename"
  >,
): t.Expression {
  const existingClassNameExpr = removeExistingClassNameAttribute(path);
  if (!existingClassNameExpr) return buildPropsCall(propsArgs, line, options);

  needsMergePropsHelper.current = true;
  const args: Array<t.Expression | t.SpreadElement> = buildDebugElements(line, options);
  args.push(...propsArgs);
  return t.callExpression(t.identifier(mergePropsHelperName), [
    t.identifier(options.stylexNamespaceName),
    existingClassNameExpr,
    ...args,
  ]);
}

/** Remove sibling `className` and return its expression so rewrites can preserve it. */
function removeExistingClassNameAttribute(path: NodePath<t.JSXAttribute>): t.Expression | null {
  const openingElement = path.parentPath;
  if (!openingElement || !openingElement.isJSXOpeningElement()) return null;

  const attrs = openingElement.node.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name, { name: "className" })) continue;

    let classNameExpr: t.Expression | null = null;
    if (t.isStringLiteral(attr.value)) {
      classNameExpr = attr.value;
    } else if (t.isJSXExpressionContainer(attr.value) && t.isExpression(attr.value.expression)) {
      classNameExpr = attr.value.expression;
    }

    attrs.splice(i, 1);
    return classNameExpr;
  }

  return null;
}

/** Convert `css={{ ...a, ...Css.df.$ }}`-style objects directly to props args. */
function buildStyleObjectPropsArgs(
  expr: t.Expression,
  path: NodePath,
  asStyleArrayHelperName: string,
  needsAsStyleArrayHelper: { current: boolean },
): (t.Expression | t.SpreadElement)[] | null {
  if (!t.isObjectExpression(expr) || expr.properties.length === 0) return null;

  const propsArgs: (t.Expression | t.SpreadElement)[] = [];

  for (const prop of expr.properties) {
    if (!t.isSpreadElement(prop)) return null;

    const normalizedArg = normalizeStyleArrayLikeExpression(prop.argument, path, new Set<t.Node>()); // I.e. `...styles`, `...Css.df.$`, or `...styles.wrapper`
    if (!normalizedArg) {
      propsArgs.push(
        t.spreadElement(
          buildUnknownObjectSpreadFallback(prop.argument, asStyleArrayHelperName, needsAsStyleArrayHelper),
        ),
      );
      continue;
    }

    const nestedArgs = buildStyleArrayLikePropsArgs(normalizedArg, path, new Set<t.Node>());
    if (nestedArgs && t.isArrayExpression(normalizedArg)) {
      propsArgs.push(...nestedArgs);
    } else {
      propsArgs.push(t.spreadElement(buildSafeSpreadArgument(normalizedArg)));
    }
  }

  return propsArgs.length > 0 ? propsArgs : null;
}

/** Normalize and lower a style-array-like expression into props args. */
function buildStyleArrayLikePropsArgsFromExpression(
  expr: t.Expression,
  path: NodePath,
  asStyleArrayHelperName: string,
  needsAsStyleArrayHelper: { current: boolean },
): (t.Expression | t.SpreadElement)[] | null {
  const normalizedExpr = normalizeStyleArrayLikeExpression(expr, path, new Set<t.Node>());
  if (!normalizedExpr) return null;
  return buildStyleArrayLikePropsArgs(normalizedExpr, path, new Set<t.Node>());
}

// Style-array-like helpers are shared by object-spread repair and JSX css lowering.

/** Convert a style-array-like expression into `stylex.props(...)` arguments. */
function buildStyleArrayLikePropsArgs(
  expr: t.Expression,
  path: NodePath,
  seen: Set<t.Node>,
): (t.Expression | t.SpreadElement)[] | null {
  if (seen.has(expr)) return null;
  seen.add(expr);

  if (t.isArrayExpression(expr)) {
    const propsArgs: (t.Expression | t.SpreadElement)[] = [];

    for (const el of expr.elements) {
      if (!el) continue;

      if (t.isSpreadElement(el)) {
        const normalizedArg = normalizeStyleArrayLikeExpression(el.argument, path, new Set<t.Node>()); // I.e. `...[css.df]`, `...base`, or `...(cond ? styles.hover : {})`
        if (!normalizedArg) {
          propsArgs.push(t.spreadElement(el.argument));
          continue;
        }

        const nestedArgs = buildStyleArrayLikePropsArgs(normalizedArg, path, seen);
        if (nestedArgs && t.isArrayExpression(normalizedArg)) {
          propsArgs.push(...nestedArgs);
        } else {
          propsArgs.push(t.spreadElement(buildSafeSpreadArgument(normalizedArg)));
        }
        continue;
      }

      propsArgs.push(el);
    }

    return propsArgs;
  }

  if (
    t.isIdentifier(expr) ||
    t.isMemberExpression(expr) ||
    t.isConditionalExpression(expr) ||
    t.isLogicalExpression(expr) ||
    t.isCallExpression(expr)
  ) {
    return [t.spreadElement(buildSafeSpreadArgument(expr))]; // I.e. `base`, `styles.wrapper`, `base || hover`, or `getStyles()`
  }

  return null;
}

/** Lower unknown direct `css={value}` cases through the style-array helper. */
function buildUnknownCssValuePropsArgs(
  expr: t.Expression,
  asStyleArrayHelperName: string,
  needsAsStyleArrayHelper: { current: boolean },
): (t.Expression | t.SpreadElement)[] | null {
  if (!(t.isIdentifier(expr) || t.isMemberExpression(expr) || t.isCallExpression(expr))) return null;
  return [t.spreadElement(buildUnknownObjectSpreadFallback(expr, asStyleArrayHelperName, needsAsStyleArrayHelper))];
}

/**
 * Rewrite object spread composition like `{ ...[css.df], ...(cond ? [css.a] : {}) }`
 * into style ref arrays so later JSX css rewrites can flatten them safely.
 */
function rewriteStyleObjectExpressions(ast: t.File): void {
  traverse(ast, {
    ObjectExpression(path: NodePath<t.ObjectExpression>) {
      const rewritten = tryBuildStyleArrayFromObject(path);
      if (!rewritten) return;
      path.replaceWith(rewritten);
    },
  });
}

/** One-line detection for object spread groups that really represent style arrays. */
function tryBuildStyleArrayFromObject(path: NodePath<t.ObjectExpression>): t.ArrayExpression | null {
  if (path.node.properties.length === 0) return null;

  let sawStyleArray = false;
  const elements: (t.Expression | t.SpreadElement | null)[] = [];

  for (const prop of path.node.properties) {
    if (!t.isSpreadElement(prop)) {
      return null;
    }

    const normalizedArg = normalizeStyleArrayLikeExpression(
      prop.argument,
      path,
      new Set<t.Node>(), // I.e. `...Css.df.$`, `...(cond ? Css.df.$ : {})`, or `...styles.wrapper`
    );
    if (!normalizedArg) {
      elements.push(t.spreadElement(buildInlineAsStyleArrayExpression(prop.argument)));
      continue;
    }

    if (isKnownStyleArrayLike(normalizedArg, path, new Set<t.Node>())) {
      sawStyleArray = true;
    }

    if (t.isArrayExpression(normalizedArg)) {
      elements.push(...normalizedArg.elements);
      continue;
    }

    elements.push(t.spreadElement(buildSafeSpreadArgument(normalizedArg)));
  }

  if (!sawStyleArray) return null;
  return t.arrayExpression(elements);
}

/**
 * Normalize style-array conditionals so object fallback branches become arrays.
 */
function normalizeStyleArrayLikeExpression(expr: t.Expression, path: NodePath, seen: Set<t.Node>): t.Expression | null {
  if (seen.has(expr)) return null;
  seen.add(expr);

  if (t.isArrayExpression(expr)) return expr; // I.e. `[css.df]` or `[css.df, ...xss]`

  if (t.isLogicalExpression(expr) && expr.operator === "&&") {
    const consequent = normalizeStyleArrayLikeExpression(expr.right, path, seen);
    if (!consequent) return null;
    return t.conditionalExpression(expr.left, consequent, t.arrayExpression([])); // I.e. `cond && Css.df.$`
  }

  if (t.isLogicalExpression(expr) && (expr.operator === "||" || expr.operator === "??")) {
    const left = normalizeStyleArrayLikeExpression(expr.left, path, seen);
    const right = normalizeStyleArrayLikeBranch(expr.right, path, seen);
    if (!left || !right) return null;
    return t.logicalExpression(expr.operator, left, right); // I.e. `base || Css.df.$` or `base ?? {}`
  }

  if (t.isConditionalExpression(expr)) {
    const consequent = normalizeStyleArrayLikeBranch(expr.consequent, path, seen);
    const alternate = normalizeStyleArrayLikeBranch(expr.alternate, path, seen);
    if (!consequent || !alternate) return null;
    return t.conditionalExpression(expr.test, consequent, alternate); // I.e. `cond ? Css.df.$ : {}`
  }

  if (t.isIdentifier(expr) || t.isMemberExpression(expr) || t.isCallExpression(expr)) {
    const nestedSeen = new Set(seen);
    nestedSeen.delete(expr);
    if (isStyleArrayLike(expr, path, nestedSeen)) return expr; // I.e. `base`, `styles.wrapper`, or `getStyles()`
  }

  return null;
}

/** Normalize a conditional branch inside a style-array-like expression. */
function normalizeStyleArrayLikeBranch(expr: t.Expression, path: NodePath, seen: Set<t.Node>): t.Expression | null {
  if (isEmptyObjectExpression(expr)) {
    return t.arrayExpression([]); // I.e. `cond ? Css.df.$ : {}` becomes `cond ? [css.df] : []`
  }

  return normalizeStyleArrayLikeExpression(expr, path, seen);
}

/** Check whether an expression is known to evaluate to a style ref array. */
function isStyleArrayLike(expr: t.Expression, path: NodePath, seen: Set<t.Node>): boolean {
  if (seen.has(expr)) return false;
  seen.add(expr);

  if (t.isArrayExpression(expr)) return true; // I.e. `[css.df]`

  if (t.isLogicalExpression(expr) && expr.operator === "&&") {
    return isStyleArrayLike(expr.right, path, seen); // I.e. `cond && [css.df]`
  }

  if (t.isLogicalExpression(expr) && (expr.operator === "||" || expr.operator === "??")) {
    return isStyleArrayLike(expr.left, path, seen) && isStyleArrayLikeBranch(expr.right, path, seen); // I.e. `base || [css.df]`
  }

  if (t.isConditionalExpression(expr)) {
    return isStyleArrayLikeBranch(expr.consequent, path, seen) && isStyleArrayLikeBranch(expr.alternate, path, seen); // I.e. `cond ? [css.df] : []`
  }

  if (t.isIdentifier(expr)) {
    const binding = path.scope.getBinding(expr.name);
    const bindingPath = binding?.path;
    if (!bindingPath || !bindingPath.isVariableDeclarator()) return false;
    const init = bindingPath.node.init;
    return !!(init && isStyleArrayLike(init, bindingPath, seen)); // I.e. `base` where `const base = [css.df]`
  }

  if (t.isCallExpression(expr)) {
    const returnExpr = getCallStyleArrayLikeExpression(expr, path);
    return returnExpr ? isStyleArrayLike(returnExpr, path, seen) : true; // I.e. `getStyles()` or imported `getFromAnotherFile()`
  }

  if (t.isMemberExpression(expr)) {
    const object = expr.object;
    if (!t.isIdentifier(object)) return false;

    const binding = path.scope.getBinding(object.name);
    const bindingPath = binding?.path;
    if (!bindingPath || !bindingPath.isVariableDeclarator()) return false;
    const init = bindingPath.node.init;
    if (!init || !t.isObjectExpression(init)) return false;

    const propertyName = getStaticMemberPropertyName(expr, path);
    if (!propertyName) return false;

    for (const prop of init.properties) {
      if (!t.isObjectProperty(prop) || prop.computed) continue;
      if (!isMatchingPropertyName(prop.key, propertyName)) continue;
      const value = prop.value;
      return t.isExpression(value) && isStyleArrayLike(value, bindingPath, seen); // I.e. `styles.wrapper`
    }
  }

  return false;
}

/** Check whether an expression is provably style-array-like without optimistic external-call assumptions. */
function isKnownStyleArrayLike(expr: t.Expression, path: NodePath, seen: Set<t.Node>): boolean {
  if (seen.has(expr)) return false;
  seen.add(expr);

  if (t.isArrayExpression(expr)) return true;

  if (t.isLogicalExpression(expr) && expr.operator === "&&") {
    return isKnownStyleArrayLike(expr.right, path, seen);
  }

  if (t.isLogicalExpression(expr) && (expr.operator === "||" || expr.operator === "??")) {
    return isKnownStyleArrayLike(expr.left, path, seen) && isStyleArrayLikeBranch(expr.right, path, seen);
  }

  if (t.isConditionalExpression(expr)) {
    return isStyleArrayLikeBranch(expr.consequent, path, seen) && isStyleArrayLikeBranch(expr.alternate, path, seen);
  }

  if (t.isIdentifier(expr)) {
    const binding = path.scope.getBinding(expr.name);
    const bindingPath = binding?.path;
    if (!bindingPath || !bindingPath.isVariableDeclarator()) return false;
    const init = bindingPath.node.init;
    return !!(init && isKnownStyleArrayLike(init, bindingPath, seen));
  }

  if (t.isCallExpression(expr)) {
    const returnExpr = getCallStyleArrayLikeExpression(expr, path);
    return !!(returnExpr && isKnownStyleArrayLike(returnExpr, path, seen));
  }

  if (t.isMemberExpression(expr)) {
    const object = expr.object;
    if (!t.isIdentifier(object)) return false;

    const binding = path.scope.getBinding(object.name);
    const bindingPath = binding?.path;
    if (!bindingPath || !bindingPath.isVariableDeclarator()) return false;
    const init = bindingPath.node.init;
    if (!init || !t.isObjectExpression(init)) return false;

    const propertyName = getStaticMemberPropertyName(expr, path);
    if (!propertyName) return false;

    for (const prop of init.properties) {
      if (!t.isObjectProperty(prop) || prop.computed) continue;
      if (!isMatchingPropertyName(prop.key, propertyName)) continue;
      const value = prop.value;
      return t.isExpression(value) && isKnownStyleArrayLike(value, bindingPath, seen);
    }
  }

  return false;
}

/** Check a branch used inside a conditional style-array expression. */
function isStyleArrayLikeBranch(expr: t.Expression, path: NodePath, seen: Set<t.Node>): boolean {
  return isEmptyObjectExpression(expr) || isStyleArrayLike(expr, path, seen); // I.e. `{}` or `[css.df]`
}

/** Match static object property names. */
function isMatchingPropertyName(key: t.Expression | t.Identifier | t.PrivateName, name: string): boolean {
  return (t.isIdentifier(key) && key.name === name) || (t.isStringLiteral(key) && key.value === name);
}

/** Check for `{}` fallback branches that should become `[]`. */
function isEmptyObjectExpression(expr: t.Expression): boolean {
  return t.isObjectExpression(expr) && expr.properties.length === 0;
}

/** Convert unknown object-spread values into safe iterable fallbacks for `stylex.props(...)`. */
function buildUnknownObjectSpreadFallback(
  expr: t.Expression,
  asStyleArrayHelperName: string,
  needsAsStyleArrayHelper: { current: boolean },
): t.Expression {
  needsAsStyleArrayHelper.current = true;
  return t.callExpression(t.identifier(asStyleArrayHelperName), [expr]);
}

/** Inline arrayification for non-JSX object rewrites where helper injection is unavailable. */
function buildInlineAsStyleArrayExpression(expr: t.Expression): t.Expression {
  return t.conditionalExpression(
    t.callExpression(t.memberExpression(t.identifier("Array"), t.identifier("isArray")), [expr]),
    expr,
    t.conditionalExpression(expr, t.arrayExpression([expr]), t.arrayExpression([])),
  );
}

/** Parenthesize spread arguments that need grouping in emitted code. */
function buildSafeSpreadArgument(expr: t.Expression): t.Expression {
  return t.isConditionalExpression(expr) || t.isLogicalExpression(expr) ? t.parenthesizedExpression(expr) : expr;
}

/** Resolve static property names for `styles.wrapper` or `styles["wrapper"]`. */
function getStaticMemberPropertyName(expr: t.MemberExpression, path: NodePath): string | null {
  if (!expr.computed && t.isIdentifier(expr.property)) {
    return expr.property.name;
  }

  if (t.isStringLiteral(expr.property)) {
    return expr.property.value;
  }

  if (t.isIdentifier(expr.property)) {
    const binding = path.scope.getBinding(expr.property.name);
    const bindingPath = binding?.path;
    if (!bindingPath || !bindingPath.isVariableDeclarator()) return null;
    const init = bindingPath.node.init;
    return t.isStringLiteral(init) ? init.value : null;
  }

  return null;
}

/** Resolve a call expression that returns a style-array-like expression. */
function getCallStyleArrayLikeExpression(expr: t.CallExpression, path: NodePath): t.Expression | null {
  const localReturnExpr = getLocalFunctionReturnExpression(expr, path);
  if (localReturnExpr) return localReturnExpr;

  const firstArg = expr.arguments[0];
  if (
    firstArg &&
    !t.isSpreadElement(firstArg) &&
    (t.isArrowFunctionExpression(firstArg) || t.isFunctionExpression(firstArg))
  ) {
    return getFunctionLikeReturnExpression(firstArg); // I.e. `useMemo(() => [...], deps)`
  }

  return null;
}

/** Resolve a local function call that returns a style-array-like expression. */
function getLocalFunctionReturnExpression(expr: t.CallExpression, path: NodePath): t.Expression | null {
  if (!t.isIdentifier(expr.callee)) return null;

  const binding = path.scope.getBinding(expr.callee.name);
  const bindingPath = binding?.path;
  if (!bindingPath) return null;

  if (bindingPath.isFunctionDeclaration()) {
    return getFunctionLikeReturnExpression(bindingPath.node);
  }

  if (bindingPath.isVariableDeclarator()) {
    const init = bindingPath.node.init;
    if (init && (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init))) {
      return getFunctionLikeReturnExpression(init);
    }
  }

  return null;
}

/** Extract a single returned expression from a function-like node. */
function getFunctionLikeReturnExpression(
  fn: t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression,
): t.Expression | null {
  if (t.isExpression(fn.body)) {
    return fn.body;
  }

  if (fn.body.body.length !== 1) return null;
  const stmt = fn.body.body[0];
  return t.isReturnStatement(stmt) && stmt.argument && t.isExpression(stmt.argument) ? stmt.argument : null;
}
