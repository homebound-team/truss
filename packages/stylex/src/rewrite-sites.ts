import _traverse from "@babel/traverse";
import * as t from "@babel/types";
import type { ResolvedSegment } from "./types";
import type { ResolvedChain } from "./resolve-chain";

// Handle CJS/ESM interop for babel packages
const traverse = (typeof _traverse === "function" ? _traverse : (_traverse as any).default) as typeof _traverse;

export interface ExpressionSite {
  path: any; // NodePath<t.MemberExpression>
  resolvedChain: ResolvedChain;
  error?: string;
}

export interface RewriteSitesOptions {
  ast: t.File;
  sites: ExpressionSite[];
  createVarName: string;
  stylexNamespaceName: string;
  maybeIncHelperName: string | null;
  markerVarForName: (name: string) => string;
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
    if (site.error) {
      // Preserve the fail-fast behavior at runtime for unsupported patterns.
      const throwExpr = t.callExpression(
        t.arrowFunctionExpression(
          [],
          t.blockStatement([t.throwStatement(t.newExpression(t.identifier("Error"), [t.stringLiteral(site.error)]))]),
        ),
        [],
      );
      site.path.replaceWith(throwExpr);
      continue;
    }

    const propsArgs = buildPropsArgsFromChain(site.resolvedChain, options);
    const cssAttrPath = getCssAttributePath(site.path);

    if (cssAttrPath) {
      const propsCall = t.callExpression(
        t.memberExpression(t.identifier(options.stylexNamespaceName), t.identifier("props")),
        propsArgs,
      );

      const openingElement = cssAttrPath.parentPath;
      let existingClassNameExpr: t.Expression | null = null;

      if (openingElement && openingElement.isJSXOpeningElement()) {
        const attrs = openingElement.node.attributes;
        for (let i = 0; i < attrs.length; i++) {
          const attr = attrs[i];
          if (t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: "className" })) {
            if (t.isStringLiteral(attr.value)) {
              existingClassNameExpr = attr.value;
            } else if (t.isJSXExpressionContainer(attr.value) && t.isExpression(attr.value.expression)) {
              existingClassNameExpr = attr.value.expression;
            }
            attrs.splice(i, 1);
            break;
          }
        }
      }

      let spreadExpr: t.Expression;
      if (existingClassNameExpr) {
        const rId = t.identifier("__r");
        // Keep existing className values while appending StyleX-generated className.
        // We do this in a tiny IIFE so the generated expression remains a single
        // JSX spread without introducing extra statements.
        const mergedClassName = t.callExpression(
          t.memberExpression(
            t.binaryExpression(
              "+",
              t.binaryExpression("+", existingClassNameExpr, t.stringLiteral(" ")),
              t.logicalExpression("||", t.memberExpression(rId, t.identifier("className")), t.stringLiteral("")),
            ),
            t.identifier("trim"),
          ),
          [],
        );
        spreadExpr = t.callExpression(
          t.arrowFunctionExpression(
            [rId],
            t.objectExpression([t.spreadElement(rId), t.objectProperty(t.identifier("className"), mergedClassName)]),
          ),
          [propsCall],
        );
      } else {
        spreadExpr = propsCall;
      }

      cssAttrPath.replaceWith(t.jsxSpreadAttribute(spreadExpr));
      continue;
    }

    site.path.replaceWith(t.arrayExpression(propsArgs));
  }

  // Second pass: flatten `css={[...Css.x.$, ...xss]}`-style arrays after site rewrites.
  rewriteCssArrayExpressions(options.ast, options.stylexNamespaceName);
}

/**
 * Return the enclosing `css={...}` JSX attribute path for a transformed site,
 * or null when the site is in a non-`css` expression context.
 */
function getCssAttributePath(path: any): any | null {
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
    if (marker.name) {
      args.push(t.identifier(options.markerVarForName(marker.name)));
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

    if (thenArgs.length === 1 && elseArgs.length === 1) {
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
function buildPropsArgs(segments: ResolvedSegment[], options: RewriteSitesOptions): t.Expression[] {
  const args: t.Expression[] = [];

  for (const seg of segments) {
    const ref = t.memberExpression(t.identifier(options.createVarName), t.identifier(seg.key));

    if (seg.dynamicProps && seg.argNode) {
      let argExpr: t.Expression;
      if (seg.incremented && options.maybeIncHelperName) {
        argExpr = t.callExpression(t.identifier(options.maybeIncHelperName), [seg.argNode]);
      } else if (seg.incremented) {
        argExpr = seg.argNode as t.Expression;
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
 * Rewrite `css={[...a, ...b]}` to `...stylex.props(...)` by flattening nested
 * arrays produced by the first rewrite pass.
 */
function rewriteCssArrayExpressions(ast: t.File, stylexNamespaceName: string): void {
  traverse(ast, {
    JSXAttribute(path) {
      if (!t.isJSXIdentifier(path.node.name, { name: "css" })) return;
      const value = path.node.value;
      if (!t.isJSXExpressionContainer(value)) return;
      const expr = value.expression;
      if (!t.isArrayExpression(expr)) return;

      const propsArgs: (t.Expression | t.SpreadElement)[] = [];

      for (const el of expr.elements) {
        if (t.isSpreadElement(el)) {
          const arg = el.argument;
          if (t.isArrayExpression(arg)) {
            for (const inner of arg.elements) {
              if (!inner) continue;
              if (t.isSpreadElement(inner)) {
                propsArgs.push(t.spreadElement(inner.argument));
              } else {
                propsArgs.push(inner);
              }
            }
          } else {
            propsArgs.push(t.spreadElement(arg));
          }
        } else if (el) {
          propsArgs.push(el);
        }
      }

      const propsCall = t.callExpression(
        t.memberExpression(t.identifier(stylexNamespaceName), t.identifier("props")),
        propsArgs,
      );
      path.replaceWith(t.jsxSpreadAttribute(propsCall));
    },
  });
}
