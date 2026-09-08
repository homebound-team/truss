import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { basename } from "path";
import type { TrussMapping, ResolvedSegment } from "./types";
import { chainSegments, resolveFullChain, type CssChainReferenceResolver, type ResolvedChain } from "./resolve-chain";
import { generate, parseModule, traverse } from "./babel-utils";
import {
  extractChain,
  extractDollarChain,
  findCssBuilderBinding,
  findCssImportBinding,
  findImportDeclaration,
  findNamedImportBinding,
  insertAfterLeadingImports,
  isCssMethodCall,
  removeCssImport,
  replaceCssImportWithNamedImports,
  reservePreferredName,
  unwrapExpression,
  upsertNamedImports,
  type NamedImport,
} from "./ast-utils";
import { collectAtomicRules, generateCssText, type AtomicRule } from "./emit-css";
import { buildMaybeIncDeclaration, buildRuntimeLookupDeclaration } from "./emit-style-hash";
import {
  rewriteExpressionSites,
  type ExpressionSite,
  type RuntimeHelperName,
  type RuntimeHelpers,
} from "./rewrite-sites";

export interface TransformResult {
  code: string;
  map?: unknown;
  /** The generated CSS text for this file's Truss usages. */
  css: string;
  /** The atomic CSS rules collected during this transform, keyed by class name. */
  rules: Map<string, AtomicRule>;
}

export interface TransformTrussOptions {
  debug?: boolean;
  /** When true, inject `__injectTrussCSS(cssText)` call for jsdom/test environments. */
  injectCss?: boolean;
}

const RUNTIME_MODULE = "@homebound/truss/runtime";

/** Runtime imports are emitted in this order regardless of which helper the rewrite reached first. */
const RUNTIME_HELPER_ORDER: RuntimeHelperName[] = ["trussProps", "mergeProps", "TrussDebugInfo", "maybeCssVar"];

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
  // Fast bail: skip files that don't reference Css or use JSX css= attributes
  if (!code.includes("Css") && !code.includes("css=")) return null;

  const ast = parseModule(code, filename);

  // Step 1: Find the Css binding name — either from an import or a local `new CssBuilder(...)` declaration.
  // May be null when the file only has JSX css= attributes without importing Css.
  const cssImportBinding = findCssImportBinding(ast);
  const cssBindingName = cssImportBinding ?? findCssBuilderBinding(ast);

  // Step 2: Collect all Css.*.$  expression sites AND detect Css.props() / JSX css= in a single pass.
  const sites: ExpressionSite[] = [];
  const errorMessages: Array<{ message: string; line: number | null }> = [];
  let hasCssPropsCall = false;
  let hasBuildtimeJsxCssAttribute = false;
  // Module-scope names, so injected helpers and imports can avoid collisions
  let usedTopLevelNames = new Set<string>();

  traverse(ast, {
    Program(path: NodePath<t.Program>) {
      usedTopLevelNames = new Set(Object.keys(path.scope.bindings));
    },
    // -- Css.*.$  chain collection --
    MemberExpression(path: NodePath<t.MemberExpression>) {
      if (!cssBindingName) return;

      const chain = extractDollarChain(path.node, cssBindingName);
      if (!chain) return;
      if (isInsideWhenObjectValue(path, cssBindingName)) {
        return;
      }

      const parentPath = path.parentPath;
      if (parentPath && parentPath.isMemberExpression() && t.isIdentifier(parentPath.node.property, { name: "$" })) {
        return;
      }

      const resolveCssChainReference = buildCssChainReferenceResolver(path, cssBindingName);
      const resolvedChain = resolveFullChain({ mapping, cssBindingName, resolveCssChainReference }, chain);
      sites.push({ path, resolvedChain });

      const line = path.node.loc?.start.line ?? null;
      for (const err of resolvedChain.errors) {
        errorMessages.push({ message: err, line });
      }
    },
    // -- Css.props() detection (so we don't bail early when there are no Css.*.$ sites) --
    CallExpression(path: NodePath<t.CallExpression>) {
      if (cssBindingName && isCssMethodCall(path.node, cssBindingName, "props")) {
        hasCssPropsCall = true;
      }
    },
    // -- JSX css={...} attribute detection (so we don't bail when there are only css props) --
    JSXAttribute(path: NodePath<t.JSXAttribute>) {
      if (!t.isJSXIdentifier(path.node.name, { name: "css" })) return;
      hasBuildtimeJsxCssAttribute = true;
    },
  });

  if (sites.length === 0 && !hasCssPropsCall && !hasBuildtimeJsxCssAttribute) return null;

  // Step 3: Collect atomic rules for CSS generation
  const chains = sites.map((s) => s.resolvedChain);
  const { rules, needsMaybeInc, needsMaybeCssVar } = collectAtomicRules(chains, mapping);
  const cssText = generateCssText(rules);

  // Step 4: Reserve local names for injected helpers
  const runtime = createRuntimeHelpers(ast, usedTopLevelNames);
  const maybeIncHelperName = needsMaybeInc ? reservePreferredName(usedTopLevelNames, "__maybeInc") : null;
  const maybeCssVarHelperName = needsMaybeCssVar ? runtime.use("maybeCssVar") : null;

  // Collect typography runtime lookups
  const runtimeLookups = collectRuntimeLookups(chains);
  const runtimeLookupNames = new Map<string, string>();
  for (const lookupKey of runtimeLookups.keys()) {
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
    maybeCssVarHelperName,
    runtime,
    runtimeLookupNames,
  });

  // Step 6: Prepare runtime imports before removing the Css import.
  const runtimeImports = runtime.imports();
  if (options.injectCss) {
    runtimeImports.push({ importedName: "__injectTrussCSS", localName: "__injectTrussCSS" });
  }

  // Step 7: Remove/replace the Css import and inject runtime imports.
  // When Css comes from a local `new CssBuilder(...)` (tsup bundles), skip import removal.
  let reusedCssImportLine = false;
  if (cssImportBinding) {
    reusedCssImportLine =
      runtimeImports.length > 0 &&
      findImportDeclaration(ast, RUNTIME_MODULE) === null &&
      replaceCssImportWithNamedImports(ast, cssImportBinding, RUNTIME_MODULE, runtimeImports);

    if (!reusedCssImportLine) {
      removeCssImport(ast, cssImportBinding);
    }
  }

  if (!reusedCssImportLine) {
    upsertNamedImports(ast, RUNTIME_MODULE, runtimeImports);
  }

  // Step 8: Insert helper declarations after imports
  const declarationsToInsert: t.Statement[] = [];
  if (maybeIncHelperName) {
    declarationsToInsert.push(buildMaybeIncDeclaration(maybeIncHelperName));
  }
  // Insert runtime lookup tables for typography
  for (const [lookupKey, segmentsByName] of runtimeLookups) {
    const lookupName = runtimeLookupNames.get(lookupKey);
    if (!lookupName) continue;
    declarationsToInsert.push(buildRuntimeLookupDeclaration(lookupName, segmentsByName, mapping));
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

  insertAfterLeadingImports(ast, declarationsToInsert);

  const output = generate(ast, {
    sourceFileName: filename,
    sourceMaps: true,
    retainLines: false,
  });

  const outputCode = preserveBlankLineAfterImports(code, output.code);

  return { code: outputCode, map: output.map, css: cssText, rules };
}

/**
 * Track which `@homebound/truss/runtime` helpers the rewrite ends up calling.
 *
 * `use()` reuses an existing import's local name when the module already imports the helper,
 * otherwise reserves a collision-free local name; `imports()` lists the helpers that still
 * need an import statement, in canonical order.
 */
function createRuntimeHelpers(
  ast: t.File,
  usedTopLevelNames: Set<string>,
): RuntimeHelpers & { imports(): NamedImport[] } {
  const localNames = new Map<RuntimeHelperName, string>();
  const missingImports = new Map<RuntimeHelperName, NamedImport>();

  return {
    use(name) {
      let localName = localNames.get(name);
      if (localName === undefined) {
        const existing = findNamedImportBinding(ast, name, RUNTIME_MODULE);
        localName = existing ?? reservePreferredName(usedTopLevelNames, name);
        if (!existing) missingImports.set(name, { importedName: name, localName });
        localNames.set(name, localName);
      }
      return localName;
    },
    imports() {
      return RUNTIME_HELPER_ORDER.flatMap((name) => {
        const entry = missingImports.get(name);
        return entry ? [entry] : [];
      });
    },
  };
}

/** True when `path` sits inside the object literal of a `Css.…when({ ... })` call, whose values are resolved by the outer chain. */
function isInsideWhenObjectValue(path: NodePath<t.MemberExpression>, cssBindingName: string): boolean {
  let current: NodePath<t.Node> | null = path.parentPath;

  while (current) {
    if (current.isObjectExpression()) {
      const parent = current.parentPath;
      if (
        parent?.isCallExpression() &&
        parent.node.arguments[0] === current.node &&
        t.isMemberExpression(parent.node.callee) &&
        !parent.node.callee.computed &&
        t.isIdentifier(parent.node.callee.property, { name: "when" }) &&
        extractChain(parent.node.callee.object as t.Expression, cssBindingName)
      ) {
        return true;
      }
    }

    current = current.parentPath;
  }

  return false;
}

function buildCssChainReferenceResolver(
  path: NodePath<t.MemberExpression>,
  cssBindingName: string,
): CssChainReferenceResolver {
  return (node) => {
    return resolveCssChainReference(path, node, cssBindingName, new Set<string>());
  };
}

/**
 * Follow lexical bindings like `const same = Css.blue.$` back to their original
 * `Css.*.$` expression so `when({ ":hover": same })` can resolve the same as
 * an inline value. This stays in the transform layer because it depends on Babel
 * scope/NodePath lookup, not just chain semantics.
 */
function resolveCssChainReference(
  path: NodePath<t.Node>,
  node: t.Expression,
  cssBindingName: string,
  seen: Set<string>,
): ReturnType<typeof extractChain> {
  const value = unwrapExpression(node);

  if (t.isMemberExpression(value)) {
    return extractDollarChain(value, cssBindingName);
  }

  if (!t.isIdentifier(value) || seen.has(value.name)) {
    return null;
  }

  const binding = path.scope.getBinding(value.name);
  if (!binding?.constant || !binding.path.isVariableDeclarator()) {
    return null;
  }

  const init = binding.path.node.init;
  if (!init || !t.isExpression(init)) {
    return null;
  }

  seen.add(value.name);
  return resolveCssChainReference(binding.path, init, cssBindingName, seen);
}

/** Collect typography runtime lookups from all resolved chains, keyed by lookup name. */
function collectRuntimeLookups(chains: ResolvedChain[]): Map<string, Record<string, ResolvedSegment[]>> {
  const lookups = new Map<string, Record<string, ResolvedSegment[]>>();
  for (const seg of chains.flatMap((chain) => chainSegments(chain))) {
    if (seg.kind === "typography" && !lookups.has(seg.lookupKey)) {
      lookups.set(seg.lookupKey, seg.segmentsByName);
    }
  }
  return lookups;
}

/** Babel's generator drops the blank line after the import block; put it back when the source had one. */
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
