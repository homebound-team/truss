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
  cssBindingName: string;
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

/** Format a property key for diagnostics. */
function formatDroppedPropertyKey(prop: t.ObjectMember | t.SpreadElement): string {
  if (t.isObjectProperty(prop)) {
    if (t.isIdentifier(prop.key)) return prop.key.name;
    if (t.isStringLiteral(prop.key)) return prop.key.value;
  }
  return formatNodeSnippet(prop);
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

  rewriteCssPropsCalls(options);
  rewriteCssSpreadCalls(
    options.ast,
    options.cssBindingName,
    options.asStyleArrayHelperName,
    options.needsAsStyleArrayHelper,
  );
  rewriteStyleObjectExpressions(
    options.ast,
    options.skippedCssPropMessages,
    options.asStyleArrayHelperName,
    options.needsAsStyleArrayHelper,
  );
  normalizeMixedStyleTernaries(options.ast);

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

/** Convert resolved segments to style refs and dynamic invocations. */
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
          buildUnknownSpreadFallback(
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

/** Rewrite style-array-like `css={...}` expressions to `...stylex.props(...)`. */
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

/** Lower a rewriteable JSX `css={...}` expression into `stylex.props(...)` args. */
function lowerCssExpressionToPropsArgs(
  expr: t.Expression,
  path: NodePath<t.JSXAttribute>,
  asStyleArrayHelperName: string,
  needsAsStyleArrayHelper: { current: boolean },
): (t.Expression | t.SpreadElement)[] | null {
  return (
    buildStyleObjectPropsArgs(expr, path, asStyleArrayHelperName, needsAsStyleArrayHelper) ??
    buildStyleArrayLikePropsArgsFromExpression(expr, path)
  );
}

/** Explain why a remaining `css={...}` expression could not be lowered. */
function explainSkippedCssRewrite(expr: t.Expression, path: NodePath<t.JSXAttribute>): string {
  if (t.isObjectExpression(expr)) {
    for (const prop of expr.properties) {
      if (!t.isSpreadElement(prop)) {
        return `[truss] Unsupported pattern: Could not rewrite css prop: object contains a non-spread property (${formatNodeSnippet(expr)})`;
      }

      const normalizedArg = normalizeStyleExpression(prop.argument);
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

// ---------------------------------------------------------------------------
// Object spread → style array rewriting
// ---------------------------------------------------------------------------

/**
 * Convert `css={{ ...a, ...Css.df.$ }}`-style objects directly to props args.
 *
 * For css prop objects: if the object is all spreads, either flatten known style
 * arrays or wrap unknown spreads in `asStyleArray()`.
 */
function buildStyleObjectPropsArgs(
  expr: t.Expression,
  path: NodePath,
  asStyleArrayHelperName: string,
  needsAsStyleArrayHelper: { current: boolean },
): (t.Expression | t.SpreadElement)[] | null {
  if (!t.isObjectExpression(expr) || expr.properties.length === 0) return null;

  // Objects with non-spread properties can't be lowered to props args
  const allSpreads = expr.properties.every(function (prop) {
    return t.isSpreadElement(prop);
  });
  if (!allSpreads) return null;

  // If any spread touches a Css-derived array, flatten with knowledge of style arrays
  if (hasStyleArraySpread(expr, path)) {
    const result = flattenStyleObject(expr, path, asStyleArrayHelperName, needsAsStyleArrayHelper);
    return result.elements.filter(Boolean) as (t.Expression | t.SpreadElement)[];
  }

  // All spreads but none touch Css → wrap each in asStyleArray as fallback
  return expr.properties.map(function (prop) {
    const spread = prop as t.SpreadElement;
    return t.spreadElement(
      buildUnknownSpreadFallback(spread.argument, asStyleArrayHelperName, needsAsStyleArrayHelper), // I.e. `css={{ ...css }}` or `css={{ ...xss }}`
    );
  });
}

/** Normalize and lower a style-array-like expression into props args. */
function buildStyleArrayLikePropsArgsFromExpression(
  expr: t.Expression,
  path: NodePath,
): (t.Expression | t.SpreadElement)[] | null {
  const normalizedExpr = normalizeStyleExpression(expr);
  if (!normalizedExpr) return null;
  return buildStyleArrayLikePropsArgs(normalizedExpr, path);
}

/** Convert a style-array-like expression into `stylex.props(...)` arguments. */
function buildStyleArrayLikePropsArgs(expr: t.Expression, path: NodePath): (t.Expression | t.SpreadElement)[] | null {
  if (t.isArrayExpression(expr)) {
    const propsArgs: (t.Expression | t.SpreadElement)[] = [];

    for (const el of expr.elements) {
      if (!el) continue;

      if (t.isSpreadElement(el)) {
        const normalizedArg = normalizeStyleExpression(el.argument); // I.e. `...[css.df]`, `...base`, or `...(cond ? styles.hover : {})`
        if (!normalizedArg) {
          propsArgs.push(t.spreadElement(el.argument));
          continue;
        }

        if (t.isArrayExpression(normalizedArg)) {
          const nestedArgs = buildStyleArrayLikePropsArgs(normalizedArg, path);
          if (nestedArgs) {
            propsArgs.push(...nestedArgs);
            continue;
          }
        }
        propsArgs.push(t.spreadElement(buildSafeSpreadArgument(normalizedArg)));
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
    return [t.spreadElement(buildSafeSpreadArgument(expr))];
  }

  return null;
}

/**
 * Rewrite object spread composition like `{ ...[css.df], ...(cond ? [css.a] : {}) }`
 * into style ref arrays so later JSX css rewrites can flatten them safely.
 */
function rewriteStyleObjectExpressions(
  ast: t.File,
  messages: Array<{ message: string; line: number | null }>,
  asStyleArrayHelperName: string,
  needsAsStyleArrayHelper: { current: boolean },
): void {
  traverse(ast, {
    ObjectExpression(path: NodePath<t.ObjectExpression>) {
      if (!hasStyleArraySpread(path.node, path)) return;

      const result = flattenStyleObject(path.node, path, asStyleArrayHelperName, needsAsStyleArrayHelper);
      if (result.droppedPropertyKeys.length > 0) {
        messages.push({
          message: `[truss] Unsupported pattern: Dropped non-spread properties from style composition object (${result.droppedPropertyKeys.join(", ")})`,
          line: path.node.loc?.start.line ?? null,
        });
      }
      path.replaceWith(t.arrayExpression(result.elements));
    },
  });
}

/**
 * Normalize ternaries and logicals that mix `{}` with style arrays.
 *
 * After Css rewriting, `cond ? {} : Css.pt3.$` becomes `cond ? {} : [css.pt3]`.
 * If `{}` is left as-is, spreading the result into an array fails at runtime
 * ("not iterable"). This pass rewrites `{}` → `[]` in branches that coexist
 * with style arrays so both sides are consistently iterable.
 */
function normalizeMixedStyleTernaries(ast: t.File): void {
  traverse(ast, {
    ConditionalExpression(path: NodePath<t.ConditionalExpression>) {
      const consequentHasArray = expressionContainsArray(path.node.consequent, path);
      const alternateHasArray = expressionContainsArray(path.node.alternate, path);
      // Only act when one branch has an array and the other is `{}`
      if (consequentHasArray && isEmptyObjectExpression(path.node.alternate)) {
        path.node.alternate = t.arrayExpression([]);
      } else if (alternateHasArray && isEmptyObjectExpression(path.node.consequent)) {
        path.node.consequent = t.arrayExpression([]);
      }
    },
    LogicalExpression(path: NodePath<t.LogicalExpression>) {
      if (path.node.operator !== "||" && path.node.operator !== "??") return;
      // I.e. `styles || {}` where styles is a style array
      if (expressionContainsArray(path.node.left, path) && isEmptyObjectExpression(path.node.right)) {
        path.node.right = t.arrayExpression([]);
      }
    },
  });
}

/**
 * Lower `Css.spread({ ... })` marker calls into plain style arrays.
 *
 * `Css.spread(...)` is an explicit user annotation that says "this object is
 * style composition" — so we skip the `hasStyleArraySpread` detection gate
 * and always rewrite.
 */
function rewriteCssSpreadCalls(
  ast: t.File,
  cssBindingName: string,
  asStyleArrayHelperName: string,
  needsAsStyleArrayHelper: { current: boolean },
): void {
  traverse(ast, {
    CallExpression(path: NodePath<t.CallExpression>) {
      if (!isCssSpreadCall(path.node, cssBindingName)) return;

      const arg = path.node.arguments[0];
      if (!arg || t.isSpreadElement(arg) || !t.isExpression(arg) || path.node.arguments.length !== 1) return;

      const styleObject = unwrapStyleObjectExpression(arg);
      if (!styleObject) return;

      const result = flattenStyleObject(styleObject, path, asStyleArrayHelperName, needsAsStyleArrayHelper);
      path.replaceWith(t.arrayExpression(result.elements));
    },
  });
}

/**
 * Rewrite `Css.props(expr)` into `stylex.props(...expr)` (or `trussProps(stylex, ...expr)` in debug mode).
 *
 * This lets users pass style arrays through plain objects (e.g. for `{...attrs}` spreading)
 * without relying on the `css=` prop that the build plugin normally rewrites.
 */
function rewriteCssPropsCalls(options: RewriteSitesOptions): void {
  traverse(options.ast, {
    CallExpression(path: NodePath<t.CallExpression>) {
      if (!isCssPropsCall(path.node, options.cssBindingName)) return;

      const arg = path.node.arguments[0];
      if (!arg || t.isSpreadElement(arg) || !t.isExpression(arg) || path.node.arguments.length !== 1) return;

      // `Css.props(expr)` → `buildPropsCall([...expr])`
      const propsArgs: (t.Expression | t.SpreadElement)[] = [t.spreadElement(arg)];
      const line = path.node.loc?.start.line ?? null;
      path.replaceWith(buildPropsCall(propsArgs, line, options));
    },
  });
}

// ---------------------------------------------------------------------------
// Core: flatten a style composition object into an array of style refs
// ---------------------------------------------------------------------------

/**
 * Convert a style composition object `{ ...a, ...b }` into a flat array `[...a, ...b]`.
 *
 * Each spread argument is normalized (&&→ternary, {}→[], nested objects→arrays).
 * Known style arrays are flattened; unknown expressions are wrapped in `asStyleArray()`.
 */
function flattenStyleObject(
  expr: t.ObjectExpression,
  path: NodePath,
  asStyleArrayHelperName: string,
  needsAsStyleArrayHelper: { current: boolean },
): { elements: (t.Expression | t.SpreadElement | null)[]; droppedPropertyKeys: string[] } {
  const elements: (t.Expression | t.SpreadElement | null)[] = [];
  const droppedPropertyKeys: string[] = [];

  for (const prop of expr.properties) {
    if (!t.isSpreadElement(prop)) {
      droppedPropertyKeys.push(formatDroppedPropertyKey(prop)); // I.e. `{ ...Css.black.$, foo: true }`
      continue;
    }

    const normalized = normalizeStyleExpression(prop.argument);
    if (!normalized) {
      // Truly unrecognizable → asStyleArray fallback
      elements.push(
        t.spreadElement(buildUnknownSpreadFallback(prop.argument, asStyleArrayHelperName, needsAsStyleArrayHelper)),
      );
      continue;
    }

    if (t.isArrayExpression(normalized)) {
      elements.push(...normalized.elements); // I.e. `...[css.df, css.aic]` → `css.df, css.aic`
    } else if (isProvablyArray(normalized)) {
      elements.push(t.spreadElement(buildSafeSpreadArgument(normalized))); // I.e. `...(cond ? [css.df] : [])`
    } else {
      elements.push(
        t.spreadElement(buildUnknownSpreadFallback(normalized, asStyleArrayHelperName, needsAsStyleArrayHelper)), // I.e. `...borderBottomStyles`
      );
    }
  }

  return { elements, droppedPropertyKeys };
}

// ---------------------------------------------------------------------------
// Detection: does an object expression "touch" Css-derived style arrays?
// ---------------------------------------------------------------------------

/**
 * Check whether any spread in an object contains an array expression.
 *
 * This works as a reliable proxy for "touches Css expressions" because the earlier Css rewriting pass converts
 * `Css.foo.$` chains into array literals like `[css.df, css.aic]`.
 *
 * Spreading an array into an object literal is semantically nonsensical in user-written code (i.e. `{ ...[a, b] }`
 * produces `{ 0: a, 1: b }`), so any object spread containing an array literal must have been produced by our Css
 * rewriting — making it safe to rewrite the whole object into a style array.
 */
function hasStyleArraySpread(expr: t.ObjectExpression, path: NodePath): boolean {
  return expr.properties.some(function (prop) {
    return t.isSpreadElement(prop) && expressionContainsArray(prop.argument, path);
  });
}

/**
 * Recursively check whether an expression contains an array expression,
 * following simple variable bindings, member accesses, and function returns.
 */
function expressionContainsArray(expr: t.Expression, path: NodePath): boolean {
  if (t.isArrayExpression(expr)) return true;

  if (t.isConditionalExpression(expr)) {
    return expressionContainsArray(expr.consequent, path) || expressionContainsArray(expr.alternate, path);
  }

  if (t.isLogicalExpression(expr)) {
    return expressionContainsArray(expr.left, path) || expressionContainsArray(expr.right, path);
  }

  if (t.isObjectExpression(expr)) {
    return expr.properties.some(function (p) {
      return t.isSpreadElement(p) && expressionContainsArray(p.argument, path);
    });
  }

  // Follow variable bindings: `const base = [css.df]; { ...base }`
  if (t.isIdentifier(expr)) {
    const binding = path.scope.getBinding(expr.name);
    if (binding?.path.isVariableDeclarator()) {
      const init = binding.path.node.init;
      if (init) return expressionContainsArray(init, binding.path as unknown as NodePath);
    }
    return false;
  }

  // Follow member access: `styles.wrapper` where `const styles = { wrapper: [css.df] }`
  if (t.isMemberExpression(expr) && t.isIdentifier(expr.object)) {
    const binding = path.scope.getBinding(expr.object.name);
    if (binding?.path.isVariableDeclarator()) {
      const init = binding.path.node.init;
      if (init && t.isObjectExpression(init)) {
        const propName = getStaticMemberPropertyName(expr, path);
        if (propName) {
          for (const prop of init.properties) {
            if (!t.isObjectProperty(prop) || prop.computed) continue;
            if (!isMatchingPropertyName(prop.key, propName)) continue;
            if (t.isExpression(prop.value)) {
              return expressionContainsArray(prop.value, binding.path as unknown as NodePath);
            }
          }
        }
      }
    }
    return false;
  }

  // Follow local function returns: `getStyles()` where `function getStyles() { return [css.df]; }`
  if (t.isCallExpression(expr)) {
    const returnExpr = getCallReturnExpression(expr, path);
    return returnExpr ? expressionContainsArray(returnExpr, path) : false;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Normalization: convert style expressions into canonical array-like form
// ---------------------------------------------------------------------------

/**
 * Normalize a style expression so conditional branches use arrays instead of objects.
 *
 * Converts `&&` to ternary with `[]` fallback, `{}` to `[]`, and accepts
 * identifiers/members/calls as-is (they're assumed to be style arrays in context).
 */
function normalizeStyleExpression(expr: t.Expression): t.Expression | null {
  if (t.isArrayExpression(expr)) return expr; // I.e. `[css.df]`

  if (isEmptyObjectExpression(expr)) return t.arrayExpression([]); // I.e. `{}`

  if (t.isLogicalExpression(expr) && expr.operator === "&&") {
    const consequent = normalizeStyleExpression(expr.right);
    if (!consequent) return null;
    return t.conditionalExpression(expr.left, consequent, t.arrayExpression([])); // I.e. `active && [css.blue]`
  }

  if (t.isLogicalExpression(expr) && (expr.operator === "||" || expr.operator === "??")) {
    const left = normalizeStyleExpression(expr.left);
    const right = normalizeStyleBranch(expr.right);
    if (!left || !right) return null;
    return t.logicalExpression(expr.operator, left, right); // I.e. `hover || base`
  }

  if (t.isConditionalExpression(expr)) {
    const consequent = normalizeStyleBranch(expr.consequent);
    const alternate = normalizeStyleBranch(expr.alternate);
    if (!consequent || !alternate) return null;
    return t.conditionalExpression(expr.test, consequent, alternate); // I.e. `cond ? [css.blue] : {}`
  }

  // Identifiers, member expressions, and calls are accepted as style arrays
  if (t.isIdentifier(expr) || t.isMemberExpression(expr) || t.isCallExpression(expr)) {
    return expr; // I.e. `baseStyles`, `styles.wrapper`, `getStyles()`
  }

  return null;
}

/** Normalize a branch in a conditional style expression. */
function normalizeStyleBranch(expr: t.Expression): t.Expression | null {
  if (isEmptyObjectExpression(expr)) return t.arrayExpression([]); // I.e. `cond ? [css.blue] : {}`

  if (t.isObjectExpression(expr)) {
    // Nested style objects in branches: `cond ? { ...Css.bb.$ } : {}`
    if (expr.properties.length === 0) return t.arrayExpression([]);
    const allSpreads = expr.properties.every(function (p) {
      return t.isSpreadElement(p);
    });
    if (!allSpreads) return null;
    // Build a simple inline array from the spreads
    const elements: (t.Expression | t.SpreadElement | null)[] = [];
    for (const prop of expr.properties) {
      const spread = prop as t.SpreadElement;
      const normalized = normalizeStyleExpression(spread.argument);
      if (!normalized) return null;
      if (t.isArrayExpression(normalized)) {
        elements.push(...normalized.elements);
      } else {
        elements.push(t.spreadElement(buildSafeSpreadArgument(normalized)));
      }
    }
    return t.arrayExpression(elements);
  }

  return normalizeStyleExpression(expr);
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

/** Unwrap TS wrappers so `Css.spread({ ... } as const)` is still recognized. */
function unwrapStyleObjectExpression(expr: t.Expression): t.ObjectExpression | null {
  if (t.isObjectExpression(expr)) return expr;
  if (t.isTSAsExpression(expr) || t.isTSSatisfiesExpression(expr) || t.isTSNonNullExpression(expr)) {
    return unwrapStyleObjectExpression(expr.expression);
  }
  return null;
}

/** Match static object property names. */
function isMatchingPropertyName(key: t.Expression | t.Identifier | t.PrivateName, name: string): boolean {
  return (t.isIdentifier(key) && key.name === name) || (t.isStringLiteral(key) && key.value === name);
}

/** Check for `{}` fallback branches that should become `[]`. */
function isEmptyObjectExpression(expr: t.Expression): boolean {
  return t.isObjectExpression(expr) && expr.properties.length === 0;
}

/**
 * Check whether an expression is structurally guaranteed to evaluate to an array.
 *
 * Unlike `expressionContainsArray` (which follows bindings), this is a pure
 * structural check on the AST — no scope resolution. Used to decide whether a
 * spread can be emitted directly (`...expr`) or needs `asStyleArray` wrapping.
 */
function isProvablyArray(expr: t.Expression): boolean {
  if (t.isArrayExpression(expr)) return true;
  if (t.isParenthesizedExpression(expr)) return isProvablyArray(expr.expression);
  if (t.isConditionalExpression(expr)) {
    return isProvablyArray(expr.consequent) && isProvablyArray(expr.alternate);
  }
  if (t.isLogicalExpression(expr)) {
    return isProvablyArray(expr.left) && isProvablyArray(expr.right);
  }
  return false;
}

/** Convert unknown spread values into safe iterable fallbacks via `asStyleArray(...)`. */
function buildUnknownSpreadFallback(
  expr: t.Expression,
  asStyleArrayHelperName: string,
  needsAsStyleArrayHelper: { current: boolean },
): t.Expression {
  needsAsStyleArrayHelper.current = true;
  return t.callExpression(t.identifier(asStyleArrayHelperName), [expr]); // I.e. `asStyleArray(xss)`
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
    if (!binding?.path.isVariableDeclarator()) return null;
    const init = binding.path.node.init;
    return t.isStringLiteral(init) ? init.value : null;
  }

  return null;
}

/** Resolve the return expression of a call, checking local functions and callback args. */
function getCallReturnExpression(expr: t.CallExpression, path: NodePath): t.Expression | null {
  const localReturnExpr = getLocalFunctionReturnExpression(expr, path);
  if (localReturnExpr) return localReturnExpr;

  const firstArg = expr.arguments[0];
  if (
    firstArg &&
    !t.isSpreadElement(firstArg) &&
    (t.isArrowFunctionExpression(firstArg) || t.isFunctionExpression(firstArg))
  ) {
    return getFunctionLikeReturnExpression(firstArg); // I.e. `useMemo(() => ({ ...baseStyles }), deps)`
  }

  return null;
}

/** Resolve a local function call's return expression. */
function getLocalFunctionReturnExpression(expr: t.CallExpression, path: NodePath): t.Expression | null {
  if (!t.isIdentifier(expr.callee)) return null;

  const binding = path.scope.getBinding(expr.callee.name);
  if (!binding) return null;

  if (binding.path.isFunctionDeclaration()) {
    return getFunctionLikeReturnExpression(binding.path.node);
  }

  if (binding.path.isVariableDeclarator()) {
    const init = binding.path.node.init;
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
