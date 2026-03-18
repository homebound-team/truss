import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";
import type { TrussMapping } from "./types";
import { resolveFullChain } from "./resolve-chain";
import {
  collectTopLevelBindings,
  reservePreferredName,
  findCssImportBinding,
  removeCssImport,
  findStylexNamespaceImport,
  findLastImportIndex,
  insertStylexNamespaceImport,
  extractChain,
} from "./ast-utils";
import {
  collectCreateData,
  buildCreateProperties,
  buildMaybeIncDeclaration,
  buildCreateDeclaration,
} from "./emit-stylex";
import { rewriteExpressionSites, type ExpressionSite } from "./rewrite-sites";

// Babel packages are CJS today; normalize default interop across loaders.
const traverse = ((_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse) as typeof _traverse;
const generate = ((_generate as unknown as { default?: typeof _generate }).default ?? _generate) as typeof _generate;

export interface TransformResult {
  code: string;
  map?: unknown;
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
  /** Error messages with source location info, to be emitted as console.error calls. */
  const errorMessages: Array<{ message: string; line: number | null }> = [];

  traverse(ast, {
    MemberExpression(path: NodePath<t.MemberExpression>) {
      if (!t.isIdentifier(path.node.property, { name: "$" })) return;
      if (path.node.computed) return;

      const chain = extractChain(path.node.object, cssBindingName);
      if (!chain) return;

      const parentPath = path.parentPath;
      if (parentPath && parentPath.isMemberExpression() && t.isIdentifier(parentPath.node.property, { name: "$" })) {
        return;
      }

      const resolvedChain = resolveFullChain(chain, mapping);
      sites.push({ path, resolvedChain });

      // Collect any errors from this chain with source location
      const line = path.node.loc?.start.line ?? null;
      for (const err of resolvedChain.errors) {
        errorMessages.push({ message: err, line });
      }
    },
  });

  if (sites.length === 0) return null;

  // Step 3: Collect stylex.create entries and helper needs
  const { createEntries, needsMaybeInc } = collectCreateData(sites.map((s) => s.resolvedChain));

  // Reserve local names we might inject at the top level
  // We do this up front so helper/style variable names are deterministic and
  // cannot collide with user code in the same module.
  const usedTopLevelNames = collectTopLevelBindings(ast);
  const existingStylexNamespace = findStylexNamespaceImport(ast);
  const stylexNamespaceName = existingStylexNamespace ?? reservePreferredName(usedTopLevelNames, "stylex");
  const createVarName = reservePreferredName(usedTopLevelNames, "css", "css_");
  const maybeIncHelperName = needsMaybeInc ? reservePreferredName(usedTopLevelNames, "__maybeInc") : null;

  const createProperties = buildCreateProperties(createEntries, stylexNamespaceName);

  // Step 4: Rewrite Css sites in-place
  rewriteExpressionSites({
    ast,
    sites,
    createVarName,
    stylexNamespaceName,
    maybeIncHelperName,
  });

  // Step 5: Remove Css import now that all usages were rewritten
  removeCssImport(ast, cssBindingName);

  // Step 6: Ensure namespace stylex import exists
  if (!findStylexNamespaceImport(ast)) {
    insertStylexNamespaceImport(ast, stylexNamespaceName);
  }

  // Step 7: Hoist marker declarations that are referenced in stylex.create entries.
  // stylex.create uses computed keys like `[stylex.when.ancestor(":hover", row)]`
  // which reference marker variables — these must be declared before stylex.create.
  const markerVarNames = collectReferencedMarkerNames(createEntries);
  const hoistedMarkerDecls = hoistMarkerDeclarations(ast, markerVarNames);

  // Step 8: Insert helper declarations after imports
  const declarationsToInsert: t.Statement[] = [];
  if (maybeIncHelperName) {
    declarationsToInsert.push(buildMaybeIncDeclaration(maybeIncHelperName, mapping.increment));
  }
  // Hoisted marker declarations go before stylex.create so they're in scope
  declarationsToInsert.push(...hoistedMarkerDecls);
  if (createProperties.length > 0) {
    declarationsToInsert.push(buildCreateDeclaration(createVarName, stylexNamespaceName, createProperties));
  }

  // Step 8: Emit console.error calls for any unsupported patterns
  for (const { message, line } of errorMessages) {
    const location = line !== null ? `${filename}:${line}` : filename;
    const logMessage = `${message} (${location})`;
    const consoleError = t.expressionStatement(
      t.callExpression(t.memberExpression(t.identifier("console"), t.identifier("error")), [
        t.stringLiteral(logMessage),
      ]),
    );
    declarationsToInsert.push(consoleError);
  }

  if (declarationsToInsert.length > 0) {
    const insertIndex = findLastImportIndex(ast) + 1;
    ast.program.body.splice(insertIndex, 0, ...declarationsToInsert);
  }

  const output = generate(ast, {
    sourceFileName: filename,
    retainLines: false,
  });

  return { code: output.code, map: output.map };
}

/**
 * Collect the names of marker variables referenced in `whenPseudo.markerNode`
 * across all stylex.create entries. These need to be hoisted above stylex.create.
 */
function collectReferencedMarkerNames(
  createEntries: Map<string, { whenPseudo?: { markerNode?: t.Node } }>,
): Set<string> {
  const names = new Set<string>();
  for (const [, entry] of createEntries) {
    if (entry.whenPseudo?.markerNode && entry.whenPseudo.markerNode.type === "Identifier") {
      names.add(entry.whenPseudo.markerNode.name);
    }
  }
  return names;
}

/**
 * Find top-level variable declarations for the given names, remove them from
 * their original position in the AST, and return them for reinsertion above
 * the stylex.create call.
 *
 * This handles `const row = stylex.defineMarker()` being declared after code
 * that uses it in a Css.when() chain — the stylex.create computed key
 * `[stylex.when.ancestor(":hover", row)]` needs `row` to be in scope.
 */
function hoistMarkerDeclarations(ast: t.File, names: Set<string>): t.Statement[] {
  if (names.size === 0) return [];
  const hoisted: t.Statement[] = [];
  const remaining = new Set(names);

  for (let i = ast.program.body.length - 1; i >= 0; i--) {
    if (remaining.size === 0) break;
    const node = ast.program.body[i];

    if (!t.isVariableDeclaration(node)) continue;

    // Check if any declarator in this statement matches a marker name
    const matchingDeclarators: t.VariableDeclarator[] = [];
    const otherDeclarators: t.VariableDeclarator[] = [];
    for (const decl of node.declarations) {
      if (t.isIdentifier(decl.id) && remaining.has(decl.id.name)) {
        matchingDeclarators.push(decl);
        remaining.delete(decl.id.name);
      } else {
        otherDeclarators.push(decl);
      }
    }

    if (matchingDeclarators.length === 0) continue;

    if (otherDeclarators.length === 0) {
      // Entire statement is marker declarations — remove it
      ast.program.body.splice(i, 1);
      hoisted.push(node);
    } else {
      // Split: keep non-marker declarators in place, hoist the marker ones
      node.declarations = otherDeclarators;
      hoisted.push(t.variableDeclaration(node.kind, matchingDeclarators));
    }
  }

  // Reverse so they appear in original source order
  hoisted.reverse();
  return hoisted;
}
