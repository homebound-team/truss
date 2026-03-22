import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import _generate from "@babel/generator";
import * as t from "@babel/types";
import { basename } from "path";
import type { TrussMapping, ResolvedSegment } from "./types";
import { resolveFullChain, type ResolvedChain } from "./resolve-chain";
import {
  collectTopLevelBindings,
  reservePreferredName,
  findCssImportBinding,
  removeCssImport,
  hasCssMethodCall,
  findNamedImportBinding,
  findImportDeclaration,
  replaceCssImportWithNamedImports,
  upsertNamedImports,
  extractChain,
} from "./ast-utils";
import {
  collectAtomicRules,
  generateCssText,
  buildMaybeIncDeclaration,
  buildRuntimeLookupDeclaration,
} from "./emit-truss";
import { rewriteExpressionSites, type ExpressionSite } from "./rewrite-sites";

// Babel packages are CJS today; normalize default interop across loaders.
const traverse = ((_traverse as unknown as { default?: typeof _traverse }).default ?? _traverse) as typeof _traverse;
const generate = ((_generate as unknown as { default?: typeof _generate }).default ?? _generate) as typeof _generate;

export interface TransformResult {
  code: string;
  map?: unknown;
  /** The generated CSS text for this file's Truss usages. */
  css: string;
  /** The atomic CSS rules collected during this transform, keyed by class name. */
  rules: Map<string, import("./emit-truss").AtomicRule>;
}

export interface TransformTrussOptions {
  debug?: boolean;
  /** When true, inject `__injectTrussCSS(cssText)` call for jsdom/test environments. */
  injectCss?: boolean;
}

/**
 * The core transform function. Given a source file's code and the truss mapping,
 * finds all `Css.*.$` expressions and rewrites them into Truss-native style hash
 * objects and `trussProps()`/`mergeProps()` runtime calls.
 *
 * Returns null if the file doesn't use Css.
 */
export function transformTruss(
  code: string,
  filename: string,
  mapping: TrussMapping,
  options: TransformTrussOptions = {},
): TransformResult | null {
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

      // Use skipMerge: true so each segment retains its individual condition fields
      const resolvedChain = resolveFullChain(chain, mapping, { skipMerge: true });
      sites.push({ path, resolvedChain });

      const line = path.node.loc?.start.line ?? null;
      for (const err of resolvedChain.errors) {
        errorMessages.push({ message: err, line });
      }
    },
  });

  // Also check for Css.props(...) calls which need rewriting even without Css.$ sites
  const hasCssPropsCall = hasCssMethodCall(ast, cssBindingName, "props");
  if (sites.length === 0 && !hasCssPropsCall) return null;

  // Step 3: Collect atomic rules for CSS generation
  const chains = sites.map((s) => s.resolvedChain);
  const { rules, needsMaybeInc } = collectAtomicRules(chains, mapping);
  const cssText = generateCssText(rules);

  // Step 4: Reserve local names for injected helpers
  const usedTopLevelNames = collectTopLevelBindings(ast);
  const maybeIncHelperName = needsMaybeInc ? reservePreferredName(usedTopLevelNames, "__maybeInc") : null;
  const existingMergePropsHelperName = findNamedImportBinding(ast, "@homebound/truss/runtime", "mergeProps");
  const mergePropsHelperName = existingMergePropsHelperName ?? reservePreferredName(usedTopLevelNames, "mergeProps");
  const needsMergePropsHelper = { current: false };
  const existingTrussPropsHelperName = findNamedImportBinding(ast, "@homebound/truss/runtime", "trussProps");
  const trussPropsHelperName = existingTrussPropsHelperName ?? reservePreferredName(usedTopLevelNames, "trussProps");
  const needsTrussPropsHelper = { current: false };
  const existingTrussDebugInfoName = findNamedImportBinding(ast, "@homebound/truss/runtime", "TrussDebugInfo");
  const trussDebugInfoName = existingTrussDebugInfoName ?? reservePreferredName(usedTopLevelNames, "TrussDebugInfo");
  const needsTrussDebugInfo = { current: false };

  // Collect typography runtime lookups
  const runtimeLookupNames = new Map<string, string>();
  const runtimeLookups = collectRuntimeLookups(chains);
  for (const [lookupKey] of runtimeLookups) {
    runtimeLookupNames.set(lookupKey, reservePreferredName(usedTopLevelNames, `__${lookupKey}`));
  }

  // Step 5: Rewrite Css sites in-place
  rewriteExpressionSites({
    ast,
    sites,
    cssBindingName,
    filename: basename(filename),
    debug: options.debug ?? false,
    mapping,
    maybeIncHelperName,
    mergePropsHelperName,
    needsMergePropsHelper,
    trussPropsHelperName,
    needsTrussPropsHelper,
    trussDebugInfoName,
    needsTrussDebugInfo,
    skippedCssPropMessages: errorMessages,
    runtimeLookupNames,
  });

  // Step 6: Prepare runtime imports before removing the Css import.
  const runtimeImports: Array<{ importedName: string; localName: string }> = [];
  if (needsTrussPropsHelper.current) {
    runtimeImports.push({ importedName: "trussProps", localName: trussPropsHelperName });
  }
  if (needsMergePropsHelper.current) {
    runtimeImports.push({ importedName: "mergeProps", localName: mergePropsHelperName });
  }
  if (needsTrussDebugInfo.current) {
    runtimeImports.push({ importedName: "TrussDebugInfo", localName: trussDebugInfoName });
  }
  if (options.injectCss) {
    runtimeImports.push({ importedName: "__injectTrussCSS", localName: "__injectTrussCSS" });
  }

  // Step 7: Remove/replace the Css import and inject runtime imports.
  const reusedCssImportLine =
    runtimeImports.length > 0 &&
    findImportDeclaration(ast, "@homebound/truss/runtime") === null &&
    replaceCssImportWithNamedImports(ast, cssBindingName, "@homebound/truss/runtime", runtimeImports);

  if (!reusedCssImportLine) {
    removeCssImport(ast, cssBindingName);
  }

  if (runtimeImports.length > 0) {
    if (!reusedCssImportLine) {
      upsertNamedImports(ast, "@homebound/truss/runtime", runtimeImports);
    }
  }

  // Step 8: Insert helper declarations after imports
  const declarationsToInsert: t.Statement[] = [];
  if (maybeIncHelperName) {
    declarationsToInsert.push(buildMaybeIncDeclaration(maybeIncHelperName, mapping.increment));
  }

  // Insert runtime lookup tables for typography
  for (const [lookupKey, lookup] of runtimeLookups) {
    const lookupName = runtimeLookupNames.get(lookupKey);
    if (!lookupName) continue;
    declarationsToInsert.push(buildRuntimeLookupDeclaration(lookupName, lookup.segmentsByName, mapping));
  }

  // Inject __injectTrussCSS call if requested
  if (options.injectCss && cssText.length > 0) {
    declarationsToInsert.push(
      t.expressionStatement(t.callExpression(t.identifier("__injectTrussCSS"), [t.stringLiteral(cssText)])),
    );
  }

  // Emit console.error calls for any unsupported patterns
  for (const { message, line } of errorMessages) {
    const location = line !== null ? `${filename}:${line}` : filename;
    const logMessage = `${message} (${location})`;
    declarationsToInsert.push(
      t.expressionStatement(
        t.callExpression(t.memberExpression(t.identifier("console"), t.identifier("error")), [
          t.stringLiteral(logMessage),
        ]),
      ),
    );
  }

  if (declarationsToInsert.length > 0) {
    const insertIndex = ast.program.body.findIndex(function (node) {
      return !t.isImportDeclaration(node);
    });
    ast.program.body.splice(insertIndex === -1 ? ast.program.body.length : insertIndex, 0, ...declarationsToInsert);
  }

  const output = generate(ast, {
    sourceFileName: filename,
    sourceMaps: true,
    retainLines: false,
  });

  const outputCode = preserveBlankLineAfterImports(code, output.code);

  return { code: outputCode, map: output.map, css: cssText, rules };
}

/** Collect typography runtime lookups from all resolved chains. */
function collectRuntimeLookups(
  chains: ResolvedChain[],
): Map<string, { segmentsByName: Record<string, ResolvedSegment[]> }> {
  const lookups = new Map<string, { segmentsByName: Record<string, ResolvedSegment[]> }>();
  for (const chain of chains) {
    for (const part of chain.parts) {
      const segs = part.type === "unconditional" ? part.segments : [...part.thenSegments, ...part.elseSegments];
      for (const seg of segs) {
        if (seg.typographyLookup && !lookups.has(seg.typographyLookup.lookupKey)) {
          lookups.set(seg.typographyLookup.lookupKey, {
            segmentsByName: seg.typographyLookup.segmentsByName,
          });
        }
      }
    }
  }
  return lookups;
}

function preserveBlankLineAfterImports(input: string, output: string): string {
  const inputLines = input.split("\n");
  const outputLines = output.split("\n");
  const lastInputImportLine = findLastImportLine(inputLines);
  const lastOutputImportLine = findLastImportLine(outputLines);

  if (lastInputImportLine === -1 || lastOutputImportLine === -1) {
    return output;
  }

  const inputHasBlankLineAfterImports = inputLines[lastInputImportLine + 1]?.trim() === "";
  const outputHasBlankLineAfterImports = outputLines[lastOutputImportLine + 1]?.trim() === "";
  if (!inputHasBlankLineAfterImports || outputHasBlankLineAfterImports) {
    return output;
  }

  outputLines.splice(lastOutputImportLine + 1, 0, "");
  return outputLines.join("\n");
}

function findLastImportLine(lines: string[]): number {
  let lastImportLine = -1;
  for (let index = 0; index < lines.length; index++) {
    if (lines[index].trimStart().startsWith("import ")) {
      lastImportLine = index;
    }
  }
  return lastImportLine;
}
