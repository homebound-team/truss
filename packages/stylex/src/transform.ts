import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";
import type { TrussMapping, ResolvedSegment } from "./types";
import {
  resolveChain,
  resolveFullChain,
  pseudoName,
  wrapDefsWithPseudo,
  UnsupportedPatternError,
  type ChainNode,
  type ResolvedChain,
  type ResolvedChainPart,
} from "./resolve-chain";

// Handle CJS/ESM interop for babel packages
const traverse = (typeof _traverse === "function" ? _traverse : (_traverse as any).default) as typeof _traverse;
const generate = (typeof _generate === "function" ? _generate : (_generate as any).default) as typeof _generate;

export interface TransformResult {
  code: string;
  map?: any;
}

/**
 * The core transform function. Given a source file's code and the truss mapping,
 * finds all `Css.*.$` expressions and rewrites them into file-local
 * `stylex.create()` + `stylex.props()` calls.
 *
 * Returns null if the file doesn't use Css.
 */
export function transformTruss(code: string, filename: string, mapping: TrussMapping): TransformResult | null {
  // Fast bail: skip files that don't reference Css
  if (!code.includes("Css")) return null;

  const ast = parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
    sourceFilename: filename,
  });

  // Step 1: Find the Css import binding name
  const cssBindingName = findCssImportBinding(ast);
  if (!cssBindingName) return null;

  // Step 2: Collect all Css expression sites
  const sites: ExpressionSite[] = [];
  const errors: string[] = [];

  traverse(ast, {
    // Look for `.<something>` where the chain starts from the Css binding
    // We need to find the topmost expression that ends with `.$`
    MemberExpression(path) {
      // We only care about the terminal `.$` accessor
      if (!t.isIdentifier(path.node.property, { name: "$" })) return;
      if (path.node.computed) return;

      // Walk up to find the full expression (in case it's inside a JSX expression)
      // Then walk down from Css to collect the chain
      const fullExpr = path.node;
      const chain = extractChain(fullExpr.object, cssBindingName);
      if (!chain) return;

      // Check if we've already processed a parent of this node
      // (avoid processing the same chain twice)
      const parentPath = path.parentPath;
      if (parentPath && parentPath.isMemberExpression() && t.isIdentifier(parentPath.node.property, { name: "$" })) {
        return; // This is an intermediate `.$` that's part of a larger expression
      }

      try {
        const resolvedChain = resolveFullChain(chain, mapping);
        sites.push({
          path,
          resolvedChain,
          chain,
        });
      } catch (err) {
        if (err instanceof UnsupportedPatternError) {
          errors.push(err.message);
          sites.push({
            path,
            resolvedChain: { parts: [], markers: [] },
            chain,
            error: err.message,
          });
        } else {
          throw err;
        }
      }
    },
  });

  if (sites.length === 0) return null;

  // Pick the stylex.create variable name: prefer "css", fall back to "css_"
  const createVarName = isNameUsed(ast, "css") ? "css_" : "css";

  // Step 3: Build the deduped stylex.create entries from all sites
  const createEntries = new Map<string, CreateEntrySpec>();
  let needsMaybeInc = false;
  /** Named markers used across all sites — need `const __truss_marker_X = stylex.defineMarker()` */
  const namedMarkers = new Set<string>();

  for (const site of sites) {
    collectSegmentsIntoEntries(site.resolvedChain, createEntries);
    // Check if any segment needs maybeInc or ancestor pseudo markers
    for (const part of site.resolvedChain.parts) {
      const segs = part.type === "unconditional" ? part.segments : [...part.thenSegments, ...part.elseSegments];
      for (const seg of segs) {
        if (seg.incremented && seg.dynamicProps) needsMaybeInc = true;
        if (seg.ancestorPseudo?.marker) namedMarkers.add(seg.ancestorPseudo.marker);
      }
    }
  }

  function collectSegmentsIntoEntries(chain: ResolvedChain, entries: Map<string, CreateEntrySpec>) {
    for (const part of chain.parts) {
      const segs = part.type === "unconditional" ? part.segments : [...part.thenSegments, ...part.elseSegments];
      for (const seg of segs) {
        if (seg.dynamicProps) {
          if (!entries.has(seg.key)) {
            entries.set(seg.key, {
              key: seg.key,
              dynamic: { props: seg.dynamicProps, pseudo: seg.pseudo },
            });
          }
        } else {
          if (!entries.has(seg.key)) {
            entries.set(seg.key, { key: seg.key, defs: seg.defs, ancestorPseudo: seg.ancestorPseudo });
          }
        }
      }
    }
    // Collect named markers for defineMarker declarations
    for (const m of chain.markers) {
      if (m.name) {
        namedMarkers.add(m.name);
      }
    }
  }

  // Step 4: Generate the AST modifications
  // 4a: Build the stylex.create object expression
  const createProperties: t.ObjectProperty[] = [];
  for (const [, entry] of createEntries) {
    if (entry.dynamic) {
      // Dynamic: (v) => ({ prop: v }) or with pseudo: (v) => ({ prop: { default: null, ":hover": v } })
      const paramId = t.identifier("v");
      const bodyProps: t.ObjectProperty[] = [];
      for (const prop of entry.dynamic.props) {
        if (entry.dynamic.pseudo) {
          bodyProps.push(
            t.objectProperty(
              t.identifier(prop),
              t.objectExpression([
                t.objectProperty(t.identifier("default"), t.nullLiteral()),
                t.objectProperty(t.stringLiteral(entry.dynamic.pseudo), paramId),
              ]),
            ),
          );
        } else {
          bodyProps.push(t.objectProperty(t.identifier(prop), paramId));
        }
      }
      const arrowFn = t.arrowFunctionExpression([paramId], t.objectExpression(bodyProps));
      createProperties.push(t.objectProperty(t.identifier(entry.key), arrowFn));
    } else if (entry.ancestorPseudo && entry.defs) {
      // Ancestor pseudo entry: wrap each prop value in { default: null, [stylex.when.ancestor(...)]: value }
      const ap = entry.ancestorPseudo;
      const whenCallArgs: t.Expression[] = [t.stringLiteral(ap.pseudo)];
      if (ap.marker) {
        whenCallArgs.push(t.identifier(markerVarName(ap.marker)));
      }
      // stylex.when.ancestor(":hover") or stylex.when.ancestor(":hover", __truss_marker_row)
      const whenCall = t.callExpression(
        t.memberExpression(t.memberExpression(t.identifier("stylex"), t.identifier("when")), t.identifier("ancestor")),
        whenCallArgs,
      );

      const props: t.ObjectProperty[] = [];
      for (const [prop, value] of Object.entries(entry.defs)) {
        const propKey = isValidIdentifier(prop) ? t.identifier(prop) : t.stringLiteral(prop);
        props.push(
          t.objectProperty(
            propKey,
            t.objectExpression([
              t.objectProperty(t.identifier("default"), t.nullLiteral()),
              t.objectProperty(whenCall, valueToAst(value), true),
            ]),
          ),
        );
      }
      createProperties.push(t.objectProperty(t.identifier(entry.key), t.objectExpression(props)));
    } else if (entry.defs) {
      // Static entry
      createProperties.push(t.objectProperty(t.identifier(entry.key), defsToAst(entry.defs)));
    }
  }

  // 4b: Build `const css = stylex.create({ ... })`
  const stylexId = t.identifier("stylex");
  const createCall = t.callExpression(t.memberExpression(stylexId, t.identifier("create")), [
    t.objectExpression(createProperties),
  ]);
  const createDecl = t.variableDeclaration("const", [t.variableDeclarator(t.identifier(createVarName), createCall)]);

  // 4c: Add `import * as stylex from "@stylexjs/stylex"` at the top
  const stylexImport = t.importDeclaration(
    [t.importNamespaceSpecifier(t.identifier("stylex"))],
    t.stringLiteral("@stylexjs/stylex"),
  );

  // 4d: If we need maybeInc, add a helper function
  let maybeIncDecl: t.VariableDeclaration | null = null;
  if (needsMaybeInc) {
    // function maybeInc(inc) { return typeof inc === "string" ? inc : `${inc * INCREMENT}px`; }
    const incParam = t.identifier("inc");
    const body = t.blockStatement([
      t.returnStatement(
        t.conditionalExpression(
          t.binaryExpression("===", t.unaryExpression("typeof", incParam), t.stringLiteral("string")),
          incParam,
          t.templateLiteral(
            [t.templateElement({ raw: "", cooked: "" }, false), t.templateElement({ raw: "px", cooked: "px" }, true)],
            [t.binaryExpression("*", incParam, t.numericLiteral(mapping.increment))],
          ),
        ),
      ),
    ]);
    const fn = t.arrowFunctionExpression([incParam], body);
    maybeIncDecl = t.variableDeclaration("const", [t.variableDeclarator(t.identifier("__maybeInc"), fn)]);
  }

  // Step 5: Rewrite each site
  for (const site of sites) {
    if (site.error) {
      // Replace with a throwing expression
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

    // Build the stylex.props(...refs) arguments from the resolved chain
    const propsArgs = buildPropsArgsFromChain(site.resolvedChain, mapping, createVarName);

    // Check if this expression is used as a css prop value
    const parentPath = site.path.parentPath;
    if (
      parentPath &&
      parentPath.isJSXExpressionContainer() &&
      parentPath.parentPath &&
      parentPath.parentPath.isJSXAttribute() &&
      t.isJSXIdentifier(parentPath.parentPath.node.name, { name: "css" })
    ) {
      // css={Css.df.$} → {...stylex.props(css.df)}
      const propsCall = t.callExpression(t.memberExpression(t.identifier("stylex"), t.identifier("props")), propsArgs);

      // Check for sibling className attribute on the same JSX element
      const attrPath = parentPath.parentPath;
      const openingElement = attrPath.parentPath;
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
            // Remove the className attribute
            attrs.splice(i, 1);
            break;
          }
        }
      }

      let spreadExpr: t.Expression;
      if (existingClassNameExpr) {
        // Merge: ((__r) => ({...__r, className: (existingClassName + " " + (__r.className || "")).trim()}))( stylex.props(...) )
        const rId = t.identifier("__r");
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
        const body = t.objectExpression([
          t.spreadElement(rId),
          t.objectProperty(t.identifier("className"), mergedClassName),
        ]);
        const iife = t.callExpression(t.arrowFunctionExpression([rId], body), [propsCall]);
        spreadExpr = iife;
      } else {
        spreadExpr = propsCall;
      }

      const spreadAttr = t.jsxSpreadAttribute(spreadExpr);

      // Replace the css={...} JSX attribute with {...stylex.props(...)}
      attrPath.replaceWith(spreadAttr);
    } else if (
      parentPath &&
      parentPath.isJSXExpressionContainer() &&
      parentPath.parentPath &&
      parentPath.parentPath.isJSXAttribute() &&
      t.isJSXIdentifier(parentPath.parentPath.node.name, { name: "css" }) === false
    ) {
      // Non-css prop usage: just replace with the array of refs
      site.path.replaceWith(t.arrayExpression(propsArgs));
    } else {
      // Variable assignment or other expression: const s = Css.df.$ → const s = [css.df]
      site.path.replaceWith(t.arrayExpression(propsArgs));
    }
  }

  // Step 6: Handle spread patterns in css={[...Css.df.$, ...xss]}
  // We need a second pass to find JSX attributes with css={[...]} arrays
  rewriteCssArrayExpressions(ast, cssBindingName);

  // Step 7: Insert imports and the stylex.create declaration
  const body = ast.program.body;

  // Find insertion point (after last import)
  let lastImportIndex = -1;
  for (let i = 0; i < body.length; i++) {
    if (t.isImportDeclaration(body[i])) {
      lastImportIndex = i;
    }
  }

  // Remove the Css import if it only imported Css
  removeCssImport(ast, cssBindingName);

  // Re-find lastImportIndex after potential removal
  lastImportIndex = -1;
  for (let i = 0; i < body.length; i++) {
    if (t.isImportDeclaration(body[i])) {
      lastImportIndex = i;
    }
  }

  // Insert stylex import
  body.splice(lastImportIndex + 1, 0, stylexImport);

  // Insert maybeInc helper if needed
  if (maybeIncDecl) {
    body.splice(lastImportIndex + 2, 0, maybeIncDecl);
  }

  let insertOffset = lastImportIndex + 2 + (maybeIncDecl ? 1 : 0);

  // Insert named marker declarations: const __truss_marker_X = stylex.defineMarker()
  for (const markerName of namedMarkers) {
    const defineCall = t.callExpression(t.memberExpression(t.identifier("stylex"), t.identifier("defineMarker")), []);
    const decl = t.variableDeclaration("const", [
      t.variableDeclarator(t.identifier(markerVarName(markerName)), defineCall),
    ]);
    body.splice(insertOffset, 0, decl);
    insertOffset++;
  }

  // Insert stylex.create declaration
  if (createProperties.length > 0) {
    body.splice(insertOffset, 0, createDecl);
  }

  // Generate the output code
  const output = generate(ast, {
    sourceFileName: filename,
    retainLines: false,
  });

  return { code: output.code, map: output.map };
}

// ── AST Helpers ───────────────────────────────────────────────────────

interface ExpressionSite {
  path: any; // NodePath<t.MemberExpression>
  resolvedChain: ResolvedChain;
  chain: ChainNode[];
  error?: string;
}

interface CreateEntrySpec {
  key: string;
  defs?: Record<string, unknown>;
  dynamic?: { props: string[]; pseudo: string | null };
  /** If set, this entry uses stylex.when.ancestor() as the computed property key */
  ancestorPseudo?: { pseudo: string; marker?: string };
}

/**
 * Check if a name is already used as a top-level binding in the file.
 */
function isNameUsed(ast: t.File, name: string): boolean {
  for (const node of ast.program.body) {
    if (t.isVariableDeclaration(node)) {
      for (const decl of node.declarations) {
        if (t.isIdentifier(decl.id, { name })) return true;
      }
    } else if (t.isImportDeclaration(node)) {
      for (const spec of node.specifiers) {
        if (spec.local.name === name) return true;
      }
    } else if (t.isFunctionDeclaration(node) && node.id?.name === name) {
      return true;
    }
  }
  return false;
}

/**
 * Find the local binding name for `Css` from import declarations.
 * Looks for: `import { Css } from "..."` where the source contains "Css" or the package name.
 */
function findCssImportBinding(ast: t.File): string | null {
  for (const node of ast.program.body) {
    if (!t.isImportDeclaration(node)) continue;
    for (const spec of node.specifiers) {
      if (t.isImportSpecifier(spec) && t.isIdentifier(spec.imported, { name: "Css" })) {
        return spec.local.name;
      }
    }
  }
  return null;
}

/**
 * Remove the Css import specifier. If it was the only specifier, remove the whole import.
 * Keep other specifiers (Palette, CssProp, etc.).
 */
function removeCssImport(ast: t.File, cssBinding: string): void {
  for (let i = 0; i < ast.program.body.length; i++) {
    const node = ast.program.body[i];
    if (!t.isImportDeclaration(node)) continue;

    const cssSpecIndex = node.specifiers.findIndex((s) => t.isImportSpecifier(s) && s.local.name === cssBinding);
    if (cssSpecIndex === -1) continue;

    if (node.specifiers.length === 1) {
      // Only Css was imported — remove the entire import
      ast.program.body.splice(i, 1);
    } else {
      // Remove just the Css specifier
      node.specifiers.splice(cssSpecIndex, 1);
    }
    return;
  }
}

/**
 * Extract the chain of getters/calls from a member expression down to the Css binding.
 * Returns null if the chain doesn't start from the Css binding.
 *
 * E.g., for `Css.df.aic`, returns [{ type: "getter", name: "df" }, { type: "getter", name: "aic" }]
 */
function extractChain(node: t.Expression, cssBinding: string): ChainNode[] | null {
  const chain: ChainNode[] = [];

  let current: t.Expression = node;

  while (true) {
    if (t.isIdentifier(current, { name: cssBinding })) {
      // We've reached the Css root
      chain.reverse();
      return chain;
    }

    if (t.isMemberExpression(current) && !current.computed && t.isIdentifier(current.property)) {
      const name = current.property.name;

      if (name === "else") {
        chain.push({ type: "else" });
      } else {
        chain.push({ type: "getter", name });
      }
      current = current.object as t.Expression;
      continue;
    }

    if (
      t.isCallExpression(current) &&
      t.isMemberExpression(current.callee) &&
      !current.callee.computed &&
      t.isIdentifier(current.callee.property)
    ) {
      const name = current.callee.property.name;

      if (name === "if") {
        chain.push({
          type: "if",
          conditionNode: current.arguments[0] as t.Expression,
        });
        current = current.callee.object as t.Expression;
        continue;
      }

      chain.push({
        type: "call",
        name,
        args: current.arguments as (t.Expression | t.SpreadElement)[],
      });
      current = current.callee.object as t.Expression;
      continue;
    }

    // Unknown node shape — not a Css chain
    return null;
  }
}

/**
 * Build the array of arguments for `stylex.props(...)` from a resolved chain
 * (which may contain conditional parts).
 */
function buildPropsArgsFromChain(chain: ResolvedChain, mapping: TrussMapping, varName: string): t.Expression[] {
  const args: t.Expression[] = [];

  // Prepend marker expressions: stylex.defaultMarker() or named marker var
  for (const m of chain.markers) {
    if (m.name) {
      args.push(t.identifier(markerVarName(m.name)));
    } else {
      // stylex.defaultMarker()
      args.push(t.callExpression(t.memberExpression(t.identifier("stylex"), t.identifier("defaultMarker")), []));
    }
  }

  for (const part of chain.parts) {
    if (part.type === "unconditional") {
      args.push(...buildPropsArgs(part.segments, mapping, varName));
    } else {
      // Conditional: cond ? thenRef : elseRef
      const thenArgs = buildPropsArgs(part.thenSegments, mapping, varName);
      const elseArgs = buildPropsArgs(part.elseSegments, mapping, varName);

      if (thenArgs.length === 1 && elseArgs.length === 1) {
        args.push(t.conditionalExpression(part.conditionNode, thenArgs[0], elseArgs[0]));
      } else if (thenArgs.length === 0 && elseArgs.length === 0) {
        // Both empty — skip
      } else {
        // Wrap: ...(cond ? [a, b] : [c, d])
        args.push(
          t.spreadElement(
            t.conditionalExpression(part.conditionNode, t.arrayExpression(thenArgs), t.arrayExpression(elseArgs)),
          ) as any,
        );
      }
    }
  }
  return args;
}

/**
 * Build the array of arguments for `stylex.props(...)` from resolved segments (no conditionals).
 */
function buildPropsArgs(segments: ResolvedSegment[], mapping: TrussMapping, varName: string): t.Expression[] {
  const args: t.Expression[] = [];

  for (const seg of segments) {
    const ref = t.memberExpression(t.identifier(varName), t.identifier(seg.key));

    if (seg.dynamicProps && seg.argNode) {
      // Dynamic: css.mt(maybeInc(x)) or css.mt(x)
      let argExpr: t.Expression;
      if (seg.incremented) {
        argExpr = t.callExpression(t.identifier("__maybeInc"), [seg.argNode]);
      } else {
        // For non-incremented, cast to string: String(value)
        argExpr = t.callExpression(t.identifier("String"), [seg.argNode]);
      }
      args.push(t.callExpression(ref, [argExpr]));
    } else {
      // Static: css.df
      args.push(ref);
    }
  }

  return args;
}

/**
 * Convert a defs object (Record<string, unknown>) into an AST ObjectExpression.
 * Handles nested objects (for pseudo-class syntax like { default: null, ":hover": value }).
 */
function defsToAst(defs: Record<string, unknown>): t.ObjectExpression {
  const properties: t.ObjectProperty[] = [];

  for (const [key, value] of Object.entries(defs)) {
    const keyNode = isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key);

    if (value === null) {
      properties.push(t.objectProperty(keyNode, t.nullLiteral()));
    } else if (typeof value === "string") {
      properties.push(t.objectProperty(keyNode, t.stringLiteral(value)));
    } else if (typeof value === "number") {
      properties.push(t.objectProperty(keyNode, t.numericLiteral(value)));
    } else if (typeof value === "object" && value !== null) {
      properties.push(t.objectProperty(keyNode, defsToAst(value as Record<string, unknown>)));
    }
  }

  return t.objectExpression(properties);
}

function isValidIdentifier(s: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s);
}

/** Variable name for a named marker: "row" → "__truss_marker_row" */
function markerVarName(name: string): string {
  return `__truss_marker_${name}`;
}

/** Convert a single value (string/number/null) to an AST node. */
function valueToAst(value: unknown): t.Expression {
  if (value === null) return t.nullLiteral();
  if (typeof value === "string") return t.stringLiteral(value);
  if (typeof value === "number") return t.numericLiteral(value);
  if (typeof value === "object" && value !== null) return defsToAst(value as Record<string, unknown>);
  return t.stringLiteral(String(value));
}

/**
 * Second pass: rewrite css={[...Css.df.$, ...xss]} patterns.
 * After the first pass, Css.df.$ has been replaced with [css.df].
 * So css={[[css.df], ...xss]} needs to become {...stylex.props(css.df, ...xss)}.
 */
function rewriteCssArrayExpressions(ast: t.File, _cssBinding: string): void {
  traverse(ast, {
    JSXAttribute(path) {
      if (!t.isJSXIdentifier(path.node.name, { name: "css" })) return;
      const value = path.node.value;
      if (!t.isJSXExpressionContainer(value)) return;
      const expr = value.expression;
      if (!t.isArrayExpression(expr)) return;

      // Flatten: each element that's a spread of an array gets inlined,
      // each element that's a spread of something else stays as a spread
      const propsArgs: t.Expression[] = [];

      for (const el of expr.elements) {
        if (t.isSpreadElement(el)) {
          const arg = el.argument;
          if (t.isArrayExpression(arg)) {
            // Inline the array contents: [...[css.df, css.aic]] → css.df, css.aic
            for (const inner of arg.elements) {
              if (inner && !t.isSpreadElement(inner)) {
                propsArgs.push(inner);
              } else if (inner && t.isSpreadElement(inner)) {
                propsArgs.push(t.spreadElement(inner.argument) as any);
              }
            }
          } else {
            // External ref: ...xss → spread into stylex.props
            propsArgs.push(t.spreadElement(arg) as any);
          }
        } else if (el && !t.isSpreadElement(el)) {
          propsArgs.push(el);
        }
      }

      // Replace css={[...]} with {...stylex.props(...)}
      const propsCall = t.callExpression(
        t.memberExpression(t.identifier("stylex"), t.identifier("props")),
        propsArgs as t.Expression[],
      );
      path.replaceWith(t.jsxSpreadAttribute(propsCall));
    },
  });
}
