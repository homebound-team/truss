import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";
import type { TrussMapping } from "./types";
import { resolveFullChain, UnsupportedPatternError } from "./resolve-chain";
import {
  collectTopLevelBindings,
  reservePreferredName,
  markerVariableBaseName,
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
  buildMarkerDeclarations,
  buildCreateDeclaration,
} from "./emit-stylex";
import { rewriteExpressionSites, type ExpressionSite } from "./rewrite-sites";

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

  traverse(ast, {
    MemberExpression(path) {
      if (!t.isIdentifier(path.node.property, { name: "$" })) return;
      if (path.node.computed) return;

      const chain = extractChain(path.node.object, cssBindingName);
      if (!chain) return;

      const parentPath = path.parentPath;
      if (parentPath && parentPath.isMemberExpression() && t.isIdentifier(parentPath.node.property, { name: "$" })) {
        return;
      }

      try {
        const resolvedChain = resolveFullChain(chain, mapping);
        sites.push({
          path,
          resolvedChain,
        });
      } catch (err) {
        if (err instanceof UnsupportedPatternError) {
          sites.push({
            path,
            resolvedChain: { parts: [], markers: [] },
            error: err.message,
          });
        } else {
          throw err;
        }
      }
    },
  });

  if (sites.length === 0) return null;

  // Step 3: Collect stylex.create entries and helper needs
  const { createEntries, needsMaybeInc, namedMarkers } = collectCreateData(sites.map((s) => s.resolvedChain));

  // Reserve local names we might inject at the top level
  // We do this up front so helper/style variable names are deterministic and
  // cannot collide with user code in the same module.
  const usedTopLevelNames = collectTopLevelBindings(ast);
  const existingStylexNamespace = findStylexNamespaceImport(ast);
  const stylexNamespaceName = existingStylexNamespace ?? reservePreferredName(usedTopLevelNames, "stylex");
  const createVarName = reservePreferredName(usedTopLevelNames, "css", "css_");
  const maybeIncHelperName = needsMaybeInc ? reservePreferredName(usedTopLevelNames, "__maybeInc") : null;

  const markerVarNames = new Map<string, string>();
  for (const markerName of namedMarkers) {
    markerVarNames.set(markerName, reservePreferredName(usedTopLevelNames, markerVariableBaseName(markerName)));
  }

  // Fallback name is only used for defensive robustness; every named marker
  // should have a reserved entry above.
  const markerVarForName = (name: string): string => markerVarNames.get(name) ?? markerVariableBaseName(name);

  const createProperties = buildCreateProperties(createEntries, stylexNamespaceName, markerVarForName);

  // Step 4: Rewrite Css sites in-place
  rewriteExpressionSites({
    ast,
    sites,
    createVarName,
    stylexNamespaceName,
    maybeIncHelperName,
    markerVarForName,
  });

  // Step 5: Remove Css import now that all usages were rewritten
  removeCssImport(ast, cssBindingName);

  // Step 6: Ensure namespace stylex import exists
  if (!findStylexNamespaceImport(ast)) {
    insertStylexNamespaceImport(ast, stylexNamespaceName);
  }

  // Step 7: Insert helper declarations after imports
  const declarationsToInsert: t.Statement[] = [];
  if (maybeIncHelperName) {
    declarationsToInsert.push(buildMaybeIncDeclaration(maybeIncHelperName, mapping.increment));
  }
  declarationsToInsert.push(...buildMarkerDeclarations(namedMarkers, stylexNamespaceName, markerVarForName));
  if (createProperties.length > 0) {
    declarationsToInsert.push(buildCreateDeclaration(createVarName, stylexNamespaceName, createProperties));
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
